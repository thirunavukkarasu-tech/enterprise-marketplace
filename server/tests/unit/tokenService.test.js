import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, hashToken, generateRawToken } =
  await import('../../src/utils/tokenService.js');

const fakeUser = { _id: { toString: () => '507f1f77bcf86cd799439011' }, role: 'customer' };

test('signAccessToken / verifyAccessToken round-trip carries sub and role', () => {
  const token = signAccessToken(fakeUser);
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.equal(payload.role, 'customer');
});

test('verifyAccessToken rejects a tampered token', () => {
  const token = signAccessToken(fakeUser);
  const tampered = token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
  assert.throws(() => verifyAccessToken(tampered));
});

test('signRefreshToken / verifyRefreshToken round-trip carries sub, family, jti', () => {
  const token = signRefreshToken({ sub: 'user123', family: 'fam-1', jti: 'jti-1' });
  const payload = verifyRefreshToken(token);
  assert.equal(payload.sub, 'user123');
  assert.equal(payload.family, 'fam-1');
  assert.equal(payload.jti, 'jti-1');
});

test('access token secret and refresh token secret are not interchangeable', () => {
  const accessToken = signAccessToken(fakeUser);
  assert.throws(() => verifyRefreshToken(accessToken));
});

test('hashToken is deterministic and collision-resistant across different inputs', () => {
  const a = hashToken('same-input');
  const b = hashToken('same-input');
  const c = hashToken('different-input');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64); // sha256 hex digest length
});

test('generateRawToken produces high-entropy, unique tokens', () => {
  const t1 = generateRawToken();
  const t2 = generateRawToken();
  assert.notEqual(t1, t2);
  assert.equal(t1.length, 64); // 32 bytes hex-encoded
});
