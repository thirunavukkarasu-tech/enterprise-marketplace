import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicFilter, buildManagedFilter, buildSort } from '../../src/repositories/product.repository.js';
import { PRODUCT_SORT_OPTIONS } from '../../src/constants/product.js';

test('buildPublicFilter always restricts to active status, even with no other filters', () => {
  const filter = buildPublicFilter({});
  assert.deepEqual(filter, { status: { $in: ['active'] } });
});

test('buildPublicFilter adds a text search clause when q is present', () => {
  const filter = buildPublicFilter({ q: 'wireless headphones' });
  assert.deepEqual(filter.$text, { $search: 'wireless headphones' });
});

test('buildPublicFilter adds a category filter', () => {
  const filter = buildPublicFilter({ category: 'cat123' });
  assert.equal(filter.category, 'cat123');
});

test('buildPublicFilter combines minPrice and maxPrice into a single range', () => {
  const filter = buildPublicFilter({ minPrice: 10, maxPrice: 50 });
  assert.deepEqual(filter['priceRange.min'], { $gte: 10, $lte: 50 });
});

test('buildPublicFilter handles a one-sided price range', () => {
  assert.deepEqual(buildPublicFilter({ minPrice: 10 })['priceRange.min'], { $gte: 10 });
  assert.deepEqual(buildPublicFilter({ maxPrice: 50 })['priceRange.min'], { $lte: 50 });
});

test('buildManagedFilter scopes to a vendor id when provided', () => {
  const filter = buildManagedFilter({ vendor: 'vendor-a' });
  assert.equal(filter.vendor, 'vendor-a');
});

test('buildManagedFilter has no status restriction by default (unlike the public filter)', () => {
  const filter = buildManagedFilter({});
  assert.equal(filter.status, undefined);
});

test('buildManagedFilter applies an explicit status filter when given one', () => {
  const filter = buildManagedFilter({ status: 'draft' });
  assert.equal(filter.status, 'draft');
});

test('buildSort maps every sort option to the expected Mongo sort spec', () => {
  assert.deepEqual(buildSort(PRODUCT_SORT_OPTIONS.PRICE_ASC), { 'priceRange.min': 1 });
  assert.deepEqual(buildSort(PRODUCT_SORT_OPTIONS.PRICE_DESC), { 'priceRange.min': -1 });
  assert.deepEqual(buildSort(PRODUCT_SORT_OPTIONS.RATING), { ratingAverage: -1, ratingCount: -1 });
  assert.deepEqual(buildSort(PRODUCT_SORT_OPTIONS.TITLE_ASC), { title: 1 });
  assert.deepEqual(buildSort(PRODUCT_SORT_OPTIONS.NEWEST), { createdAt: -1 });
});

test('buildSort defaults to newest-first for an unrecognized value', () => {
  assert.deepEqual(buildSort('not-a-real-option'), { createdAt: -1 });
});
