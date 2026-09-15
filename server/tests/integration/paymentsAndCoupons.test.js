import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/adminOperations.test.js for why this suite needs
 * a MongoDB **replica set**, not just a standalone `mongod` — order
 * creation (and therefore payment/coupon flows that depend on a real
 * order existing) uses a transaction. Run locally with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/paymentsAndCoupons.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('payments/coupons integration suite skipped — set TEST_MONGODB_URI (replica set) to run against a real MongoDB instance', () => {
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
  let adminToken;
  let vendorToken;

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

  async function createActiveProduct(price = 100, stock = 10) {
    const sku = `PC-${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorToken),
      body: JSON.stringify({
        title: 'Payments/Coupons Test Product',
        description: 'A product for Phase 8 tests.',
        category: categoryId,
        variants: [{ sku, price, stock }],
      }),
    });
    const product = (await createRes.json()).data.product;
    await fetch(`${baseUrl}/products/manage/${product._id}/status`, {
      method: 'PATCH',
      headers: authed(vendorToken),
      body: JSON.stringify({ status: 'active' }),
    });
    return { ...product, sku };
  }

  async function addToCart(customerToken, product, quantity = 1) {
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity }),
    });
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
    return (await res.json()).data.order;
  }

  async function createCoupon(overrides = {}) {
    const code = `TEST${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const res = await fetch(`${baseUrl}/admin/coupons`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ code, discountType: 'percentage', discountValue: 10, ...overrides }),
    });
    return (await res.json()).data.coupon;
  }

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    adminToken = await createUserAndLogin({ name: 'PC Admin', email: 'pcadmin@example.com', role: 'super_admin' });
    vendorToken = await createUserAndLogin({ name: 'PC Vendor', email: 'pcvendor@example.com', role: 'vendor' });

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ name: 'Payments Coupons Test Category' }),
    });
    categoryId = (await catRes.json()).data.category._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  // ── admin coupon RBAC & CRUD ─────────────────────────────────────────

  test('a non-admin cannot access coupon management endpoints', async () => {
    const customerToken = await createUserAndLogin({ name: 'No Coupons', email: 'nocoupons@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/admin/coupons`, { headers: authed(customerToken) });
    assert.equal(res.status, 403);
  });

  test('a vendor cannot access coupon management endpoints either', async () => {
    const res = await fetch(`${baseUrl}/admin/coupons`, { headers: authed(vendorToken) });
    assert.equal(res.status, 403);
  });

  test('admin can create, update, deactivate, and delete a coupon', async () => {
    const coupon = await createCoupon({ discountValue: 15 });
    assert.equal(coupon.discountValue, 15);
    assert.equal(coupon.isActive, true);

    const updateRes = await fetch(`${baseUrl}/admin/coupons/${coupon._id}`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ description: 'Updated description' }),
    });
    assert.equal(updateRes.status, 200);

    const deactivateRes = await fetch(`${baseUrl}/admin/coupons/${coupon._id}/status`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal((await deactivateRes.json()).data.coupon.isActive, false);

    const deleteRes = await fetch(`${baseUrl}/admin/coupons/${coupon._id}`, { method: 'DELETE', headers: authed(adminToken) });
    assert.equal(deleteRes.status, 200);
  });

  test('creating a coupon with a duplicate code is rejected', async () => {
    const code = `DUPE${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const first = await fetch(`${baseUrl}/admin/coupons`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ code, discountType: 'fixed', discountValue: 5 }),
    });
    assert.equal(first.status, 201);
    const second = await fetch(`${baseUrl}/admin/coupons`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ code, discountType: 'fixed', discountValue: 5 }),
    });
    assert.equal(second.status, 409);
  });

  test('a percentage discount over 100 is rejected by validation', async () => {
    const res = await fetch(`${baseUrl}/admin/coupons`, {
      method: 'POST',
      headers: authed(adminToken),
      body: JSON.stringify({ code: 'BADPCT', discountType: 'percentage', discountValue: 150 }),
    });
    assert.equal(res.status, 400);
  });

  // ── coupon application to a real cart ───────────────────────────────

  test('applying a nonexistent coupon code is rejected', async () => {
    const customerToken = await createUserAndLogin({ name: 'Bad Coupon', email: 'badcoupon@example.com', role: 'customer' });
    const product = await createActiveProduct();
    await addToCart(customerToken, product);

    const res = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: 'DOESNOTEXIST' }),
    });
    assert.equal(res.status, 400);
  });

  test('an inactive coupon is rejected', async () => {
    const coupon = await createCoupon({ discountValue: 10 });
    await fetch(`${baseUrl}/admin/coupons/${coupon._id}/status`, {
      method: 'PATCH',
      headers: authed(adminToken),
      body: JSON.stringify({ isActive: false }),
    });

    const customerToken = await createUserAndLogin({ name: 'Inactive Coupon', email: 'inactivecoupon@example.com', role: 'customer' });
    const product = await createActiveProduct();
    await addToCart(customerToken, product);

    const res = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(res.status, 400);
  });

  test('an expired coupon is rejected', async () => {
    const coupon = await createCoupon({ expiresAt: new Date(Date.now() - 86400000).toISOString() });
    const customerToken = await createUserAndLogin({ name: 'Expired Coupon', email: 'expiredcoupon@example.com', role: 'customer' });
    const product = await createActiveProduct();
    await addToCart(customerToken, product);

    const res = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(res.status, 400);
  });

  test('a coupon below its minimum order value is rejected', async () => {
    const coupon = await createCoupon({ minOrderValue: 10000 });
    const customerToken = await createUserAndLogin({ name: 'Min Order', email: 'minorder@example.com', role: 'customer' });
    const product = await createActiveProduct(50);
    await addToCart(customerToken, product);

    const res = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(res.status, 400);
  });

  test('percentage coupon correctly discounts the cart subtotal, capped by maxDiscountAmount', async () => {
    const coupon = await createCoupon({ discountType: 'percentage', discountValue: 20, maxDiscountAmount: 15 });
    const customerToken = await createUserAndLogin({ name: 'Pct Coupon', email: 'pctcoupon@example.com', role: 'customer' });
    const product = await createActiveProduct(200);
    await addToCart(customerToken, product);

    const applyRes = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(applyRes.status, 200);
    const cart = (await applyRes.json()).data.cart;
    assert.equal(cart.discountAmount, 15);
    assert.equal(cart.grandTotal, 200 - 15);
  });

  test('a global usage limit is enforced across different customers', async () => {
    const coupon = await createCoupon({ usageLimit: 1, discountType: 'fixed', discountValue: 5 });

    const customerA = await createUserAndLogin({ name: 'Usage A', email: 'usagea@example.com', role: 'customer' });
    const productA = await createActiveProduct(50);
    await addToCart(customerA, productA);
    await fetch(`${baseUrl}/cart/coupon`, { method: 'POST', headers: authed(customerA), body: JSON.stringify({ code: coupon.code }) });
    const orderA = await placeOrder(customerA);
    assert.ok(orderA.orderNumber);

    const customerB = await createUserAndLogin({ name: 'Usage B', email: 'usageb@example.com', role: 'customer' });
    const productB = await createActiveProduct(50);
    await addToCart(customerB, productB);
    const applyRes = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerB),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(applyRes.status, 400);
  });

  test('a per-user usage limit blocks the same customer from reusing a coupon', async () => {
    const coupon = await createCoupon({ perUserLimit: 1, discountType: 'fixed', discountValue: 5 });
    const customerToken = await createUserAndLogin({ name: 'Per User', email: 'peruser@example.com', role: 'customer' });

    const product1 = await createActiveProduct(50);
    await addToCart(customerToken, product1);
    await fetch(`${baseUrl}/cart/coupon`, { method: 'POST', headers: authed(customerToken), body: JSON.stringify({ code: coupon.code }) });
    await placeOrder(customerToken);

    const product2 = await createActiveProduct(50);
    await addToCart(customerToken, product2);
    const res = await fetch(`${baseUrl}/cart/coupon`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ code: coupon.code }),
    });
    assert.equal(res.status, 400);
  });

  test('placing an order with a coupon applies the discount to the order total and increments usage', async () => {
    const coupon = await createCoupon({ discountType: 'fixed', discountValue: 20 });
    const customerToken = await createUserAndLogin({ name: 'Order Coupon', email: 'ordercoupon@example.com', role: 'customer' });
    const product = await createActiveProduct(100);
    await addToCart(customerToken, product);
    await fetch(`${baseUrl}/cart/coupon`, { method: 'POST', headers: authed(customerToken), body: JSON.stringify({ code: coupon.code }) });

    const order = await placeOrder(customerToken);
    assert.equal(order.discountAmount, 20);
    assert.equal(order.grandTotal, 80);

    const couponAfter = await (await fetch(`${baseUrl}/admin/coupons/${coupon._id}`, { headers: authed(adminToken) })).json();
    assert.equal(couponAfter.data.coupon.usageCount, 1);
  });

  test('server-side total cannot be manipulated — client-supplied discount/total fields are ignored', async () => {
    const customerToken = await createUserAndLogin({ name: 'No Manip', email: 'nomanip@example.com', role: 'customer' });
    const product = await createActiveProduct(100);

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({
        productId: product._id,
        sku: product.sku,
        quantity: 1,
        price: 1,
        discountAmount: 9999,
        grandTotal: 0.01,
      }),
    });
    const cart = (await res.json()).data.cart;
    assert.equal(cart.subtotal, 100);
    assert.equal(cart.grandTotal, 100);
  });

  // ── payment lifecycle ────────────────────────────────────────────────

  test("a customer cannot initiate payment for another customer's order", async () => {
    const customerA = await createUserAndLogin({ name: 'Pay Owner', email: 'payowner@example.com', role: 'customer' });
    const product = await createActiveProduct(60);
    await addToCart(customerA, product);
    const order = await placeOrder(customerA);

    const customerB = await createUserAndLogin({ name: 'Pay Intruder', email: 'payintruder@example.com', role: 'customer' });
    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerB),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    assert.equal(res.status, 404);
  });

  test('a successful payment marks the payment PAID and confirms the order', async () => {
    const customerToken = await createUserAndLogin({ name: 'Pay Success', email: 'paysuccess@example.com', role: 'customer' });
    const product = await createActiveProduct(75);
    await addToCart(customerToken, product);
    const order = await placeOrder(customerToken);

    const initiateRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    assert.equal(initiateRes.status, 201);
    const payment = (await initiateRes.json()).data.payment;
    assert.equal(payment.status, 'processing');

    const verifyRes = await fetch(`${baseUrl}/payments/${payment._id}/verify`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ simulate: 'success' }),
    });
    assert.equal(verifyRes.status, 200);
    const verified = (await verifyRes.json()).data.payment;
    assert.equal(verified.status, 'paid');

    const orderRes = await fetch(`${baseUrl}/orders/${order._id}`, { headers: authed(customerToken) });
    const updatedOrder = (await orderRes.json()).data.order;
    assert.equal(updatedOrder.paymentStatus, 'paid');
    assert.ok(updatedOrder.vendorGroups.every((g) => g.status === 'confirmed'));
  });

  test('a failed payment marks the payment FAILED and the order is NOT confirmed', async () => {
    const customerToken = await createUserAndLogin({ name: 'Pay Fail', email: 'payfail@example.com', role: 'customer' });
    const product = await createActiveProduct(45);
    await addToCart(customerToken, product);
    const order = await placeOrder(customerToken);

    const initiateRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'upi' }),
    });
    const payment = (await initiateRes.json()).data.payment;

    const verifyRes = await fetch(`${baseUrl}/payments/${payment._id}/verify`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ simulate: 'failure' }),
    });
    const verified = (await verifyRes.json()).data.payment;
    assert.equal(verified.status, 'failed');
    assert.ok(verified.failureReason);

    const orderRes = await fetch(`${baseUrl}/orders/${order._id}`, { headers: authed(customerToken) });
    const updatedOrder = (await orderRes.json()).data.order;
    assert.equal(updatedOrder.paymentStatus, 'failed');
    assert.ok(updatedOrder.vendorGroups.every((g) => g.status === 'pending'));
  });

  test('an invalid payment status transition is rejected — cannot verify an already-paid payment', async () => {
    const customerToken = await createUserAndLogin({ name: 'Pay Twice', email: 'paytwice@example.com', role: 'customer' });
    const product = await createActiveProduct(30);
    await addToCart(customerToken, product);
    const order = await placeOrder(customerToken);

    const initiateRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    const payment = (await initiateRes.json()).data.payment;

    await fetch(`${baseUrl}/payments/${payment._id}/verify`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ simulate: 'success' }),
    });

    const secondVerify = await fetch(`${baseUrl}/payments/${payment._id}/verify`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ simulate: 'failure' }),
    });
    assert.equal(secondVerify.status, 400);
  });

  test('cannot initiate a second payment for an order that is already paid', async () => {
    const customerToken = await createUserAndLogin({ name: 'Already Paid', email: 'alreadypaid@example.com', role: 'customer' });
    const product = await createActiveProduct(30);
    await addToCart(customerToken, product);
    const order = await placeOrder(customerToken);

    const first = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    const payment = (await first.json()).data.payment;
    await fetch(`${baseUrl}/payments/${payment._id}/verify`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ simulate: 'success' }),
    });

    const second = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    assert.equal(second.status, 400);
  });

  // ── webhook idempotency ──────────────────────────────────────────────

  test('a webhook event with an unknown transactionId is accepted but not applied', async () => {
    const res = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_${Math.random().toString(36).slice(2)}`,
        provider: 'mock',
        type: 'payment.succeeded',
        payload: { transactionId: 'NONEXISTENT-TXN' },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.processed, false);
  });

  test('the same webhook event delivered twice is only applied once (idempotency)', async () => {
    const customerToken = await createUserAndLogin({ name: 'Webhook Cust', email: 'webhookcust@example.com', role: 'customer' });
    const product = await createActiveProduct(55);
    await addToCart(customerToken, product);
    const order = await placeOrder(customerToken);

    const initiateRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: authed(customerToken),
      body: JSON.stringify({ orderId: order._id, method: 'card' }),
    });
    const payment = (await initiateRes.json()).data.payment;

    const eventId = `evt_${Math.random().toString(36).slice(2)}`;
    const webhookBody = JSON.stringify({
      eventId,
      provider: 'mock',
      type: 'payment.succeeded',
      payload: { transactionId: payment.transactionId },
    });

    const first = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: webhookBody,
    });
    assert.equal((await first.json()).data.processed, true);

    const second = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: webhookBody,
    });
    const secondBody = await second.json();
    assert.equal(secondBody.data.duplicate, true);
    assert.equal(secondBody.data.processed, false);

    const paymentRes = await fetch(`${baseUrl}/payments/${payment._id}`, { headers: authed(customerToken) });
    const finalPayment = (await paymentRes.json()).data.payment;
    assert.equal(finalPayment.status, 'paid');
  });

  test('the webhook endpoint requires no authentication', async () => {
    const res = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_${Math.random().toString(36).slice(2)}`,
        provider: 'mock',
        type: 'payment.failed',
        payload: { transactionId: 'IRRELEVANT' },
      }),
    });
    assert.notEqual(res.status, 401);
  });
}
