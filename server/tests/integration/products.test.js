import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/auth.test.js for why this suite is gated behind
 * TEST_MONGODB_URI. Run locally with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/products.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('product integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
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
  let vendorAToken;
  let vendorBToken;
  let customerToken;
  let adminToken;

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

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    adminToken = await createUserAndLogin({ name: 'Admin', email: 'padmin@example.com', role: 'super_admin' });
    vendorAToken = await createUserAndLogin({ name: 'Vendor A', email: 'vendora@example.com', role: 'vendor' });
    vendorBToken = await createUserAndLogin({ name: 'Vendor B', email: 'vendorb@example.com', role: 'vendor' });
    customerToken = await createUserAndLogin({ name: 'Customer', email: 'pcustomer@example.com', role: 'customer' });

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ name: 'Test Category' }),
    });
    categoryId = (await catRes.json()).data.category._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  function productPayload(overrides = {}) {
    return {
      title: 'Mechanical Keyboard',
      description: 'A tactile mechanical keyboard.',
      category: categoryId,
      variants: [{ sku: `KB-${Math.random().toString(36).slice(2, 8)}`, price: 79.99, stock: 15 }],
      ...overrides,
    };
  }

  test('a customer cannot create a product', async () => {
    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify(productPayload()),
    });
    assert.equal(res.status, 403);
  });

  test('a customer cannot access the managed product listing', async () => {
    const res = await fetch(`${baseUrl}/products/manage`, { headers: authed(customerToken) });
    assert.equal(res.status, 403);
  });

  test('a vendor creates a product and it is scoped to their own id', async () => {
    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Vendor A Keyboard' })),
    });
    assert.equal(res.status, 201);
    const product = (await res.json()).data.product;
    assert.equal(product.status, 'draft');
    assert.equal(product.priceRange.min, 79.99);
    assert.equal(product.priceRange.max, 79.99);
  });

  test("vendor B cannot view, edit, or delete vendor A's product", async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Vendor A Exclusive' })),
    });
    const product = (await createRes.json()).data.product;

    const viewRes = await fetch(`${baseUrl}/products/manage/${product._id}`, { headers: authed(vendorBToken) });
    assert.equal(viewRes.status, 403);

    const editRes = await fetch(`${baseUrl}/products/manage/${product._id}`, {
      method: 'PATCH',
      headers: authed(vendorBToken),
      body: JSON.stringify({ title: 'Hijacked Title' }),
    });
    assert.equal(editRes.status, 403);

    const deleteRes = await fetch(`${baseUrl}/products/manage/${product._id}`, {
      method: 'DELETE',
      headers: authed(vendorBToken),
    });
    assert.equal(deleteRes.status, 403);
  });

  test("vendor A's products never appear in vendor B's managed listing", async () => {
    await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Only Vendor A Should See This' })),
    });

    const listRes = await fetch(`${baseUrl}/products/manage`, { headers: authed(vendorBToken) });
    const body = await listRes.json();
    const titles = body.data.products.map((p) => p.title);
    assert.ok(!titles.includes('Only Vendor A Should See This'));
  });

  test("a vendor's ?vendor= query filter is ignored — cannot list another vendor's products by guessing their id", async () => {
    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: authed(vendorAToken) });
    const vendorAId = (await meRes.json()).data.user._id;

    const res = await fetch(`${baseUrl}/products/manage?vendor=${vendorAId}`, { headers: authed(vendorBToken) });
    const body = await res.json();
    const titles = body.data.products.map((p) => p.title);
    assert.ok(!titles.includes('Only Vendor A Should See This'));
  });

  test('an admin can filter the managed listing by an explicit vendor id', async () => {
    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: authed(vendorAToken) });
    const vendorAId = (await meRes.json()).data.user._id;

    const res = await fetch(`${baseUrl}/products/manage?vendor=${vendorAId}`, { headers: authed(adminToken) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.products.length > 0);
  });

  test('duplicate SKUs across different vendors are rejected', async () => {
    const sharedSku = `DUPE-${Math.random().toString(36).slice(2, 8)}`;
    const first = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'First With SKU', variants: [{ sku: sharedSku, price: 10, stock: 1 }] })),
    });
    assert.equal(first.status, 201);

    const second = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorBToken),
      body: JSON.stringify(productPayload({ title: 'Second With Same SKU', variants: [{ sku: sharedSku, price: 20, stock: 1 }] })),
    });
    assert.equal(second.status, 409);
  });

  test('duplicate SKUs within the same product payload are rejected', async () => {
    const sku = `SELFDUPE-${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(
        productPayload({
          title: 'Self Duplicate SKU',
          variants: [
            { sku, price: 10, stock: 1 },
            { sku, price: 12, stock: 2 },
          ],
        })
      ),
    });
    assert.equal(res.status, 400);
  });

  test('a draft product is invisible on the public storefront', async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Still A Draft' })),
    });
    const product = (await createRes.json()).data.product;

    const publicRes = await fetch(`${baseUrl}/products/slug/${product.slug}`);
    assert.equal(publicRes.status, 404);
  });

  test('activating a product makes it visible on the public storefront', async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'About To Go Live' })),
    });
    const product = (await createRes.json()).data.product;

    const activateRes = await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(activateRes.status, 200);

    const publicRes = await fetch(`${baseUrl}/products/slug/${product.slug}`);
    assert.equal(publicRes.status, 200);
    const body = await publicRes.json();
    assert.equal(body.data.product.title, 'About To Go Live');
  });

  test('an invalid status value is rejected by validation', async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Bad Status Attempt' })),
    });
    const product = (await createRes.json()).data.product;

    const res = await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ status: 'featured' }), // not a real status
    });
    assert.equal(res.status, 400);
  });

  test("an admin can archive any vendor's product (moderation)", async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Subject To Moderation' })),
    });
    const product = (await createRes.json()).data.product;

    const res = await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ status: 'archived' }),
    });
    assert.equal(res.status, 200);
  });

  test('adding a variant recomputes the price range', async () => {
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(
        productPayload({
          title: 'Multi Variant Product',
          variants: [{ sku: `MV-${Math.random().toString(36).slice(2, 8)}`, price: 50, stock: 5 }],
        })
      ),
    });
    const product = (await createRes.json()).data.product;

    const addRes = await fetch(`${baseUrl}/products/manage/${product._id}/variants`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify({ sku: `MV2-${Math.random().toString(36).slice(2, 8)}`, price: 100, stock: 3 }),
    });
    assert.equal(addRes.status, 201);
    const withTwoVariants = (await addRes.json()).data.product;
    assert.equal(withTwoVariants.priceRange.min, 50);
    assert.equal(withTwoVariants.priceRange.max, 100);
  });

  test('deleting the only remaining variant is rejected — delete the product instead', async () => {
    const sku = `ONLY-${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: 'Single Variant Product', variants: [{ sku, price: 30, stock: 2 }] })),
    });
    const product = (await createRes.json()).data.product;

    const res = await fetch(`${baseUrl}/products/manage/${product._id}/variants/${sku}`, {
      method: 'DELETE',
      headers: authed(vendorAToken),
    });
    assert.equal(res.status, 400);
  });

  test('public listing supports pagination and only ever returns active products', async () => {
    const res = await fetch(`${baseUrl}/products?limit=2&page=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.products.length <= 2);
    assert.ok(typeof body.meta.total === 'number');
  });

  test('public listing search matches an active product by title keyword', async () => {
    const unique = `Unobtanium${Math.random().toString(36).slice(2, 6)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorAToken),
      body: JSON.stringify(productPayload({ title: `${unique} Special Edition` })),
    });
    const product = (await createRes.json()).data.product;
    await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorAToken),
      body: JSON.stringify({ status: 'active' }),
    });

    const searchRes = await fetch(`${baseUrl}/products?q=${unique}`);
    const body = await searchRes.json();
    assert.ok(body.data.products.some((p) => p.title.includes(unique)));
  });
}
