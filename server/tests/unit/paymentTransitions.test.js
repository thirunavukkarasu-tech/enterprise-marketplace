import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_STATUS, PAYMENT_STATUS_TRANSITIONS } from '../../src/constants/order.js';

function isAllowed(from, to) {
  return (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

test('pending can move to processing, failed, or cancelled', () => {
  assert.ok(isAllowed(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING));
  assert.ok(isAllowed(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED));
  assert.ok(isAllowed(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELLED));
});

test('pending cannot jump directly to paid', () => {
  assert.equal(isAllowed(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID), false);
});

test('processing can move to paid, failed, or cancelled', () => {
  assert.ok(isAllowed(PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID));
  assert.ok(isAllowed(PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.FAILED));
  assert.ok(isAllowed(PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.CANCELLED));
});

test('paid can only move to refunded', () => {
  assert.ok(isAllowed(PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED));
  assert.equal(isAllowed(PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED), false);
  assert.equal(isAllowed(PAYMENT_STATUS.PAID, PAYMENT_STATUS.PENDING), false);
});

test('failed, cancelled, and refunded are all terminal — nothing transitions out of them', () => {
  assert.deepEqual(PAYMENT_STATUS_TRANSITIONS[PAYMENT_STATUS.FAILED], []);
  assert.deepEqual(PAYMENT_STATUS_TRANSITIONS[PAYMENT_STATUS.CANCELLED], []);
  assert.deepEqual(PAYMENT_STATUS_TRANSITIONS[PAYMENT_STATUS.REFUNDED], []);
});

test('every status appears as a key in the transition table (no undefined lookups)', () => {
  for (const status of Object.values(PAYMENT_STATUS)) {
    assert.ok(status in PAYMENT_STATUS_TRANSITIONS, `${status} missing from transition table`);
  }
});
