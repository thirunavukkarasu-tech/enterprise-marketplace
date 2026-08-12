# Roadmap — MarketSphere

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation & architecture | ✅ Complete |
| 2 | Authentication & RBAC | ✅ Complete |
| 3 | Product & category management | ⏳ Next |
| 4 | Vendor management | Planned |
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

## Phase 3 preview — Product & Category Management

- `Product` and `Category` models (see `docs/DATABASE.md` for the
  embed/reference decisions already made for variants and SKUs)
- Public product listing, filtering, sorting, search, and pagination
  endpoints
- Vendor-facing product CRUD, scoped to `req.user.id` — the first place
  the "role check vs. resource-ownership check" distinction from
  `SECURITY.md` §2 actually matters
- Admin product moderation endpoints
- Frontend: real product cards on the storefront home (replacing the
  category placeholder grid), a product detail page, and the vendor
  product-management screen (replacing its Phase-3 placeholder)

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
