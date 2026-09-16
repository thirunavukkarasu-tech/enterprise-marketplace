# Security Policy

MarketSphere is a portfolio project demonstrating production-oriented
engineering practices for a multi-vendor marketplace. It is **not a
deployed commercial service** and processes no real user data, real
payments, or real money — see [Scope](#scope) below for what that means
in practice.

## Supported versions

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |
| Older tags / phase branches | ❌ |

Only the current state of the `main` branch receives security fixes.
Earlier phase snapshots exist to show how the project was built up
incrementally and are not maintained.

## Reporting a vulnerability

If you find a security issue, please report it privately rather than
opening a public issue:

1. Open a [GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
   on this repository ("Security" tab → "Report a vulnerability"), or
2. If that isn't available to you, open a regular issue containing only
   "security issue — requesting private contact" with no technical
   detail, and a maintainer will follow up.

Please include, where you can:

- what the issue is and roughly how severe you think it is
- the steps to reproduce it
- the affected file, endpoint, or component
- anything you think a fix would need to account for

Please **do not** include real credentials, real personal data, or
third-party data in a report.

### What to expect

This is a personal project maintained in spare time, so this is a
best-effort commitment rather than a service-level guarantee:

- acknowledgement of your report as soon as reasonably possible
- an assessment of whether it's in scope and how severe it looks
- a fix on `main` for anything confirmed and in scope
- credit in the fix commit or advisory if you'd like it

### Responsible disclosure

Please give a reasonable window for a fix before publishing details.
Please don't run automated scanners against any deployed instance, access
or modify data that isn't yours, or do anything that degrades the service
for others. Testing against your own local checkout is always fine and is
the preferred way to investigate.

## Scope

**In scope** — issues in this repository's own code:

- authentication and session handling (JWT issuance, refresh token
  rotation and reuse detection, password reset)
- authorization and RBAC across the customer / vendor / delivery partner
  / admin roles
- IDOR / BOLA — any way to read or modify a resource belonging to another
  user, vendor, or customer
- server-side price, discount, coupon, or payment-status manipulation
- input validation gaps, injection, or unsafe error/data exposure
- secrets or credentials committed to the repository

**Out of scope:**

- **The mock payment provider.** This app integrates no real payment
  gateway. `server/src/utils/mockPaymentProvider.js` is explicitly a
  stand-in that moves no money, and the webhook endpoint has no
  signature verification because there is no real provider to sign
  anything — this is documented, deliberate, and noted as the extension
  point a real integration would fill. Reports that the mock is not a
  real gateway aren't findings.
- Missing hardening that depends on deployment infrastructure this
  repository doesn't own (WAF, TLS termination, network policy, secret
  managers).
- Findings that require an attacker to already have valid admin
  credentials.
- Automated scanner output with no demonstrated exploit path.
- Dependency advisories with no reachable path in this codebase — though
  these are still welcome as regular issues.

## Security practices in this project

For how security is actually implemented — authentication, RBAC,
per-resource ownership checks, server-authoritative pricing, validation,
rate limiting, secure error handling, and secret management — see
[`docs/SECURITY.md`](docs/SECURITY.md), which documents each phase's
decisions and the reasoning behind them.

Secrets are never committed: `.env` is gitignored, every environment
variable is validated at boot, and
[`server/.env.example`](server/.env.example) contains placeholders only.
