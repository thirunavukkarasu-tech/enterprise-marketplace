import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageProduct } from '../../src/utils/ownership.js';

const VENDOR_A = 'vendor-a-id';
const VENDOR_B = 'vendor-b-id';

function product(vendorId) {
  return { vendor: { toString: () => vendorId } };
}

test('a super_admin can manage any product regardless of owner', () => {
  const admin = { id: 'admin-id', role: 'super_admin' };
  assert.equal(canManageProduct(admin, product(VENDOR_A)), true);
  assert.equal(canManageProduct(admin, product(VENDOR_B)), true);
});

test('a vendor can manage their own product', () => {
  const vendor = { id: VENDOR_A, role: 'vendor' };
  assert.equal(canManageProduct(vendor, product(VENDOR_A)), true);
});

test("a vendor cannot manage another vendor's product", () => {
  const vendorB = { id: VENDOR_B, role: 'vendor' };
  assert.equal(canManageProduct(vendorB, product(VENDOR_A)), false);
});

test('a customer can never manage a product, even one somehow flagged as their own id', () => {
  const customer = { id: VENDOR_A, role: 'customer' };
  assert.equal(canManageProduct(customer, product(VENDOR_A)), false);
});

test('a delivery partner can never manage a product', () => {
  const delivery = { id: VENDOR_A, role: 'delivery_partner' };
  assert.equal(canManageProduct(delivery, product(VENDOR_A)), false);
});
