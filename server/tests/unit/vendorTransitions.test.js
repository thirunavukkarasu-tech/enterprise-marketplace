import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENDOR_STATUS, VENDOR_STATUS_TRANSITIONS, ALL_VENDOR_STATUSES } from '../../src/constants/roles.js';

test('every status has a defined (even if empty) transition list', () => {
  for (const status of ALL_VENDOR_STATUSES) {
    assert.ok(Array.isArray(VENDOR_STATUS_TRANSITIONS[status]), `${status} should have a transitions array`);
  }
});

test('PENDING can move to APPROVED or REJECTED, and nowhere else', () => {
  const allowed = VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.PENDING];
  assert.deepEqual(new Set(allowed), new Set([VENDOR_STATUS.APPROVED, VENDOR_STATUS.REJECTED]));
});

test('APPROVED can only move to SUSPENDED', () => {
  assert.deepEqual(VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.APPROVED], [VENDOR_STATUS.SUSPENDED]);
});

test('SUSPENDED can only move back to APPROVED (reactivation)', () => {
  assert.deepEqual(VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.SUSPENDED], [VENDOR_STATUS.APPROVED]);
});

test('REJECTED is terminal — no further admin transition is defined', () => {
  assert.deepEqual(VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.REJECTED], []);
});

test('a vendor can never jump straight from PENDING to SUSPENDED', () => {
  assert.ok(!VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.PENDING].includes(VENDOR_STATUS.SUSPENDED));
});

test('a vendor can never jump straight from APPROVED to REJECTED', () => {
  assert.ok(!VENDOR_STATUS_TRANSITIONS[VENDOR_STATUS.APPROVED].includes(VENDOR_STATUS.REJECTED));
});
