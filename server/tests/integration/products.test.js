import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * Full-flow integration tests for Category/Product RBAC and ownership —
 * same environment caveat as tests/integration/auth.test.js: requires a
 * real MongoDB connection, which this authoring sandbox doesn't have
 * network access to provision. Run with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/products.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('product/category integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
    console.log('  ⚠ Skipped: no TEST_MONGODB_URI configured in this environment.');
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = TEST_URI;

  const { default: app } = await import('../../src/app.js');

  let server;
  let baseUrl;

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  async function registerAndLogin(role, email) {
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Test ${role}`, email, password: 'Password1', role }),
    });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    const body = await res.json();
    return body.data.accessToken;
  }

  let categoryId;

  test('setup: create a category as admin (via direct model insert — no public admin registration)', async () => {
    // Super Admin accounts aren't publicly registerable (Phase 2 design),
    // so this suite inserts one directly through the model, exactly like
    // scripts/seed.js does, rather than trying to hit a nonexistent
    // public admin-registration endpoint.
    const bcrypt = (await import('bcryptjs')).default;
    const { User } = await import('../../src/models/User.model.js');
    const passwordHash = await bcrypt.hash('Password1', 12);
    await User.create({
      name: 'Test Admin',
      email: 'admin@test.local',
      passwordHash,
      role: 'super_admin',
      isEmailVerified: true,
    });

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.local', password: 'Password1' }),
    });
    const { data } = await loginRes.json();

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.accessToken}` },
      body: JSON.stringify({ name: 'Electronics' }),
    });
    assert.equal(catRes.status, 201);
    const catBody = await catRes.json();
    categoryId = catBody.data.category._id;
    assert.ok(categoryId);
  });

  test('a customer cannot create a category', async () => {
    const token = await registerAndLogin('customer', 'cust-cat@test.local');
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    assert.equal(res.status, 403);
  });

  test('a vendor cannot create a category', async () => {
    const token = await registerAndLogin('vendor', 'vend-cat@test.local');
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Should Also Fail' }),
    });
    assert.equal(res.status, 403);
  });

  test('a vendor can create a product they own', async () => {
    const token = await registerAndLogin('vendor', 'vendor-a@test.local');
    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Bluetooth Speaker',
        category: categoryId,
        variants: [{ sku: 'SPK-001', price: 49.99, stock: 25 }],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.product.status, 'draft');
    assert.equal(body.data.product.priceRange.min, 49.99);
  });

  test('a customer cannot create a product', async () => {
    const token = await registerAndLogin('customer', 'cust-prod@test.local');
    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Should Not Exist',
        category: categoryId,
        variants: [{ sku: 'NOPE-1', price: 1, stock: 1 }],
      }),
    });
    assert.equal(res.status, 403);
  });

  test('duplicate SKU across different products is rejected', async () => {
    const token = await registerAndLogin('vendor', 'vendor-sku@test.local');
    await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'First Product',
        category: categoryId,
        variants: [{ sku: 'DUPE-SKU', price: 10, stock: 1 }],
      }),
    });

    const res = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Second Product',
        category: categoryId,
        variants: [{ sku: 'DUPE-SKU', price: 20, stock: 1 }],
      }),
    });
    assert.equal(res.status, 409);
  });

  test('vendor B cannot update or delete vendor A\'s product', async () => {
    const tokenA = await registerAndLogin('vendor', 'owner-a@test.local');
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'Owned By A',
        category: categoryId,
        variants: [{ sku: 'OWNED-A-1', price: 15, stock: 5 }],
      }),
    });
    const { data } = await createRes.json();
    const productId = data.product._id;

    const tokenB = await registerAndLogin('vendor', 'owner-b@test.local');
    const updateRes = await fetch(`${baseUrl}/products/manage/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title: 'Hijacked Title' }),
    });
    assert.equal(updateRes.status, 403);

    const deleteRes = await fetch(`${baseUrl}/products/manage/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(deleteRes.status, 403);
  });

  test('vendor B does not see vendor A\'s products in their own managed list', async () => {
    const tokenA = await registerAndLogin('vendor', 'list-a@test.local');
    await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'A Private Listing',
        category: categoryId,
        variants: [{ sku: 'LIST-A-1', price: 5, stock: 1 }],
      }),
    });

    const tokenB = await registerAndLogin('vendor', 'list-b@test.local');
    const res = await fetch(`${baseUrl}/products/manage`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body = await res.json();
    const titles = body.data.products.map((p) => p.title);
    assert.ok(!titles.includes('A Private Listing'));
  });

  test('a draft product is invisible on the public storefront listing', async () => {
    const token = await registerAndLogin('vendor', 'draft-vendor@test.local');
    await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Still A Draft',
        category: categoryId,
        variants: [{ sku: 'DRAFT-1', price: 5, stock: 1 }],
      }),
    });

    const res = await fetch(`${baseUrl}/products?q=Still A Draft`);
    const body = await res.json();
    const titles = body.data.products.map((p) => p.title);
    assert.ok(!titles.includes('Still A Draft'));
  });

  test('publishing (status=active) makes a product visible on the public detail route', async () => {
    const token = await registerAndLogin('vendor', 'publish-vendor@test.local');
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Published Product',
        category: categoryId,
        variants: [{ sku: 'PUB-1', price: 30, stock: 4 }],
      }),
    });
    const { data } = await createRes.json();

    await fetch(`${baseUrl}/products/manage/${data.product._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'active' }),
    });

    const publicRes = await fetch(`${baseUrl}/products/${data.product.slug}`);
    assert.equal(publicRes.status, 200);
    const publicBody = await publicRes.json();
    assert.equal(publicBody.data.product.title, 'Published Product');
  });

  test('deleting the last variant on a product is rejected', async () => {
    const token = await registerAndLogin('vendor', 'lastvariant@test.local');
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Single Variant Product',
        category: categoryId,
        variants: [{ sku: 'ONLY-1', price: 10, stock: 1 }],
      }),
    });
    const { data } = await createRes.json();
    const variantId = data.product.variants[0]._id;

    const res = await fetch(`${baseUrl}/products/manage/${data.product._id}/variants/${variantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 400);
  });

  test('deleting a category that still has products is rejected', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const { User } = await import('../../src/models/User.model.js');
    const passwordHash = await bcrypt.hash('Password1', 12);
    await User.create({
      name: 'Second Admin',
      email: 'admin2@test.local',
      passwordHash,
      role: 'super_admin',
      isEmailVerified: true,
    });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin2@test.local', password: 'Password1' }),
    });
    const { data } = await loginRes.json();

    const res = await fetch(`${baseUrl}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    assert.equal(res.status, 409);
  });
}
