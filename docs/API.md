# API Reference — MarketSphere

Base URL: `http://localhost:5000/api/v1` (local) — versioned under `/api/v1`
for every route in this document.

## Response envelope

Every response follows the same shape:

```json
{ "success": true, "message": "...", "data": { ... } }
```

Error responses:

```json
{ "success": false, "message": "...", "errors": ["optional field-level details"] }
```

## Authentication

Two tokens are involved:

- **Access token** — short-lived (15 min default), returned in the response
  body on login/refresh. Sent by the client on every subsequent request as
  `Authorization: Bearer <token>`.
- **Refresh token** — long-lived (7 days default), set automatically as an
  `httpOnly` cookie scoped to `/api/v1/auth`. Never touched by client-side
  JavaScript; the browser sends it automatically to `/auth/refresh` and
  `/auth/logout`.

---

## `POST /auth/register`

Creates a Customer or Vendor account. **Not available** for `super_admin`
or `delivery_partner` — see `docs/ARCHITECTURE.md` for why those roles
aren't self-service.

Rate limited (auth limiter: 20 req / 15 min per IP).

**Body**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "Password1", "role": "customer" }
```
`role` must be `"customer"` or `"vendor"`. Password requires ≥8 characters
with at least one letter and one number.

**201 Created**
```json
{ "success": true, "message": "Registration successful. Please check your email to verify your account.",
  "data": { "user": { "_id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "customer", "isEmailVerified": false, "isActive": true, "createdAt": "..." } } }
```

**Errors**: `400` validation failure · `409` email already registered

---

## `POST /auth/login`

Rate limited (auth limiter).

**Body**
```json
{ "email": "jane@example.com", "password": "Password1" }
```

**200 OK** — sets the `refreshToken` httpOnly cookie, returns the access token in the body
```json
{ "success": true, "message": "Login successful",
  "data": { "user": { "...": "..." }, "accessToken": "eyJhbGciOi..." } }
```

**Errors**: `401 "Invalid email or password"` — deliberately generic
whether the email doesn't exist or the password is wrong (prevents
account enumeration).

---

## `POST /auth/refresh`

No body — reads the `refreshToken` cookie automatically. Rate limited.

Rotates the refresh token on every call: the old one is invalidated and a
new one is issued (same rotation "family"). If a refresh token that was
already rotated away from is presented again, that's treated as reuse —
the **entire session family is revoked** and re-authentication is
required.

**200 OK** — sets a new rotated `refreshToken` cookie
```json
{ "success": true, "message": "Token refreshed",
  "data": { "user": { "...": "..." }, "accessToken": "eyJhbGciOi..." } }
```

**Errors**: `401` — no cookie, expired, invalid signature, or reuse detected. In every case the client should treat this as "session ended, show the login screen."

---

## `POST /auth/logout`

No body — reads the `refreshToken` cookie, revokes that specific token, clears the cookie. Always returns `200`, even if there was nothing to revoke (idempotent, safe to call speculatively on the client).

---

## `POST /auth/forgot-password`

Rate limited.

**Body**
```json
{ "email": "jane@example.com" }
```

**200 OK** — always the same response whether or not the account exists:
```json
{ "success": true, "message": "If an account with that email exists, a reset link has been sent.", "data": null }
```

In development, the reset link is logged to the server console (no real
email provider is wired up yet — see `docs/ARCHITECTURE.md` §7-equivalent
for the email abstraction).

---

## `POST /auth/reset-password`

Rate limited.

**Body**
```json
{ "token": "<raw token from the emailed link>", "newPassword": "NewPassword1" }
```

**200 OK** — also revokes every existing session (refresh token) for the account, so a stolen session can't survive a password reset.
```json
{ "success": true, "message": "Password reset successful. Please log in with your new password.", "data": null }
```

**Errors**: `400 "Invalid or expired reset token"`

---

## `GET /auth/verify-email/:token`

**200 OK**
```json
{ "success": true, "message": "Email verified successfully.", "data": null }
```

**Errors**: `400 "Invalid or expired verification link"`

---

## `GET /auth/me`

Requires `Authorization: Bearer <accessToken>`.

**200 OK**
```json
{ "success": true, "message": "Success",
  "data": { "user": { "_id": "...", "name": "...", "email": "...", "role": "...", "isEmailVerified": true, "isActive": true } } }
```

**Errors**: `401` — missing/invalid/expired token, or the account has been deactivated since the token was issued.

---

## Categories

Base path: `/categories`. Reads are public; writes require `super_admin`.

### `GET /categories`
Query: `?tree=true` returns a nested parent/children structure instead of
a flat list; `?includeInactive=true` includes disabled categories
(admin UIs pass this, the public storefront doesn't).

```json
{ "success": true, "data": { "categories": [ { "_id": "...", "name": "Electronics", "slug": "electronics", "parent": null, "isActive": true } ] } }
```

### `GET /categories/:slug`
Public single-category lookup by slug. `404` if not found.

### `POST /categories` — `super_admin` only
```json
{ "name": "Electronics", "description": "optional", "parent": null }
```
`201` on success. `400` if `parent` is set but doesn't exist.

### `PATCH /categories/:id` — `super_admin` only
Partial update — any subset of `name`, `description`, `parent`, `image`, `isActive`.

### `DELETE /categories/:id` — `super_admin` only
`409 Conflict` if the category still has subcategories or products — reassign or remove those first. This is a deliberate guard against orphaning products with a dangling category reference.

---

## Products

Base path: `/products`. Public browsing lives at the root; vendor/admin
management lives under `/products/manage` (registered first in the router
specifically so `/manage` is never swallowed as a `:slug` value).

### `GET /products` — public
Only ever returns `status: active` products, regardless of query params.

Query params: `q` (text search), `category` (ObjectId), `minPrice`,
`maxPrice`, `sort` (`newest` | `price_asc` | `price_desc` | `rating` |
`title_asc`, default `newest`), `page` (default `1`), `limit` (default
`20`, max `60`).

```json
{ "success": true, "data": { "products": [ { "...": "..." } ] }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

### `GET /products/:slug` — public
`404` unless the product exists **and** is `active` — a vendor's own
draft is invisible here even to that vendor; they view drafts through
`/products/manage/:id` instead.

### `GET /products/manage` — `vendor` or `super_admin`
Same filters as the public list, plus `status` and (admin-only) `vendor`.
**A vendor's `vendor` scope is always forced to their own id server-side**
— the query param is ignored/overridden for that role, never trusted.
Admins may optionally filter by `vendor` to inspect one seller's catalog.

### `GET /products/manage/:id` — `vendor` (own) or `super_admin`
`403` if a vendor requests a product they don't own.

### `POST /products/manage` — `vendor` only
Admins moderate existing listings rather than creating products on a
vendor's behalf, so this is vendor-only, not `vendorOrAdmin`.

```json
{
  "title": "Bluetooth Speaker",
  "category": "<categoryId>",
  "description": "optional",
  "status": "draft",
  "variants": [{ "sku": "SPK-001", "price": 49.99, "stock": 25, "attributes": { "color": "Black" } }]
}
```
`201` on success. `409` if any SKU is already in use **anywhere in the
catalog** — SKUs are globally unique, not just unique per product.

### `PATCH /products/manage/:id` — `vendor` (own) or `super_admin`
Partial update of `title`, `description`, `category`, `images`, `status`.
Does not touch variants — see the variant sub-resource routes below.

### `DELETE /products/manage/:id` — `vendor` (own) or `super_admin`

### Variant / SKU sub-resource — `vendor` (own) only
- `POST /products/manage/:id/variants` — add a variant. `409` on a duplicate SKU.
- `PATCH /products/manage/:id/variants/:variantId` — update price/stock/attributes/sku.
- `DELETE /products/manage/:id/variants/:variantId` — `400` if it's the product's last remaining variant (delete the product instead).

Every variant mutation recomputes the product's denormalized
`priceRange.{min,max}` before saving.

---

## `GET /health`

Unauthenticated. Returns process uptime and current MongoDB connection state — see `README.md` for the full URL.

---

## Coming in later phases

Vendor, order, cart, coupon, review, delivery, and analytics endpoints are
added as their respective phases ship (see `docs/ROADMAP.md`). This
document grows alongside them rather than being written speculatively
ahead of the code that implements each route.
