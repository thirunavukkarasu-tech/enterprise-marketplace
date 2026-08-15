import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/auth.test.js for why this suite is gated behind
 * TEST_MONGODB_URI. Run locally with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/vendors.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('vendor integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
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

  function vendorPayload(overrides = {}) {
    return {
      storeName: 'Test Store',
      businessEmail: 'store@example.com',
      businessPhone: '+1 555-000-1111',
      address: { line1: '1 Main St', city: 'Metropolis', state: 'NY', country: 'USA', postalCode: '10001' },
      ...overrides,
    };
  }

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;
    adminToken = await createUserAndLogin({ name: 'Admin', email: 'vadmin@example.com', role: 'super_admin' });
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  test('a customer cannot access any vendor management API', async () => {
    const token = await createUserAndLogin({ name: 'Cust', email: 'vcustomer@example.com', role: 'customer' });

    const list = await fetch(`${baseUrl}/vendors`, { headers: authed(token) });
    assert.equal(list.status, 403);

    const me = await fetch(`${baseUrl}/vendors/me`, { headers: authed(token) });
    assert.equal(me.status, 403);

    const onboard = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    assert.equal(onboard.status, 403);
  });

  test('a delivery partner cannot access vendor management APIs', async () => {
    const token = await createUserAndLogin({ name: 'Courier', email: 'vdelivery@example.com', role: 'delivery_partner' });
    const res = await fetch(`${baseUrl}/vendors/me`, { headers: authed(token) });
    assert.equal(res.status, 403);
  });

  test('a vendor can onboard, and the profile starts PENDING', async () => {
    const token = await createUserAndLogin({ name: 'Vendor One', email: 'vendor1@example.com', role: 'vendor' });

    const res = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload({ storeName: 'Vendor One Store' })),
    });
    assert.equal(res.status, 201);
    const vendor = (await res.json()).data.vendor;
    assert.equal(vendor.status, 'pending');
    assert.equal(vendor.isVerified, false);
  });

  test('onboarding a second vendor profile for the same account is rejected', async () => {
    const token = await createUserAndLogin({ name: 'Vendor Two', email: 'vendor2@example.com', role: 'vendor' });
    await fetch(`${baseUrl}/vendors/me`, { method: 'POST', headers: authed(token), body: JSON.stringify(vendorPayload()) });

    const second = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    assert.equal(second.status, 409);
  });

  test('a vendor cannot set their own status or isVerified via self-update — those fields are simply ignored', async () => {
    const token = await createUserAndLogin({ name: 'Vendor Three', email: 'vendor3@example.com', role: 'vendor' });
    await fetch(`${baseUrl}/vendors/me`, { method: 'POST', headers: authed(token), body: JSON.stringify(vendorPayload()) });

    const res = await fetch(`${baseUrl}/vendors/me`, {
      method: 'PATCH',
      headers: authed(token),
      body: JSON.stringify({ status: 'approved', isVerified: true, storeName: 'Still Pending Store' }),
    });
    assert.equal(res.status, 200);
    const vendor = (await res.json()).data.vendor;
    assert.equal(vendor.status, 'pending');
    assert.equal(vendor.isVerified, false);
    assert.equal(vendor.storeName, 'Still Pending Store');
  });

  test('a vendor without a profile gets 404 on /vendors/me, not a crash', async () => {
    const token = await createUserAndLogin({ name: 'No Profile', email: 'noprofile@example.com', role: 'vendor' });
    const res = await fetch(`${baseUrl}/vendors/me`, { headers: authed(token) });
    assert.equal(res.status, 404);
  });

  test("a vendor cannot view another vendor's profile by id — the admin-only :id route rejects any vendor", async () => {
    const tokenA = await createUserAndLogin({ name: 'IDOR A', email: 'idora@example.com', role: 'vendor' });
    const tokenB = await createUserAndLogin({ name: 'IDOR B', email: 'idorb@example.com', role: 'vendor' });

    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(tokenA),
      body: JSON.stringify(vendorPayload({ storeName: 'IDOR Target Store' })),
    });
    const vendorA = (await createRes.json()).data.vendor;

    const res = await fetch(`${baseUrl}/vendors/${vendorA._id}`, { headers: authed(tokenB) });
    assert.equal(res.status, 403);
  });

  test('a vendor cannot call admin lifecycle actions on any vendor, including their own', async () => {
    const token = await createUserAndLogin({ name: 'Self Approve', email: 'selfapprove@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;

    const res = await fetch(`${baseUrl}/vendors/${vendor._id}/approve`, { method: 'PATCH', headers: authed(token) });
    assert.equal(res.status, 403);
  });

  test('admin can list, approve, and the vendor sees the updated status', async () => {
    const token = await createUserAndLogin({ name: 'To Approve', email: 'toapprove@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload({ storeName: 'To Approve Store' })),
    });
    const vendor = (await createRes.json()).data.vendor;

    const listRes = await fetch(`${baseUrl}/vendors?status=pending`, { headers: authed(adminToken) });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.data.vendors.some((v) => v._id === vendor._id));

    const approveRes = await fetch(`${baseUrl}/vendors/${vendor._id}/approve`, {
      method: 'PATCH',
      headers: authed(adminToken),
    });
    assert.equal(approveRes.status, 200);
    assert.equal((await approveRes.json()).data.vendor.status, 'approved');

    const meRes = await fetch(`${baseUrl}/vendors/me`, { headers: authed(token) });
    assert.equal((await meRes.json()).data.vendor.status, 'approved');
  });

  test('admin rejection requires a reason and is reflected on the vendor profile', async () => {
    const token = await createUserAndLogin({ name: 'To Reject', email: 'toreject@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;

    const noReasonRes = await fetch(`${baseUrl}/vendors/${vendor._id}/reject`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({}),
    });
    assert.equal(noReasonRes.status, 400);

    const rejectRes = await fetch(`${baseUrl}/vendors/${vendor._id}/reject`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ reason: 'Business registration documents were invalid.' }),
    });
    assert.equal(rejectRes.status, 200);
    const rejected = (await rejectRes.json()).data.vendor;
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.rejectionReason, 'Business registration documents were invalid.');
  });

  test('a rejected vendor is a terminal state — approve is refused', async () => {
    const token = await createUserAndLogin({ name: 'Rejected Terminal', email: 'rejterm@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;
    await fetch(`${baseUrl}/vendors/${vendor._id}/reject`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ reason: 'Not eligible to sell on this platform at this time.' }),
    });

    const res = await fetch(`${baseUrl}/vendors/${vendor._id}/approve`, { method: 'PATCH', headers: authed(adminToken) });
    assert.equal(res.status, 400);
  });

  test('suspend then reactivate moves an approved vendor through the full lifecycle', async () => {
    const token = await createUserAndLogin({ name: 'Suspend Cycle', email: 'suspendcycle@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;
    await fetch(`${baseUrl}/vendors/${vendor._id}/approve`, { method: 'PATCH', headers: authed(adminToken) });

    const suspendRes = await fetch(`${baseUrl}/vendors/${vendor._id}/suspend`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ reason: 'Repeated policy violations.' }),
    });
    assert.equal(suspendRes.status, 200);
    assert.equal((await suspendRes.json()).data.vendor.status, 'suspended');

    const reactivateRes = await fetch(`${baseUrl}/vendors/${vendor._id}/reactivate`, {
      method: 'PATCH',
      headers: authed(adminToken),
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal((await reactivateRes.json()).data.vendor.status, 'approved');
  });

  test('a pending vendor cannot be suspended directly (invalid transition)', async () => {
    const token = await createUserAndLogin({ name: 'Pending Suspend', email: 'pendingsuspend@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;

    const res = await fetch(`${baseUrl}/vendors/${vendor._id}/suspend`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ reason: 'Testing invalid transition.' }),
    });
    assert.equal(res.status, 400);
  });

  test('an invalid vendor id returns a clean 400/404, not a 500', async () => {
    const badFormat = await fetch(`${baseUrl}/vendors/not-a-valid-id`, { headers: authed(adminToken) });
    assert.equal(badFormat.status, 400);

    const wellFormedButMissing = await fetch(`${baseUrl}/vendors/000000000000000000000000`, { headers: authed(adminToken) });
    assert.equal(wellFormedButMissing.status, 404);
  });

  test('vendor dashboard reflects real product counts and never fabricates analytics', async () => {
    const token = await createUserAndLogin({ name: 'Dashboard Vendor', email: 'dashvendor@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;
    await fetch(`${baseUrl}/vendors/${vendor._id}/approve`, { method: 'PATCH', headers: authed(adminToken) });

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ name: 'Dashboard Test Category' }),
    });
    const category = (await catRes.json()).data.category;

    await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({
        title: 'Dashboard Test Product',
        description: 'x',
        category: category._id,
        variants: [{ sku: `DASH-${Math.random().toString(36).slice(2, 8)}`, price: 10, stock: 5 }],
      }),
    });

    const dashRes = await fetch(`${baseUrl}/vendors/me/dashboard`, { headers: authed(token) });
    assert.equal(dashRes.status, 200);
    const dash = (await dashRes.json()).data;
    assert.equal(dash.productCounts.total, 1);
    assert.equal(dash.productCounts.draft, 1);
    assert.equal(dash.productCounts.active, 0);
    assert.ok(typeof dash.profileCompletion === 'number');
    assert.ok(Array.isArray(dash.recentProducts));
    assert.equal(dash.recentProducts[0].title, 'Dashboard Test Product');
  });

  test("vendor B still cannot touch vendor A's products after vendor management is layered on top of Phase 3", async () => {
    const tokenA = await createUserAndLogin({ name: 'Product Owner A', email: 'productownera@example.com', role: 'vendor' });
    const tokenB = await createUserAndLogin({ name: 'Product Owner B', email: 'productownerb@example.com', role: 'vendor' });

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ name: 'Ownership Integration Category' }),
    });
    const category = (await catRes.json()).data.category;

    const productRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(tokenA),
      body: JSON.stringify({
        title: 'Vendor A Owned Product',
        description: 'x',
        category: category._id,
        variants: [{ sku: `OWN-${Math.random().toString(36).slice(2, 8)}`, price: 10, stock: 5 }],
      }),
    });
    const product = (await productRes.json()).data.product;

    const editAttempt = await fetch(`${baseUrl}/products/manage/${product._id}`, {
      method: 'PATCH',
      headers: authed(tokenB),
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    assert.equal(editAttempt.status, 403);
  });

  test('admin can independently verify a vendor regardless of approval status', async () => {
    const token = await createUserAndLogin({ name: 'Verify Me', email: 'verifyme@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;
    assert.equal(vendor.isVerified, false);

    // Verifiable while still pending — verification is independent of
    // the approve/reject/suspend status machine.
    const verifyRes = await fetch(`${baseUrl}/vendors/${vendor._id}/verify`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ isVerified: true }),
    });
    assert.equal(verifyRes.status, 200);
    const verified = (await verifyRes.json()).data.vendor;
    assert.equal(verified.status, 'pending');
    assert.equal(verified.isVerified, true);

    const listRes = await fetch(`${baseUrl}/vendors?isVerified=true`, { headers: authed(adminToken) });
    const listBody = await listRes.json();
    assert.ok(listBody.data.vendors.some((v) => v._id === vendor._id));
  });

  test('a vendor cannot verify themselves', async () => {
    const token = await createUserAndLogin({ name: 'Self Verify', email: 'selfverify@example.com', role: 'vendor' });
    const createRes = await fetch(`${baseUrl}/vendors/me`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(vendorPayload()),
    });
    const vendor = (await createRes.json()).data.vendor;

    const res = await fetch(`${baseUrl}/vendors/${vendor._id}/verify`, {
      method: 'PATCH',
      headers: authed(token),
      body: JSON.stringify({ isVerified: true }),
    });
    assert.equal(res.status, 403);
  });
}
