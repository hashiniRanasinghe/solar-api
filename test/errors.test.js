const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const app = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, () => resolve(server));
  });
}

function request(server, options, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: '127.0.0.1', port, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test('unknown route returns 404 with the standard error body', async (t) => {
  const server = await listen(app);
  t.after(() => server.close());

  const res = await request(server, { method: 'GET', path: '/no-such-route' });
  const parsed = JSON.parse(res.body);

  assert.equal(res.statusCode, 404);
  assert.equal(parsed.code, 40401);
  assert.equal(typeof parsed.message, 'string');
  assert.equal(typeof parsed.description, 'string');
  assert.equal(parsed.moreInfo, '/docs');
  assert.ok(Array.isArray(parsed.error));
});

test('malformed JSON body returns 400 / 40001', async (t) => {
  const server = await listen(app);
  t.after(() => server.close());

  const res = await request(
    server,
    {
      method: 'POST',
      path: '/solar/v1.0/anything',
      headers: { 'content-type': 'application/json' },
    },
    '{ not valid json',
  );
  const parsed = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(parsed.code, 40001);
});

test('X-Powered-By header is absent', async (t) => {
  const server = await listen(app);
  t.after(() => server.close());

  const res = await request(server, { method: 'GET', path: '/' });
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('GET / still returns 200 with status and environment', async (t) => {
  const server = await listen(app);
  t.after(() => server.close());

  const res = await request(server, { method: 'GET', path: '/' });
  const parsed = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(parsed.status, 'ok');
  assert.ok('environment' in parsed);
});

test('an async route that throws gives 500 / 50001 with no stack in the body', async (t) => {
  const testApp = express();
  testApp.get('/boom', async () => {
    throw new Error('secret internal detail');
  });
  testApp.use(errorHandler);

  const server = await listen(testApp);
  t.after(() => server.close());

  const res = await request(server, { method: 'GET', path: '/boom' });
  const parsed = JSON.parse(res.body);

  assert.equal(res.statusCode, 500);
  assert.equal(parsed.code, 50001);
  assert.ok(!res.body.includes('secret internal detail'));
  assert.ok(!res.body.includes(' at '));
});
