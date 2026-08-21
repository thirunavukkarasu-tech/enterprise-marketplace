import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals } from '../../src/services/cartPricingService.js';
import { CART_ITEM_ISSUE } from '../../src/constants/cart.js';
import { SHIPPING_METHOD } from '../../src/constants/shipping.js';

function item(overrides = {}) {
  return {
    itemId: 'item1',
    product: 'prod1',
    sku: 'SKU-1',
    quantity: 1,
    priceSnapshot: 10,
    currentPrice: 10,
    availableStock: 5,
    issue: null,
    lineSubtotal: 10,
    ...overrides,
  };
}

test('calculateTotals sums line subtotals into the cart subtotal', () => {
  const totals = calculateTotals([
    item({ lineSubtotal: 10, quantity: 1 }),
    item({ lineSubtotal: 30, quantity: 3 }),
  ]);
  assert.equal(totals.subtotal, 40);
  assert.equal(totals.itemCount, 4);
});

test('calculateTotals returns zero discount and zero tax (unimplemented extension points)', () => {
  const totals = calculateTotals([item({ lineSubtotal: 100 })]);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.taxAmount, 0);
});

test('calculateTotals applies the standard shipping fee (free) when items are present', () => {
  const totals = calculateTotals([item()], { shippingMethod: SHIPPING_METHOD.STANDARD });
  assert.equal(totals.shippingFee, 0);
  assert.equal(totals.shippingMethod, 'standard');
});

test('calculateTotals applies the express shipping fee when requested', () => {
  const totals = calculateTotals([item()], { shippingMethod: SHIPPING_METHOD.EXPRESS });
  assert.equal(totals.shippingFee, 15);
  assert.equal(totals.grandTotal, item().lineSubtotal + 15);
});

test('calculateTotals charges no shipping fee for an empty cart', () => {
  const totals = calculateTotals([], { shippingMethod: SHIPPING_METHOD.EXPRESS });
  assert.equal(totals.shippingFee, 0);
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.grandTotal, 0);
});

test('grand total is subtotal minus discount plus tax plus shipping', () => {
  const totals = calculateTotals([item({ lineSubtotal: 50 })], { shippingMethod: SHIPPING_METHOD.EXPRESS });
  assert.equal(totals.grandTotal, 50 - 0 + 0 + 15);
});

test('a blocking issue (out of stock) is reflected in hasBlockingIssues and contributes zero to the subtotal', () => {
  const totals = calculateTotals([
    item({ lineSubtotal: 20 }),
    item({ lineSubtotal: 0, issue: CART_ITEM_ISSUE.OUT_OF_STOCK, availableStock: 0 }),
  ]);
  assert.equal(totals.hasBlockingIssues, true);
  assert.equal(totals.subtotal, 20);
});

test('insufficient stock is also a blocking issue', () => {
  const totals = calculateTotals([item({ lineSubtotal: 0, issue: CART_ITEM_ISSUE.INSUFFICIENT_STOCK })]);
  assert.equal(totals.hasBlockingIssues, true);
});

test('product/variant unavailable are blocking issues', () => {
  assert.equal(
    calculateTotals([item({ issue: CART_ITEM_ISSUE.PRODUCT_UNAVAILABLE, lineSubtotal: 0 })]).hasBlockingIssues,
    true
  );
  assert.equal(
    calculateTotals([item({ issue: CART_ITEM_ISSUE.VARIANT_UNAVAILABLE, lineSubtotal: 0 })]).hasBlockingIssues,
    true
  );
});

test('a price change is non-blocking but is flagged with the exact required customer-facing message', () => {
  const totals = calculateTotals([item({ issue: CART_ITEM_ISSUE.PRICE_CHANGED, lineSubtotal: 15 })]);
  assert.equal(totals.hasBlockingIssues, false);
  assert.equal(totals.hasPriceChanges, true);
  assert.equal(totals.priceChangeMessage, 'One or more item prices have changed. Please review your cart before checkout.');
});

test('no price change means no message and hasPriceChanges is false', () => {
  const totals = calculateTotals([item({ issue: null })]);
  assert.equal(totals.hasPriceChanges, false);
  assert.equal(totals.priceChangeMessage, null);
});

test('totals are rounded to 2 decimal places even with floating-point-prone inputs', () => {
  const totals = calculateTotals([item({ lineSubtotal: 10.1 }), item({ lineSubtotal: 20.2 })]);
  assert.equal(totals.subtotal, 30.3);
});
