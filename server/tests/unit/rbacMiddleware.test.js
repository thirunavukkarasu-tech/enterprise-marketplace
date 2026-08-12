import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../../src/middleware/rbac.js';

function makeReq(user) {
  return { user };
}

function makeNextCapture() {
  const calls = [];
  const next = (err) => calls.push(err);
  return { next, calls };
}

test('requireRole calls next() with no error when the role matches', () => {
  const middleware = requireRole('vendor', 'super_admin');
  const req = makeReq({ id: '1', role: 'vendor' });
  const { next, calls } = makeNextCapture();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], undefined);
});

test('requireRole calls next(ApiError forbidden) when the role does not match', () => {
  const middleware = requireRole('super_admin');
  const req = makeReq({ id: '1', role: 'customer' });
  const { next, calls } = makeNextCapture();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 403);
});

test('requireRole calls next(ApiError unauthorized) when req.user is missing', () => {
  const middleware = requireRole('vendor');
  const req = makeReq(undefined);
  const { next, calls } = makeNextCapture();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 401);
});

test('requireRole accepts multiple allowed roles', () => {
  const middleware = requireRole('vendor', 'customer', 'delivery_partner');
  const req = makeReq({ id: '1', role: 'delivery_partner' });
  const { next, calls } = makeNextCapture();

  middleware(req, {}, next);

  assert.equal(calls[0], undefined);
});
