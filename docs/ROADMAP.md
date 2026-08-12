# Roadmap — MarketSphere

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation & architecture | ✅ Complete |
| 2 | Authentication & RBAC | ✅ Complete |
| 3 | Product & category management | ✅ Complete |
| 4 | Vendor management | ⏳ Next |
| 5 | Customer shopping experience | Planned |
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
- 22 passing unit tests (tokens, validators, RBAC middleware) + a full
  integration suite for the auth flow (register→login→refresh
  rotation→logout, reuse detection, generic error messages) — written and
  ready to run against a real MongoDB instance; see `README.md` for how

## Phase 3 summary — Product & Category Management (complete)

- `Category` model (self-referencing `parent` for subcategories, admin-only
  writes, public reads) and `Product` model (embedded variants/SKUs,
  denormalized `priceRange` for efficient sort/filter, `reservedStock`
  defined now but always `0` until Phase 7's checkout writes to it)
- Global SKU uniqueness enforced at the database level via a unique index
  on `variants.sku`
- Public storefront endpoints: search (`$text`), category/price filtering,
  five sort options, and page/limit pagination — draft and archived
  products are never visible here, enforced server-side regardless of
  query params
- Vendor/admin "managed" endpoints under `/products/manage`: a vendor's
  `vendor` scope is forced server-side to their own id no matter what a
  request sends, and every mutation re-checks ownership via a pure,
  unit-tested `canManageProduct` rule — a super admin bypasses it for
  moderation, nothing else does
- Variant/SKU sub-resource endpoints (add/update/remove) so pricing and
  stock changes don't require re-submitting an entire product
- Frontend: real product listing/detail pages replacing the Phase-1
  placeholders, a vendor product management UI (list + create form +
  per-variant edit/add/remove wired to the real sub-resource endpoints,
  not a single form pretending they're one write), and an admin
  moderation UI (publish/archive/delete across every vendor) plus category
  CRUD
- 37 new unit/integration tests (60 total passing) covering slug
  generation, price-range computation, the ownership rule, the
  filter/sort query builders, and validator edge cases (negative price,
  zero variants, oversized page size, disallowed sort values)

## Phase 4 preview — Vendor Management

- A dedicated `Vendor` collection (storefront metadata, KYC documents,
  approval status, payout details) — `Product.vendor` currently points at
  `User` directly (see `Product.model.js` comments); Phase 4 repoints it
  at `Vendor._id` once that collection exists, a one-line service change
  since `Vendor.user` stays a 1:1 pointer to the same `User`
- Vendor registration/application → admin approval/rejection workflow
- Vendor public storefront profile pages
- Vendor revenue/analytics groundwork (real numbers arrive with orders in
  Phase 7, but the dashboard shell built in Phase 1 gets wired to
  something real)
- Admin vendor-approval queue (the `/admin/vendors` placeholder from
  Phases 1–3 becomes a real screen)

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
- A vendor payout/settlement batch job
- Horizontal scaling notes (Socket.IO adapter for multi-instance
  deployments, e.g. Redis adapter)
