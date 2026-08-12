import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * Full-flow integration tests against a real MongoDB connection.
 *
 * These are NOT run as part of `npm test` by default in the sandbox this
 * project was authored in — that environment has no local `mongod` and no
 * network path to download one. They ARE real, correct tests: point
 * TEST_MONGODB_URI at any reachable MongoDB instance (a local `mongod`,
 * `mongodb-memory-server`, or a scratch Atlas cluster) and run:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/auth.test.js
 *
 * The suite creates its own isolated database and drops it on completion.
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('auth integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
    console.log('  ⚠ Skipped: no TEST_MONGODB_URI configured in this environment.');
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = TEST_URI;

  const { default: app } = await import('../../src/app.js');
  const { User } = await import('../../src/models/User.model.js');
  const { RefreshToken } = await import('../../src/models/RefreshToken.model.js');

  let server;
  let baseUrl;

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  function extractCookie(res, name) {
    const raw = res.headers.get('set-cookie') || '';
    const match = raw.split(',').find((c) => c.trim().startsWith(`${name}=`));
    return match ? match.split(';')[0] : null;
  }

  test('register → login → me → refresh (rotation) → logout happy path', async () => {
    const email = 'flow@example.com';

    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Flow Test', email, password: 'Password1', role: 'customer' }),
    });
    assert.equal(registerRes.status, 201);
    const registerBody = await registerRes.json();
    assert.equal(registerBody.data.user.email, email);
    assert.equal(registerBody.data.user.isEmailVerified, false);
    assert.equal(registerBody.data.user.passwordHash, undefined); // never leaked

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.ok(loginBody.data.accessToken);
    const refreshCookie = extractCookie(loginRes, 'refreshToken');
    assert.ok(refreshCookie, 'expected Set-Cookie for refreshToken');

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.data.user.email, email);

    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    });
    assert.equal(refreshRes.status, 200);
    const refreshBody = await refreshRes.json();
    assert.ok(refreshBody.data.accessToken);
    assert.notEqual(refreshBody.data.accessToken, loginBody.data.accessToken);
    const rotatedCookie = extractCookie(refreshRes, 'refreshToken');
    assert.notEqual(rotatedCookie, refreshCookie);

    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(logoutRes.status, 200);
  });

  test('login fails with a generic message for wrong password', async () => {
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Wrong Pw', email: 'wrongpw@example.com', password: 'Password1', role: 'customer' }),
    });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrongpw@example.com', password: 'WrongPassword1' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.message, 'Invalid email or password');
  });

  test('login fails with the same generic message for a nonexistent email', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'Password1' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.message, 'Invalid email or password');
  });

  test('registering with role=super_admin is rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sneaky', email: 'sneaky@example.com', password: 'Password1', role: 'super_admin' }),
    });
    assert.equal(res.status, 400);
  });

  test('registering with a duplicate email returns 409', async () => {
    const email = 'dupe@example.com';
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'First', email, password: 'Password1', role: 'customer' }),
    });
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second', email, password: 'Password1', role: 'customer' }),
    });
    assert.equal(res.status, 409);
  });

  test('GET /auth/me without a token returns 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401);
  });

  test('refresh token reuse is detected and revokes the whole session family', async () => {
    const email = 'reuse@example.com';
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reuse Test', email, password: 'Password1', role: 'customer' }),
    });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    const originalCookie = extractCookie(loginRes, 'refreshToken');

    // Legitimate rotation — this consumes (revokes) the original token.
    const firstRefresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: originalCookie },
    });
    assert.equal(firstRefresh.status, 200);

    // An attacker (or a race) replays the now-revoked original token.
    const replay = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: originalCookie },
    });
    assert.equal(replay.status, 401);

    // The rotated token from the legitimate first refresh should now ALSO
    // be rejected, because reuse detection revoked the entire family.
    const rotatedCookie = extractCookie(firstRefresh, 'refreshToken');
    const legitimateButNowRevoked = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(legitimateButNowRevoked.status, 401);
  });

  test('forgot-password always returns 200 whether or not the account exists', async () => {
    const known = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrongpw@example.com' }),
    });
    const unknown = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'definitely-not-registered@example.com' }),
    });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(await known.json().then((b) => b.message), await unknown.json().then((b) => b.message));
  });

  test('reset-password with an invalid token returns 400', async () => {
    const res = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64), newPassword: 'NewPassword1' }),
    });
    assert.equal(res.status, 400);
  });

  test('a deactivated user cannot authenticate even with a valid access token', async () => {
    const email = 'deactivated@example.com';
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Deactivated', email, password: 'Password1', role: 'customer' }),
    });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    const { data } = await loginRes.json();

    await User.updateOne({ email }, { $set: { isActive: false } });

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    assert.equal(meRes.status, 401);
  });
}
