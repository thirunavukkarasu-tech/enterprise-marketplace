# Security — MarketSphere

> Status note: Phase 2 (Authentication & RBAC) is implemented — §1–§2 and
> §4 below describe what's actually running, not a plan. §8 onward remain
> forward-looking, as noted per section.

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
- Role membership answers "can this role call this route at all." It does
  not answer "does this specific vendor own this specific resource" —
  that's a separate, resource-level ownership check the service layer for
  each domain is responsible for once that domain exists (e.g. a vendor
  editing only their own products in Phase 3, or their own orders in
  Phase 7). No resource-owning domain exists yet as of Phase 2, so there's
  no ownership check to document here yet — it'll be added to this file
  alongside the code that implements it.

## 3. Input validation

- Every auth request body passes through a Zod schema (`validators/auth.validator.js`)
  before reaching a controller. Validation failures return a `400` with
  field-level messages, never a raw stack trace. The same `validate()`
  middleware factory (`middleware/validate.js`) is reused for every future
  domain's validators, not rewritten per route.
- `express-mongo-sanitize` strips any key starting with `$` or containing
  `.` from `req.body`/`query`/`params` before it can reach a Mongoose
  query — the standard defense against NoSQL operator injection
  (`{ "$gt": "" }`-style payloads).
- `hpp` guards against HTTP parameter pollution (repeated query keys used
  to smuggle unexpected array values into a handler expecting a string).

## 4. Transport & headers

- **Helmet** sets standard security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, a Content-Security-Policy in production, etc.).
- **CORS** is locked to the single configured client origin
  (`CLIENT_URL`), with `credentials: true` since the refresh cookie must
  travel cross-origin between the Vercel-hosted client and the
  Render/Railway-hosted API.
- All cookies are `secure` in production (HTTPS-only) and signed
  (`COOKIE_SECRET`).

## 5. Rate limiting (Phase 1 global limiter; Phase 2 applies it to auth routes)

- A lenient **global limiter** on all `/api/v1/*` routes protects against
  basic abuse without bothering normal traffic.
- A strict **auth limiter** (20 requests / 15 min per IP) applies to
  `register`, `login`, `refresh`, `forgot-password`, and `reset-password`
  — brute-force, credential-stuffing, and refresh-token-guessing targets
  all need a much tighter window than general API traffic. `logout` and
  `me` are intentionally left off this limiter — they're not attack
  surfaces in the same way, and a legitimate user shouldn't be throttled
  for normal use.

## 6. Error handling

- All errors funnel through one `errorHandler` middleware. Operational
  errors (`ApiError`, expected 4xx conditions) return their real message.
  Non-operational errors (unexpected bugs, a 500) always return a generic
  "Something went wrong" message to the client — the real error and stack
  trace are logged server-side only, never leaked in the response, even in
  a way that could reveal internal file paths or library versions.

## 7. File uploads (Phase 4+ — not yet implemented)

- Uploads (product images, vendor KYC documents) are validated by
  MIME-type allowlist and size limit before being forwarded to object
  storage — never trusted based on file extension alone, and never written
  to the API server's own disk.

## 8. Secrets

- All secrets (JWT signing keys, DB URI, storage credentials) are read
  from environment variables via a single validated `config/env.js` —
  nothing is hardcoded, nothing is committed. `.env` is gitignored;
  `.env.example` documents every variable a deployer needs to set without
  containing any real value.

## 9. Audit logging (Phase 10 — not yet implemented)

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

## 10. What's intentionally deferred

No payment gateway is integrated yet (see `ARCHITECTURE.md` §7) — there is
no PCI-scope surface to secure in Phase 1–6. Two-factor authentication and
device/session management (viewing and revoking active sessions) are
listed in `ROADMAP.md` as future hardening, not core to a marketplace MVP.
