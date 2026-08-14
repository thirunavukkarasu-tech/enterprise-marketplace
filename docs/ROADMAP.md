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

## Phase 4 preview — Vendor Management

- A dedicated `Vendor` model (storefront metadata, approval status,
  documents, payout details) — `Product.vendor` is planned to repoint
  from `User` to `Vendor._id` as a one-line service change, not a
  migration (see `docs/DATABASE.md`)
- Vendor registration/application and admin approval/rejection workflow
- Vendor public storefront profile pages
- Vendor revenue/analytics dashboard foundation (real data arrives with
  orders in Phase 7 — the dashboard shell already exists from Phase 1)

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
