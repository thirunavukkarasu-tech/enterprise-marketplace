# Security — MarketSphere

> Status note: Phases 2 (Authentication & RBAC), 3 (Product & Category
> Management), 4 (Vendor Management), 5 (Customer Shopping Experience),
> and 6 (Cart & Checkout) are implemented — §1–§7 below describe what's
> actually running, not a plan. §11 onward remain forward-looking, as
> noted per section.

## 1. Authentication (Phase 2 — implemented)

- **Password storage**: bcrypt, cost factor 12 (`bcryptjs`, a pure-JS
  implementation — avoids a native build dependency for a hashing cost
  that's plenty fast at this scale). Never logged; `select: false` on the
  schema so it's never returned unless explicitly queried, and stripped
  again by a `toJSON` transform as a second layer of defense.
- **Access token**: JWT, 15 min default (`JWT_ACCESS_EXPIRY`), returned in
  the response body, held in memory on the client (Redux) — never
  `localStorage`, to limit the blast radius of an XSS bug. Lost on page
  reload by design; re-minted via silent refresh against the httpOnly
  cookie.
- **Refresh token**: JWT, 7 days default (`JWT_REFRESH_EXPIRY`), set as an
  `httpOnly`, `secure` (in production), `sameSite=strict` cookie, scoped
  to the `/api/v1/auth` path only — never attached to product/order/etc.
  requests, only the handful of auth endpoints that need it.
- **Refresh token rotation + reuse detection**: backed by a dedicated
  `RefreshToken` collection (see `docs/DATABASE.md`), not just a JWT
  claim. Every refresh call revokes the presented token and issues a new
  one in the same rotation "family." If an already-revoked token is
  presented again — the signature of a stolen token being replayed after
  the legitimate client has already moved on — the **entire family** is
  revoked, forcing both the attacker and the legitimate client to
  re-authenticate. This is stronger than relying on the JWT's own expiry
  alone, since a stolen-but-not-yet-expired token would otherwise stay
  valid for its full remaining lifetime.
- **Live account-status check**: `requireAuth` re-checks `isActive`
  against the database on every request rather than trusting the access
  token's claims for its full 15-minute lifetime — a deactivated account
  takes effect on the very next request, not up to 15 minutes later.
- **Generic authentication errors**: login failures return the same
  "Invalid email or password" message whether the email doesn't exist or
  the password is wrong — never reveal which one, to prevent user
  enumeration. `forgot-password` returns the same response regardless of
  whether the account exists, for the same reason.
- **Password reset revokes all sessions**: resetting a password
  invalidates every refresh token on the account, not just the one used to
  request the reset — a stolen session shouldn't survive its owner
  regaining control.

## 2. Authorization (RBAC) (Phase 2 — implemented)

- Every protected route declares the roles allowed to call it via a
  `requireRole(...roles)` middleware, checked **server-side only** — the
  frontend hiding a button (`ProtectedRoute`) is a UX nicety, never a
  security boundary.
- Only Customer and Vendor roles can self-register (`PUBLIC_REGISTERABLE_ROLES`,
  enforced in the Zod schema, not just the frontend form) — see
  `docs/ARCHITECTURE.md` for why Super Admin and Delivery Partner accounts
  are provisioned differently.
- Resource-level ownership is a **separate check from the role check**,
  layered on top of it — see §3 below for how this actually works for
  products, the first resource type where it applies.

## 3. Resource ownership (Phase 3 — implemented)

Role membership answers "can this role call this route at all." It does
not answer "does this specific vendor own this specific product" — that
second question is a distinct check, enforced in the service layer, every
time:

- `canManageProduct(user, product)` (`utils/ownership.js`) is a pure,
  unit-tested function: `true` for a `super_admin` regardless of owner
  (moderation), `true` for the vendor who owns the product, `false`
  otherwise. Every mutating product/variant operation in `productService`
  calls it before touching the database via a shared `loadManagedOrThrow`
  helper — there's exactly one place this rule is implemented, not one
  copy per controller action.
- **The vendor scope on list endpoints is forced server-side, never
  trusted from the query string.** `GET /products/manage?vendor=<id>` — a
  vendor's `vendor` filter is always overwritten with their own id in
  `productService.listManaged`, regardless of what the request sends.
  Only a `super_admin` may pass an arbitrary `vendor` filter. This means
  there is no query-parameter path that lets one vendor list, view, or
  edit another vendor's products.
- The same ownership check gates the variant/SKU sub-resource endpoints
  (add/update/remove) — a vendor cannot reprice or restock a product they
  don't own even if they know its id.
- SKU uniqueness is enforced **globally**, not per-vendor — one vendor
  cannot claim a SKU another vendor is already using, checked against the
  database (not just within the request payload) on every create and
  variant addition.

## 4. Vendor account ownership & IDOR prevention (Phase 4 — implemented)

Vendor management introduces a second resource type with the same
"role check isn't enough" problem as products, plus a self-service
identity dimension products don't have — a vendor accessing *their own*
account isn't just "any vendor," it's "the one specific vendor tied to
this authenticated user."

- **No `GET /vendors/:id` for vendors, at all.** The admin-only detail
  route (`requireRole(SUPER_ADMIN)`) is the only way to fetch a vendor
  profile by id. A vendor's own profile is served from a completely
  separate route, `GET /vendors/me`, which never takes an id from the
  client — it's resolved server-side from `req.user.id`. This closes the
  IDOR path by construction: there is no route where a vendor-authenticated
  request can supply *any* id and receive vendor data back. Contrast this
  with product ownership (§3), where the same route (`/products/manage/:id`)
  is shared between vendor and admin and an ownership check gates it —
  vendor profiles use route separation instead, which is a stronger
  guarantee than a runtime check for a resource a user should never be
  able to address by someone else's id in the first place.
- **The same route separation applies to writes.** `PATCH /vendors/me`
  updates the caller's own profile; there is no `PATCH /vendors/:id` for
  self-service — only the admin lifecycle actions
  (`/approve`/`/reject`/`/suspend`/`/reactivate`/`/verify`) take an `:id`,
  and all five require `super_admin`.
- **A vendor cannot approve, reject, suspend, reactivate, or verify any
  vendor profile — including their own.** This is enforced twice:
  route-level (`requireRole(SUPER_ADMIN)` rejects a vendor-role token
  with `403` before any handler code runs), and defensively inside
  `vendorService.approve` (a same-account check that can't currently be
  reached through the API, but is kept explicit because "a vendor can
  never approve themselves" is a stated business rule, not just an
  implementation detail of how routes happen to be wired today).
- **Mass assignment is prevented in two independent layers**, the same
  pattern established for products in Phase 3: the Zod schemas for
  onboarding/self-update (`createVendorSchema`, `updateVendorSchema`)
  simply have no field for `status`, `isVerified`, `reviewedBy/At`,
  `rejectionReason`, `suspensionReason`, or `user` — Zod strips unknown
  keys by default, so these never reach the service layer. Independently,
  `vendorService` writes through an explicit `SELF_EDITABLE_FIELDS`
  allow-list (`applyFields(doc, payload, allowedFields)`), never
  `Object.assign(vendor, req.body)` or `findByIdAndUpdate(id, req.body)`
  — a validator bug alone couldn't cause a privilege escalation here, the
  service layer would still refuse to write an unlisted field.
- **The `GET /vendors` admin list never leaks credentials.** It populates
  the linked `User` document but explicitly selects only `name email
  isActive` (`vendorRepository.findById`/`list`) — never the
  `passwordHash` or refresh-token data, even though populate operates at
  the driver level and doesn't automatically inherit the User schema's
  `toJSON` transform the way a plain `res.json(user)` would.
- **Status transitions are a server-side whitelist
  (`VENDOR_STATUS_TRANSITIONS`, `constants/roles.js`), not inferred from
  whatever status string the client sends.** `assertTransitionAllowed`
  rejects e.g. `pending → suspended` or `approved → rejected` with a
  `400` even from an authenticated admin — the only legal transitions are
  the ones spelled out in that table.

## 5. Customer-facing authorization & safe data exposure (Phase 5 — implemented)

Phase 5 introduces the first genuinely public, unauthenticated read
surface with real business data behind it (the storefront catalog), plus
two more self-service-only resources (wishlist, account profile). Same
questions as every prior phase, applied to a different surface:

- **Wishlist and profile endpoints use the same route-separation pattern
  Phase 4 established for vendors** — `GET/PATCH /users/me` and
  `GET/POST/DELETE /wishlist[/:productId]` never take a user id from the
  client at all; the identity is always `req.user.id` from the verified
  access token. There is no route where an authenticated customer can
  address *another* customer's profile or wishlist by id, because no
  such route exists — not because a check happens to catch it.
- **Wishlisting is scoped to the `customer` role specifically**, not "any
  authenticated user," the same way `/vendors/me` is vendor-only — a
  vendor or admin account calling `/wishlist` gets a `403`, not an empty
  list. This matches how the rest of the app treats role-flavored
  features rather than treating "authenticated" as a single tier.
- **The public catalog only ever exposes customer-safe product fields.**
  Wishlist responses are populated with an explicit field allow-list
  (`title slug images priceRange status variants` — see
  `wishlistService.js`), never the full product document. Public listing/
  detail responses attach a `vendorStore` summary (`storeName`, `logo`,
  `isVerified`) built from an explicit `.select()` on the `Vendor`
  collection — never the vendor's `businessEmail`, `businessPhone`,
  `address`, `taxId`, or any of the admin-only moderation fields
  (`rejectionReason`, `suspensionReason`, `reviewedBy`) documented in
  §4. A customer looking at a product listing has no way to see anything
  about the seller beyond what a real storefront would show on a
  "sold by" byline.
- **Mass assignment on the profile endpoint** follows the same
  double-layer pattern as Phases 3–4: `updateOwnUserSchema` has no field
  for `role`, `email`, `isActive`, `isEmailVerified`, or any
  password/token property, and `userService.updateOwnProfile` writes
  through an explicit `SELF_EDITABLE_FIELDS` allow-list
  (`['name', 'phone']`), never a raw `req.body` merge. A user cannot
  escalate their own role or reactivate a deactivated account by sending
  extra fields on this endpoint — verified directly in
  `tests/integration/customerExperience.test.js`.
- **Query parameters that reach a database filter are validated, not
  passed through.** `sort` is a closed enum (`newest`/`price_asc`/
  `price_desc`/`rating`) mapped server-side to a fixed sort spec
  (`SORT_MAP` in `product.repository.js`) — the client sends a name, never
  a Mongo sort expression, so there's no path to inject an arbitrary sort
  document. `inStock` is a strict `'true'|'false'` enum coerced to a real
  boolean; anything else is a `400`, not silently ignored or coerced to a
  truthy guess.
- **Guests can browse everything the catalog exposes without an
  account.** `GET /products`, `GET /products/slug/:slug`,
  `GET /categories`, and `GET /categories/:id` have no `requireAuth` at
  all — the authorization boundary is "is this product/category
  publicly visible" (its own `status`/`isActive` field), not "is there a
  valid session."

## 6. Cart, checkout & address security (Phase 6 — implemented)

Cart and checkout are the first place this app calculates money, which
makes price/quantity manipulation the primary threat model rather than
just another IDOR surface. Every requirement below maps to something
`tests/integration/cartCheckout.test.js` exercises directly, not just an
intention:

- **The server is the only source of truth for price, subtotal, and
  total — structurally, not just by convention.** `addCartItemSchema`
  and `updateCartItemSchema` (`validators/cart.validator.js`) have no
  field for `price`, `subtotal`, `discountAmount`, or `total` at all.
  Sending them does nothing — they're not validated-then-rejected, they
  never reach the service layer to begin with, the same "can't get there
  from here" guarantee Phase 4 established for admin-only vendor fields.
  Every total in every cart/checkout response is computed by
  `cartPricingService.calculateTotals`, which takes freshly-hydrated
  items re-read from the live `Product` collection — never a stored
  total, never a client-supplied one.
- **Price snapshots are for display, never for billing.**
  `CartItem.priceSnapshot` exists solely so the UI can show "price
  changed since you added this" — `hydrateCartItems` always prices the
  line at `variant.price` (the current live price), and flags
  `PRICE_CHANGED` as informational, non-blocking metadata. There is no
  code path in this app that charges a snapshot price.
- **Quantity is server-validated against live stock on every mutation,
  not just once at add-time.** Adding, updating, and reviewing checkout
  all independently re-check `quantity <= variant.availableStock` against
  the database at that moment — a quantity that was valid when added can
  still be rejected later if stock changed, rather than trusting
  whatever was true when the line item was created. A fixed per-item cap
  (`MAX_CART_ITEM_QUANTITY`) is enforced independently of stock, as a
  guard against a fat-fingered or scripted absurd quantity.
- **Cart, address, and checkout all use the same IDOR-structural pattern**
  established across Phases 4–5, applied per-resource-shape:
  - Cart is a *singleton per user* (route-separation style, like Vendor
    profiles/Wishlist) — every cart route resolves to `req.user.id`'s
    cart; no route takes a cart id or another user's id at all.
  - Address is a *list resource* (ownership-scoped-query style, like
    Products) — every lookup is one query,
    `{ _id: addressId, user: userId }`, never a bare `findById` followed
    by a separate check. A request for another customer's address id
    returns `404`, the same response as an address that doesn't exist —
    it never confirms the id belongs to someone else.
  - Checkout's address selection reuses `addressService.assertOwned`
    rather than re-implementing an ownership check — a customer cannot
    check out against an address id that isn't theirs even if they
    correctly guess or enumerate one that exists.
- **Cart and checkout are restricted to the `customer` role specifically**,
  not "any authenticated user" — a vendor or admin token gets `403` on
  every cart/address/checkout route, matching how the rest of the app
  scopes role-flavored features rather than treating "authenticated" as
  one tier (verified directly: "a vendor cannot access the cart
  endpoints," "an admin cannot access the cart endpoints either").
- **Checkout review never persists anything and never touches
  inventory** — see the inventory reservation policy in
  `docs/DATABASE.md`. This isn't a performance optimization; it's a
  security-relevant boundary: nothing in Phase 6 can be used to lock,
  reserve, or otherwise deny stock to other customers by repeatedly
  calling checkout review without ever completing a purchase.
- **Discount and tax have no input surface at all in Phase 6.**
  `calculateDiscount`/`calculateTax` in `cartPricingService.js` are pure
  functions with no request-derived input — there is no field anywhere
  in the cart/checkout request schemas for a discount code, discount
  amount, or tax amount. When Phase 9's coupon engine lands, it changes
  what `calculateDiscount` returns; it does not add a new place for a
  client to submit a number that becomes someone's bill.

## 7. Input validation

- Every request body passes through a Zod schema (`validators/`) before
  reaching a controller. Validation failures return a `400` with
  field-level messages, never a raw stack trace. The same `validate()`
  middleware factory (`middleware/validate.js`) is reused for every
  domain's validators, not rewritten per route.
- `express-mongo-sanitize` strips any key starting with `$` or containing
  `.` from `req.body`/`query`/`params` before it can reach a Mongoose
  query — the standard defense against NoSQL operator injection
  (`{ "$gt": "" }`-style payloads).
- `hpp` guards against HTTP parameter pollution (repeated query keys used
  to smuggle unexpected array values into a handler expecting a string).

## 8. Transport & headers

- **Helmet** sets standard security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, a Content-Security-Policy in production, etc.).
- **CORS** is locked to the single configured client origin
  (`CLIENT_URL`), with `credentials: true` since the refresh cookie must
  travel cross-origin between the Vercel-hosted client and the
  Render/Railway-hosted API.
- All cookies are `secure` in production (HTTPS-only) and signed
  (`COOKIE_SECRET`).

## 9. Rate limiting (Phase 1 global limiter; Phase 2 applies it to auth routes)

- A lenient **global limiter** on all `/api/v1/*` routes protects against
  basic abuse without bothering normal traffic.
- A strict **auth limiter** (20 requests / 15 min per IP) applies to
  `register`, `login`, `refresh`, `forgot-password`, and `reset-password`
  — brute-force, credential-stuffing, and refresh-token-guessing targets
  all need a much tighter window than general API traffic. `logout` and
  `me` are intentionally left off this limiter — they're not attack
  surfaces in the same way, and a legitimate user shouldn't be throttled
  for normal use.

## 10. Error handling

- All errors funnel through one `errorHandler` middleware. Operational
  errors (`ApiError`, expected 4xx conditions) return their real message.
  Non-operational errors (unexpected bugs, a 500) always return a generic
  "Something went wrong" message to the client — the real error and stack
  trace are logged server-side only, never leaked in the response, even in
  a way that could reveal internal file paths or library versions.

## 11. File uploads (not yet implemented)

- Uploads (product images, vendor logo/banner, KYC documents) are
  validated by MIME-type allowlist and size limit before being forwarded
  to object storage — never trusted based on file extension alone, and
  never written to the API server's own disk. Still true as written, not
  yet built: Phase 4 shipped vendor logo/banner as URL references
  (`{url, alt}`, the same shape product images already use) rather than
  handling uploads directly — no domain in the app owns file-upload
  infrastructure yet.

## 12. Secrets

- All secrets (JWT signing keys, DB URI, storage credentials) are read
  from environment variables via a single validated `config/env.js` —
  nothing is hardcoded, nothing is committed. `.env` is gitignored;
  `.env.example` documents every variable a deployer needs to set without
  containing any real value.

## 13. Audit logging (Phase 10 — not yet implemented)

A dedicated, queryable `AuditLog` collection (actor, action, target,
timestamp) is planned for Phase 10, alongside the admin tooling that would
actually consume it. In the meantime, Phase 2 logs the security-relevant
auth events — registration, login, password-reset requests/completions,
email verification, and refresh-token reuse detection — through the
standard Winston logger (`config/logger.js`) with the acting user's id.
That's useful for local debugging and demonstrates the events worth
tracking, but it is **not** a substitute for the real audit trail: it's
unstructured relative to a query-able collection and isn't retained
independently of normal log rotation.

## 14. What's intentionally deferred

No payment gateway is integrated yet (see `ARCHITECTURE.md` §7) — there is
no PCI-scope surface to secure in Phase 1–6. Two-factor authentication and
device/session management (viewing and revoking active sessions) are
listed in `ROADMAP.md` as future hardening, not core to a marketplace MVP.
