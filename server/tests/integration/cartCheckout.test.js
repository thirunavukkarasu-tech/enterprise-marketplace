import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * See tests/integration/auth.test.js for why this suite is gated behind
 * TEST_MONGODB_URI. Run locally with:
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/marketsphere-test node --test tests/integration/cartCheckout.test.js
 */

const TEST_URI = process.env.TEST_MONGODB_URI;

if (!TEST_URI) {
  test('cart/checkout integration suite skipped — set TEST_MONGODB_URI to run against a real MongoDB instance', () => {
    console.log('  ⚠ Skipped: no TEST_MONGODB_URI configured in this environment.');
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = TEST_URI;

  const { default: app } = await import('../../src/app.js');
  const { User } = await import('../../src/models/User.model.js');
  const { Product } = await import('../../src/models/Product.model.js');
  const bcrypt = (await import('bcryptjs')).default;

  let server;
  let baseUrl;
  let categoryId;
  let vendorToken;

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

  async function createActiveProduct({ title, price = 25, stock = 10 }) {
    const sku = `CART-${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorToken),
      body: JSON.stringify({
        title,
        description: 'A product for Phase 6 cart tests.',
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

  async function newCustomer(email) {
    return createUserAndLogin({ name: 'Cart Customer', email, role: 'customer' });
  }

  async function createAddressFor(token) {
    const res = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({
        fullName: 'Jane Doe',
        phone: '+1 555-123-4567',
        line1: '123 Market St',
        city: 'Springfield',
        state: 'IL',
        country: 'USA',
        postalCode: '62704',
      }),
    });
    return (await res.json()).data.address;
  }

  before(async () => {
    await mongoose.connect(TEST_URI);
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    const admin = await createUserAndLogin({ name: 'Cart Admin', email: 'cartadmin@example.com', role: 'super_admin' });
    const vendor = await createUserAndLogin({ name: 'Cart Vendor', email: 'cartvendor@example.com', role: 'vendor' });
    vendorToken = vendor.token;

    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: authed(admin.token),
      body: JSON.stringify({ name: 'Cart Test Category' }),
    });
    categoryId = (await catRes.json()).data.category._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  // ── ownership / RBAC ──────────────────────────────────────────────────

  test('GET /cart requires authentication', async () => {
    const res = await fetch(`${baseUrl}/cart`);
    assert.equal(res.status, 401);
  });

  test('a vendor cannot access the cart endpoints', async () => {
    const res = await fetch(`${baseUrl}/cart`, { headers: authed(vendorToken) });
    assert.equal(res.status, 403);
  });

  test('an admin cannot access the cart endpoints either', async () => {
    const admin = await createUserAndLogin({ name: 'Cart Admin2', email: 'cartadmin2@example.com', role: 'super_admin' });
    const res = await fetch(`${baseUrl}/cart`, { headers: authed(admin.token) });
    assert.equal(res.status, 403);
  });

  test('a customer only ever sees their own cart — never another customer\'s items', async () => {
    const customerA = await newCustomer('carta@example.com');
    const customerB = await newCustomer('cartb@example.com');
    const product = await createActiveProduct({ title: 'A-Only Product' });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customerA.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });

    const bCart = await fetch(`${baseUrl}/cart`, { headers: authed(customerB.token) });
    const bBody = await bCart.json();
    assert.equal(bBody.data.cart.items.length, 0);
  });

  // ── add to cart ───────────────────────────────────────────────────────

  test('adding a product to an empty cart creates one and returns it', async () => {
    const customer = await newCustomer('addbasic@example.com');
    const product = await createActiveProduct({ title: 'Basic Add Product', price: 40 });

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 2 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.cart.items.length, 1);
    assert.equal(body.data.cart.items[0].quantity, 2);
    assert.equal(body.data.cart.subtotal, 80); // server-calculated: 40 * 2
  });

  test('adding the same product/sku again increments quantity rather than duplicating the line item', async () => {
    const customer = await newCustomer('increment@example.com');
    const product = await createActiveProduct({ title: 'Increment Product' });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });
    const secondAdd = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 2 }),
    });
    const body = await secondAdd.json();
    assert.equal(body.data.cart.items.length, 1);
    assert.equal(body.data.cart.items[0].quantity, 3);
  });

  test('adding a nonexistent product is rejected', async () => {
    const customer = await newCustomer('ghostproduct@example.com');
    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: '507f1f77bcf86cd799439011', sku: 'DOES-NOT-EXIST', quantity: 1 }),
    });
    assert.equal(res.status, 400);
  });

  test('adding a draft (inactive) product is rejected', async () => {
    const customer = await newCustomer('draftproduct@example.com');
    const sku = `DRAFT-${Math.random().toString(36).slice(2, 6)}`;
    const createRes = await fetch(`${baseUrl}/products/manage`, {
      method: 'POST',
      headers: authed(vendorToken),
      body: JSON.stringify({
        title: 'Still A Draft',
        description: 'Not active yet.',
        category: categoryId,
        variants: [{ sku, price: 10, stock: 5 }],
      }),
    });
    const draftProduct = (await createRes.json()).data.product;

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: draftProduct._id, sku, quantity: 1 }),
    });
    assert.equal(res.status, 400);
  });

  test('adding an invalid/nonexistent variant SKU is rejected', async () => {
    const customer = await newCustomer('badvariant@example.com');
    const product = await createActiveProduct({ title: 'Variant Test Product' });

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: 'NOT-A-REAL-SKU', quantity: 1 }),
    });
    assert.equal(res.status, 400);
  });

  test('requesting more than available stock is rejected', async () => {
    const customer = await newCustomer('overstock@example.com');
    const product = await createActiveProduct({ title: 'Low Stock Product', stock: 3 });

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 5 }),
    });
    assert.equal(res.status, 400);
  });

  test('requesting more than the max allowed item quantity is rejected by validation', async () => {
    const customer = await newCustomer('maxqty@example.com');
    const product = await createActiveProduct({ title: 'Max Qty Product', stock: 100 });

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 999 }),
    });
    assert.equal(res.status, 400);
  });

  // ── price manipulation resistance (the critical requirement) ──────────

  test('a price/subtotal/total sent by the client is completely ignored — server always recalculates', async () => {
    const customer = await newCustomer('pricemanip@example.com');
    const product = await createActiveProduct({ title: 'Real Price Product', price: 99 });

    const res = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({
        productId: product._id,
        sku: product.sku,
        quantity: 1,
        // None of these fields exist in the schema — Zod strips them.
        price: 0.01,
        subtotal: 0.01,
        total: 0.01,
        discount: 1000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.cart.items[0].lineSubtotal, 99); // the REAL price, not 0.01
    assert.equal(body.data.cart.subtotal, 99);
  });

  test('a price increase after adding to cart is detected and flagged, and the cart charges the NEW price', async () => {
    const customer = await newCustomer('pricechange@example.com');
    const product = await createActiveProduct({ title: 'Price Change Product', price: 50 });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });

    // Vendor reprices the variant via a full product update... simulate
    // by adding a second identical-SKU variant update isn't supported,
    // so instead we directly verify via the variant update endpoint.
    await fetch(`${baseUrl}/products/manage/${product._id}/variants/${product.sku}`, {
      method: 'PATCH',
      headers: authed(vendorToken),
      body: JSON.stringify({ price: 75 }),
    });

    const cartRes = await fetch(`${baseUrl}/cart`, { headers: authed(customer.token) });
    const cart = (await cartRes.json()).data.cart;
    assert.equal(cart.hasPriceChanges, true);
    assert.equal(cart.priceChangeMessage, 'One or more item prices have changed. Please review your cart before checkout.');
    assert.equal(cart.items[0].currentPrice, 75);
    assert.equal(cart.subtotal, 75); // charges the NEW price, never the stale snapshot
  });

  // ── update / remove / clear ─────────────────────────────────────────

  test('updating quantity recalculates the subtotal', async () => {
    const customer = await newCustomer('updateqty@example.com');
    const product = await createActiveProduct({ title: 'Update Qty Product', price: 20 });

    const addRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });
    const itemId = (await addRes.json()).data.cart.items[0].itemId;

    const updateRes = await fetch(`${baseUrl}/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: authed(customer.token),
      body: JSON.stringify({ quantity: 4 }),
    });
    const body = await updateRes.json();
    assert.equal(body.data.cart.items[0].quantity, 4);
    assert.equal(body.data.cart.subtotal, 80);
  });

  test('updating quantity beyond available stock is rejected', async () => {
    const customer = await newCustomer('updateoverstock@example.com');
    const product = await createActiveProduct({ title: 'Update Overstock Product', stock: 2 });

    const addRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });
    const itemId = (await addRes.json()).data.cart.items[0].itemId;

    const res = await fetch(`${baseUrl}/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: authed(customer.token),
      body: JSON.stringify({ quantity: 10 }),
    });
    assert.equal(res.status, 400);
  });

  test('removing a cart item works, and removing it again is a graceful no-op, not an error', async () => {
    const customer = await newCustomer('removeitem@example.com');
    const product = await createActiveProduct({ title: 'Remove Item Product' });

    const addRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });
    const itemId = (await addRes.json()).data.cart.items[0].itemId;

    const firstRemove = await fetch(`${baseUrl}/cart/items/${itemId}`, { method: 'DELETE', headers: authed(customer.token) });
    assert.equal(firstRemove.status, 200);
    assert.equal((await firstRemove.json()).data.cart.items.length, 0);

    const secondRemove = await fetch(`${baseUrl}/cart/items/${itemId}`, { method: 'DELETE', headers: authed(customer.token) });
    assert.equal(secondRemove.status, 200); // still 200, not 404
  });

  test('clearing the cart empties all items', async () => {
    const customer = await newCustomer('clearcart@example.com');
    const productA = await createActiveProduct({ title: 'Clear A' });
    const productB = await createActiveProduct({ title: 'Clear B' });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: productA._id, sku: productA.sku, quantity: 1 }),
    });
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: productB._id, sku: productB.sku, quantity: 1 }),
    });

    const clearRes = await fetch(`${baseUrl}/cart`, { method: 'DELETE', headers: authed(customer.token) });
    const body = await clearRes.json();
    assert.equal(body.data.cart.items.length, 0);
    assert.equal(body.data.cart.subtotal, 0);
  });

  // ── persistence ───────────────────────────────────────────────────────

  test('the cart persists across separate requests/sessions for the same customer', async () => {
    const customer = await newCustomer('persist@example.com');
    const product = await createActiveProduct({ title: 'Persist Product' });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 2 }),
    });

    // Simulate "returning later" — log in again, fresh access token.
    const loginAgain = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'persist@example.com', password: 'Password1' }),
    });
    const newToken = (await loginAgain.json()).data.accessToken;

    const cartRes = await fetch(`${baseUrl}/cart`, { headers: authed(newToken) });
    const cart = (await cartRes.json()).data.cart;
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 2);
  });

  // ── addresses ─────────────────────────────────────────────────────────

  test('address operations require authentication', async () => {
    const res = await fetch(`${baseUrl}/addresses`);
    assert.equal(res.status, 401);
  });

  test('a customer can create, list, and update their own address; the first address becomes the default', async () => {
    const customer = await newCustomer('addressowner@example.com');
    const address = await createAddressFor(customer.token);
    assert.equal(address.isDefaultShipping, true);
    assert.equal(address.isDefaultBilling, true);

    const listRes = await fetch(`${baseUrl}/addresses`, { headers: authed(customer.token) });
    const list = (await listRes.json()).data.addresses;
    assert.equal(list.length, 1);

    const updateRes = await fetch(`${baseUrl}/addresses/${address._id}`, {
      method: 'PATCH',
      headers: authed(customer.token),
      body: JSON.stringify({ city: 'Updated City' }),
    });
    assert.equal((await updateRes.json()).data.address.city, 'Updated City');
  });

  test('a customer cannot view, update, or delete another customer\'s address', async () => {
    const customerA = await newCustomer('addra@example.com');
    const customerB = await newCustomer('addrb@example.com');
    const address = await createAddressFor(customerA.token);

    const getRes = await fetch(`${baseUrl}/addresses/${address._id}`, { headers: authed(customerB.token) });
    assert.equal(getRes.status, 404); // ownership-scoped query — indistinguishable from nonexistent

    const updateRes = await fetch(`${baseUrl}/addresses/${address._id}`, {
      method: 'PATCH',
      headers: authed(customerB.token),
      body: JSON.stringify({ city: 'Hijacked' }),
    });
    assert.equal(updateRes.status, 404);

    const deleteRes = await fetch(`${baseUrl}/addresses/${address._id}`, { method: 'DELETE', headers: authed(customerB.token) });
    assert.equal(deleteRes.status, 404);

    // Confirm it's untouched.
    const stillThereRes = await fetch(`${baseUrl}/addresses/${address._id}`, { headers: authed(customerA.token) });
    assert.equal((await stillThereRes.json()).data.address.city, 'Springfield');
  });

  // ── checkout review ───────────────────────────────────────────────────

  test('checkout review is rejected for an empty cart', async () => {
    const customer = await newCustomer('emptycheckout@example.com');
    const address = await createAddressFor(customer.token);

    const res = await fetch(`${baseUrl}/checkout/review`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ shippingAddressId: address._id }),
    });
    assert.equal(res.status, 400);
  });

  test('checkout review is rejected when the shipping address belongs to someone else', async () => {
    const customerA = await newCustomer('checkouta@example.com');
    const customerB = await newCustomer('checkoutb@example.com');
    const address = await createAddressFor(customerA.token);
    const product = await createActiveProduct({ title: 'Checkout RBAC Product' });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customerB.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });

    const res = await fetch(`${baseUrl}/checkout/review`, {
      method: 'POST',
      headers: authed(customerB.token),
      body: JSON.stringify({ shippingAddressId: address._id }),
    });
    assert.equal(res.status, 404);
  });

  test('a valid checkout review returns server-calculated totals and canProceed=true', async () => {
    const customer = await newCustomer('goodcheckout@example.com');
    const address = await createAddressFor(customer.token);
    const product = await createActiveProduct({ title: 'Good Checkout Product', price: 30 });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 2 }),
    });

    const res = await fetch(`${baseUrl}/checkout/review`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ shippingAddressId: address._id, shippingMethod: 'express' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.checkout.subtotal, 60);
    assert.equal(body.data.checkout.shippingFee, 15);
    assert.equal(body.data.checkout.grandTotal, 75);
    assert.equal(body.data.checkout.canProceed, true);
    assert.equal(body.data.checkout.shippingAddress._id, address._id);
  });

  test('checkout review blocks proceeding when the cart has an out-of-stock item', async () => {
    const customer = await newCustomer('blockedcheckout@example.com');
    const address = await createAddressFor(customer.token);
    const product = await createActiveProduct({ title: 'Will Sell Out Product', stock: 1 });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ productId: product._id, sku: product.sku, quantity: 1 }),
    });

    // Sell out the variant from under the cart.
    await Product.updateOne({ _id: product._id, 'variants.sku': product.sku }, { $set: { 'variants.$.stock': 0 } });

    const res = await fetch(`${baseUrl}/checkout/review`, {
      method: 'POST',
      headers: authed(customer.token),
      body: JSON.stringify({ shippingAddressId: address._id }),
    });
    assert.equal(res.status, 200); // review succeeds — it's a report, not a hard failure
    const body = await res.json();
    assert.equal(body.data.checkout.canProceed, false);
    assert.equal(body.data.checkout.hasBlockingIssues, true);
  });
}
