import crypto from 'crypto';

const REQUEST_ID_HEADER = 'X-Request-ID';
// A caller-supplied request id is only trusted if it looks like a UUID —
// anything else (arbitrary length, control characters, etc.) is replaced
// with a freshly generated one rather than echoed back or logged as-is.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every request gets a correlation id, attached as `req.id` and echoed
 * back as `X-Request-ID` — the same id shows up in the access log line
 * (morgan), any error this request triggers (errorHandler), and the
 * response header, so a single request can be traced across all three
 * without needing full distributed tracing infrastructure for a project
 * at this scale. If the caller (e.g. a load balancer, or a frontend that
 * wants to correlate its own logs) already sent one, it's reused as-is
 * only after validating its shape — never trusted blindly into a log
 * line otherwise.
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && UUID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}
