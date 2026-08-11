# Roadmap — MarketSphere

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation & architecture | ✅ Complete |
| 2 | Authentication & RBAC | ⏳ Next |
| 3 | Product & category management | Planned |
| 4 | Vendor management | Planned |
| 5 | Customer shopping experience | Planned |
| 6 | Cart & checkout | Planned |
| 7 | Orders, inventory & payments | Planned |
| 8 | Delivery & real-time tracking | Planned |
| 9 | Reviews, coupons & notifications | Planned |
| 10 | Analytics, audit logs, testing & hardening | Planned |
| 11 | Deployment, documentation & portfolio polish | Planned |

## Phase 2 preview — Authentication & RBAC

- User model + registration/login/logout
- Access + refresh token issuance, rotation, and reuse detection
- Email verification and password-reset flows (email sending stays
  abstracted behind an interface — no real SMTP provider wired yet)
- `requireAuth` and `requireRole(...)` middleware
- Protected-route wiring on the frontend (`<RequireAuth>` wrapper,
  role-aware redirects out of `/admin`, `/vendor`, `/delivery`)
- Session slice wired into the Redux store already scaffolded in Phase 1

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
