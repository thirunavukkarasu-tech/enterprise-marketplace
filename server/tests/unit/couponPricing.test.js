import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals } from '../../src/services/cartPricingService.js';

function item(lineSubtotal, overrides = {}) {
  return {
    itemId: 'i1',
    product: 'p1',
    sku: 'SKU-1',
    quantity: 1,
    currentPrice: lineSubtotal,
    availableStock: 10,
    issue: null,
    lineSubtotal,
    ...overrides,
  };
}

function coupon(overrides = {}) {
  return {
    code: 'SAVE10',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: null,
    minOrderValue: 0,
    ...overrides,
  };
}

test('percentage discount is calculated against the eligible subtotal', () => {
  const totals = calculateTotals([item(100)], { coupon: coupon({ discountType: 'percentage', discountValue: 20 }) });
  assert.equal(totals.discountAmount, 20);
  assert.equal(totals.subtotal, 100);
});

test('fixed discount subtracts a flat amount regardless of subtotal size', () => {
  const totals = calculateTotals([item(100)], { coupon: coupon({ discountType: 'fixed', discountValue: 15 }) });
  assert.equal(totals.discountAmount, 15);
});

test('maxDiscountAmount caps a percentage discount', () => {
  const totals = calculateTotals([item(1000)], {
    coupon: coupon({ discountType: 'percentage', discountValue: 50, maxDiscountAmount: 100 }),
  });
  // 50% of 1000 = 500, but capped at 100
  assert.equal(totals.discountAmount, 100);
});

test('a fixed discount larger than the subtotal is clamped to the subtotal, never negative total', () => {
  const totals = calculateTotals([item(20)], { coupon: coupon({ discountType: 'fixed', discountValue: 500 }) });
  assert.equal(totals.discountAmount, 20);
  assert.ok(totals.grandTotal >= 0);
  assert.equal(totals.grandTotal, 0 + totals.shippingFee);
});

test('no coupon means zero discount, not undefined or null arithmetic', () => {
  const totals = calculateTotals([item(50)], { coupon: null });
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.couponCode, null);
});

test('a blocked (out-of-stock) line item contributes nothing to the discountable subtotal', () => {
  const blocked = item(0, { lineSubtotal: 0, issue: 'out_of_stock', availableStock: 0 });
  const totals = calculateTotals([item(100), blocked], { coupon: coupon({ discountType: 'fixed', discountValue: 30 }) });
  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discountAmount, 30);
});

test('discount amount is always rounded to 2 decimal places', () => {
  const totals = calculateTotals([item(33.33)], { coupon: coupon({ discountType: 'percentage', discountValue: 33 }) });
  const decimals = totals.discountAmount.toString().split('.')[1]?.length ?? 0;
  assert.ok(decimals <= 2);
});

test('grand total reflects subtotal minus discount plus shipping (tax stays zero)', () => {
  const totals = calculateTotals([item(100)], { coupon: coupon({ discountType: 'fixed', discountValue: 10 }) });
  assert.equal(totals.taxAmount, 0);
  assert.equal(totals.grandTotal, Number((100 - 10 + totals.shippingFee).toFixed(2)));
});
