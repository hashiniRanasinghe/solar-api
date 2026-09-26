// Conditional GET (strong ETag, 304, If-None-Match over If-Modified-Since),
// cache headers and 406. Reads the seeded database (slsea_local). Read-only:
// no writes, no index builds. POST /login is refused with 406 before the body
// is read, so no credential is sent.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { nationalToken, districtToken } = require('./helpers/auth');
const { MONGODB_URI } = require('../src/config/env');

const API = '/solar/v1.0';
const INSTALLATION = `${API}/installations/INS-0001`;
const NATIONAL = nationalToken();
const DT01 = districtToken('DT-01');

let server;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the conditional GET tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

// token: a bearer token, or null to send none.
function request({ method = 'GET', path, token = NATIONAL, headers = {} }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const all = { ...headers };
    if (token !== null) all.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: all }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, raw: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function assertError(res, status, code) {
  assert.equal(res.statusCode, status);
  assert.match(res.headers['content-type'], /^application\/json/);
  const body = JSON.parse(res.raw);
  assert.equal(body.code, code);
  assert.equal(typeof body.message, 'string');
  assert.equal(typeof body.description, 'string');
  assert.equal(body.moreInfo, '/docs');
  assert.ok(Array.isArray(body.error));
}

function assertNotModified(res, etag) {
  assert.equal(res.statusCode, 304);
  assert.equal(res.raw, '');
  assert.equal(res.headers.etag, etag);
}

test('a GET carries a strong ETag, Cache-Control private no-cache and Vary Authorization', async () => {
  const res = await request({ path: INSTALLATION });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers.etag, /^"[^"]+"$/);
  assert.ok(!res.headers.etag.startsWith('W/'));
  assert.equal(res.headers['cache-control'], 'private, no-cache');
  assert.match(res.headers.vary, /\bAuthorization\b/);
});

test('If-None-Match with the current ETag gives 304 with an empty body; another ETag gives 200', async () => {
  const first = await request({ path: INSTALLATION });
  const { etag } = first.headers;

  const again = await request({ path: INSTALLATION, headers: { 'If-None-Match': etag } });
  assertNotModified(again, etag);
  assert.equal(again.headers['last-modified'], first.headers['last-modified']);

  const other = await request({ path: INSTALLATION, headers: { 'If-None-Match': '"not-the-current-tag"' } });
  assert.equal(other.statusCode, 200);
  assert.equal(other.headers.etag, etag);
});

test('If-None-Match takes precedence over If-Modified-Since', async () => {
  const { headers } = await request({ path: INSTALLATION });

  const matching = await request({
    path: INSTALLATION,
    headers: { 'If-None-Match': headers.etag, 'If-Modified-Since': new Date(0).toUTCString() },
  });
  assertNotModified(matching, headers.etag);

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  const notMatching = await request({
    path: INSTALLATION,
    headers: { 'If-None-Match': '"not-the-current-tag"', 'If-Modified-Since': future },
  });
  assert.equal(notMatching.statusCode, 200);
});

test('If-Modified-Since alone: 304 when not modified since, 200 when older', async () => {
  const first = await request({ path: INSTALLATION });
  const lastModified = first.headers['last-modified'];
  assert.ok(lastModified);

  const same = await request({ path: INSTALLATION, headers: { 'If-Modified-Since': lastModified } });
  assertNotModified(same, first.headers.etag);
  assert.equal(same.headers['last-modified'], lastModified);

  const older = new Date(Date.parse(lastModified) - 24 * 60 * 60 * 1000).toUTCString();
  const res = await request({ path: INSTALLATION, headers: { 'If-Modified-Since': older } });
  assert.equal(res.statusCode, 200);
});

test('Last-Modified on the installation composite is the later of updated_at and last_reading.received_at', async () => {
  const res = await request({ path: INSTALLATION });
  const body = JSON.parse(res.raw);
  const times = [body.updated_at, body.last_reading && body.last_reading.received_at]
    .filter(Boolean)
    .map((value) => Date.parse(value));
  assert.equal(res.headers['last-modified'], new Date(Math.max(...times)).toUTCString());
});

test('Last-Modified on a reading and on last-reading is received_at', async () => {
  const last = await request({ path: `${INSTALLATION}/last-reading` });
  assert.equal(last.statusCode, 200);
  const reading = JSON.parse(last.raw);
  const expected = new Date(reading.received_at).toUTCString();
  assert.equal(last.headers['last-modified'], expected);

  const member = await request({ path: `${INSTALLATION}/readings/${reading.reading_id}` });
  assert.equal(member.statusCode, 200);
  assert.equal(member.headers['last-modified'], expected);
});

test('no Last-Modified on a province, a collection or the generation summary', async () => {
  for (const path of [`${API}/provinces/PV-01`, `${API}/provinces`, `${INSTALLATION}/readings`, `${API}/districts/DT-01/generation-summary`]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request({ path });
    assert.equal(res.statusCode, 200, path);
    assert.equal(res.headers['last-modified'], undefined, path);
    assert.ok(res.headers.etag, path);
  }
});

test('a collection revalidates with its ETag', async () => {
  const first = await request({ path: `${API}/provinces` });
  const res = await request({ path: `${API}/provinces`, headers: { 'If-None-Match': first.headers.etag } });
  assertNotModified(res, first.headers.etag);
});

test('a copied ETag never turns 403 or 401 into 304', async () => {
  const path = `${API}/districts/DT-02`;
  const national = await request({ path });
  assert.equal(national.statusCode, 200);
  const { etag } = national.headers;

  const outOfScope = await request({ path, token: DT01, headers: { 'If-None-Match': etag } });
  assertError(outOfScope, 403, 40301);

  const noToken = await request({ path, token: null, headers: { 'If-None-Match': etag } });
  assertError(noToken, 401, 40101);
});

test('the generation summary never returns 304 (as_of changes on every request)', async () => {
  const path = `${API}/districts/DT-01/generation-summary`;
  const first = await request({ path });
  assert.equal(first.statusCode, 200);
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
  const res = await request({ path, headers: { 'If-None-Match': first.headers.etag } });
  assert.equal(res.statusCode, 200);
  assert.notEqual(res.headers.etag, first.headers.etag);
});

test('HEAD follows the same rules: 304 with a matching If-None-Match', async () => {
  const first = await request({ method: 'HEAD', path: INSTALLATION });
  assert.equal(first.statusCode, 200);
  assert.ok(first.headers.etag);
  const res = await request({ method: 'HEAD', path: INSTALLATION, headers: { 'If-None-Match': first.headers.etag } });
  assertNotModified(res, first.headers.etag);
});

test('Accept that does not allow application/json gives 406 40601 as JSON', async () => {
  const res = await request({ path: INSTALLATION, headers: { Accept: 'text/html' } });
  assertError(res, 406, 40601);
});

test('406 comes before 401', async () => {
  const res = await request({ path: INSTALLATION, token: null, headers: { Accept: 'text/html' } });
  assertError(res, 406, 40601);
});

test('POST /login with Accept text/html gives 406 40601', async () => {
  const res = await request({ method: 'POST', path: `${API}/login`, token: null, headers: { Accept: 'text/html' } });
  assertError(res, 406, 40601);
});

test('Accept */*, application/json and no Accept are served', async () => {
  for (const accept of ['*/*', 'application/json', 'text/html, application/json;q=0.5', undefined]) {
    const headers = accept === undefined ? {} : { Accept: accept };
    // eslint-disable-next-line no-await-in-loop
    const res = await request({ path: INSTALLATION, headers });
    assert.equal(res.statusCode, 200, String(accept));
  }
});
