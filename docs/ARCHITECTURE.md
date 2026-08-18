# Architecture — MarketSphere

## 1. System shape

MarketSphere is a monorepo with two independently deployable apps:

```
enterprise-marketplace/
├── client/   React + TypeScript SPA (Vercel)
├── server/   Express REST API + Socket.IO (Render/Railway)
└── docs/
```

They communicate over a versioned REST API (`/api/v1`) plus a WebSocket
channel for real-time delivery/order-status updates. There is no server-side
rendering and no shared backend-for-frontend layer — the SPA talks to the
API directly, which keeps the deployment story simple and matches what a
small product team would actually run for a project at this scale.

## 2. Backend layering

```
routes → controllers → services → repositories (where useful) → models
```

- **routes** — declare the URL, HTTP method, middleware chain (auth, RBAC,
  validation), and which controller handles it. No logic lives here.
- **controllers** — thin. Parse the request, call one service method,
  shape the response with `ApiResponse`. A controller should be readable
  top-to-bottom in under 15 lines.
- **services** — own business logic: order splitting across vendors,
  inventory reservation, coupon validation, refund workflows. Services can
  call other services (e.g. `orderService` calls `inventoryService`), but
  controllers never skip services to reach a model directly.
- **repositories** — introduced only where a model's queries are complex
  enough to be worth isolating (e.g. product search/filtering, order
  aggregation for analytics). Simple CRUD models are queried directly from
  their service — adding a repository around a five-line `findById` would
  be ceremony, not architecture.
- **models** — Mongoose schemas: validation, indexes, virtuals, and
  instance/static methods that are genuinely data-shape concerns (e.g. a
  `comparePassword` method on `User`).

This is deliberately **not** a full hexagonal/clean-architecture setup with
interfaces for every layer. A four-role marketplace with this many
concrete business flows benefits far more from being easy to trace through
than from swappable persistence — YAGNI applies.

## 3. Cross-cutting concerns

| Concern | Where it lives |
|---|---|
| Auth/session | `middleware/auth.js` (Phase 2), JWT access token + httpOnly refresh cookie |
| Authorization | `middleware/rbac.js` (Phase 2), role check per route |
| Validation | `validators/*.validator.js`, Zod schemas run before the controller |
| Error handling | `middleware/errorHandler.js` — the only place that writes an error response |
| Response shape | `utils/ApiResponse.js` — every success response goes through it |
| Logging | `config/logger.js` (Winston) — structured, used by both request logs and audit logs |
| Rate limiting | `middleware/rateLimiter.js` — a lenient global limiter, a strict one for auth routes |

## 4. Frontend layering

```
src/
├── components/   ui/ (Button, Card, Badge, Input — no business logic)
│               common/ (Logo, DirectoryStrip — app-aware but not domain-aware)
├── layouts/      StorefrontLayout, DashboardLayout, DeliveryLayout
├── pages/        route-level screens, grouped by shell (storefront/admin/vendor/delivery/auth)
├── features/     domain slices — one folder per business domain (auth/, cart/, catalog/…)
├── store/        Redux Toolkit store assembly
├── services/     apiClient.ts + one *.api.ts per domain (added as each domain ships)
├── hooks/        cross-cutting hooks (typed Redux hooks, etc.)
├── routes/       router.tsx — the single route tree
└── types/        shared TypeScript types mirrored from backend contracts
```

**One layout, three roles.** `DashboardLayout` is parameterized by
`navItems` and `roleLabel` rather than duplicated per role — Admin and
Vendor dashboards are structurally the same shell (sidebar + content) with
different navigation, so they share one component instead of drifting out
of sync. `DeliveryLayout` is a separate, mobile-first shell (top bar +
bottom tabs) because delivery partners work from a phone in the field, not
a desktop — that's a real UX difference, not an arbitrary one.

**State**: Redux Toolkit holds cross-cutting, multi-screen state — session
(Phase 2), wishlist (Phase 5). The test applied consistently since Phase 1
isn't "is this server data" but "does the same fact need to render
consistently in more than one place at once." Wishlist membership is the
clearest example: the same "is this product saved" fact has to show up on
a product card in a grid *and* the detail page *and* a header badge count,
all simultaneously — that's what makes it a Redux slice
(`features/wishlist/wishlistSlice.ts`) rather than a fetch hook. Product/
category browsing, by contrast, stays screen-local (`useProducts`,
`useCategories` — plain hooks over `useState`/`useEffect`, not slices):
a product listing's filters and results are read once per page visit and
don't need to be visible from anywhere else in the app at the same time.
Form inputs and toggles stay in component state either way — not every
piece of state needs to be global, and not every piece of server data
needs to be in Redux either.

## 5. Real-time layer

Socket.IO is initialized in Phase 1 (`sockets/index.js`) so the HTTP/WS
split is decided once. No business events are wired yet — Phase 7 adds
order-status push, Phase 8 adds delivery location/status updates. Each
feature registers its own event handlers in that same file rather than
spinning up a second WS server.

## 6. Why REST over GraphQL

A four-role marketplace has well-defined, role-scoped resources (a
vendor's products, a customer's orders, an admin's approval queue) that
map cleanly to REST routes with RBAC middleware per route. GraphQL's main
win — flexible client-driven queries — matters more for a small number of
highly-nested screens than for a system with clearly bounded resources per
role; REST also makes the security review (which route can which role
call) much easier to reason about, which matters for a marketplace
handling payments and PII.

## 7. Payment abstraction (why no gateway yet)

`services/paymentService.js` (added in Phase 7) will define a provider
interface — `initiate`, `verify`, `refund` — with an in-memory/mock
implementation for local development. Stripe or Razorpay can be plugged in
later by implementing the same interface, without touching order or
checkout logic. This mirrors how a real team would sequence the work:
business logic and webhooks-shaped architecture first, real money second.
