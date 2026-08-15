import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVendorSchema,
  updateVendorSchema,
  rejectVendorSchema,
  suspendVendorSchema,
  listVendorsQuerySchema,
  setVendorVerificationSchema,
} from '../../src/validators/vendor.validator.js';

const validId = '507f1f77bcf86cd799439011';

function baseVendorBody(overrides = {}) {
  return {
    storeName: 'Acme Supplies',
    businessEmail: 'contact@acme.test',
    businessPhone: '+1 555-123-4567',
    address: { line1: '123 Market St', city: 'Springfield', state: 'IL', country: 'USA', postalCode: '62704' },
    ...overrides,
  };
}

test('createVendorSchema accepts a complete, valid onboarding payload', async () => {
  const result = await createVendorSchema.parseAsync({ body: baseVendorBody(), query: {}, params: {} });
  assert.equal(result.body.storeName, 'Acme Supplies');
  assert.equal(result.body.businessEmail, 'contact@acme.test');
});

test('createVendorSchema rejects a missing address field', async () => {
  const body = baseVendorBody();
  delete body.address.city;
  await assert.rejects(() => createVendorSchema.parseAsync({ body, query: {}, params: {} }));
});

test('createVendorSchema rejects an invalid business email', async () => {
  await assert.rejects(() =>
    createVendorSchema.parseAsync({ body: baseVendorBody({ businessEmail: 'not-an-email' }), query: {}, params: {} })
  );
});

test('createVendorSchema rejects an invalid business phone', async () => {
  await assert.rejects(() =>
    createVendorSchema.parseAsync({ body: baseVendorBody({ businessPhone: 'call me maybe' }), query: {}, params: {} })
  );
});

test('createVendorSchema has no field for status, isVerified, or user — admin/system fields are simply absent', async () => {
  const result = await createVendorSchema.parseAsync({
    body: { ...baseVendorBody(), status: 'approved', isVerified: true, user: validId },
    query: {},
    params: {},
  });
  // Zod strips unknown keys by default (non-strict object) — these never
  // reach the service layer at all, let alone get persisted.
  assert.equal(result.body.status, undefined);
  assert.equal(result.body.isVerified, undefined);
  assert.equal(result.body.user, undefined);
});

test('updateVendorSchema accepts a partial update with just one field', async () => {
  const result = await updateVendorSchema.parseAsync({ body: { description: 'Updated description' }, query: {}, params: {} });
  assert.equal(result.body.description, 'Updated description');
});

test('rejectVendorSchema requires a meaningful (10+ char) reason', async () => {
  await assert.rejects(() =>
    rejectVendorSchema.parseAsync({ body: { reason: 'too short' }, query: {}, params: { id: validId } })
  );
  const result = await rejectVendorSchema.parseAsync({
    body: { reason: 'Business documentation could not be verified.' },
    query: {},
    params: { id: validId },
  });
  assert.ok(result.body.reason.length >= 10);
});

test('rejectVendorSchema requires a valid vendor id in params', async () => {
  await assert.rejects(() =>
    rejectVendorSchema.parseAsync({
      body: { reason: 'Business documentation could not be verified.' },
      query: {},
      params: { id: 'not-an-id' },
    })
  );
});

test('suspendVendorSchema allows an omitted reason', async () => {
  const result = await suspendVendorSchema.parseAsync({ body: {}, query: {}, params: { id: validId } });
  assert.equal(result.body.reason, undefined);
});

test('suspendVendorSchema still enforces a minimum length when a reason is provided', async () => {
  await assert.rejects(() =>
    suspendVendorSchema.parseAsync({ body: { reason: 'bad' }, query: {}, params: { id: validId } })
  );
});

test('listVendorsQuerySchema applies pagination defaults and coerces isVerified to a boolean', async () => {
  const defaults = await listVendorsQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(defaults.query.page, 1);
  assert.equal(defaults.query.isVerified, undefined);

  const withFlag = await listVendorsQuerySchema.parseAsync({ body: {}, params: {}, query: { isVerified: 'true' } });
  assert.equal(withFlag.query.isVerified, true);
});

test('listVendorsQuerySchema rejects an unknown status value', async () => {
  await assert.rejects(() =>
    listVendorsQuerySchema.parseAsync({ body: {}, params: {}, query: { status: 'banned' } })
  );
});

test('setVendorVerificationSchema requires a boolean isVerified and a valid id', async () => {
  const result = await setVendorVerificationSchema.parseAsync({
    body: { isVerified: true },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.isVerified, true);

  await assert.rejects(() =>
    setVendorVerificationSchema.parseAsync({ body: { isVerified: 'yes' }, query: {}, params: { id: validId } })
  );
  await assert.rejects(() =>
    setVendorVerificationSchema.parseAsync({ body: { isVerified: true }, query: {}, params: { id: 'bad-id' } })
  );
});
