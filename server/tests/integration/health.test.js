import { test } from 'node:test';
import assert from 'node:assert/strict';

// NODE_ENV=test lets config/env.js load with placeholder secrets so this
// test doesn't need a real .env file or a live MongoDB connection.
process.env.NODE_ENV = 'test';

const { default: app } = await import('../../src/app.js');

test('GET /api/v1/health returns success envelope', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
  } finally {
    server.close();
  }
});

test('GET /api/v1/unknown-route returns a 404 envelope', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/unknown-route`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  } finally {
    server.close();
  }
});
