import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCouponSchema, updateCouponSchema, applyCouponSchema } from '../../src/validators/coupon.validator.js';
import { initiatePaymentSchema, verifyPaymentSchema, paymentWebhookSchema } from '../../src/validators/payment.validator.js';

const validId = '507f1f77bcf86cd799439011';

// ── coupon ──────────────────────────────────────────────────────────────

test('createCouponSchema accepts a valid percentage coupon', async () => {
  const result = await createCouponSchema.parseAsync({
    body: { code: 'SAVE10', discountType: 'percentage', discountValue: 10 },
    query: {},
    params: {},
  });
  assert.equal(result.body.code, 'SAVE10');
});

test('createCouponSchema rejects a percentage discount above the max', async () => {
  await assert.rejects(() =>
    createCouponSchema.parseAsync({
      body: { code: 'TOOMUCH', discountType: 'percentage', discountValue: 150 },
      query: {},
      params: {},
    })
  );
});

test('createCouponSchema allows a fixed discount above 100 (not subject to the percentage cap)', async () => {
  const result = await createCouponSchema.parseAsync({
    body: { code: 'BIGFIXED', discountType: 'fixed', discountValue: 500 },
    query: {},
    params: {},
  });
  assert.equal(result.body.discountValue, 500);
});

test('createCouponSchema rejects a negative or zero discount value', async () => {
  await assert.rejects(() =>
    createCouponSchema.parseAsync({ body: { code: 'BAD', discountType: 'fixed', discountValue: 0 }, query: {}, params: {} })
  );
  await assert.rejects(() =>
    createCouponSchema.parseAsync({ body: { code: 'BAD2', discountType: 'fixed', discountValue: -5 }, query: {}, params: {} })
  );
});

test('createCouponSchema rejects a code shorter than 3 characters', async () => {
  await assert.rejects(() =>
    createCouponSchema.parseAsync({ body: { code: 'AB', discountType: 'fixed', discountValue: 5 }, query: {}, params: {} })
  );
});

test('createCouponSchema rejects startsAt after expiresAt', async () => {
  await assert.rejects(() =>
    createCouponSchema.parseAsync({
      body: {
        code: 'BACKWARDS',
        discountType: 'fixed',
        discountValue: 5,
        startsAt: '2026-06-01',
        expiresAt: '2026-01-01',
      },
      query: {},
      params: {},
    })
  );
});

test('updateCouponSchema accepts a partial body with just isActive-adjacent fields', async () => {
  const result = await updateCouponSchema.parseAsync({
    body: { minOrderValue: 25 },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.minOrderValue, 25);
});

test('updateCouponSchema requires a valid mongo id param', async () => {
  await assert.rejects(() =>
    updateCouponSchema.parseAsync({ body: { minOrderValue: 25 }, query: {}, params: { id: 'not-an-id' } })
  );
});

test('applyCouponSchema requires a code of at least 3 characters', async () => {
  await assert.rejects(() => applyCouponSchema.parseAsync({ body: { code: 'AB' }, query: {}, params: {} }));
  const result = await applyCouponSchema.parseAsync({ body: { code: 'sav10' }, query: {}, params: {} });
  assert.equal(result.body.code, 'sav10'); // case normalization happens in the service, not here
});

// ── payment ───────────────────────────────────────────────────────────────

test('initiatePaymentSchema accepts a valid orderId and method', async () => {
  const result = await initiatePaymentSchema.parseAsync({
    body: { orderId: validId, method: 'card' },
    query: {},
    params: {},
  });
  assert.equal(result.body.orderId, validId);
});

test('initiatePaymentSchema has no field for amount, status, or transactionId', async () => {
  const result = await initiatePaymentSchema.parseAsync({
    body: { orderId: validId, method: 'card', amount: 1, status: 'paid', transactionId: 'FAKE' },
    query: {},
    params: {},
  });
  assert.equal('amount' in result.body, false);
  assert.equal('status' in result.body, false);
  assert.equal('transactionId' in result.body, false);
});

test('initiatePaymentSchema rejects an unknown payment method', async () => {
  await assert.rejects(() =>
    initiatePaymentSchema.parseAsync({ body: { orderId: validId, method: 'bitcoin' }, query: {}, params: {} })
  );
});

test('verifyPaymentSchema defaults simulate to success', async () => {
  const result = await verifyPaymentSchema.parseAsync({ body: {}, query: {}, params: { id: validId } });
  assert.equal(result.body.simulate, 'success');
});

test('paymentWebhookSchema requires eventId, provider, and type', async () => {
  await assert.rejects(() => paymentWebhookSchema.parseAsync({ body: {}, query: {}, params: {} }));
  const result = await paymentWebhookSchema.parseAsync({
    body: { eventId: 'evt_1', provider: 'mock', type: 'payment.succeeded' },
    query: {},
    params: {},
  });
  assert.equal(result.body.eventId, 'evt_1');
  assert.deepEqual(result.body.payload, {});
});
