import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/auth.test.js for why this suite is gated behind
 * TEST_MONGODB_URI. This suite additionally needs a MongoDB **replica
 * set** (even a single-node one) — `orderService.createFromCart` uses a
 * real multi-document transaction to atomically decrement stock and
 * create the Order, and standalone `mongod` does not support
 * transactions at all. A local single-node replica set is enough:
 *
 *   mongod --replSet rs0 --dbpath <path>
 *   mongosh --eval "rs.initiate()"
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test?replicaSet=rs0 \
 *     node --test tests/integration/adminOperations.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('admin/vendor operations integration suite skipped — set TEST_MONGODB_URI (replica set) to run against a real MongoDB instance', () => {
    console.log('  ⚠ Skipped: no TEST_MONGODB_URI configured in this environment.');
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = TEST_URI;

  const { default: app } = await import('../../src/app.js');
  const { User } = await import('../../src/models/User.model.js');
  const { AuditLog } = await import('../../src/models/AuditLog.model.js');
  const bcrypt = (await import('bcryptjs')).default;

  let server;
  let baseUrl;
  let categoryId;
  let adminToken;
  let vendorAToken;
  let vendorBToken;

  async function createUserAndLogin({ name, email, role }) {
    const passwordHash = await bcrypt.hash('Password1', 12);
    await User.create({ name, email, passwordHash, role, isEmailVerified: true });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    return (await res.json()).data.accessToken;
  }

  function authed(token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function createActiveProduct(token, overrides = {}) {
    const sku = `AO-${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({
        title: 'Admin Ops Test Product',
        description: 'A product for Phase 7 tests.',
        category: categoryId,
        variants: [{ sku, price: 40, stock: 10 }],
        ...overrides,
      }),
    });
    const product = (await createRes.json()).data.product;
    await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(token),
      body: JSON.stringify({ status: 'active' }),
    });
    return product;
  }

  async function placeOrder(customerToken) {
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({
        fullName: 'Test Customer',
        phone: '+1 555-000-0000',
        line1: '1 Main St',
        city: 'Springfield',
        state: 'IL',
        country: 'USA',
        postalCode: '62704',
      }),
    });
    const address = (await addrRes.json()).data.address;

    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ shippingAddressId: address._id }),
    });
    return res;
  }

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    adminToken = await createUserAndLogin({ name: 'AO Admin', email: 'aoadmin@example.com', role: 'super_admin' });
    vendorAToken = await createUserAndLogin({ name: 'AO Vendor A', email: 'aovendora@example.com', role: 'vendor' });
    vendorBToken = await createUserAndLogin({ name: 'AO Vendor B', email: 'aovendorb@example.com', role: 'vendor' });

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ name: 'AO Test Category' }),
    });
    categoryId = (await catRes.json()).data.category._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  // ── order creation & atomic inventory ──────────────────────────────────

  test('placing an order decrements stock atomically and creates an audit log entry', async () => {
    const customerToken = await createUserAndLogin({ name: 'Buyer One', email: 'buyer1@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorAToken);

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ productId: product._id, sku: product.variants[0].sku, quantity: 3 }),
    });

    const res = await placeOrder(customerToken);
    assert.equal(res.status, 201);
    const order = (await res.json()).data.order;
    assert.equal(order.vendorGroups[0].items[0].quantity, 3);

    const productAfter = await (await fetch(`${baseUrl}/products/slug/${product.slug}`)).json();
    assert.equal(productAfter.data.product.variants[0].stock, 7);

    const auditEntry = await AuditLog.findOne({ action: 'order.created', entityId: order._id });
    assert.ok(auditEntry, 'expected an order.created audit log entry');
  });

  test('an empty cart cannot be checked out into an order', async () => {
    const customer = await createUserAndLogin({ name: 'Empty Cart', email: 'emptycart@example.com', role: 'customer' });
    const res = await placeOrder(customer);
    assert.equal(res.status, 400);
  });

  test('a vendor cannot place an order (customer-only)', async () => {
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify({
        fullName: 'x', phone: '+1 555-000-0000', line1: '1 St', city: 'C', state: 'S', country: 'USA', postalCode: '00000',
      }),
    });
    // Vendors don't even have address-management access — confirms the
    // whole checkout path is closed off, not just order creation itself.
    assert.equal(addrRes.status, 403);
  });

  // ── order lifecycle & cross-vendor isolation ───────────────────────────

  test('a valid order status transition succeeds', async () => {
    const customer = await createUserAndLogin({ name: 'Buyer Two', email: 'buyer2@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorAToken);
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer),
      body: JSON.stringify({ productId: product._id, sku: product.variants[0].sku, quantity: 1 }),
    });
    const order = (await (await placeOrder(customer)).json()).data.order;

    const res = await fetch(`${baseUrl}/orders/${order._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(res.status, 200);
    const updated = (await res.json()).data.order;
    assert.equal(updated.vendorGroups[0].status, 'confirmed');
  });

  test('an invalid order status transition is rejected', async () => {
    const customer = await createUserAndLogin({ name: 'Buyer Three', email: 'buyer3@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorAToken);
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer),
      body: JSON.stringify({ productId: product._id, sku: product.variants[0].sku, quantity: 1 }),
    });
    const order = (await (await placeOrder(customer)).json()).data.order;

    // pending -> delivered is not a legal transition.
    const res = await fetch(`${baseUrl}/orders/${order._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ status: 'delivered' }),
    });
    assert.equal(res.status, 400);
  });

  test("vendor B cannot update vendor A's order, and cannot see it in their managed order list", async () => {
    const customer = await createUserAndLogin({ name: 'Buyer Four', email: 'buyer4@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorAToken, { title: 'Vendor A Exclusive Order Item' });
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer),
      body: JSON.stringify({ productId: product._id, sku: product.variants[0].sku, quantity: 1 }),
    });
    const order = (await (await placeOrder(customer)).json()).data.order;

    const updateRes = await fetch(`${baseUrl}/orders/${order._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorBToken),
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(updateRes.status, 403);

    const detailRes = await fetch(`${baseUrl}/orders/manage/${order._id}`, { headers: authed(vendorBToken) });
    assert.equal(detailRes.status, 404);

    const listRes = await fetch(`${baseUrl}/orders/manage`, { headers: authed(vendorBToken) });
    const orderIds = (await listRes.json()).data.orders.map((o) => o._id);
    assert.ok(!orderIds.includes(order._id));
  });

  test('a customer cannot access vendor/admin order management endpoints', async () => {
    const customer = await createUserAndLogin({ name: 'Buyer Five', email: 'buyer5@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/orders/manage`, { headers: authed(customer) });
    assert.equal(res.status, 403);
  });

  // ── inventory ────────────────────────────────────────────────────────

  test('an inventory adjustment that would make stock negative is rejected', async () => {
    const product = await createActiveProduct(vendorAToken, {
      variants: [{ sku: `NEG-${Math.random().toString(36).slice(2, 6)}`, price: 10, stock: 5 }],
    });
    const res = await fetch(`${baseUrl}/inventory/${product._id}/adjust`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ sku: product.variants[0].sku, quantityChange: -10, reason: 'testing negative guard' }),
    });
    assert.equal(res.status, 400);
  });

  test('a valid inventory adjustment succeeds and writes an audit log entry', async () => {
    const product = await createActiveProduct(vendorAToken, {
      variants: [{ sku: `ADJ-${Math.random().toString(36).slice(2, 6)}`, price: 10, stock: 5 }],
    });
    const res = await fetch(`${baseUrl}/inventory/${product._id}/adjust`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ sku: product.variants[0].sku, quantityChange: 20, reason: 'restock from supplier' }),
    });
    assert.equal(res.status, 200);
    const row = (await res.json()).data.inventory;
    assert.equal(row.stock, 25);

    const auditEntry = await AuditLog.findOne({ action: 'inventory.adjusted', entityId: product._id });
    assert.ok(auditEntry);
  });

  test("vendor B cannot adjust vendor A's inventory", async () => {
    const product = await createActiveProduct(vendorAToken, {
      variants: [{ sku: `IDOR-${Math.random().toString(36).slice(2, 6)}`, price: 10, stock: 5 }],
    });
    const res = await fetch(`${baseUrl}/inventory/${product._id}/adjust`, {
      method: 'PATCH',
      headers: authed(vendorBToken),
      body: JSON.stringify({ sku: product.variants[0].sku, quantityChange: 5, reason: 'not mine to touch' }),
    });
    assert.equal(res.status, 403);
  });

  test("a vendor's inventory list never includes another vendor's products", async () => {
    await createActiveProduct(vendorBToken, { title: 'Only Vendor B Inventory' });
    const res = await fetch(`${baseUrl}/inventory`, { headers: authed(vendorAToken) });
    const titles = (await res.json()).data.inventory.map((r) => r.productTitle);
    assert.ok(!titles.includes('Only Vendor B Inventory'));
  });

  // ── admin-only surfaces ──────────────────────────────────────────────

  test('the admin dashboard overview is admin-only and returns real aggregated numbers', async () => {
    const vendorRes = await fetch(`${baseUrl}/admin/dashboard/overview`, { headers: authed(vendorAToken) });
    assert.equal(vendorRes.status, 403);

    const adminRes = await fetch(`${baseUrl}/admin/dashboard/overview`, { headers: authed(adminToken) });
    assert.equal(adminRes.status, 200);
    const overview = (await adminRes.json()).data.overview;
    assert.ok(typeof overview.totalUsers === 'number');
    assert.ok(typeof overview.totalRevenue === 'number');
    assert.ok(Array.isArray(overview.revenueTrend));
  });

  test('audit log listing is admin-only', async () => {
    const vendorRes = await fetch(`${baseUrl}/audit-logs`, { headers: authed(vendorAToken) });
    assert.equal(vendorRes.status, 403);

    const adminRes = await fetch(`${baseUrl}/audit-logs`, { headers: authed(adminToken) });
    assert.equal(adminRes.status, 200);
    const logs = (await adminRes.json()).data.logs;
    assert.ok(logs.length > 0);
  });

  test('admin customer management is admin-only and reports real order stats', async () => {
    const vendorRes = await fetch(`${baseUrl}/admin/customers`, { headers: authed(vendorAToken) });
    assert.equal(vendorRes.status, 403);

    const adminRes = await fetch(`${baseUrl}/admin/customers`, { headers: authed(adminToken) });
    assert.equal(adminRes.status, 200);
    const customers = (await adminRes.json()).data.customers;
    const buyer = customers.find((c) => c.email === 'buyer1@example.com');
    assert.ok(buyer);
    assert.ok(buyer.orderCount >= 1);
    assert.ok(buyer.totalSpent > 0);
  });
}
