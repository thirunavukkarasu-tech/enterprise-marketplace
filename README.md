# MarketSphere

A production-minded, multi-vendor e-commerce marketplace — built to
demonstrate how a real product team would architect, secure, and ship a
system with four distinct user roles (Super Admin, Vendor, Customer,
Delivery Partner) sharing one platform.

> **Status**: Phase 3 of 11 complete — foundation, authentication & RBAC,
> plus product & category management. See [`docs/ROADMAP.md`](docs/ROADMAP.md)
> for what's next.

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
| Vendor onboarding & approval | 4 |
| Customer browsing, search, wishlist | 5 |
| Cart & checkout | 6 |
| Multi-vendor order splitting, inventory, payment abstraction | 7 |
| Real-time delivery tracking (Socket.IO) | 8 |
| Reviews, coupons, notifications | 9 |
| Analytics, audit logs, hardening | 10 |
| Deployment & polish | 11 |

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
immediately without walking through the verification email step.

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
unique-slug generation, product ownership rules, product/category
validators — 50 tests, no database required) plus the health-check
integration tests (2 tests). Three further integration suites need a real
MongoDB connection and are skipped by default in environments without one
(shown as 3 skip-notice tests in the count, 55 total): the full auth flow
(register → login → refresh-rotation → logout, reuse detection, generic
error messages, deactivated-user rejection), category management (cycle
prevention, deletion guards, active-only public listing), and product
management (cross-vendor ownership enforcement, SKU uniqueness, status
transitions, public visibility rules):

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/auth.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/categories.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/products.test.js
```

Each suite creates its own isolated database and drops it when finished.

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
forgot/reset password, email verification, `/me`) and for category/
product management (public storefront listing/search/filtering, and the
vendor/admin managed endpoints with ownership enforcement) is in
[`docs/API.md`](docs/API.md). Vendor, order, and other domain endpoints
are added there as their phases ship.

## Health check

```
GET http://localhost:5000/api/v1/health
```

## Deployment

- **Frontend** → Vercel (static build, `client/`)
- **Backend** → Render or Railway (`server/`, exposes `PORT` from env)
- **Database** → MongoDB Atlas

Deployment steps and environment configuration are documented in full once
Phase 11 wires up CI/CD — the project is intentionally local-first until then.

## Future improvements

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full phase plan and the
list of enhancements intentionally deferred past Phase 11 (real payment
gateway, 2FA, search-at-scale, caching, recommendations).

---

Built as a portfolio project to demonstrate marketplace-domain system
design — distinct from a generic CRUD admin panel, and from a single-seller
storefront.
