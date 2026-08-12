import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDurationToMs } from '../../src/utils/parseDuration.js';

test('parseDurationToMs converts minutes, hours, days, seconds correctly', () => {
  assert.equal(parseDurationToMs('15m'), 15 * 60 * 1000);
  assert.equal(parseDurationToMs('7d'), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseDurationToMs('1h'), 60 * 60 * 1000);
  assert.equal(parseDurationToMs('30s'), 30 * 1000);
});

test('parseDurationToMs throws on an invalid format', () => {
  assert.throws(() => parseDurationToMs('banana'));
  assert.throws(() => parseDurationToMs('15'));
  assert.throws(() => parseDurationToMs('15x'));
});
