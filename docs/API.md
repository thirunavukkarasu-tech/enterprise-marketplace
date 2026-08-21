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

**Query params**: `withCounts` (`true`|`false`, default `false`) — adds a `productCount` field per category (active products only), computed with a single aggregation, not one query per category. Omit it and the response shape is identical to before this param existed.

**200 OK**
```json
{ "success": true, "data": { "categories": [ { "_id": "...", "name": "Electronics", "slug": "electronics", "parent": null, "isActive": true, "productCount": 12 } ] } }
```
(`productCount` only present when `withCounts=true`.)

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

**Query params**: `q` (text search), `category` (id), `minPrice`, `maxPrice`, `inStock` (`true`|`false` — `true` matches products with at least one variant in stock, `false` matches products where every variant is at zero; omit to not filter by stock at all), `vendor` (id, filters to one seller's storefront listing), `sort` (`newest` | `price_asc` | `price_desc` | `rating`, default `newest`), `page` (default 1), `limit` (default 20, max 100).

Every product in the response carries a `vendorStore` summary — the customer-facing store name/logo, looked up from the seller's `Vendor` profile (not the raw `vendor` field, which is a `User` id — see `docs/DATABASE.md` for why those are different collections). `vendorStore` is `null` if that vendor account hasn't completed onboarding (`POST /vendors/me`) yet; the product is still listed, just without a store byline.

**200 OK**
```json
{ "success": true, "data": { "products": [ { "_id": "...", "title": "...", "slug": "...", "priceRange": { "min": 19.99, "max": 24.99 }, "variants": [...], "vendorStore": { "storeName": "Acme Supplies", "logo": null, "isVerified": true } } ] },
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

### `GET /products/slug/:slug`

Public. `404` if the product doesn't exist **or** isn't `active` — a draft or archived product is indistinguishable from a nonexistent one on this endpoint, by design. Same `vendorStore` enrichment as the listing.

### `GET /products/manage`

Requires `vendor` or `super_admin`. Vendor sees only their own products, any status. Admin may pass `?vendor=<id>` to filter to one vendor, or omit it to see everything.

Same query params as the public listing (including `inStock`), plus `status` (filter by draft/active/archived — vendor and admin only, since the public listing is always active-only anyway). Managed responses do **not** include `vendorStore` — a vendor/admin managing their own listing doesn't need a storefront-branded summary of themselves.

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

## Vendors

Two surfaces: **self-service** (`vendor` role, scoped to the caller's own
profile — no vendor endpoint here ever takes an id from the client) and
**admin management** (`super_admin`, operates on any vendor by id). See
`docs/SECURITY.md` §4 for why this route separation, not just an
ownership check, is the IDOR defense here.

### `POST /vendors/me`

Requires `vendor` role. Onboards the caller's business profile — one per
account (`409` if one already exists).

**Body**
```json
{
  "storeName": "Acme Supplies",
  "legalBusinessName": "Acme Supplies LLC",
  "description": "optional",
  "businessEmail": "contact@acme.test",
  "businessPhone": "+1 555-123-4567",
  "address": { "line1": "123 Market St", "line2": "optional", "city": "Springfield", "state": "IL", "country": "USA", "postalCode": "62704" },
  "taxId": "optional",
  "logo": { "url": "https://...", "alt": "optional" },
  "banner": { "url": "https://...", "alt": "optional" }
}
```

**201 Created** — `data.vendor`, always `status: "pending"`, `isVerified: false` — never trusted from the request body even if sent.

**Errors**: `400` validation failure · `403` non-vendor role · `409` profile already exists

### `GET /vendors/me`

Requires `vendor` role. `404` if the caller hasn't onboarded yet — the
frontend uses this to decide whether to show the onboarding form or the
edit form.

### `PATCH /vendors/me`

Requires `vendor` role. Partial body — any subset of the onboarding
fields. `status`, `isVerified`, and all admin/review fields are absent
from the schema, not merely rejected — there's no code path that could
let one through.

### `GET /vendors/me/dashboard`

Requires `vendor` role.

**200 OK**
```json
{ "success": true, "data": {
  "vendor": { "...": "..." },
  "productCounts": { "total": 12, "active": 8, "draft": 3, "archived": 1 },
  "profileCompletion": 80,
  "recentProducts": [ { "_id": "...", "title": "...", "slug": "...", "status": "active", "priceRange": {...}, "createdAt": "..." } ],
  "notices": [ { "tone": "info", "message": "Add your first product to start selling." } ]
} }
```
`productCounts` and `recentProducts` are real `Product.countDocuments`/`find` queries scoped to the caller — never fabricated. `notices` surface status-relevant messages (pending review, rejection/suspension reason, "add your first product").

A vendor's own products are listed via the existing Phase 3 endpoint,
`GET /products/manage` (already vendor-scoped) — there's no second,
duplicate "my products" endpoint under `/vendors`.

### `GET /vendors`

Requires `super_admin`.

**Query params**: `q` (search store/legal name/business email), `status` (`pending`|`approved`|`rejected`|`suspended`), `isVerified` (`true`|`false`), `sort` (`newest`|`oldest`|`name_asc`|`name_desc`, default `newest`), `page`, `limit` (default 20, max 100).

**200 OK** — same `{ data: { vendors: [...] }, meta: {...} }` shape as the Phase 3 product listing.

### `GET /vendors/:id`

Requires `super_admin`. `400` on a malformed id, `404` if not found.

### `PATCH /vendors/:id/approve`

Requires `super_admin`. Legal only from `pending` or `rejected`. `400` on any other current status (e.g. already `approved`).

### `PATCH /vendors/:id/reject`

Requires `super_admin`. Legal only from `pending`.

**Body**: `{ "reason": "..." }` — 10–500 characters, required.

### `PATCH /vendors/:id/suspend`

Requires `super_admin`. Legal only from `approved`.

**Body**: `{ "reason": "..." }` — optional, but 10–500 characters if provided.

### `PATCH /vendors/:id/reactivate`

Requires `super_admin`. Legal only from `suspended` — moves back to `approved`.

### `PATCH /vendors/:id/verify`

Requires `super_admin`. Independent of the status transitions above —
callable regardless of current status.

**Body**: `{ "isVerified": true }` (or `false` to revoke).

---

## Users

Self-service only — there is no endpoint here (or anywhere in the app) that takes a user id from the client. Reading the current user is `GET /auth/me` (Phase 2); this is only the write side.

### `PATCH /users/me`

Requires authentication (any role).

**Body**: partial — any subset of `name`, `phone`. `role`, `email`, `isActive`, `isEmailVerified`, and every password/token field are absent from the schema, not merely rejected — there's no code path that could let one through (see `docs/SECURITY.md` §5).

**200 OK** — `data.user`

**Errors**: `400` validation failure (e.g. malformed phone number) · `401` no token

---

## Wishlist

Requires the `customer` role specifically — not "any authenticated user," matching how the rest of the app scopes role-flavored features (e.g. Phase 4's `/vendors/me`). Every route is scoped to the caller server-side; none ever takes a user id from the client.

### `GET /wishlist`

**200 OK** — `data.products`, an array of full product objects (only the fields a wishlist card needs: title, slug, images, priceRange, status, variants — never vendor/admin-internal fields).

### `POST /wishlist/:productId`

Adds a product. Adding an already-wishlisted product is a harmless no-op (`200`, not `409`) — a second click on a filled-in heart icon behaves the same as the first.

**Errors**: `404` product doesn't exist · `403` non-customer role

### `DELETE /wishlist/:productId`

Removes a product. Removing something not on the list is also a no-op, not an error.

Both add/remove return the updated `data.products` array — the frontend never needs a separate re-fetch after a mutation.

---

## Cart

Requires the `customer` role specifically (same reasoning as Wishlist). Every route is scoped to `req.user.id` server-side — no route here ever takes a user id from the client, so there's no request shape that could return or modify another customer's cart.

**Every price, subtotal, and total in every response below is calculated server-side from the live `Product`/variant data — never from anything the client sends.** `POST`/`PATCH` bodies only ever contain `productId`, `sku`, and `quantity`. Sending `price`, `subtotal`, `discountAmount`, or `total` in a request body has no effect — those fields don't exist in the validation schema, so they're silently ignored, not merely rejected.

### `GET /cart`

**Query params**: `shippingMethod` (`standard`|`express`, optional — affects the returned `shippingFee`/`grandTotal` preview; doesn't change anything stored).

**200 OK**
```json
{ "success": true, "data": { "cart": {
  "cartId": "...", "items": [ { "itemId": "...", "product": "...", "sku": "...", "quantity": 2, "title": "...", "currentPrice": 19.99, "availableStock": 8, "issue": null, "lineSubtotal": 39.98 } ],
  "itemCount": 2, "subtotal": 39.98, "discountAmount": 0, "taxAmount": 0, "shippingMethod": "standard", "shippingFee": 0, "grandTotal": 39.98,
  "hasBlockingIssues": false, "hasPriceChanges": false, "priceChangeMessage": null
} } }
```
A cart is created automatically (empty) the first time a customer's cart is requested — there's no separate "create cart" step. Every item carries an `issue` (`null`, or one of `product_unavailable`, `variant_unavailable`, `out_of_stock`, `insufficient_stock`, `price_changed`) so the frontend can explain *why* a line item isn't contributing to the total, rather than silently dropping it.

### `POST /cart/items`

**Body**: `{ "productId": "...", "sku": "...", "quantity": 1 }` (`quantity` defaults to 1, max 20 per item — see `MAX_CART_ITEM_QUANTITY`).

Adding a product/sku combination already in the cart **increments** the existing line's quantity rather than creating a duplicate row — validated against live stock as the new combined total, not just the delta.

**Errors**: `400` product doesn't exist, isn't active, the SKU doesn't exist on it, or the requested quantity (existing + new) exceeds available stock or the max-per-item cap.

### `PATCH /cart/items/:itemId`

**Body**: `{ "quantity": 3 }` — sets the quantity directly (not a delta). Re-validated against live stock at the moment of the request, since it may have sold down since the item was added.

### `DELETE /cart/items/:itemId`

Removes one line item. Idempotent — removing an item that's already gone returns `200`, not `404`.

### `DELETE /cart`

Empties the cart entirely. Same idempotent behavior.

---

## Addresses

Requires the `customer` role. Every lookup is scoped `{ _id: addressId, user: userId }` in one query — never a `findById` followed by a separate ownership check — so a customer addressing another customer's address id gets a `404`, not a `403` that would confirm the id exists.

### `GET /addresses` · `GET /addresses/:id` · `POST /addresses` · `PATCH /addresses/:id` · `DELETE /addresses/:id`

Standard CRUD, customer-owned. A customer's *first* saved address automatically becomes both the default shipping and default billing address — saves a click for the common single-address case without silently overriding a later, deliberate choice.

**Body** (`POST`/`PATCH`): `label` (`home`|`work`|`other`), `fullName`, `phone`, `line1`, `line2` (optional), `city`, `state`, `country`, `postalCode`.

### `PATCH /addresses/:id/default-shipping` · `PATCH /addresses/:id/default-billing`

No body. Clears the flag from any other address of this customer's first, so at most one address ever has each flag set.

---

## Checkout

Requires the `customer` role. A single review endpoint, not a stateful multi-step server session — the frontend's multi-step UI (contact → shipping → delivery → review) is presentation only; every step's data is sent together in one request here.

### `POST /checkout/review`

**Body**: `{ "shippingAddressId": "...", "billingAddressId": "... (optional, defaults to shippingAddressId)", "shippingMethod": "standard | express (optional, defaults to standard)" }`

Recalculates the cart from scratch (same pricing path as `GET /cart`) and validates the address ids belong to the caller. **Does not create an order, does not touch inventory, does not change cart status** — this is the checkout boundary Phase 7's order creation is expected to build on, not order creation itself.

**200 OK**
```json
{ "success": true, "message": "Checkout summary ready", "data": { "checkout": {
  "...cart fields as above...",
  "shippingAddress": { "...": "..." }, "billingAddress": { "...": "..." },
  "canProceed": true, "reviewedAt": "2026-08-20T..."
} } }
```
`canProceed` is `false` if any cart item has a blocking issue (out of stock, no longer available) — a non-blocking price change alone doesn't block proceeding, but `hasPriceChanges`/`priceChangeMessage` are still set so the frontend can require the customer to see and acknowledge it.

**Errors**: `400` empty cart · `404` the address id doesn't belong to the caller (never reveals whether it belongs to someone else instead)

---

## Coming in later phases

Order, coupon, review, delivery, and analytics endpoints are added as
their respective phases ship (see `docs/ROADMAP.md`). This document
grows alongside the code that actually implements each route — it does
not describe endpoints ahead of their implementation.
