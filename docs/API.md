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

In development, the reset link is logged to the server console instead of
sent by a real provider — see `server/src/services/emailService.js`.

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

## `GET /health`

Unauthenticated. Returns process uptime and current MongoDB connection state — see `README.md` for the full URL.

---

## Categories

### `GET /categories`

Public. Always active-only, regardless of any query sent.

**200 OK**
```json
{ "success": true, "data": { "categories": [ { "_id": "...", "name": "Electronics", "slug": "electronics", "parent": null, "isActive": true } ] } }
```

### `GET /categories/:id`

Public. `400` if `:id` isn't a valid Mongo id, `404` if not found.

### `GET /categories/manage/all`

Requires `super_admin`. Every category, active or not — used for moderation/editing.

### `POST /categories`

Requires `super_admin`.

**Body**
```json
{ "name": "Headphones", "description": "optional", "parent": "<category id or omit>", "image": { "url": "https://...", "alt": "optional" } }
```

**201 Created** — `data.category`. Slug is generated from `name`; a duplicate name gets a `-2`, `-3`, ... suffix rather than an error.

**Errors**: `400` validation failure or nonexistent `parent` · `403` non-admin

### `PATCH /categories/:id`

Requires `super_admin`. Partial body — any subset of `name`, `description`, `parent`, `image`, `isActive`.

Setting `parent` is checked for cycles: a category cannot become its own ancestor, directly or transitively.

**Errors**: `400` — nonexistent parent, self-parenting, or a circular hierarchy · `404` category not found

### `DELETE /categories/:id`

Requires `super_admin`. Blocked (`409`) if the category has subcategories or any product assigned to it — deletion never cascades.

---

## Products

Two distinct surfaces: the **public storefront** (always active-only, no auth) and **managed** endpoints under `/products/manage` (vendor + admin, auth required). A vendor's own id is always forced server-side on managed routes — see `docs/SECURITY.md` §2 for why the `vendor` query parameter can't be used to see another vendor's products.

### `GET /products`

Public. Search, filter, sort, paginate — active products only.

**Query params**: `q` (text search), `category` (id), `minPrice`, `maxPrice`, `sort` (`newest` | `price_asc` | `price_desc` | `rating`, default `newest`), `page` (default 1), `limit` (default 20, max 100).

**200 OK**
```json
{ "success": true, "data": { "products": [ { "_id": "...", "title": "...", "slug": "...", "priceRange": { "min": 19.99, "max": 24.99 }, "variants": [...] } ] },
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

### `GET /products/slug/:slug`

Public. `404` if the product doesn't exist **or** isn't `active` — a draft or archived product is indistinguishable from a nonexistent one on this endpoint, by design.

### `GET /products/manage`

Requires `vendor` or `super_admin`. Vendor sees only their own products, any status. Admin may pass `?vendor=<id>` to filter to one vendor, or omit it to see everything.

Same query params as the public listing, plus `status` (filter by draft/active/archived — vendor and admin only, since the public listing is always active-only anyway).

### `GET /products/manage/:id`

Requires `vendor` or `super_admin`, plus ownership: a vendor gets `403` on any product they don't own, regardless of status.

### `POST /products/manage`

Requires `vendor` or `super_admin`.

**Body**
```json
{
  "title": "Mechanical Keyboard",
  "description": "...",
  "category": "<category id>",
  "images": [{ "url": "https://...", "alt": "optional" }],
  "variants": [{ "sku": "KB-001", "attributes": { "color": "black" }, "price": 79.99, "compareAtPrice": 99.99, "stock": 15 }]
}
```
At least one variant is required. SKUs must be globally unique across every vendor's products, and unique within the same request. New products start as `status: "draft"` — never visible on the public storefront until explicitly activated.

**Errors**: `400` validation failure, duplicate SKU within the same request, or nonexistent category · `403` customer/delivery_partner role · `409` SKU already used by another product

### `PATCH /products/manage/:id`

Requires ownership (or admin). Updates `title`, `description`, `category`, `images` — **not** variants (see the variant endpoints below) and not `status` (see the status endpoint). The slug is never regenerated on a title change, so existing product URLs don't break.

### `PATCH /products/manage/:id/status`

Requires ownership (or admin).

**Body**: `{ "status": "draft" | "active" | "archived" }`

Going to `active` requires at least one variant to exist (always true post-creation, but enforced defensively). This is also the moderation endpoint — an admin can archive any vendor's product regardless of ownership.

### `DELETE /products/manage/:id`

Requires ownership (or admin). Hard delete.

### `POST /products/manage/:id/variants`

Requires ownership (or admin). Adds one variant; recomputes `priceRange`.

**Body**: `{ "sku": "...", "attributes": {...}, "price": 10, "compareAtPrice": 15, "stock": 5 }`

**Errors**: `409` SKU already on this product or another product

### `PATCH /products/manage/:id/variants/:sku`

Requires ownership (or admin). Partial update to `price`, `compareAtPrice`, `stock`, `attributes`. Recomputes `priceRange`.

### `DELETE /products/manage/:id/variants/:sku`

Requires ownership (or admin). Rejected with `400` if it's the product's only remaining variant — delete the product instead of leaving it with zero variants.

---

## Coming in later phases

Vendor, order, cart, coupon, review, delivery, and analytics endpoints are
added as their respective phases ship (see `docs/ROADMAP.md`). This
document grows alongside the code that actually implements each route —
it does not describe endpoints ahead of their implementation.
