# Security — MarketSphere

## 1. Authentication (Phase 2)

- **Password storage**: bcrypt, cost factor 12. Never logged, never
  returned in any API response (enforced by a Mongoose `toJSON` transform
  that strips `passwordHash`).
- **Access token**: short-lived JWT (15 min default), returned in the
  response body, held in memory on the client (Redux) — never
  `localStorage`, to limit the blast radius of an XSS bug.
- **Refresh token**: longer-lived JWT (7 days), set as an `httpOnly`,
  `secure` (in production), `sameSite=strict` cookie. Never readable by
  client-side JavaScript.
- **Refresh token rotation + reuse detection**: each refresh issues a new
  refresh token and invalidates the old one (`refreshTokenVersion` on the
  `User` model). If an already-used/rotated token is presented again, that
  signals token theft — all sessions for that user are invalidated and
  re-authentication is required.
- **Generic authentication errors**: login failures return the same
  "Invalid email or password" message whether the email doesn't exist or
  the password is wrong — never reveal which one, to prevent user
  enumeration.

## 2. Authorization (RBAC)

- Every protected route declares the roles allowed to call it via a
  `requireRole(...roles)` middleware, checked **server-side only** — the
  frontend hiding a button is a UX nicety, never a security boundary.
- Resource-level checks go further than role checks where needed: a vendor
  with the `vendor` role can only mutate *their own* products/orders, not
  any vendor's — enforced in the service layer by scoping the query to
  `req.user.id`, not just checking the role.

## 3. Input validation

- Every request body/query/params that reaches a controller has already
  passed through a Zod schema in `validators/`. Validation failures return
  a `400` with field-level messages, never a raw stack trace.
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

## 5. Rate limiting

- A lenient **global limiter** on all `/api/v1/*` routes protects against
  basic abuse without bothering normal traffic.
- A strict **auth limiter** (20 requests / 15 min per IP) applies
  specifically to login, registration, and password-reset routes —
  brute-force and credential-stuffing targets need a much tighter window
  than general API traffic.

## 6. Error handling

- All errors funnel through one `errorHandler` middleware. Operational
  errors (`ApiError`, expected 4xx conditions) return their real message.
  Non-operational errors (unexpected bugs, a 500) always return a generic
  "Something went wrong" message to the client — the real error and stack
  trace are logged server-side only, never leaked in the response, even in
  a way that could reveal internal file paths or library versions.

## 7. File uploads (Phase 3/4)

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

## 9. Audit logging

- Security- and business-sensitive actions (login, vendor approval/
  rejection, role changes, refunds, order-status overrides) are written to
  an append-only `AuditLog` collection with the acting user, action, and
  target — the trail an admin or incident responder would need to
  reconstruct "who did what."

## 10. What's intentionally deferred

No payment gateway is integrated yet (see `ARCHITECTURE.md` §7) — there is
no PCI-scope surface to secure in Phase 1–6. Two-factor authentication and
device/session management (viewing and revoking active sessions) are
listed in `ROADMAP.md` as future hardening, not core to a marketplace MVP.
