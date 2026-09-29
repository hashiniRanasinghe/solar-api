// Admin CRUD on installations: POST (with device key issuance), PUT (whole
// replacement, optional If-Match -> 412) and DELETE (409 while readings
// exist). Writes go ONLY to the database slsea_test (same MONGODB_URI, dbName
// overridden), never to slsea_local; the database is emptied before and after,
// with a guard that refuses any other database. Also: 405 with Allow on every
// URI that exists but does not support the method, before 406 and 401 (these
// need no data). No seeded key is read; the device key used here is the one
// this test's POST returns, and it is never printed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { Province, District, Substation, Installation, GenerationReading } = require('../src/models');
const { mintToken, nationalToken, deviceToken } = require('./helpers/auth');

const TEST_DB = 'slsea_test';
const API = '/solar/v1.0';
const CHALLENGE = 'Bearer realm="solar"';
const WRITE_CHALLENGE = 'Bearer realm="solar", error="insufficient_scope", scope="installations:write"';
const EXISTING = 'INS-0005';
const SLOT_MS = 15 * 60 * 1000;
const BASE_MS = Date.parse('2026-09-01T00:00:00Z');
const at = (slot) => new Date(BASE_MS + slot * SLOT_MS).toISOString();

const adminToken = () => mintToken({ sub: 'test.admin', role: 'admin' });
const districtAdminToken = (id) =>
  mintToken({ sub: 'test.district.admin', role: 'admin', jurisdiction_level: 'district', jurisdiction_id: id });

let server;

// Refuses to touch any database whose name is not exactly slsea_test.
function assertTestDatabase() {
  const name = mongoose.connection.db && mongoose.connection.db.databaseName;
  if (name !== TEST_DB) {
    throw new Error(`Refusing to write to or drop database "${name}"; only ${TEST_DB} is allowed`);
  }
}

// The database user may drop collections but not databases, so every
// collection is dropped; MongoDB removes a database with no collections.
async function dropTestDatabase() {
  assertTestDatabase();
  const { db } = mongoose.connection;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    // eslint-disable-next-line no-await-in-loop
    await db.dropCollection(name);
  }
}

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the admin CRUD tests');
  await mongoose.connect(MONGODB_URI, { dbName: TEST_DB, serverSelectionTimeoutMS: 10000, autoIndex: false });
  await dropTestDatabase();
  await Installation.createIndexes();
  await GenerationReading.createIndexes();

  // Two separate branches, so moving an installation changes both derived ids.
  await Province.create([
    { province_id: 'PV-T1', name: 'Test Province 1' },
    { province_id: 'PV-T2', name: 'Test Province 2' },
  ]);
  await District.create([
    { district_id: 'DT-T1', name: 'Test District 1', province_id: 'PV-T1' },
    { district_id: 'DT-T2', name: 'Test District 2', province_id: 'PV-T2' },
  ]);
  await Substation.create([
    { substation_id: 'SS-T01', name: 'Test Substation 1', district_id: 'DT-T1', province_id: 'PV-T1' },
    { substation_id: 'SS-T02', name: 'Test Substation 2', district_id: 'DT-T2', province_id: 'PV-T2' },
  ]);
  // An existing installation (no key): new ids continue after its number.
  await Installation.create({
    installation_id: EXISTING,
    meter_id: 'MTR-EXISTING',
    name: 'Existing Installation',
    capacity_kw: 5,
    substation_id: 'SS-T01',
    district_id: 'DT-T1',
    province_id: 'PV-T1',
  });

  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) await dropTestDatabase();
  } finally {
    await mongoose.disconnect();
  }
});

function request({ method = 'GET', path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, raw: data, body: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// A write request. token / contentType: the header value, or null to omit it.
function write(method, path, { token = adminToken(), body, contentType = 'application/json', headers = {} } = {}) {
  const all = { ...headers };
  if (contentType !== null && body !== undefined) all['Content-Type'] = contentType;
  if (token !== null) all.Authorization = `Bearer ${token}`;
  return request({
    method,
    path,
    headers: all,
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const installationPath = (id) => `${API}/installations/${id}`;
const create = (body, options) => write('POST', `${API}/installations`, { body, ...options });
const replace = (id, body, options) => write('PUT', installationPath(id), { body, ...options });
const remove = (id, options) => write('DELETE', installationPath(id), options);
const get = (path) => request({ path, headers: { Authorization: `Bearer ${nationalToken()}` } });

function installationBody(overrides = {}) {
  return { name: 'New Installation', meter_id: 'MTR-NEW-1', substation_id: 'SS-T01', capacity_kw: 6.5, ...overrides };
}

function assertError(res, status, code) {
  assert.equal(res.statusCode, status);
  assert.equal(res.body.code, code);
  assert.equal(typeof res.body.message, 'string');
  assert.equal(typeof res.body.description, 'string');
  assert.equal(res.body.moreInfo, '/docs');
  assert.ok(Array.isArray(res.body.error));
}

const itemCodes = (res) => res.body.error.map((item) => item.code).sort();

function assertNoSecrets(res) {
  assert.ok(!res.raw.includes('device_key'));
  assert.ok(!res.raw.includes('api_key_hash'));
  assert.ok(!res.raw.includes('"_id"'));
}

function postReading(installationId, token, slot) {
  return write('POST', `${installationPath(installationId)}/readings`, {
    token,
    body: { timestamp: at(slot), power_kw: 1.5, energy_kwh: 100 + slot, voltage: 230 },
  });
}

// Shared across the life-cycle tests, which run in order.
let first;
let deviceKey;
let device;

test('refuses any database other than slsea_test', () => {
  assert.equal(mongoose.connection.db.databaseName, TEST_DB);
});

test('POST: 201 with Location, ETag, Last-Modified, no-store and device_key; no Content-Location', async () => {
  const res = await create(installationBody());
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'], /^application\/json/);

  const { body } = res;
  assert.deepEqual(Object.keys(body).sort(), [
    'capacity_kw',
    'created_at',
    'device_key',
    'district_id',
    'installation_id',
    'meter_id',
    'name',
    'province_id',
    'substation_id',
    'updated_at',
  ]);
  assert.equal(body.installation_id, 'INS-0006');
  assert.equal(body.district_id, 'DT-T1');
  assert.equal(body.province_id, 'PV-T1');
  assert.equal(body.capacity_kw, 6.5);
  assert.match(body.device_key, /^[0-9a-f]{64}$/);
  assert.ok(!res.raw.includes('api_key_hash'));
  assert.ok(!res.raw.includes('"_id"'));

  assert.equal(res.headers.location, installationPath('INS-0006'));
  assert.equal(res.headers['content-location'], undefined);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.headers.etag, /^"[^"]+"$/);
  assert.equal(res.headers['last-modified'], new Date(body.updated_at).toUTCString());

  first = body.installation_id;
  deviceKey = body.device_key;
  const stored = await Installation.findOne({ installation_id: first }).lean();
  assert.match(stored.api_key_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(stored.api_key_hash, deviceKey);

  // GET on Location: the composite, without the key, with the same ETag.
  const got = await get(res.headers.location);
  assert.equal(got.statusCode, 200);
  assertNoSecrets(got);
  const { device_key: omitted, ...fields } = body;
  assert.equal(typeof omitted, 'string');
  assert.deepEqual(got.body, { ...fields, last_reading: null });
  assert.equal(got.headers.etag, res.headers.etag);
});

test('the returned key logs the device in, and the device posts a reading (201)', async () => {
  const res = await write('POST', `${API}/login`, {
    token: null,
    body: { installation_id: first, device_key: deviceKey },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token_type, 'Bearer');
  device = res.body.access_token;

  const posted = await postReading(first, device, 10);
  assert.equal(posted.statusCode, 201);
});

test('DELETE an installation with readings: 409/40905, nothing deleted', async () => {
  const res = await remove(first);
  assertError(res, 409, 40905);
  assert.equal((await get(installationPath(first))).statusCode, 200);
});

test('ids are sequential; DELETE without readings: 200 with the representation, repeat 404', async () => {
  const created = await create(installationBody({ meter_id: 'MTR-NEW-2', installation_id: 'INS-0100' }));
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.installation_id, 'INS-0007', 'installation_id in a POST body is ignored');
  const id = created.body.installation_id;
  const before = await get(installationPath(id));

  const res = await remove(id);
  assert.equal(res.statusCode, 200);
  assertNoSecrets(res);
  assert.deepEqual(res.body, before.body);

  assertError(await remove(id), 404, 40402);
  assertError(await get(installationPath(id)), 404, 40402);
});

test('PUT without If-Match: 200, derived ids recomputed, updated_at changes, body equals GET', async () => {
  const before = await get(installationPath(first));
  const res = await replace(first, installationBody({ name: 'Moved', substation_id: 'SS-T02', capacity_kw: 8 }));
  assert.equal(res.statusCode, 200);
  assertNoSecrets(res);
  assert.equal(res.body.installation_id, first);
  assert.equal(res.body.name, 'Moved');
  assert.equal(res.body.substation_id, 'SS-T02');
  assert.equal(res.body.district_id, 'DT-T2');
  assert.equal(res.body.province_id, 'PV-T2');
  assert.equal(res.body.capacity_kw, 8);
  assert.equal(res.body.created_at, before.body.created_at);
  assert.ok(Date.parse(res.body.updated_at) > Date.parse(before.body.updated_at));
  assert.notEqual(res.body.last_reading, null);

  const got = await get(installationPath(first));
  assert.deepEqual(got.body, res.body);
  assert.equal(got.headers.etag, res.headers.etag);
  assert.ok(res.headers['last-modified']);
});

test('a GET body PUT back is accepted: server-set fields are ignored and recomputed', async () => {
  const current = await get(installationPath(first));
  const body = { ...current.body, district_id: 'DT-T1', province_id: 'PV-T1', created_at: '2000-01-01T00:00:00Z' };
  const res = await replace(first, body, { headers: { 'If-Match': current.headers.etag } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.district_id, 'DT-T2');
  assert.equal(res.body.province_id, 'PV-T2');
  assert.equal(res.body.created_at, current.body.created_at);
});

test('PUT with an installation_id that differs from the path: 400 with 40028', async () => {
  const res = await replace(first, installationBody({ installation_id: EXISTING }));
  assertError(res, 400, 40010);
  assert.deepEqual(itemCodes(res), [40028]);
});

test('PUT with If-Match: current ETag 200; ETag from before a device reading 412; * 200', async () => {
  const current = await get(installationPath(first));
  const ok = await replace(first, installationBody({ substation_id: 'SS-T02' }), {
    headers: { 'If-Match': current.headers.etag },
  });
  assert.equal(ok.statusCode, 200);

  const stale = ok.headers.etag;
  assert.equal((await postReading(first, device, 11)).statusCode, 201);
  const refused = await replace(first, installationBody({ name: 'Lost update' }), { headers: { 'If-Match': stale } });
  assertError(refused, 412, 41201);
  assert.notEqual((await get(installationPath(first))).body.name, 'Lost update');

  const weak = await replace(first, installationBody(), { headers: { 'If-Match': `W/${stale}` } });
  assertError(weak, 412, 41201);

  const any = await replace(first, installationBody({ substation_id: 'SS-T02' }), { headers: { 'If-Match': '*' } });
  assert.equal(any.statusCode, 200);
});

test('412 comes before 400; 404 comes before 412', async () => {
  const stale = await replace(first, { name: '' }, { headers: { 'If-Match': '"stale"' } });
  assertError(stale, 412, 41201);
  const missing = await replace('INS-0999', { name: '' }, { headers: { 'If-Match': '"stale"' } });
  assertError(missing, 404, 40402);
});

test('PUT or DELETE a missing installation: 404 for a national admin (PUT never creates)', async () => {
  assertError(await replace('INS-0999', installationBody({ meter_id: 'MTR-NEW-9' })), 404, 40402);
  assertError(await remove('INS-0999'), 404, 40402);
  assert.equal(await Installation.exists({ installation_id: 'INS-0999' }), null);
});

test('duplicate meter_id: 409/40904 on POST and on PUT', async () => {
  assertError(await create(installationBody({ meter_id: 'MTR-EXISTING' })), 409, 40904);
  assertError(await replace(first, installationBody({ meter_id: 'MTR-EXISTING' })), 409, 40904);
  // Its own meter_id is not a duplicate.
  assert.equal((await replace(first, installationBody({ substation_id: 'SS-T02' }))).statusCode, 200);
});

test('unknown substation_id: 400 with 40026', async () => {
  const res = await create(installationBody({ meter_id: 'MTR-NEW-3', substation_id: 'SS-NOPE' }));
  assertError(res, 400, 40010);
  assert.deepEqual(itemCodes(res), [40026]);
});

test('missing and wrongly typed fields are reported together', async () => {
  const res = await create({ name: 5, meter_id: '   ', capacity_kw: '5' });
  assertError(res, 400, 40010);
  assert.deepEqual(itemCodes(res), [40023, 40024, 40025, 40027]);

  for (const capacity of [0, -1, 1000.5]) {
    // eslint-disable-next-line no-await-in-loop
    const out = await create(installationBody({ meter_id: 'MTR-NEW-4', capacity_kw: capacity }));
    assert.deepEqual(itemCodes(out), [40027]);
  }
  const top = await create(installationBody({ meter_id: 'MTR-NEW-4', capacity_kw: 1000 }));
  assert.equal(top.statusCode, 201, 'capacity_kw 1000 is the upper bound, inclusive');
  assert.equal((await remove(top.body.installation_id)).statusCode, 200);
});

test('reader token and device token: 403/40303 on POST, PUT and DELETE', async () => {
  for (const token of [nationalToken(), deviceToken(first)]) {
    const results = [
      // eslint-disable-next-line no-await-in-loop
      await create(installationBody({ meter_id: 'MTR-NEW-5' }), { token }),
      // eslint-disable-next-line no-await-in-loop
      await replace(first, installationBody(), { token }),
      // eslint-disable-next-line no-await-in-loop
      await remove(first, { token }),
    ];
    for (const res of results) {
      assertError(res, 403, 40303);
      assert.equal(res.headers['www-authenticate'], WRITE_CHALLENGE);
    }
  }
});

test('no token: 401 with WWW-Authenticate', async () => {
  const results = [
    await create(installationBody(), { token: null }),
    await replace(first, installationBody(), { token: null }),
    await remove(first, { token: null }),
  ];
  for (const res of results) {
    assertError(res, 401, 40101);
    assert.equal(res.headers['www-authenticate'], CHALLENGE);
  }
});

test('415 before 401 and 406 before 415 on the write routes', async () => {
  assertError(await create('name=x', { token: null, contentType: 'text/plain' }), 415, 41501);
  assertError(await replace(first, 'name=x', { token: null, contentType: 'text/plain' }), 415, 41501);
  const notAcceptable = await create('name=x', {
    token: null,
    contentType: 'text/plain',
    headers: { Accept: 'text/html' },
  });
  assertError(notAcceptable, 406, 40601);
});

test('a scoped admin gets 403/40301 outside the subtree, for the installation and the substation', async () => {
  const token = districtAdminToken('DT-T1');
  // first now sits under DT-T2.
  assertError(await replace(first, installationBody(), { token }), 403, 40301);
  assertError(await remove(first, { token }), 403, 40301);
  assertError(await replace('INS-0999', installationBody(), { token }), 403, 40301);
  assertError(await create(installationBody({ meter_id: 'MTR-NEW-6', substation_id: 'SS-T02' }), { token }), 403, 40301);
  // Inside the subtree it works.
  const ok = await replace(EXISTING, installationBody({ meter_id: 'MTR-EXISTING', name: 'Renamed' }), { token });
  assert.equal(ok.statusCode, 200);
});

// ---------------------------------------------------------------------------
// 405 with Allow, before 406 and 401 (no token is sent).
// ---------------------------------------------------------------------------
const READ_ONLY_URIS = [
  '/provinces',
  '/provinces/PV-T1',
  '/provinces/PV-T1/readings',
  '/districts',
  '/districts/DT-T1',
  '/districts/DT-T1/readings',
  '/districts/DT-T1/generation-summary',
  '/substations',
  '/substations/SS-T01',
  '/substations/SS-T01/readings',
  '/installations/INS-0005/last-reading',
];

const CASES = [
  ...READ_ONLY_URIS.flatMap((uri) => ['POST', 'PUT', 'PATCH', 'DELETE'].map((method) => [method, uri, 'GET'])),
  ['PUT', '/installations', 'GET, POST'],
  ['PATCH', '/installations', 'GET, POST'],
  ['DELETE', '/installations', 'GET, POST'],
  ['POST', '/installations/INS-0005', 'GET, PUT, DELETE'],
  ['PATCH', '/installations/INS-0005', 'GET, PUT, DELETE'],
  ['GET', '/login', 'POST'],
  ['PUT', '/login', 'POST'],
  ['DELETE', '/installations/INS-0005/readings', 'GET, POST'],
];

test('405/40501 with the right Allow on every URI that does not support the method, before 406 and 401', async () => {
  for (const [method, uri, allow] of CASES) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request({ method, path: `${API}${uri}`, headers: { Accept: 'text/html' } });
    assert.equal(res.statusCode, 405, `${method} ${uri}`);
    assert.equal(res.body.code, 40501, `${method} ${uri}`);
    assert.equal(res.headers.allow, allow, `${method} ${uri}`);
  }
});

test('HEAD still works where GET does (reaches authentication, not 405)', async () => {
  for (const uri of [...READ_ONLY_URIS, '/installations', '/installations/INS-0005']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request({ method: 'HEAD', path: `${API}${uri}` });
    assert.equal(res.statusCode, 401, `HEAD ${uri}`);
  }
});
