import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderSchema, updateOrderStatusSchema, listAdminOrdersQuerySchema } from '../../src/validators/order.validator.js';
import { adjustInventorySchema, listInventoryQuerySchema } from '../../src/validators/inventory.validator.js';
import { listAuditLogsQuerySchema } from '../../src/validators/audit.validator.js';
import { listCustomersQuerySchema } from '../../src/validators/adminCustomer.validator.js';

const validId = '507f1f77bcf86cd799439011';

// ── order ────────────────────────────────────────────────────────────────

test('createOrderSchema requires a shippingAddressId and defaults shippingMethod to standard', async () => {
  const result = await createOrderSchema.parseAsync({ body: { shippingAddressId: validId }, query: {}, params: {} });
  assert.equal(result.body.shippingMethod, 'standard');
});

test('createOrderSchema rejects a malformed address id', async () => {
  await assert.rejects(() =>
    createOrderSchema.parseAsync({ body: { shippingAddressId: 'not-an-id' }, query: {}, params: {} })
  );
});

test('updateOrderStatusSchema only accepts known order statuses', async () => {
  const result = await updateOrderStatusSchema.parseAsync({
    body: { status: 'shipped' },
    query: {},
    params: { id: validId },
  });
  assert.equal(result.body.status, 'shipped');

  await assert.rejects(() =>
    updateOrderStatusSchema.parseAsync({ body: { status: 'shipped_and_lost' }, query: {}, params: { id: validId } })
  );
});

test('updateOrderStatusSchema treats groupId as optional (vendor omits it, admin/multi-vendor supplies it)', async () => {
  const withoutGroup = await updateOrderStatusSchema.parseAsync({
    body: { status: 'confirmed' },
    query: {},
    params: { id: validId },
  });
  assert.equal(withoutGroup.body.groupId, undefined);

  const withGroup = await updateOrderStatusSchema.parseAsync({
    body: { status: 'confirmed', groupId: validId },
    query: {},
    params: { id: validId },
  });
  assert.equal(withGroup.body.groupId, validId);
});

test('listAdminOrdersQuerySchema accepts admin-only filters (customer, vendor, date range)', async () => {
  const result = await listAdminOrdersQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { status: 'pending', customer: validId, vendor: validId, from: '2026-01-01', to: '2026-02-01' },
  });
  assert.equal(result.query.status, 'pending');
  assert.equal(result.query.customer, validId);
});

// ── inventory ────────────────────────────────────────────────────────────

test('adjustInventorySchema requires a non-zero quantityChange and a reason', async () => {
  await assert.rejects(() =>
    adjustInventorySchema.parseAsync({
      body: { sku: 'SKU-1', quantityChange: 0, reason: 'restock' },
      query: {},
      params: { productId: validId },
    })
  );
  await assert.rejects(() =>
    adjustInventorySchema.parseAsync({
      body: { sku: 'SKU-1', quantityChange: 5, reason: 'ab' }, // too short
      query: {},
      params: { productId: validId },
    })
  );
});

test('adjustInventorySchema accepts a positive (restock) or negative (write-off) change', async () => {
  const restock = await adjustInventorySchema.parseAsync({
    body: { sku: 'SKU-1', quantityChange: 20, reason: 'Restock from supplier' },
    query: {},
    params: { productId: validId },
  });
  assert.equal(restock.body.quantityChange, 20);

  const writeOff = await adjustInventorySchema.parseAsync({
    body: { sku: 'SKU-1', quantityChange: -3, reason: 'Damaged in warehouse' },
    query: {},
    params: { productId: validId },
  });
  assert.equal(writeOff.body.quantityChange, -3);
});

test('listInventoryQuerySchema validates stockStatus against the closed enum', async () => {
  const result = await listInventoryQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { stockStatus: 'low_stock' },
  });
  assert.equal(result.query.stockStatus, 'low_stock');

  await assert.rejects(() =>
    listInventoryQuerySchema.parseAsync({ body: {}, params: {}, query: { stockStatus: 'almost_gone' } })
  );
});

// ── audit ────────────────────────────────────────────────────────────────

test('listAuditLogsQuerySchema validates action against the closed AUDIT_ACTION enum', async () => {
  const result = await listAuditLogsQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { action: 'vendor.approved' },
  });
  assert.equal(result.query.action, 'vendor.approved');

  await assert.rejects(() =>
    listAuditLogsQuerySchema.parseAsync({ body: {}, params: {}, query: { action: 'vendor.made_up_action' } })
  );
});

// ── admin customers ─────────────────────────────────────────────────────

test('listCustomersQuerySchema applies pagination defaults and coerces isActive to a boolean', async () => {
  const withDefaults = await listCustomersQuerySchema.parseAsync({ body: {}, params: {}, query: {} });
  assert.equal(withDefaults.query.page, 1);
  assert.equal(withDefaults.query.isActive, undefined); // no filter applied when omitted

  const filtered = await listCustomersQuerySchema.parseAsync({
    body: {},
    params: {},
    query: { isActive: 'false' },
  });
  assert.equal(filtered.query.isActive, false);
});
