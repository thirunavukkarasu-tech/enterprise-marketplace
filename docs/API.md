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

## Orders

Placing an order requires `customer`. Viewing/managing orders after that is split the same way Phase 3 split product management: `/orders` (customer's own history) vs `/orders/manage` (vendor scoped to their own vendor group within each order, admin sees everything) — one route tree, the service branches by `req.user.role`, not two parallel implementations.

### `POST /orders`

Requires `customer`. Same three fields as `POST /checkout/review` — re-validates the cart from scratch one more time at the moment of commitment, never trusting an earlier review response that may be stale by the time the customer clicks through.

Runs inside a MongoDB transaction: every line item's stock is decremented with an atomic, conditional `findOneAndUpdate` (the update's filter itself requires enough stock to exist at that instant), the `Order` is created, an `InventoryLedger` sale entry is written, and the cart is emptied and marked `converted` — all together, or none of it. If a competing order took the last unit between review and this request, the whole transaction aborts with a clear per-item error; nothing is partially charged or decremented.

**Body**: `{ "shippingAddressId": "...", "billingAddressId": "... (optional)", "shippingMethod": "standard | express (optional)" }`

**201 Created** — `data.order`, with a human-readable `orderNumber` (e.g. `ORD-20260901-4F2A`), a multi-vendor `vendorGroups` array (each with its own fulfillment `status`), and `paymentStatus: "pending"` (no payment gateway exists yet — see `docs/ARCHITECTURE.md` §7).

**Errors**: `400` empty cart, a blocking cart issue, or insufficient stock for any item · `404` an address id that isn't the caller's own

### `GET /orders` · `GET /orders/:id`

Requires `customer`. The caller's own order history/detail only — `:id` is looked up scoped to `{ _id, customer: req.user.id }`, so another customer's order id returns `404`, not `403`.

### `GET /orders/manage` · `GET /orders/manage/:id`

Requires `vendor` or `super_admin`. A vendor sees only orders containing at least one of their items, and only their own `vendorGroups` entry within each — another vendor's items, pricing, and fulfillment status inside the same multi-vendor order are stripped out server-side before the response is built, never just hidden in the UI. An admin sees every order and every vendor group, with optional `?status=`, `?customer=`, `?vendor=`, `?from=`, `?to=` filters (vendor requests only ever need `status`/`from`/`to`, since a vendor filtering by `customer` or `vendor` wouldn't make sense — the schema accepts the fields, the service simply never reads the admin-only ones for a vendor caller).

### `PATCH /orders/:id/status`

Requires `vendor` or `super_admin`.

**Body**: `{ "status": "confirmed", "groupId": "... (required for admin on a multi-vendor order, auto-resolved for a vendor to their own group)" }`

Rejects any transition not in the server-side whitelist with `400`, regardless of caller role — an admin cannot skip `pending` straight to `shipped` any more than a vendor can. Order lifecycle: `pending → confirmed → processing → shipped → delivered`, with `cancelled` reachable from `pending`/`confirmed`/`processing` and `refunded` only from `delivered`. `cancelled` and `refunded` are terminal.

**Errors**: `400` invalid transition or missing `groupId` on a multi-vendor order · `403` a vendor targeting a group that isn't theirs

---

## Inventory

Requires `vendor` or `super_admin`. A read/adjust layer over the existing `Product.variants[].stock` (Phase 3) — not a second source of truth for stock.

### `GET /inventory`

Vendor sees only their own products' variants (forced server-side); admin may pass `?vendor=` or see everything. `?stockStatus=in_stock|low_stock|out_of_stock` filters by a derived value, never stored.

### `GET /inventory/:productId/history`

The auditable adjustment/sale ledger for one product — who changed what, by how much, why, and when.

### `PATCH /inventory/:productId/adjust`

**Body**: `{ "sku": "...", "quantityChange": -3, "reason": "Damaged in warehouse" }` (signed integer; `reason` required, 3–500 characters)

**Errors**: `400` the adjustment would take stock below zero, or the SKU doesn't exist on this product · `403` a vendor targeting a product they don't own

---

## Audit Logs

### `GET /audit-logs`

Requires `super_admin`. Every tracked action platform-wide (`vendor.approved`, `product.status_changed`, `inventory.adjusted`, `order.status_changed`, etc. — the full closed set is in `constants/audit.js`), optionally filtered by `?actor=`, `?action=`, `?entityType=`. Never contains passwords, tokens, or payment secrets — see `docs/SECURITY.md`.

---

## Admin

### `GET /admin/dashboard/overview`

Requires `super_admin`. Every figure is a real aggregation against live data — no hardcoded or estimated numbers. Returns platform counts (users, vendors, customers, products, active products, low-stock products, pending vendor approvals), order-group counts (pending/completed/cancelled — counted at the per-vendor-fulfillment-group level, since a single multi-vendor order can have groups in different states simultaneously), total revenue, a 14-day revenue/order trend, top-5 vendors by revenue, and the 10 most recent audit log entries.

### `GET /admin/customers` · `GET /admin/customers/:id`

Requires `super_admin`. A read-only view over the existing `User` collection (role `customer`) — no separate Customer model. Each row/detail includes real order count and total spend from an aggregation against `Order`, and the detail view includes the 5 most recent orders.

### `GET /admin/coupons` · `POST /admin/coupons` · `GET /admin/coupons/:id` · `PATCH /admin/coupons/:id` · `PATCH /admin/coupons/:id/status` · `DELETE /admin/coupons/:id`

Requires `super_admin`. Standard CRUD plus a dedicated status toggle (`PATCH .../status`, body `{ "isActive": true|false }` — kept separate from the general update so deactivating a coupon can't be bundled with an unrelated field change by accident).

**Body** (create/update): `code` (3–30 chars, normalized to uppercase server-side regardless of what's sent), `description` (optional), `discountType` (`percentage`|`fixed`), `discountValue` (positive; capped at 100 when `discountType` is `percentage`), `maxDiscountAmount` (optional, caps a percentage discount's absolute value), `minOrderValue` (optional, default 0), `startsAt`/`expiresAt` (optional dates; `startsAt` must be before `expiresAt` if both are set), `usageLimit` (optional global cap), `perUserLimit` (optional per-customer cap).

**Errors**: `400` validation failure (including percentage > 100, or `startsAt` after `expiresAt`) · `404` coupon not found · `409` duplicate code

---

## Applying a coupon (customer)

### `POST /cart/coupon` · `DELETE /cart/coupon`

Requires the `customer` role. Coupon state lives on the `Cart` document (`Cart.couponCode`), not under `/checkout` — a coupon is something a customer tries out while shopping, and `GET /cart` needs to reflect it the same way it reflects everything else about the cart. `POST` body: `{ "code": "...", "shippingMethod": "standard|express (optional)" }`.

Applying runs the full eligibility check (exists, active, started, not expired, minimum order value, global usage limit, per-user usage limit) as a hard failure — a customer actively typing in a code gets an immediate, specific error (`docs/SECURITY.md` §8 lists each one), not a silently-ignored one. Every subsequent `GET /cart` and `POST /checkout/review` re-checks the same eligibility non-fatally instead: if the coupon has since become invalid, the response clears it and sets `couponError` rather than breaking the page.

**Response** (both cart and checkout responses): `discountAmount`, `couponCode`, alongside the existing `subtotal`/`taxAmount`/`shippingFee`/`grandTotal` — every one of these is a server calculation; no field in any cart/checkout/coupon request body can set a discount or total directly.

---

## Payments

Requires the `customer` role for every route except the webhook. Every route besides the webhook is ownership-scoped to `req.user.id` — there is no way to fetch or act on another customer's payment.

**There is no real payment gateway integrated.** `mockPaymentProvider.js` is the entire "provider" this app talks to — it exists so the full create → verify → webhook → order-consistency flow can be built and tested end-to-end, but no money moves and no real provider is called. See `docs/ARCHITECTURE.md` §7 and `docs/SECURITY.md` §8 for what a real integration would need to change.

### `POST /payments`

**Body**: `{ "orderId": "...", "method": "card" | "upi" }`

Starts a payment attempt for an order the caller owns. An order can have more than one attempt over its lifetime — a failed attempt doesn't block retrying. Returns the new `Payment` at `status: "processing"`.

**Errors**: `400` order not found or already fully paid · `403` non-customer role

### `POST /payments/:id/verify`

**Body**: `{ "simulate": "success" | "failure" (optional, default "success") }` — **only honored when `payment.provider === "mock"`**, which is always true today. A real provider integration would drop this field entirely; the route itself wouldn't change.

Applies the outcome to both `Payment` and `Order` inside one transaction — a reader can never observe the two documents disagreeing about whether the order is paid. On success, every `vendorGroups` entry still `pending` moves to `confirmed`. On failure, the order is left exactly as it was — a failed payment does not cancel the order, it leaves it awaiting a retried payment.

**Errors**: `400` invalid payment status transition (e.g. verifying an already-`paid` payment) or the payment isn't using the mock provider

### `GET /payments/:id`

Returns the caller's own payment record.

### `POST /payments/webhook`

**No authentication** — a payment provider's server calls this, not a logged-in customer, and can't attach a bearer token. Real authenticity verification (a provider-specific signature header) is the extension point a real integration would add here; with only the mock provider configured, there is nothing to sign or verify, so no check is faked in its place.

**Idempotent by construction**: the handler tries to *insert* the event's id into a dedicated collection before doing anything else; a duplicate delivery hits a unique-index conflict and is discarded, always returning `200`. This is safe under concurrent duplicate deliveries in a way a "check if seen, then act" pattern is not.

**Body**: `{ "eventId": "...", "provider": "mock", "type": "payment.succeeded" | "payment.failed" | "payment.cancelled", "payload": { "transactionId": "...", "failureReason": "... (optional)" } }`

Always returns `200` — including for an unrecognized `transactionId` or event `type`, since a webhook endpoint retrying on a non-2xx is standard provider behavior, and there's nothing actionable to retry for an event that will never resolve to a known payment.

---

## Coming in later phases

Reviews, delivery tracking, and advanced analytics are added as their
respective phases ship (see `docs/ROADMAP.md`). This document grows
alongside the code that actually implements each route — it does not
describe endpoints ahead of their implementation.
