# Roadmap — MarketSphere

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation & architecture | ✅ Complete |
| 2 | Authentication & RBAC | ✅ Complete |
| 3 | Product & category management | ✅ Complete |
| 4 | Vendor management | ✅ Complete |
| 5 | Customer shopping experience | ⏳ Next |
| 6 | Cart & checkout | Planned |
| 7 | Orders, inventory & payments | Planned |
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

## Phase 5 preview — Customer Shopping Experience

- Customer profile and saved address management
- Wishlist
- Product browsing enhancements building on Phase 3's storefront
  (the listing/detail pages already built are the foundation this phase
  extends, not replaces)
- The public vendor storefront page (`/vendors/:slug`-style profile,
  currently a Phase 3 placeholder) is a natural fit here, surfacing the
  `Vendor` data Phase 4 now provides

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
- Horizontal scaling notes (Socket.IO adapter for multi-instance
  deployments, e.g. Redis adapter)
