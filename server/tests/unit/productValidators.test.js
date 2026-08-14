import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  updateProductStatusSchema,
  addVariantSchema,
  listPublicProductsQuerySchema,
} from '../../src/validators/product.validator.js';

const validCategory = '507f1f77bcf86cd799439011';
const validId = '507f1f77bcf86cd799439012';

function baseProductBody(overrides = {}) {
  return {
    title: 'Wireless Mouse',
    description: 'A reliable wireless mouse.',
    category: validCategory,
    variants: [{ sku: 'WM-001', price: 19.99, stock: 10 }],
    ...overrides,
  };
}

test('createProductSchema accepts a valid single-variant product', async () => {
  const result = await createProductSchema.parseAsync({ body: baseProductBody(), query: {}, params: {} });
  assert.equal(result.body.title, 'Wireless Mouse');
  assert.equal(result.body.variants[0].price, 19.99);
});

test('createProductSchema rejects a product with zero variants', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({ body: baseProductBody({ variants: [] }), query: {}, params: {} })
  );
});

test('createProductSchema rejects a negative or zero price', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: baseProductBody({ variants: [{ sku: 'X-1', price: 0, stock: 1 }] }),
      query: {},
      params: {},
    })
  );
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: baseProductBody({ variants: [{ sku: 'X-1', price: -5, stock: 1 }] }),
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects negative stock', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: baseProductBody({ variants: [{ sku: 'X-1', price: 5, stock: -1 }] }),
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects a SKU with invalid characters', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: baseProductBody({ variants: [{ sku: 'BAD SKU!', price: 5, stock: 1 }] }),
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects a malformed category id', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({ body: baseProductBody({ category: 'not-an-id' }), query: {}, params: {} })
  );
});

test('updateProductStatusSchema only accepts known status values', async () => {
  const result = await updateProductStatusSchema.parseAsync({
    body: { status: 'active' },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.status, 'active');

  await assert.rejects(() =>
    updateProductStatusSchema.parseAsync({ body: { status: 'published' }, query: {}, params: { id: validId } })
  );
});

test('addVariantSchema accepts an optional compareAtPrice greater than zero', async () => {
  const result = await addVariantSchema.parseAsync({
    body: { sku: 'X-2', price: 10, compareAtPrice: 15, stock: 3 },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.compareAtPrice, 15);
});

test('listPublicProductsQuerySchema applies pagination defaults and coerces numeric strings', async () => {
  const result = await listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(result.query.page, 1);
  assert.equal(result.query.limit, 20);

  const coerced = await listPublicProductsQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { page: '3', limit: '5', minPrice: '10.5' },
  });
  assert.equal(coerced.query.page, 3);
  assert.equal(coerced.query.limit, 5);
  assert.equal(coerced.query.minPrice, 10.5);
});

test('listPublicProductsQuerySchema rejects a limit above the maximum', async () => {
  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { limit: '500' } })
  );
});

test('listPublicProductsQuerySchema rejects an unknown sort value', async () => {
  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ body: {}, params: {}, query: { sort: 'most_expensive' } })
  );
});
