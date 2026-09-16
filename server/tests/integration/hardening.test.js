import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 9 hardening tests.
 *
 * Unlike the other integration suites, this one needs NO database — every
 * behavior under test (error envelope shape, request correlation,
 * malformed/oversized input handling, security headers, query-parameter
 * validation) is decided by middleware before any handler touches Mongo.
 * That's deliberate: these are exactly the guarantees that should be
 * verified on every CI run, not only on the runs where a replica set
 * happens to be provisioned.
 */

process.env.NODE_ENV = 'test';

const { default: app } = await import('../../src/app.js');

let server;
let base;

before(() => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api/v1`;
});

after(() => {
  server.close();
});

// ── error envelope ──────────────────────────────────────────────────────

test('every error response carries the machine-readable error.code envelope', async () => {
  const res = await fetch(`${base}/nonexistent-route`);
  assert.equal(res.status, 404);

  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
  // The pre-Phase-9 `message` field is still present and unchanged —
  // `error` is additive, so no existing frontend call site breaks.
  assert.equal(typeof body.message, 'string');
  assert.equal(body.error.message, body.message);
});

test('an authentication failure returns UNAUTHORIZED, not a generic 500', async () => {
  const res = await fetch(`${base}/cart`);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
});

test('a validation failure returns BAD_REQUEST with field-level detail', async () => {
  const res = await fetch(`${base}/products?page=0`);
  assert.equal(res.status, 400);

  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
});

test('no error response ever leaks a stack trace outside development', async () => {
  // NODE_ENV is 'test' here, so the isDev branch in errorHandler is off.
  const res = await fetch(`${base}/nonexistent-route`);
  const raw = await res.text();
  assert.ok(!raw.includes('at Object.'), 'response body contained a stack frame');
  assert.ok(!raw.includes('node_modules'), 'response body leaked an internal path');
});

// ── request correlation ────────────────────────────────────────────────

test('every response carries an X-Request-ID header', async () => {
  const res = await fetch(`${base}/health`);
  const id = res.headers.get('x-request-id');
  assert.ok(id, 'X-Request-ID header missing');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test('a well-formed caller-supplied request id is reused for correlation', async () => {
  const supplied = '123e4567-e89b-12d3-a456-426614174000';
  const res = await fetch(`${base}/health`, { headers: { 'X-Request-ID': supplied } });
  assert.equal(res.headers.get('x-request-id'), supplied);
});

test('a malformed caller-supplied request id is replaced, never echoed back', async () => {
  const hostile = '<script>alert(1)</script>';
  const res = await fetch(`${base}/health`, { headers: { 'X-Request-ID': hostile } });

  const returned = res.headers.get('x-request-id');
  assert.notEqual(returned, hostile);
  assert.match(returned, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test('error responses include the request id so a report can be traced to a log line', async () => {
  const supplied = '123e4567-e89b-12d3-a456-426614174000';
  const res = await fetch(`${base}/nonexistent-route`, { headers: { 'X-Request-ID': supplied } });
  assert.equal((await res.json()).requestId, supplied);
});

// ── malformed & oversized input ────────────────────────────────────────

test('a malformed JSON body is a 400, not an unhandled 500', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "a@b.com", ',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'BAD_REQUEST');
});

test('an oversized request body is rejected with 413, not a 500', async () => {
  // express.json is configured with a 10kb limit; this is comfortably over.
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(200000) }),
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('an invalid ObjectId in a path parameter is a 400, not a cast crash', async () => {
  const res = await fetch(`${base}/categories/not-a-valid-object-id`);
  assert.equal(res.status, 400);
});

// ── query parameter validation ─────────────────────────────────────────

test('pagination values are bounded — page below 1 is rejected', async () => {
  const res = await fetch(`${base}/products?page=0`);
  assert.equal(res.status, 400);
});

test('pagination values are bounded — limit above the maximum is rejected', async () => {
  const res = await fetch(`${base}/products?limit=100000`);
  assert.equal(res.status, 400);
});

test('a non-numeric pagination value is rejected rather than coerced to NaN', async () => {
  const res = await fetch(`${base}/products?page=abc`);
  assert.equal(res.status, 400);
});

test('sort is a closed enum — an arbitrary sort expression is rejected', async () => {
  // The client sends a sort *name* that maps to a fixed server-side sort
  // spec; there is no path for a caller to inject a Mongo sort document.
  const res = await fetch(`${base}/products?sort=__proto__`);
  assert.equal(res.status, 400);

  const injection = await fetch(`${base}/products?sort=${encodeURIComponent('{"price":-1}')}`);
  assert.equal(injection.status, 400);
});

// ── security headers & transport ───────────────────────────────────────

test('standard security headers are present on responses', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options'));
  // Helmet strips the framework fingerprint that Express sets by default.
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('rate limiting is active and advertises its budget', async () => {
  const res = await fetch(`${base}/health`);
  assert.ok(res.headers.get('ratelimit-limit'), 'RateLimit-Limit header missing');
  assert.ok(res.headers.get('ratelimit-remaining'), 'RateLimit-Remaining header missing');
});

// ── health endpoint ────────────────────────────────────────────────────

test('the health endpoint reports status, environment, uptime and db state', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);

  const { data } = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(typeof data.environment, 'string');
  assert.equal(typeof data.uptimeSeconds, 'number');
  assert.equal(typeof data.database, 'string');
});

test('the health endpoint exposes no secrets or connection strings', async () => {
  const raw = await (await fetch(`${base}/health`)).text();
  for (const leak of ['mongodb://', 'mongodb+srv://', 'SECRET', 'secret', 'password', 'JWT_']) {
    assert.ok(!raw.includes(leak), `health response leaked "${leak}"`);
  }
});
