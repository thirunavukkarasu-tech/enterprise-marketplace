import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCategorySchema, updateCategorySchema, listCategoriesQuerySchema } from '../../src/validators/category.validator.js';

const validId = '507f1f77bcf86cd799439011';

test('createCategorySchema accepts a valid top-level category', async () => {
  const result = await createCategorySchema.parseAsync({
    body: { name: 'Electronics' },
    query: {},
    params: {},
  });
  assert.equal(result.body.name, 'Electronics');
});

test('createCategorySchema accepts a valid subcategory with a parent id', async () => {
  const result = await createCategorySchema.parseAsync({
    body: { name: 'Headphones', parent: validId },
    query: {},
    params: {},
  });
  assert.equal(result.body.parent, validId);
});

test('createCategorySchema rejects a name that is too short', async () => {
  await assert.rejects(() =>
    createCategorySchema.parseAsync({ body: { name: 'A' }, query: {}, params: {} })
  );
});

test('createCategorySchema rejects a malformed parent id', async () => {
  await assert.rejects(() =>
    createCategorySchema.parseAsync({ body: { name: 'Electronics', parent: 'not-an-id' }, query: {}, params: {} })
  );
});

test('createCategorySchema rejects an invalid image url', async () => {
  await assert.rejects(() =>
    createCategorySchema.parseAsync({
      body: { name: 'Electronics', image: { url: 'not-a-url' } },
      query: {},
      params: {},
    })
  );
});

test('updateCategorySchema requires a valid id param and allows a partial body', async () => {
  const result = await updateCategorySchema.parseAsync({
    body: { isActive: false },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.isActive, false);

  await assert.rejects(() =>
    updateCategorySchema.parseAsync({ body: { isActive: false }, query: {}, params: { id: 'bad-id' } })
  );
});

test('listCategoriesQuerySchema coerces the includeInactive string flag to a boolean', async () => {
  const withFlag = await listCategoriesQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { includeInactive: 'true' },
  });
  assert.equal(withFlag.query.includeInactive, true);

  const withoutFlag = await listCategoriesQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(withoutFlag.query.includeInactive, false);
});
