import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageProduct } from '../../src/utils/ownership.js';

const vendorA = { id: 'vendor-a', role: 'vendor' };
const vendorB = { id: 'vendor-b', role: 'vendor' };
const admin = { id: 'admin-1', role: 'super_admin' };
const customer = { id: 'customer-1', role: 'customer' };

test('a vendor can manage their own product', () => {
  const product = { vendor: 'vendor-a' };
  assert.equal(canManageProduct(vendorA, product), true);
});

test('a vendor cannot manage another vendor\'s product', () => {
  const product = { vendor: 'vendor-a' };
  assert.equal(canManageProduct(vendorB, product), false);
});

test('super_admin can manage any product regardless of owner', () => {
  const product = { vendor: 'vendor-a' };
  assert.equal(canManageProduct(admin, product), true);
});

test('a customer can never manage a product', () => {
  const product = { vendor: 'customer-1' }; // even a contrived edge case
  assert.equal(canManageProduct(customer, product), false);
});

test('handles a populated vendor document (vendor._id) the same as a raw ObjectId', () => {
  const product = { vendor: { _id: 'vendor-a', name: 'Vendor A Store' } };
  assert.equal(canManageProduct(vendorA, product), true);
  assert.equal(canManageProduct(vendorB, product), false);
});

test('returns false when user or product is missing', () => {
  assert.equal(canManageProduct(null, { vendor: 'vendor-a' }), false);
  assert.equal(canManageProduct(vendorA, null), false);
});
