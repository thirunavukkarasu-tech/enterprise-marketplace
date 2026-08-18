import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listPublicProductsQuerySchema } from '../../src/validators/product.validator.js';
import { listCategoriesQuerySchema } from '../../src/validators/category.validator.js';
import { wishlistProductParamSchema } from '../../src/validators/wishlist.validator.js';
import { updateOwnUserSchema } from '../../src/validators/user.validator.js';

// ── product listing: inStock ────────────────────────────────────────────

test('listPublicProductsQuerySchema leaves inStock undefined when omitted', async () => {
  const result = await listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(result.query.inStock, undefined);
});

test('listPublicProductsQuerySchema coerces inStock=true and inStock=false to real booleans', async () => {
  const trueResult = await listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { inStock: 'true' } });
  assert.equal(trueResult.query.inStock, true);

  const falseResult = await listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { inStock: 'false' } });
  assert.equal(falseResult.query.inStock, false);
});

test('listPublicProductsQuerySchema rejects a non-boolean inStock value', async () => {
  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { inStock: 'yes' } })
  );
});

test('listPublicProductsQuerySchema accepts an optional vendor filter as a valid mongo id', async () => {
  const result = await listPublicProductsQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { vendor: '507f1f77bcf86cd799439011' },
  });
  assert.equal(result.query.vendor, '507f1f77bcf86cd799439011');

  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { vendor: 'not-an-id' } })
  );
});

// ── category listing: withCounts ────────────────────────────────────────

test('listCategoriesQuerySchema defaults withCounts to false when omitted', async () => {
  const result = await listCategoriesQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(result.query.withCounts, false);
});

test('listCategoriesQuerySchema coerces withCounts=true', async () => {
  const result = await listCategoriesQuerySchema.parseAsync({ body: {}, params: {}, query: { withCounts: 'true' } });
  assert.equal(result.query.withCounts, true);
});

// ── wishlist ─────────────────────────────────────────────────────────────

test('wishlistProductParamSchema accepts a valid product id', async () => {
  const result = await wishlistProductParamSchema.parseAsync({
    body: {},
    query: {},
    params: { productId: '507f1f77bcf86cd799439011' },
  });
  assert.equal(result.params.productId, '507f1f77bcf86cd799439011');
});

test('wishlistProductParamSchema rejects a malformed product id', async () => {
  await assert.rejects(() =>
    wishlistProductParamSchema.parseAsync({ body: {}, query: {}, params: { productId: 'not-an-id' } })
  );
});

// ── user self-profile ────────────────────────────────────────────────────

test('updateOwnUserSchema accepts a partial update with just a name', async () => {
  const result = await updateOwnUserSchema.parseAsync({ body: { name: 'New Name' }, query: {}, params: {} });
  assert.equal(result.body.name, 'New Name');
  assert.equal(result.body.phone, undefined);
});

test('updateOwnUserSchema rejects an invalid phone number', async () => {
  await assert.rejects(() =>
    updateOwnUserSchema.parseAsync({ body: { phone: 'not-a-phone-number!!' }, query: {}, params: {} })
  );
});

test('updateOwnUserSchema has no field for role, email, or any admin-controlled property', async () => {
  const result = await updateOwnUserSchema.parseAsync({
    body: { name: 'Legit Name', role: 'super_admin', isActive: false, passwordHash: 'x' },
    query: {},
    params: {},
  });
  // Zod strips unknown keys by default — a mass-assignment attempt in the
  // body simply doesn't survive parsing, regardless of what was sent.
  assert.equal(result.body.name, 'Legit Name');
  assert.equal('role' in result.body, false);
  assert.equal('isActive' in result.body, false);
  assert.equal('passwordHash' in result.body, false);
});
