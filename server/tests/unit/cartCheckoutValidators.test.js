import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCartItemSchema, updateCartItemSchema, getCartQuerySchema } from '../../src/validators/cart.validator.js';
import { createAddressSchema, updateAddressSchema } from '../../src/validators/address.validator.js';
import { checkoutReviewSchema } from '../../src/validators/checkout.validator.js';

const validId = '507f1f77bcf86cd799439011';

// ── cart ──────────────────────────────────────────────────────────────

test('addCartItemSchema accepts a valid item and defaults quantity to 1', async () => {
  const result = await addCartItemSchema.parseAsync({
    body: { productId: validId, sku: 'SKU-1' },
    query: {},
    params: {},
  });
  assert.equal(result.body.quantity, 1);
});

test('addCartItemSchema rejects a zero or negative quantity', async () => {
  await assert.rejects(() =>
    addCartItemSchema.parseAsync({ body: { productId: validId, sku: 'SKU-1', quantity: 0 }, query: {}, params: {} })
  );
  await assert.rejects(() =>
    addCartItemSchema.parseAsync({ body: { productId: validId, sku: 'SKU-1', quantity: -3 }, query: {}, params: {} })
  );
});

test('addCartItemSchema rejects a quantity above the maximum', async () => {
  await assert.rejects(() =>
    addCartItemSchema.parseAsync({ body: { productId: validId, sku: 'SKU-1', quantity: 21 }, query: {}, params: {} })
  );
});

test('addCartItemSchema rejects a malformed product id', async () => {
  await assert.rejects(() =>
    addCartItemSchema.parseAsync({ body: { productId: 'not-an-id', sku: 'SKU-1' }, query: {}, params: {} })
  );
});

test('addCartItemSchema rejects a non-integer quantity', async () => {
  await assert.rejects(() =>
    addCartItemSchema.parseAsync({ body: { productId: validId, sku: 'SKU-1', quantity: 1.5 }, query: {}, params: {} })
  );
});

test('updateCartItemSchema requires a valid itemId param and a positive integer quantity', async () => {
  const result = await updateCartItemSchema.parseAsync({ body: { quantity: 3 }, query: {}, params: { itemId: validId } });
  assert.equal(result.body.quantity, 3);

  await assert.rejects(() =>
    updateCartItemSchema.parseAsync({ body: { quantity: 3 }, query: {}, params: { itemId: 'bad-id' } })
  );
  await assert.rejects(() =>
    updateCartItemSchema.parseAsync({ body: { quantity: 0 }, query: {}, params: { itemId: validId } })
  );
});

test('getCartQuerySchema only accepts a known shipping method', async () => {
  const result = await getCartQuerySchema.parseAsync({ body: {}, params: {}, query: { shippingMethod: 'express' } });
  assert.equal(result.query.shippingMethod, 'express');

  await assert.rejects(() =>
    getCartQuerySchema.parseAsync({ body: {}, params: {}, query: { shippingMethod: 'overnight-drone' } })
  );
});

// ── address ───────────────────────────────────────────────────────────

function validAddressBody(overrides = {}) {
  return {
    fullName: 'Jane Doe',
    phone: '+1 555-123-4567',
    line1: '123 Market St',
    city: 'Springfield',
    state: 'IL',
    country: 'USA',
    postalCode: '62704',
    ...overrides,
  };
}

test('createAddressSchema accepts a fully valid address and defaults label to home', async () => {
  const result = await createAddressSchema.parseAsync({ body: validAddressBody(), query: {}, params: {} });
  assert.equal(result.body.label, 'home');
});

test('createAddressSchema rejects a missing required field', async () => {
  const body = validAddressBody();
  delete body.city;
  await assert.rejects(() => createAddressSchema.parseAsync({ body, query: {}, params: {} }));
});

test('createAddressSchema rejects an invalid phone number', async () => {
  await assert.rejects(() =>
    createAddressSchema.parseAsync({ body: validAddressBody({ phone: 'abc' }), query: {}, params: {} })
  );
});

test('createAddressSchema rejects an invalid label', async () => {
  await assert.rejects(() =>
    createAddressSchema.parseAsync({ body: validAddressBody({ label: 'vacation-home' }), query: {}, params: {} })
  );
});

test('updateAddressSchema allows a partial body but still validates a provided field and the id param', async () => {
  const result = await updateAddressSchema.parseAsync({ body: { city: 'New City' }, query: {}, params: { id: validId } });
  assert.equal(result.body.city, 'New City');

  await assert.rejects(() =>
    updateAddressSchema.parseAsync({ body: { city: 'New City' }, query: {}, params: { id: 'bad-id' } })
  );
});

// ── checkout ──────────────────────────────────────────────────────────

test('checkoutReviewSchema requires a shippingAddressId and defaults shippingMethod to standard', async () => {
  const result = await checkoutReviewSchema.parseAsync({ body: { shippingAddressId: validId }, query: {}, params: {} });
  assert.equal(result.body.shippingMethod, 'standard');
});

test('checkoutReviewSchema rejects a missing shippingAddressId', async () => {
  await assert.rejects(() => checkoutReviewSchema.parseAsync({ body: {}, query: {}, params: {} }));
});

test('checkoutReviewSchema rejects a malformed billingAddressId', async () => {
  await assert.rejects(() =>
    checkoutReviewSchema.parseAsync({
      body: { shippingAddressId: validId, billingAddressId: 'not-an-id' },
      query: {},
      params: {},
    })
  );
});
