import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStockStatus, STOCK_STATUS, DEFAULT_LOW_STOCK_THRESHOLD, INVENTORY_CHANGE_TYPE } from '../../src/constants/inventory.js';

test('zero available stock is OUT_OF_STOCK', () => {
  assert.equal(getStockStatus(0), STOCK_STATUS.OUT_OF_STOCK);
});

test('negative available stock (should never happen, but is handled) is still OUT_OF_STOCK, not a crash', () => {
  assert.equal(getStockStatus(-3), STOCK_STATUS.OUT_OF_STOCK);
});

test('stock at exactly the low-stock threshold is LOW_STOCK', () => {
  assert.equal(getStockStatus(DEFAULT_LOW_STOCK_THRESHOLD), STOCK_STATUS.LOW_STOCK);
});

test('stock one above the threshold is IN_STOCK', () => {
  assert.equal(getStockStatus(DEFAULT_LOW_STOCK_THRESHOLD + 1), STOCK_STATUS.IN_STOCK);
});

test('a custom threshold is respected', () => {
  assert.equal(getStockStatus(10, 20), STOCK_STATUS.LOW_STOCK);
  assert.equal(getStockStatus(21, 20), STOCK_STATUS.IN_STOCK);
});

test('plenty of stock is IN_STOCK', () => {
  assert.equal(getStockStatus(500), STOCK_STATUS.IN_STOCK);
});

test('INVENTORY_CHANGE_TYPE distinguishes manual adjustments from sales', () => {
  assert.equal(INVENTORY_CHANGE_TYPE.ADJUSTMENT, 'adjustment');
  assert.equal(INVENTORY_CHANGE_TYPE.SALE, 'sale');
  assert.notEqual(INVENTORY_CHANGE_TYPE.ADJUSTMENT, INVENTORY_CHANGE_TYPE.SALE);
});

// ── the "cannot go negative" rule as inventoryService.adjust applies it ──
// (a small pure re-implementation of the check, since the real function
// requires a DB-backed product — see tests/integration/adminOperations.test.js
// for the full end-to-end version against a real MongoDB instance)

function wouldGoNegative(currentStock, quantityChange) {
  return currentStock + quantityChange < 0;
}

test('an adjustment that would take stock below zero is flagged', () => {
  assert.equal(wouldGoNegative(5, -10), true);
});

test('an adjustment that reduces stock to exactly zero is allowed', () => {
  assert.equal(wouldGoNegative(5, -5), false);
});

test('a positive adjustment (restock) is always allowed', () => {
  assert.equal(wouldGoNegative(0, 100), false);
});
