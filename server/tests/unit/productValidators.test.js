import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  addVariantSchema,
  listPublicProductsQuerySchema,
} from '../../src/validators/product.validator.js';
import { createCategorySchema } from '../../src/validators/category.validator.js';

const validObjectId = '507f1f77bcf86cd799439011';

test('createProductSchema accepts a valid product with one variant', async () => {
  const result = await createProductSchema.parseAsync({
    body: {
      title: 'Wireless Mouse',
      category: validObjectId,
      variants: [{ sku: 'MOUSE-BLK', price: 25, stock: 10 }],
    },
    query: {},
    params: {},
  });
  assert.equal(result.body.title, 'Wireless Mouse');
  assert.equal(result.body.variants[0].price, 25);
});

test('createProductSchema rejects a product with zero variants', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: { title: 'No Variants', category: validObjectId, variants: [] },
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects a negative price', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: {
        title: 'Bad Price',
        category: validObjectId,
        variants: [{ sku: 'BAD-1', price: -5, stock: 1 }],
      },
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects a negative stock', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: {
        title: 'Bad Stock',
        category: validObjectId,
        variants: [{ sku: 'BAD-2', price: 10, stock: -1 }],
      },
      query: {},
      params: {},
    })
  );
});

test('createProductSchema rejects a malformed category id', async () => {
  await assert.rejects(() =>
    createProductSchema.parseAsync({
      body: { title: 'Valid Title', category: 'not-an-object-id', variants: [{ sku: 'X-1', price: 1, stock: 1 }] },
      query: {},
      params: {},
    })
  );
});

test('addVariantSchema requires a sku and non-negative price', async () => {
  const result = await addVariantSchema.parseAsync({
    body: { sku: 'NEW-SKU', price: 12.5, stock: 3 },
    params: { id: validObjectId },
    query: {},
  });
  assert.equal(result.body.sku, 'NEW-SKU');

  await assert.rejects(() =>
    addVariantSchema.parseAsync({ body: { sku: '', price: 12.5 }, params: { id: validObjectId }, query: {} })
  );
});

test('listPublicProductsQuerySchema applies sensible pagination defaults', async () => {
  const result = await listPublicProductsQuerySchema.parseAsync({ query: {}, body: {}, params: {} });
  assert.equal(result.query.page, 1);
  assert.equal(result.query.limit, 20);
  assert.equal(result.query.sort, 'newest');
});

test('listPublicProductsQuerySchema rejects a page size above the max', async () => {
  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ query: { limit: 500 }, body: {}, params: {} })
  );
});

test('listPublicProductsQuerySchema rejects an unrecognized sort value', async () => {
  await assert.rejects(() =>
    listPublicProductsQuerySchema.parseAsync({ query: { sort: 'cheapest-first' }, body: {}, params: {} })
  );
});

test('createCategorySchema accepts a top-level category with no parent', async () => {
  const result = await createCategorySchema.parseAsync({
    body: { name: 'Electronics' },
    query: {},
    params: {},
  });
  assert.equal(result.body.name, 'Electronics');
  assert.equal(result.body.parent, null);
});

test('createCategorySchema rejects a name that is too short', async () => {
  await assert.rejects(() =>
    createCategorySchema.parseAsync({ body: { name: 'A' }, query: {}, params: {} })
  );
});
