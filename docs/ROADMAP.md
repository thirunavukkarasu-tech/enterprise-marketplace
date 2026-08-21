# Roadmap — MarketSphere

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation & architecture | ✅ Complete |
| 2 | Authentication & RBAC | ✅ Complete |
| 3 | Product & category management | ✅ Complete |
| 4 | Vendor management | ✅ Complete |
| 5 | Customer shopping experience | ✅ Complete |
| 6 | Cart & checkout | ✅ Complete |
| 7 | Orders, inventory & payments | ⏳ Next |
| 8 | Delivery & real-time tracking | Planned |
| 9 | Reviews, coupons & notifications | Planned |
| 10 | Analytics, audit logs, testing & hardening | Planned |
| 11 | Deployment, documentation & portfolio polish | Planned |

## Phase 2 summary — Authentication & RBAC (complete)

- `User` and `RefreshToken` models; register/login/logout
- Access + refresh token issuance, rotation, and reuse detection (backed
  by a real `RefreshToken` collection, not just JWT claims)
- Email verification and password-reset flows, with email sending
  abstracted behind `emailService` (dev mode logs the link to the
  console — no real SMTP/provider wired up yet)
- `requireAuth` (with a live DB active-status check) and `requireRole(...)`
  middleware; only Customer/Vendor can self-register
- Auth-specific rate limiting on register/login/refresh/forgot/reset
- Frontend: Redux auth slice with async thunks, an Axios interceptor doing
  single-flight silent refresh on 401, `ProtectedRoute` enforcing
  role-based access on `/admin`, `/vendor`, `/delivery`, and role-aware
  navigation (sign-in/sign-out, dashboard links)
- Demo/seed users for all four roles (`npm run seed`)

## Phase 3 summary — Product & Category Management (complete)

- `Category` model — self-referencing `parent` for subcategories,
  cycle-checked on every reassignment, admin-only writes, public reads
  (active-only), deletion blocked if it still has subcategories or
  products
- `Product` model — embedded variants/SKUs (globally unique), denormalized
  `priceRange` recomputed on every mutation, `draft`/`active`/`archived`
  status, `reservedStock` field defined now (always `0`) ahead of Phase
  7's checkout so no later migration is needed
- Resource-level ownership (`canManageProduct`, `utils/ownership.js`) —
  new on top of Phase 2's role-only RBAC: a vendor can only view/edit/
  delete their own products, enforced in the service layer, not just
  hidden in the UI; a vendor's `?vendor=` query filter is always
  overwritten server-side, never trusted from the request
- Public storefront endpoints: full-text search, category/price
  filtering, sorting, pagination — draft/archived products are `404`, not
  filtered-and-hidden, on the public detail route
- Frontend: real product listing/detail pages (replacing the Phase 1
  placeholders), a vendor product management UI (list, create, edit,
  status control, delete) with a dynamic variant editor, an admin
  moderation UI (cross-vendor listing, archive/restore), and admin
  category CRUD
- 30 new passing unit tests (slugify, ownership rules, product/category
  Zod validators — pricing, SKU format, pagination bounds) + full
  integration suites for both categories and products (ownership
  enforcement, cycle prevention, SKU conflicts, status transitions,
  public visibility rules) — written and ready to run against a real
  MongoDB instance; see `README.md` for how

## Phase 4 summary — Vendor Management (complete)

- `Vendor` model — business profile (store name, legal name, contact,
  address, tax id, logo/banner references), independent `status`
  (pending/approved/rejected/suspended) and `isVerified` fields (verifying
  a vendor's documents is a separate admin judgment from whether their
  store can currently sell — see `docs/DATABASE.md`)
- Server-side status transition whitelist (`VENDOR_STATUS_TRANSITIONS`) —
  an admin cannot skip states (e.g. pending straight to suspended) even
  by calling the API directly; `REJECTED` is terminal for this phase
- Vendor self-service: onboarding (`POST /vendors/me`, one profile per
  account), profile view/edit (`GET`/`PATCH /vendors/me`), and a real
  dashboard (`GET /vendors/me/dashboard`) built from actual `Product`
  counts — no fabricated analytics, honest empty states where data
  belongs to a future phase (orders/revenue)
- Admin management: list with search/filter/sort/pagination, per-vendor
  approve/reject (reason required)/suspend (reason required)/reactivate/
  verify — every action gated by `requireRole(super_admin)` and, for
  approve, a defensive same-account check even though a vendor-role token
  can't reach that route at all
- **IDOR prevention via route separation, not just an ownership check**:
  there is no route where a vendor-authenticated request can supply an
  arbitrary id and receive vendor data back — `/vendors/me` never takes
  an id from the client, and `/vendors/:id` is admin-only. See
  `docs/SECURITY.md` §4.
- Double-layered mass-assignment prevention (Zod schema has no field for
  admin-controlled properties; service writes through an explicit
  allow-list, never a raw `req.body` merge) — the same pattern Phase 3
  established for products, reapplied here rather than reinvented
- **Product ownership integration without touching Phase 3**:
  `Product.vendor` still references `User`, not the new `Vendor`
  collection — `Vendor.user` is a unique 1:1 pointer to that same `User`,
  so every existing ownership check, scoping query, and the new vendor
  dashboard's product counts all work correctly with zero changes to
  Product's schema or `productService`. Full reasoning in
  `docs/DATABASE.md`.
- Frontend: real vendor dashboard and store-profile pages (replacing the
  Phase 1 placeholders), an admin vendor management page with expandable
  detail rows and reason-prompted reject/suspend actions
- 21 new passing unit + integration tests (status transition table,
  vendor validators, onboarding, self-profile mass-assignment rejection,
  cross-vendor IDOR checks, self-approval/self-verification prevention,
  the full lifecycle, and a regression test proving product ownership
  still works after vendor management is layered on top)

## Phase 5 summary — Customer Shopping Experience (complete)

- Storefront rebuilt on real Phase 3/4 data: URL-driven search/filter/sort/
  pagination (`ProductListing`), category browsing with subcategories and
  live product counts (`CategoriesIndex`/`CategoryBrowse`), a product
  detail page with variant selection validated before "Add to cart" can
  proceed
- **Two real gaps found and fixed while integrating, not left as silent
  TODOs**: the `withCounts` category query param was validated but never
  actually wired to the controller (fixed — see `docs/API.md`); there was
  no availability/in-stock filter at all despite it being a stated
  requirement (added `inStock`, both directions, with correct Mongo
  array-element matching — see `docs/DATABASE.md` §3 for why no new index
  was needed)
- **`vendorStore` enrichment on public product responses** — a
  customer-safe `{storeName, logo, isVerified}` summary looked up from
  `Vendor.user`, not the raw `vendor` (User id) field the product
  document actually stores; degrades to `null` gracefully for a vendor
  who hasn't onboarded a store profile yet rather than hiding the product
- **Deliberately did not gate public product visibility on vendor
  approval status** — checked first, and confirmed this would break
  Phase 3's own approved test suite, which never onboards a Vendor
  profile for its test vendors. Documented in `productService.js` rather
  than silently added or silently skipped.
- Wishlist: `Wishlist` model (one document per user, embedded product
  refs — see `docs/DATABASE.md`), duplicate-add is a no-op not an error,
  dangling product refs are filtered and self-repaired on read, scoped to
  the `customer` role specifically via route separation (same IDOR
  pattern Phase 4 established for vendors)
- Customer/account profile: `phone` added to `User` (optional, so
  existing accounts aren't retroactively invalid), `PATCH /users/me`
  reuses Phase 2's `GET /auth/me` rather than duplicating a read
  endpoint, double-layered mass-assignment prevention matching Phases 3–4
- Redux used only where state is genuinely cross-screen (wishlist —
  the same "is this saved" fact renders on a grid card and the detail
  page at once); product/category browsing stays screen-local state,
  per the rule set in `docs/ARCHITECTURE.md`
- Skeleton loaders for the three product-grid contexts (listing, category
  browse, wishlist); `Spinner` kept for non-grid loading states
- Cart: intentionally not built. "Add to cart" is a confirmation-only
  interaction (client state, nothing persisted) — see the Cart section in
  `docs/DATABASE.md` for why the schema isn't drafted twice
- 11 new passing unit tests (inStock/withCounts/wishlist/profile Zod
  validators) + a new integration suite (wishlist auth/RBAC/duplicate-
  prevention/cross-customer isolation, profile mass-assignment rejection,
  inStock filtering, vendorStore enrichment, category counts) — written
  and ready to run against a real MongoDB instance; see `README.md` for
  how

## Phase 6 summary — Cart & Checkout (complete)

- `Cart` model — one per customer, embedded mutable items, a
  `priceSnapshot` per item used only for change-detection display, never
  for billing (see `docs/DATABASE.md`); `Address` model — a genuinely
  referenced (not embedded) per-customer list, since checkout needs to
  address one specifically by id independent of the others
- **A single, reusable server-side pricing calculation path**
  (`cartPricingService.calculateTotals`), called by both cart retrieval
  and checkout review rather than duplicated — Phase 7's order creation
  is expected to call the same function rather than reimplementing
  subtotal/discount/tax/shipping math a third time (see
  `docs/ARCHITECTURE.md`)
- **Nothing about price, subtotal, or total is ever trusted from the
  client** — the add/update cart schemas have no field for any of them at
  all, not merely a rejected one; every total is recomputed from live
  `Product`/variant data on every read
- Price-change detection: a per-item price is compared against its
  stored snapshot on every cart/checkout read; a change is non-blocking
  (checkout can still proceed) but surfaced with the exact customer-facing
  message the spec called for: *"One or more item prices have changed.
  Please review your cart before checkout."*
- Stock validated server-side on every mutation (add, update, checkout
  review) against live `variant.availableStock` — never trusted from
  what was true when an item was added
- **Inventory reservation policy, stated explicitly**: cart quantity is
  *not* a stock reservation. Nothing in Phase 6 decrements `stock` or
  increments `reservedStock`; two customers can simultaneously hold the
  last unit of a SKU in their carts, and only one will succeed — that
  moment is Phase 7's order-creation transaction, not anything cart or
  checkout does. Full reasoning in `docs/DATABASE.md`.
- Checkout review (`POST /checkout/review`) is the boundary Phase 7 is
  expected to build on: validates cart + addresses, returns
  server-calculated totals, **creates nothing** — no order, no cart
  status change, no inventory touch
- Frontend: cart page (quantity controls, per-item issue messaging,
  price-change warning, blocking-issue gating on the checkout CTA), a
  4-step checkout UI (contact → shipping → delivery → review) that
  clearly labels its final action "Place order (coming soon)" rather
  than implying it does something it doesn't, address management reused
  as both a standalone page and an inline checkout step via one shared
  `AddressForm` component
- Redux used for cart the same way Phase 5 used it for wishlist — the
  same "how many items are in my cart" fact renders in a header badge,
  the cart page, and checkout simultaneously — while checkout's own
  multi-step UI state stays local to that page, not globalized
- **Two real integration gaps found and fixed while wiring this phase
  together, not left as silent TODOs**: the Cart/Checkout/Addresses pages
  were fully built but never connected to the router (`/cart` still
  pointed at a Phase 1 placeholder, `/checkout` and `/addresses` had no
  route at all); a product detail page's "add to cart" button didn't
  disable during the request or display a failure message despite
  fetching both pieces of state, purely because the JSX using them was
  never finished
- 27 new passing unit tests (pricing calculation math, cart/checkout/
  address Zod validators) + a comprehensive integration suite covering
  every item in the spec's minimum test list, including cross-customer
  cart isolation, vendor/admin blocked from cart access, price/quantity
  manipulation rejection, and address ownership — written and ready to
  run against a real MongoDB instance; see `README.md` for how

## Phase 7 preview — Orders, Inventory & Payments

- Real order creation from a validated checkout review — using the
  `cartPricingService.calculateTotals` function this phase already
  built, not a fourth reimplementation of the same math
- Atomic/transactional inventory deduction at the moment of order
  creation — the first thing in this app to actually write to
  `reservedStock`/`stock`, replacing Phase 6's re-check-every-time,
  reserve-nothing policy
- `Cart.status` transitioning from `active` to `converted` for the first
  time — the field has existed since Phase 6, unset by anything until now
- The payment abstraction layer described in `docs/ARCHITECTURE.md` §7

## Beyond Phase 11 — future improvements

Ideas intentionally out of scope for the portfolio build, listed here so
the README doesn't imply they were forgotten:

- Real payment gateway integration (Stripe/Razorpay) behind the Phase 7
  payment abstraction
- Two-factor authentication and active-session management
- Elasticsearch/Atlas Search for product search at catalog scale
- Redis-backed caching for category/product listing pages
- A recommendation/"customers also bought" module
- Multi-currency and multi-language support
- A vendor payout/settlement batch job (deferred from Phase 4 — no
  orders/payments exist yet for a payout to settle against)
- File-upload infrastructure for vendor KYC documents and direct image
  uploads (currently URL-reference-only for logo/banner/product images)
- A public vendor directory/storefront page (`/vendors`, `/vendors/:id`-style
  profile) — currently a placeholder; `Vendor` data has existed since
  Phase 4 and product cards already link store names, but a dedicated
  "shop this seller's other products" page wasn't built in Phase 5
- Horizontal scaling notes (Socket.IO adapter for multi-instance
  deployments, e.g. Redis adapter)
