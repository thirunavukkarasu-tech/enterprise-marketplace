import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * Full-flow integration tests against a real MongoDB connection.
 * See tests/integration/auth.test.js for why these are gated behind
 * TEST_MONGODB_URI rather than run by default — same environment
 * limitation, same instructions to run them locally:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/categories.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('category integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
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
  let adminToken;

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    const passwordHash = await bcrypt.hash('Password1', 12);
    await User.create({
      name: 'Test Admin',
      email: 'catadmin@example.com',
      passwordHash,
      role: 'super_admin',
      isEmailVerified: true,
    });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'catadmin@example.com', password: 'Password1' }),
    });
    const loginBody = await loginRes.json();
    adminToken = loginBody.data.accessToken;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  }

  test('a customer cannot create a category', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    await User.create({
      name: 'Cat Customer',
      email: 'catcustomer@example.com',
      passwordHash,
      role: 'customer',
      isEmailVerified: true,
    });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'catcustomer@example.com', password: 'Password1' }),
    });
    const { data } = await loginRes.json();

    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.accessToken}` },
      body: JSON.stringify({ name: 'Should Not Work' }),
    });
    assert.equal(res.status, 403);
  });

  test('admin creates a top-level category and a subcategory', async () => {
    const parentRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Electronics' }),
    });
    assert.equal(parentRes.status, 201);
    const parent = (await parentRes.json()).data.category;
    assert.equal(parent.slug, 'electronics');

    const childRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Headphones', parent: parent._id }),
    });
    assert.equal(childRes.status, 201);
    const child = (await childRes.json()).data.category;
    assert.equal(child.parent, parent._id);
  });

  test('creating a category with a duplicate name still succeeds with a suffixed slug', async () => {
    const first = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Books' }),
    });
    const second = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Books' }),
    });
    const firstBody = (await first.json()).data.category;
    const secondBody = (await second.json()).data.category;
    assert.equal(firstBody.slug, 'books');
    assert.equal(secondBody.slug, 'books-2');
  });

  test('setting a category as its own parent is rejected', async () => {
    const createRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Self Parent Test' }),
    });
    const category = (await createRes.json()).data.category;

    const updateRes = await fetch(`${baseUrl}/categories/${category._id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parent: category._id }),
    });
    assert.equal(updateRes.status, 400);
  });

  test('a circular parent chain (grandchild set as grandparent of its own ancestor) is rejected', async () => {
    const a = (
      await (await fetch(`${baseUrl}/categories`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: 'Cycle A' }) })).json()
    ).data.category;
    const b = (
      await (
        await fetch(`${baseUrl}/categories`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ name: 'Cycle B', parent: a._id }),
        })
      ).json()
    ).data.category;

    // Try to make A a child of B — but B is already a child of A. This
    // must be rejected as a circular hierarchy.
    const res = await fetch(`${baseUrl}/categories/${a._id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parent: b._id }),
    });
    assert.equal(res.status, 400);
  });

  test('deleting a category with subcategories is blocked', async () => {
    const parent = (
      await (
        await fetch(`${baseUrl}/categories`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: 'Has Children' }) })
      ).json()
    ).data.category;
    await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Child Of Has Children', parent: parent._id }),
    });

    const res = await fetch(`${baseUrl}/categories/${parent._id}`, { method: 'DELETE', headers: authHeaders() });
    assert.equal(res.status, 409);
  });

  test('the public category list never includes inactive categories', async () => {
    const created = (
      await (
        await fetch(`${baseUrl}/categories`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: 'Will Be Deactivated' }) })
      ).json()
    ).data.category;
    await fetch(`${baseUrl}/categories/${created._id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isActive: false }),
    });

    const publicList = await (await fetch(`${baseUrl}/categories`)).json();
    const found = publicList.data.categories.find((c) => c._id === created._id);
    assert.equal(found, undefined);
  });
}
