# MarketSphere

A production-minded, multi-vendor e-commerce marketplace — built to
demonstrate how a real product team would architect, secure, and ship a
system with four distinct user roles (Super Admin, Vendor, Customer,
Delivery Partner) sharing one platform.

> **Status**: Phase 9 of 11 complete — the full marketplace (auth & RBAC,
> catalog, vendors, storefront, cart & checkout, orders & inventory, admin
> operations, payments & coupons), now production-hardened: security
> review, structured logging with request correlation, CI, and deployment
> readiness. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.

## Overview

Most portfolio e-commerce projects are a single-seller storefront with an
admin CRUD panel bolted on. MarketSphere is deliberately harder than that:
a **marketplace**, where independent vendors list and fulfill their own
products, orders can span multiple vendors in a single checkout, inventory
has to prevent overselling under concurrent demand, and a delivery
partner role needs real-time status updates — the kind of system design
problems that come up in actual marketplace companies (Amazon
Marketplace, Etsy, Flipkart), not a tutorial CRUD app.

## The business problem

- **Customers** want to buy from many independent sellers in one checkout,
  with one order history and one return process — not four different
  seller portals.
- **Vendors** need their own dashboard: list products, manage stock, see
  only their own orders and revenue, without touching anyone else's data.
- **Admins** need oversight without becoming a bottleneck: approve
  vendors, moderate products, monitor orders platform-wide, and have an
  audit trail when something goes wrong.
- **Delivery partners** need a lightweight, mobile-first flow to accept
  assignments and push live status — not a scaled-down version of the
  admin dashboard.

## Architecture

Full write-ups: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/SECURITY.md`](docs/SECURITY.md)

```
routes → controllers (thin) → services (business logic) → models
```

Controllers stay thin; business logic (auth session management, and
order splitting/inventory reservation/coupon validation as those domains
are built) lives in services. Every error funnels through one centralized
handler; every success response uses the same `{ success, message, data }`
envelope. Auth and authorization are enforced server-side only.

## Tech stack

**Frontend** — React 19 · TypeScript · Vite · Redux Toolkit · React Router
· Tailwind CSS v4 · Axios · React Hook Form · Zod · Recharts · Lucide

**Backend** — Node.js · Express · MongoDB · Mongoose · Socket.IO

**Security** — JWT access tokens · refresh token rotation with reuse
detection · httpOnly cookies · bcrypt · RBAC · Helmet · CORS ·
express-rate-limit · Zod validation · centralized error handling

**Infra** — MongoDB Atlas · Redis (optional) · Cloudinary/S3-style storage
abstraction · Vercel (frontend) · Render/Railway (backend)

## Key features (by phase)

| Domain | Phase |
|---|---|
| Auth, sessions, RBAC | 2 ✅ |
| Product & category catalog | 3 ✅ |
| Vendor onboarding & approval | 4 ✅ |
| Customer browsing, search, wishlist | 5 ✅ |
| Cart & checkout | 6 ✅ |
| Multi-vendor order splitting, inventory, admin operations | 7 ✅ |
| Payments (mock provider), coupons, checkout hardening | 8 ✅ |
| Production hardening, testing, observability, CI & deployment readiness | 9 ✅ |
| Real-time delivery tracking (Socket.IO) | 10 |
| Reviews & notifications | 11 |

## Design system

A distinct visual identity rather than a default AI-generated look: an
indigo/marigold palette (not the generic SaaS-blue or cream-and-terracotta
defaults), a Sora/Inter/IBM Plex Mono type pairing, and a signature
**directory strip** component — a marketplace-directory-board motif that
makes the four account types concrete instead of a decorative stat block.
See the storefront home page for it in context.

## Screenshots

_Screenshots added once there's real seed/demo catalog data to show, not
empty states — the product/category screens are built as of Phase 3, this
just needs seed data (a demo catalog seed is a good candidate to add
alongside the Phase 4 vendor seed data)._

## Local setup

### Prerequisites
- Node.js ≥ 18
- A MongoDB connection string (local `mongod` or MongoDB Atlas)

### Backend

```bash
cd server
cp .env.example .env       # then fill in MONGODB_URI and the JWT/cookie secrets
npm install
npm run dev                 # http://localhost:5000
```

### Seed demo users (optional, but recommended)

```bash
cd server
npm run seed
```

Creates one account per role with fixed, published credentials — for
local/demo use only, never for a real deployment:

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@marketsphere.dev` | `Admin@12345` |
| Vendor | `vendor@marketsphere.dev` | `Vendor@12345` |
| Customer | `customer@marketsphere.dev` | `Customer@12345` |
| Delivery Partner | `delivery@marketsphere.dev` | `Delivery@12345` |

All four are created with `isEmailVerified: true` so they can log in
immediately without walking through the verification email step. The
seeded vendor account has no store profile yet — logging in as
`vendor@marketsphere.dev` lands on the "set up your store" empty state,
since onboarding (`POST /vendors/me`) is a real business-info submission
flow, not something a generic seed script should fabricate.

### Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

### Run backend tests

```bash
cd server
npm test
```

This runs the full unit test suite (JWT signing/verification, token
hashing, duration parsing, Zod validators, RBAC middleware, slugify/
unique-slug generation, product ownership rules, product/category/vendor
validators, vendor status transitions, the Phase 5 customer-experience
validators for `inStock`/`withCounts`/wishlist/profile, the Phase 6 cart
pricing calculation + cart/checkout/address validators, the Phase 7
order-status transition table + inventory stock-status derivation, and
the Phase 8 payment status transition table + coupon discount math — 164
tests, no database required) plus two database-free integration suites:
the health-check tests (2 tests) and the Phase 9 hardening suite (19
tests — error-envelope shape, request-id correlation, malformed and
oversized body handling, invalid ObjectId, pagination bounds, sort-enum
injection, security headers, and a check that the health endpoint leaks
no secrets). Those run on every CI run precisely because they need no
database. Eight further integration suites do need a real MongoDB
connection and are skipped by default in environments without one (shown
as 8 skip-notice tests in the count, 193 total): the full auth flow
(register
→ login → refresh-rotation → logout, reuse detection, generic error
messages, deactivated-user rejection), category management (cycle
prevention, deletion guards, active-only public listing), product
management (cross-vendor ownership enforcement, SKU uniqueness, status
transitions, public visibility rules), vendor management (onboarding,
cross-vendor IDOR checks, self-approval/self-verification prevention,
mass-assignment rejection, the full approve/reject/suspend/reactivate
lifecycle, and a regression check that product ownership still works
with vendor management layered on top), the customer experience
(wishlist auth/RBAC/duplicate-prevention/cross-customer isolation,
profile mass-assignment rejection, `inStock` filtering, `vendorStore`
enrichment, category product counts), cart & checkout (cross-customer
cart isolation, vendor/admin blocked from cart access, client-supplied
price/subtotal/total silently ignored, price-change detection charging
the new price, stock validation on every mutation, address ownership,
checkout validation for empty carts and mismatched addresses),
admin/vendor operations (atomic transactional order creation, valid/
invalid order status transitions, cross-vendor order and inventory
isolation, negative-stock rejection, admin-only endpoint gating, and
audit log creation), and payments & coupons (percentage/fixed discount
calculation, max-discount capping, global and per-user usage limits,
expired/inactive/below-minimum coupon rejection, server-side total
calculation with client manipulation rejected, payment success/failure,
invalid payment transitions rejected, and duplicate webhook delivery
handled idempotently):

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/auth.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/categories.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/products.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/vendors.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/customerExperience.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/cartCheckout.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/adminOperations.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/paymentsAndCoupons.test.js
```

Each suite creates its own isolated database and drops it when finished.
**`adminOperations.test.js` and `paymentsAndCoupons.test.js` need a
replica set, not just a standalone `mongod`** — order and payment
consistency both use MongoDB transactions, which require one. A
single-node replica set works fine for local testing
(`mongod --replSet rs0`, then `rs.initiate()` once via `mongosh`); the
other six suites don't need this.

## Environment variables

See [`server/.env.example`](server/.env.example) and
[`client/.env.example`](client/.env.example) for the full list. The
backend validates all required variables at boot (via Zod) and fails fast
with a clear message if any are missing — it will not silently start in a
broken state.

## API documentation

Versioned under `/api/v1`. Every response follows:

```json
{ "success": true, "message": "...", "data": { ... } }
```

Full reference for authentication (register, login, logout, refresh,
forgot/reset password, email verification, `/me`), category/product
management (public storefront listing/search/filtering with availability
and vendor-store enrichment, and the vendor/admin managed endpoints with
ownership enforcement), vendor management (self-service onboarding/
profile/dashboard, and admin approve/reject/suspend/reactivate/verify),
the customer shopping experience (self-service profile updates,
wishlist), cart & checkout (server-authoritative pricing, address
management, checkout review), orders/inventory/admin operations
(atomic transactional order creation, order lifecycle management,
inventory adjustment with an auditable ledger, an operational audit log,
and admin dashboard/customer-management aggregations), and payments &
coupons (a provider-agnostic payment abstraction with a mock provider,
idempotent webhook handling, and platform-wide discount codes) is in
[`docs/API.md`](docs/API.md). Delivery tracking and other domain
endpoints are added there as their phases ship.

## Health check

```
GET http://localhost:5000/api/v1/health
```

## Security

Security decisions are documented per-phase, with reasoning, in
[`docs/SECURITY.md`](docs/SECURITY.md). In summary:

- **Authentication** — bcrypt password hashing, short-lived JWT access
  tokens, refresh token rotation with reuse detection, httpOnly
  `sameSite=strict` refresh cookies, generic auth errors that don't
  reveal whether an account exists.
- **Authorization** — RBAC on every protected route, plus a second,
  separate layer of per-resource ownership checks. A vendor cannot read
  or modify another vendor's products, orders, or inventory; a customer
  cannot reach another customer's cart, addresses, orders, or wishlist.
  Where a resource should never be addressable by id at all (a user's own
  cart or profile), the route simply takes no id and resolves everything
  from the verified token — IDOR prevented structurally rather than by a
  runtime check.
- **Server-authoritative money** — price, discount, tax, shipping, and
  order totals are always recomputed server-side from live database
  state. The cart, checkout, and coupon request schemas contain no field
  for a price, discount, or total, so a manipulated client payload has
  nothing to manipulate. Payment status likewise comes from the provider
  abstraction, never from the client.
- **Input validation** — every request body, query, and route param
  passes a Zod schema before reaching a controller: bounded string
  lengths, validated enums, validated ObjectIds, bounded pagination, and
  closed sort/filter allowlists (the client sends a sort *name*, never a
  database sort expression).
- **Transport & platform** — Helmet security headers, a single-origin
  CORS allowlist with credentials, global and stricter auth-specific rate
  limiting, a 10 kb JSON body cap, NoSQL-injection sanitisation, and HTTP
  parameter-pollution protection.
- **Safe errors** — one centralised handler returns a consistent shape
  with a stable machine-readable `error.code`. Stack traces and internal
  details are never sent in production; unexpected errors return a
  generic message while the real error is logged server-side.
- **Secrets** — `.env` is gitignored, every variable is validated at
  boot, and `.env.example` holds placeholders only. No card numbers, CVVs,
  or payment credentials are stored anywhere, by design.

Vulnerability reporting: [`SECURITY.md`](SECURITY.md).

## Testing

```bash
cd server && npm test
```

193 backend tests. The unit suite (164) covers the logic worth protecting
against regression — JWT and token handling, RBAC, per-resource
ownership, order and payment status transition tables, inventory
stock-status rules, coupon discount maths, and every Zod validator.

A **hardening suite** (19 tests) verifies the cross-cutting API
guarantees that hold regardless of business domain: every error carries
a stable machine-readable `error.code`, no response leaks a stack trace,
every request is traceable by `X-Request-ID` (and a malformed
caller-supplied id is never echoed back), malformed JSON is a 400 and an
oversized body a 413 rather than an unhandled 500, invalid ObjectIds and
out-of-range pagination are rejected, `sort` is a closed enum that can't
be used to inject a Mongo sort document, and security/rate-limit headers
are present. It needs no database, so it runs on every CI run.

Eight integration suites exercise full HTTP flows against a real
database, including an explicit set of **security regression tests**:
cross-tenant IDOR attempts, privilege escalation, mass-assignment of
admin-controlled fields, coupon and price manipulation, invalid status
transitions, and duplicate webhook delivery. They self-skip when
`TEST_MONGODB_URI` is unset, so `npm test` is always runnable — see
[Run backend tests](#run-backend-tests) for how to run them against a
local MongoDB.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push
and pull request:

| Job | Steps |
|---|---|
| **Server** | `npm ci` → lint → test → `npm audit --audit-level=high --omit=dev` |
| **Client** | `npm ci` → lint → build (runs `tsc -b` first, so a type error fails the build) → audit |
| **Server (integration)** | starts MongoDB as a single-node replica set, then runs the database-backed suites |

The integration job starts `mongod` explicitly with `--replSet` rather
than using a service container, because order creation and payment/order
consistency use MongoDB transactions — which require a replica set, and
a service container gives no way to pass that flag.

## Performance

- **Pagination everywhere it matters** — product, order, vendor,
  customer, coupon, inventory, and audit-log listings are all paginated
  with bounded `limit` values, returning `meta` alongside the data.
- **Indexes backing real query patterns** — added per phase for the
  queries that actually exist, not speculatively; the reasoning (and the
  explicit decisions *not* to add one) is recorded in
  [`docs/DATABASE.md`](docs/DATABASE.md).
- **Aggregations over N+1 loops** — dashboard KPIs, category product
  counts, and customer order/spend totals are each a single aggregation
  rather than a query per row.
- **Projections on populate** — populated references select only the
  fields the response needs, so a joined `User` never carries its
  password hash or token state into memory.
- **Route-level code splitting** — the admin and vendor dashboards are
  lazily loaded. They're role-gated and are the only screens importing
  `recharts`, so a customer never downloads them: the main bundle is
  ~476 kB (~139 kB gzipped) with the ~329 kB charting chunk fetched only
  when an admin or vendor actually opens a dashboard.
- **Denormalised where it pays** — e.g. `Product.priceRange`, so
  storefront price sorting and filtering don't unwind a variants array on
  every query.

## Deployment

| Piece | Target |
|---|---|
| Frontend | Vercel or any static host — `cd client && npm run build`, serve `dist/` |
| Backend | Render, Railway, Fly.io, or any Node host — `cd server && npm start` |
| Database | MongoDB Atlas (**replica set required** — transactions are used) |

**Node.js 20+** on both sides.

Before deploying:

1. Set every variable in [`server/.env.example`](server/.env.example) on
   the backend host. The server validates them at boot and refuses to
   start with a clear message if any are missing or malformed — it will
   not start half-configured. Generate each secret with
   `openssl rand -base64 48`; the access and refresh secrets must differ.
2. Set `CLIENT_URL` to the deployed frontend origin. CORS is a
   single-origin allowlist, so a wrong value here blocks the browser from
   calling the API at all.
3. Set `VITE_API_URL` on the frontend host to the deployed API's
   `/api/v1` base. It's baked in at build time, so it must be present
   *before* the build runs, not after.
4. Set `NODE_ENV=production`. This is what switches error responses to
   their safe form, enables the production CSP, and marks cookies
   `secure`.
5. Point a health check at `GET /api/v1/health`. It reports process
   uptime, environment, and live database connectivity without exposing
   configuration.

The server handles `SIGTERM`/`SIGINT` gracefully — it stops accepting new
connections, closes WebSocket and HTTP servers, then closes the MongoDB
connection, with a 10-second forced-exit backstop — so rolling deploys
and container restarts don't sever in-flight requests.

## Future improvements

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full phase plan and the
list of enhancements intentionally deferred past Phase 11 (real payment
gateway, 2FA, search-at-scale, caching, recommendations).

---

Built as a portfolio project to demonstrate marketplace-domain system
design — distinct from a generic CRUD admin panel, and from a single-seller
storefront.
