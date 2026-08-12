import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema, resetPasswordSchema } from '../../src/validators/auth.validator.js';

test('registerSchema accepts a valid customer registration', async () => {
  const result = await registerSchema.parseAsync({
    body: { name: 'Jane Doe', email: 'jane@example.com', password: 'Password1', role: 'customer' },
    query: {},
    params: {},
  });
  assert.equal(result.body.email, 'jane@example.com');
});

test('registerSchema rejects role=super_admin (not publicly registerable)', async () => {
  await assert.rejects(() =>
    registerSchema.parseAsync({
      body: { name: 'Evil Admin', email: 'evil@example.com', password: 'Password1', role: 'super_admin' },
      query: {},
      params: {},
    })
  );
});

test('registerSchema rejects role=delivery_partner (not publicly registerable)', async () => {
  await assert.rejects(() =>
    registerSchema.parseAsync({
      body: { name: 'Courier', email: 'courier@example.com', password: 'Password1', role: 'delivery_partner' },
      query: {},
      params: {},
    })
  );
});

test('registerSchema rejects a weak password (no number)', async () => {
  await assert.rejects(() =>
    registerSchema.parseAsync({
      body: { name: 'Jane Doe', email: 'jane@example.com', password: 'onlyletters', role: 'customer' },
      query: {},
      params: {},
    })
  );
});

test('registerSchema rejects a malformed email', async () => {
  await assert.rejects(() =>
    registerSchema.parseAsync({
      body: { name: 'Jane Doe', email: 'not-an-email', password: 'Password1', role: 'customer' },
      query: {},
      params: {},
    })
  );
});

test('registerSchema lowercases and trims email', async () => {
  const result = await registerSchema.parseAsync({
    body: { name: '  Jane Doe  ', email: '  JANE@EXAMPLE.COM  ', password: 'Password1', role: 'vendor' },
    query: {},
    params: {},
  });
  assert.equal(result.body.email, 'jane@example.com');
  assert.equal(result.body.name, 'Jane Doe');
});

test('loginSchema requires a non-empty password but does not enforce complexity', async () => {
  const result = await loginSchema.parseAsync({
    body: { email: 'jane@example.com', password: 'x' },
    query: {},
    params: {},
  });
  assert.equal(result.body.password, 'x');

  await assert.rejects(() =>
    loginSchema.parseAsync({ body: { email: 'jane@example.com', password: '' }, query: {}, params: {} })
  );
});

test('resetPasswordSchema rejects a short/invalid token', async () => {
  await assert.rejects(() =>
    resetPasswordSchema.parseAsync({
      body: { token: 'short', newPassword: 'Password1' },
      query: {},
      params: {},
    })
  );
});
