import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATUS, ORDER_STATUS_TRANSITIONS, ALL_ORDER_STATUSES } from '../../src/constants/order.js';

test('every order status has a defined (even if empty) transition list', () => {
  for (const status of ALL_ORDER_STATUSES) {
    assert.ok(Array.isArray(ORDER_STATUS_TRANSITIONS[status]), `${status} should have a transitions array`);
  }
});

test('PENDING can move to CONFIRMED or CANCELLED, and nowhere else', () => {
  assert.deepEqual(
    new Set(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PENDING]),
    new Set([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED])
  );
});

test('the happy path follows PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED', () => {
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PENDING].includes(ORDER_STATUS.CONFIRMED));
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.CONFIRMED].includes(ORDER_STATUS.PROCESSING));
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PROCESSING].includes(ORDER_STATUS.SHIPPED));
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.SHIPPED].includes(ORDER_STATUS.DELIVERED));
});

test('CONFIRMED and PROCESSING can still be cancelled, but SHIPPED cannot', () => {
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.CONFIRMED].includes(ORDER_STATUS.CANCELLED));
  assert.ok(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PROCESSING].includes(ORDER_STATUS.CANCELLED));
  assert.ok(!ORDER_STATUS_TRANSITIONS[ORDER_STATUS.SHIPPED].includes(ORDER_STATUS.CANCELLED));
});

test('DELIVERED can only move to REFUNDED', () => {
  assert.deepEqual(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.DELIVERED], [ORDER_STATUS.REFUNDED]);
});

test('CANCELLED and REFUNDED are terminal states', () => {
  assert.deepEqual(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.CANCELLED], []);
  assert.deepEqual(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.REFUNDED], []);
});

test('an order can never jump straight from PENDING to SHIPPED or DELIVERED', () => {
  assert.ok(!ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PENDING].includes(ORDER_STATUS.SHIPPED));
  assert.ok(!ORDER_STATUS_TRANSITIONS[ORDER_STATUS.PENDING].includes(ORDER_STATUS.DELIVERED));
});

test('an order can never move backward (e.g. SHIPPED back to PROCESSING)', () => {
  assert.ok(!ORDER_STATUS_TRANSITIONS[ORDER_STATUS.SHIPPED].includes(ORDER_STATUS.PROCESSING));
  assert.ok(!ORDER_STATUS_TRANSITIONS[ORDER_STATUS.DELIVERED].includes(ORDER_STATUS.SHIPPED));
});
