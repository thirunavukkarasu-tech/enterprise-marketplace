import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/auth.test.js for why this suite is gated behind
 * TEST_MONGODB_URI. Run locally with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/customerExperience.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('customer experience integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
    console.log('  ⚠ Skipped: no TEST_MONGODB_URI configured in this environment.');
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = TEST_URI;

  const { default: app } = await import('../../src/app.js');
  const { User } = await import('../../src/models/User.model.js');
  const bcrypt = (await import('bcryptjs')).default;

  let server;
  let baseUrl;
  let categoryId;
  let vendorToken;
  let vendorUserId;

  async function createUserAndLogin({ name, email, role }) {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const user = await User.create({ name, email, passwordHash, role, isEmailVerified: true });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    const body = await res.json();
    return { token: body.data.accessToken, userId: user._id.toString() };
  }

  function authed(token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function createActiveProduct(token, overrides = {}) {
    const sku = `CE-${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({
        title: 'Customer Experience Test Product',
        description: 'A product for Phase 5 tests.',
        category: categoryId,
        variants: [{ sku, price: 25, stock: 10 }],
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

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    const admin = await createUserAndLogin({ name: 'CE Admin', email: 'ceadmin@example.com', role: 'super_admin' });
    const vendor = await createUserAndLogin({ name: 'CE Vendor', email: 'cevendor@example.com', role: 'vendor' });
    vendorToken = vendor.token;
    vendorUserId = vendor.userId;

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(admin.token),
      body: JSON.stringify({ name: 'CE Test Category' }),
    });
    categoryId = (await catRes.json()).data.category._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  // ── wishlist ──────────────────────────────────────────────────────────

  test('wishlist requires authentication', async () => {
    const res = await fetch(`${baseUrl}/wishlist`);
    assert.equal(res.status, 401);
  });

  test('a vendor cannot use the wishlist (customer-only feature)', async () => {
    const res = await fetch(`${baseUrl}/wishlist`, { headers: authed(vendorToken) });
    assert.equal(res.status, 403);
  });

  test('an admin cannot use the wishlist either', async () => {
    const admin = await createUserAndLogin({ name: 'CE Admin2', email: 'ceadmin2@example.com', role: 'super_admin' });
    const res = await fetch(`${baseUrl}/wishlist`, { headers: authed(admin.token) });
    assert.equal(res.status, 403);
  });

  test('a customer can add, view, and remove a product from their wishlist', async () => {
    const customer = await createUserAndLogin({ name: 'Wishlister', email: 'wishlister@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorToken);

    const emptyRes = await fetch(`${baseUrl}/wishlist`, { headers: authed(customer.token) });
    assert.deepEqual((await emptyRes.json()).data.products, []);

    const addRes = await fetch(`${baseUrl}/wishlist/${product._id}`, { method: 'POST', headers: authed(customer.token) });
    assert.equal(addRes.status, 200);
    const afterAdd = (await addRes.json()).data.products;
    assert.equal(afterAdd.length, 1);
    assert.equal(afterAdd[0]._id, product._id);

    const removeRes = await fetch(`${baseUrl}/wishlist/${product._id}`, { method: 'DELETE', headers: authed(customer.token) });
    assert.equal(removeRes.status, 200);
    assert.deepEqual((await removeRes.json()).data.products, []);
  });

  test('adding the same product twice does not create a duplicate', async () => {
    const customer = await createUserAndLogin({ name: 'Dupe Wishlister', email: 'dupewishlist@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorToken);

    await fetch(`${baseUrl}/wishlist/${product._id}`, { method: 'POST', headers: authed(customer.token) });
    const secondAdd = await fetch(`${baseUrl}/wishlist/${product._id}`, { method: 'POST', headers: authed(customer.token) });
    assert.equal(secondAdd.status, 200); // idempotent, not a 409

    const body = (await secondAdd.json()).data.products;
    assert.equal(body.length, 1);
  });

  test("one customer's wishlist is completely separate from another's", async () => {
    const customerA = await createUserAndLogin({ name: 'Wish A', email: 'wisha@example.com', role: 'customer' });
    const customerB = await createUserAndLogin({ name: 'Wish B', email: 'wishb@example.com', role: 'customer' });
    const product = await createActiveProduct(vendorToken);

    await fetch(`${baseUrl}/wishlist/${product._id}`, { method: 'POST', headers: authed(customerA.token) });

    const bList = await fetch(`${baseUrl}/wishlist`, { headers: authed(customerB.token) });
    assert.deepEqual((await bList.json()).data.products, []);
  });

  test('adding a nonexistent product id returns 404', async () => {
    const customer = await createUserAndLogin({ name: 'Ghost Wisher', email: 'ghostwisher@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/wishlist/507f1f77bcf86cd799439011`, { method: 'POST', headers: authed(customer.token) });
    assert.equal(res.status, 404);
  });

  // ── customer profile ─────────────────────────────────────────────────

  test('updating own profile requires authentication', async () => {
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });
    assert.equal(res.status, 401);
  });

  test('a customer can update their own name and phone', async () => {
    const customer = await createUserAndLogin({ name: 'Original Name', email: 'profileupdate@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'PATCH',
      headers: authed(customer.token),
      body: JSON.stringify({ name: 'Updated Name', phone: '+1 555-000-1111' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.user.name, 'Updated Name');
    assert.equal(body.data.user.phone, '+1 555-000-1111');
  });

  test('a user cannot escalate their own role via profile update (mass assignment)', async () => {
    const customer = await createUserAndLogin({ name: 'Sneaky', email: 'sneakyrole@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'PATCH',
      headers: authed(customer.token),
      body: JSON.stringify({ name: 'Still Sneaky', role: 'super_admin', isActive: false }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.user.role, 'customer'); // unchanged
    assert.equal(body.data.user.isActive, true); // unchanged

    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: authed(customer.token) });
    const me = (await meRes.json()).data.user;
    assert.equal(me.role, 'customer');
  });

  // ── storefront product enrichment ────────────────────────────────────

  test('public product listing supports the inStock filter', async () => {
    const inStockProduct = await createActiveProduct(vendorToken, {
      title: 'In Stock Item',
      variants: [{ sku: `INSTOCK-${Math.random().toString(36).slice(2, 6)}`, price: 10, stock: 5 }],
    });
    const outOfStockProduct = await createActiveProduct(vendorToken, {
      title: 'Out Of Stock Item',
      variants: [{ sku: `OOS-${Math.random().toString(36).slice(2, 6)}`, price: 10, stock: 0 }],
    });

    const inStockRes = await fetch(`${baseUrl}/products?inStock=true&limit=100`);
    const inStockIds = (await inStockRes.json()).data.products.map((p) => p._id);
    assert.ok(inStockIds.includes(inStockProduct._id));
    assert.ok(!inStockIds.includes(outOfStockProduct._id));

    const outOfStockRes = await fetch(`${baseUrl}/products?inStock=false&limit=100`);
    const outOfStockIds = (await outOfStockRes.json()).data.products.map((p) => p._id);
    assert.ok(outOfStockIds.includes(outOfStockProduct._id));
    assert.ok(!outOfStockIds.includes(inStockProduct._id));
  });

  test('public product responses include a vendorStore summary when the vendor has onboarded', async () => {
    const onboardingVendor = await createUserAndLogin({
      name: 'Onboarded Vendor',
      email: 'onboardedvendor@example.com',
      role: 'vendor',
    });
    await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(onboardingVendor.token),
      body: JSON.stringify({
        storeName: 'The Onboarded Store',
        businessEmail: 'store@example.com',
        businessPhone: '+1 555-222-3333',
        address: { line1: '1 Main St', city: 'Springfield', state: 'IL', country: 'USA', postalCode: '62704' },
      }),
    });
    const product = await createActiveProduct(onboardingVendor.token, { title: 'Product From Onboarded Vendor' });

    const detailRes = await fetch(`${baseUrl}/products/slug/${product.slug}`);
    const detail = (await detailRes.json()).data.product;
    assert.equal(detail.vendorStore.storeName, 'The Onboarded Store');
  });

  test('public product responses degrade gracefully when the vendor has not onboarded a store profile', async () => {
    // vendorToken's account never called POST /vendors/me in this suite.
    const product = await createActiveProduct(vendorToken, { title: 'Product From Non-Onboarded Vendor' });

    const detailRes = await fetch(`${baseUrl}/products/slug/${product.slug}`);
    const detail = (await detailRes.json()).data.product;
    assert.equal(detail.vendorStore, null);
  });

  // ── category product counts ──────────────────────────────────────────

  test('withCounts=true reports an accurate active-product count per category', async () => {
    await createActiveProduct(vendorToken, { title: 'Counted Product 1' });
    await createActiveProduct(vendorToken, { title: 'Counted Product 2' });

    const res = await fetch(`${baseUrl}/categories?withCounts=true`);
    const categories = (await res.json()).data.categories;
    const target = categories.find((c) => c._id === categoryId);
    assert.ok(target.productCount >= 2);
  });

  test('withCounts is omitted (false) by default — response shape unchanged for existing callers', async () => {
    const res = await fetch(`${baseUrl}/categories`);
    const categories = (await res.json()).data.categories;
    assert.equal('productCount' in categories[0], false);
  });

  // ── cross-cutting RBAC sanity (customer cannot touch admin/vendor APIs) ─

  test('a customer cannot access vendor product management endpoints', async () => {
    const customer = await createUserAndLogin({ name: 'RBAC Customer', email: 'rbaccustomer@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/products/manage`, { headers: authed(customer.token) });
    assert.equal(res.status, 403);
  });

  test('a customer cannot access admin vendor management endpoints', async () => {
    const customer = await createUserAndLogin({ name: 'RBAC Customer 2', email: 'rbaccustomer2@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/vendors?page=1`, { headers: authed(customer.token) });
    assert.equal(res.status, 403);
  });
}
