import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePriceRange } from '../../src/utils/pricing.js';

test('computePriceRange finds min and max across variants', () => {
  const result = computePriceRange([{ price: 25 }, { price: 10 }, { price: 40 }]);
  assert.deepEqual(result, { min: 10, max: 40 });
});

test('computePriceRange handles a single variant', () => {
  assert.deepEqual(computePriceRange([{ price: 15 }]), { min: 15, max: 15 });
});

test('computePriceRange returns zeros for an empty or missing variants array', () => {
  assert.deepEqual(computePriceRange([]), { min: 0, max: 0 });
  assert.deepEqual(computePriceRange(undefined), { min: 0, max: 0 });
  assert.deepEqual(computePriceRange(null), { min: 0, max: 0 });
});

test('computePriceRange ignores malformed price entries', () => {
  const result = computePriceRange([{ price: 20 }, { price: NaN }, { price: 'not-a-number' }]);
  assert.deepEqual(result, { min: 20, max: 20 });
});
