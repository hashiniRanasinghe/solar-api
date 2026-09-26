// Device write path: POST /installations/{installation-id}/readings.
// Writes go ONLY to the database slsea_test (same MONGODB_URI, dbName
// overridden), never to slsea_local. The test builds the minimum hierarchy and
// two installations whose device keys are generated here; only their SHA-256
// hashes are stored. Devices log in with the key (POST /login) and post with
// the bearer token. The database is removed afterwards, with a guard that
// refuses to touch any other database. No seeded key is read.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { Province, District, Substation, Installation, GenerationReading } = require('../src/models');
const jwt = require('jsonwebtoken');
const { nationalToken, mintToken, deviceToken } = require('./helpers/auth');

const TEST_DB = 'slsea_test';
const API = '/solar/v1.0';
const OWN = 'INS-9001';
const OTHER = 'INS-9002';
const CAPACITY_KW = 5;
const CHALLENGE = 'Bearer realm="solar"';
const scopeChallenge = (scope) => `Bearer realm="solar", error="insufficient_scope", scope="${scope}"`;
const OWN_KEY = crypto.randomBytes(32).toString('hex');
const OTHER_KEY = crypto.randomBytes(32).toString('hex');

// Fixed slot-aligned times, 15 minutes apart.
const SLOT_MS = 15 * 60 * 1000;
const BASE_MS = Date.parse('2026-09-01T00:00:00Z');
const at = (slot) => new Date(BASE_MS + slot * SLOT_MS).toISOString();

let server;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Refuses to touch any database whose name is not exactly slsea_test.
function assertTestDatabase() {
  const name = mongoose.connection.db && mongoose.connection.db.databaseName;
  if (name !== TEST_DB) {
    throw new Error(`Refusing to write to or drop database "${name}"; only ${TEST_DB} is allowed`);
  }
}

// The database user may drop collections but not databases
// (readWriteAnyDatabase), so every collection is dropped; MongoDB removes a
// database once it has no collections left.
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
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the device write tests');
  await mongoose.connect(MONGODB_URI, {
    dbName: TEST_DB,
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });
  await dropTestDatabase();
  await Installation.createIndexes();
  await GenerationReading.createIndexes();

  await Province.create({ province_id: 'PV-T1', name: 'Test Province' });
  await District.create({ district_id: 'DT-T1', name: 'Test District', province_id: 'PV-T1' });
  await Substation.create({
    substation_id: 'SS-T01',
    name: 'Test Substation',
    district_id: 'DT-T1',
    province_id: 'PV-T1',
  });
  const hierarchy = { substation_id: 'SS-T01', district_id: 'DT-T1', province_id: 'PV-T1' };
  await Installation.create([
    {
      installation_id: OWN,
      meter_id: 'MTR-T9001',
      name: 'Test Installation 1',
      capacity_kw: CAPACITY_KW,
      api_key_hash: sha256(OWN_KEY),
      ...hierarchy,
    },
    {
      installation_id: OTHER,
      meter_id: 'MTR-T9002',
      name: 'Test Installation 2',
      capacity_kw: CAPACITY_KW,
      api_key_hash: sha256(OTHER_KEY),
      ...hierarchy,
    },
  ]);

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

// POST a reading. token / contentType: the header value, or null to omit it.
function post({ id = OWN, token = deviceToken(OWN), body, contentType = 'application/json', headers = {} }) {
  const all = { ...headers };
  if (contentType !== null) all['Content-Type'] = contentType;
  if (token !== null) all.Authorization = `Bearer ${token}`;
  return request({
    method: 'POST',
    path: `${API}/installations/${id}/readings`,
    headers: all,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function login(credentials) {
  return request({
    method: 'POST',
    path: `${API}/login`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

function reading(slot, overrides = {}) {
  return { timestamp: at(slot), power_kw: 2.5, energy_kwh: 1000 + slot, voltage: 230, ...overrides };
}

function assertError(res, status, code) {
  assert.equal(res.statusCode, status);
  assert.equal(res.body.code, code);
  assert.equal(typeof res.body.message, 'string');
  assert.equal(typeof res.body.description, 'string');
  assert.equal(res.body.moreInfo, '/docs');
  assert.ok(Array.isArray(res.body.error));
}

function itemCodes(res) {
  return res.body.error.map((item) => item.code).sort();
}

test('refuses any database other than slsea_test', () => {
  assert.equal(mongoose.connection.db.databaseName, TEST_DB);
});

test('201 with Location, Content-Location, ETag, Last-Modified and the reading; GET on Location returns it', async () => {
  const res = await post({ body: reading(10) });
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'], /^application\/json/);

  const { body } = res;
  assert.deepEqual(Object.keys(body).sort(), [
    'energy_kwh',
    'installation_id',
    'power_kw',
    'reading_id',
    'received_at',
    'timestamp',
    'voltage',
  ]);
  assert.equal(body.installation_id, OWN);
  assert.equal(body.reading_id, 'RD-9001-20260901023000');
  assert.equal(body.timestamp, '2026-09-01T02:30:00.000Z');
  assert.equal(body.power_kw, 2.5);
  assert.equal(body.energy_kwh, 1010);
  assert.equal(body.voltage, 230);
  assert.ok(Math.abs(Date.parse(body.received_at) - Date.now()) < 60 * 1000);

  const location = `${API}/installations/${OWN}/readings/${body.reading_id}`;
  assert.equal(res.headers.location, location);
  assert.equal(res.headers['content-location'], location);
  assert.match(res.headers.etag, /^"[^"]+"$/);
  assert.ok(!res.headers.etag.startsWith('W/'));
  assert.equal(res.headers['last-modified'], new Date(body.received_at).toUTCString());
  assert.ok(!res.raw.includes('api_key_hash'));
  assert.ok(!res.raw.includes('"_id"'));

  const got = await request({ path: location, headers: { Authorization: `Bearer ${nationalToken()}` } });
  assert.equal(got.statusCode, 200);
  assert.deepEqual(got.body, body);
});

test('device login returns a readings:write token for the installation, and it posts a 201', async () => {
  const res = await login({ installation_id: OWN, device_key: OWN_KEY });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['access_token', 'expires_in', 'token_type']);
  assert.equal(res.body.token_type, 'Bearer');
  assert.equal(res.body.expires_in, 3600);
  assert.ok(!res.raw.includes(OWN_KEY));
  assert.ok(!res.raw.includes(sha256(OWN_KEY)));

  const claims = jwt.decode(res.body.access_token, { complete: true });
  assert.equal(claims.header.alg, 'HS256');
  assert.deepEqual(Object.keys(claims.payload).sort(), ['exp', 'iat', 'role', 'scope', 'sub']);
  assert.equal(claims.payload.sub, OWN);
  assert.equal(claims.payload.role, 'device');
  assert.equal(claims.payload.scope, 'readings:write');
  assert.equal(claims.payload.exp - claims.payload.iat, 3600);

  const created = await post({ token: res.body.access_token, body: reading(11) });
  assert.equal(created.statusCode, 201);
});

test('wrong key and unknown installation give the same 401/40106 body', async () => {
  const wrongKey = await login({ installation_id: OWN, device_key: OTHER_KEY });
  const unknown = await login({ installation_id: 'INS-9999', device_key: OWN_KEY });
  for (const res of [wrongKey, unknown]) {
    assertError(res, 401, 40106);
    assert.equal(res.headers['www-authenticate'], CHALLENGE);
  }
  assert.equal(wrongKey.raw, unknown.raw);
});

test('no token, or X-API-Key alone, gives 401/40101 with WWW-Authenticate', async () => {
  const none = await post({ token: null, body: reading(20) });
  assertError(none, 401, 40101);
  assert.equal(none.headers['www-authenticate'], CHALLENGE);
  const keyOnly = await post({ token: null, headers: { 'X-API-Key': OWN_KEY }, body: reading(20) });
  assertError(keyOnly, 401, 40101);
  assert.equal(keyOnly.headers['www-authenticate'], CHALLENGE);
});

test('an expired device token gives 401/40102', async () => {
  const res = await post({ token: deviceToken(OWN, { expiresIn: -60 }), body: reading(20) });
  assertError(res, 401, 40102);
  assert.equal(res.headers['www-authenticate'], `${CHALLENGE}, error="invalid_token"`);
});

test('reader and admin tokens on POST readings give 403/40303 insufficient_scope', async () => {
  for (const token of [nationalToken(), mintToken({ role: 'admin' })]) {
    const res = await post({ token, body: reading(20) });
    assertError(res, 403, 40303);
    assert.equal(res.headers['www-authenticate'], scopeChallenge('readings:write'));
  }
  assert.equal(await GenerationReading.countDocuments({ installation_id: OWN, timestamp: at(20) }), 0);
});

test('a device token on a GET gives 403/40303 insufficient_scope', async () => {
  for (const path of [`/installations/${OWN}/readings`, `/installations/${OWN}`, '/provinces']) {
    const res = await request({ path: `${API}${path}`, headers: { Authorization: `Bearer ${deviceToken(OWN)}` } });
    assertError(res, 403, 40303);
    assert.equal(res.headers['www-authenticate'], scopeChallenge('solar:read'), path);
  }
});

test("another installation's token gives 403/40302 without WWW-Authenticate", async () => {
  const res = await post({ token: deviceToken(OTHER), body: reading(20) });
  assertError(res, 403, 40302);
  assert.equal(res.headers['www-authenticate'], undefined);
});

test('an unknown installation gives 403, not 404, even for its own token', async () => {
  const other = await post({ id: 'INS-9999', body: reading(20) });
  assertError(other, 403, 40302);
  const own = await post({ id: 'INS-9999', token: deviceToken('INS-9999'), body: reading(20) });
  assertError(own, 403, 40302);
});

test('Content-Type other than application/json gives 415, before the token check', async () => {
  const text = await post({ contentType: 'text/plain', body: JSON.stringify(reading(20)) });
  assertError(text, 415, 41501);
  const none = await post({ contentType: null, token: null, body: JSON.stringify(reading(20)) });
  assertError(none, 415, 41501);
  const charset = await post({ contentType: 'application/json; charset=utf-8', body: reading(21) });
  assert.equal(charset.statusCode, 201);
});

test('Accept that does not allow application/json gives 406, before 415 and the token check', async () => {
  const res = await post({ contentType: 'text/plain', token: null, body: 'x', headers: { Accept: 'text/html' } });
  assertError(res, 406, 40601);
  assert.equal(await GenerationReading.countDocuments({ installation_id: OWN, timestamp: at(22) }), 0);
  const any = await post({ body: reading(22), headers: { Accept: '*/*' } });
  assert.equal(any.statusCode, 201);
});

test('405 comes before 406', async () => {
  const res = await request({ method: 'PUT', path: `${API}/installations/${OWN}/readings`, headers: { Accept: 'text/html' } });
  assertError(res, 405, 40501);
});

test('403 comes before 400: invalid body with another installation token or the wrong scope', async () => {
  const other = await post({ token: deviceToken(OTHER), body: { timestamp: 'bad' } });
  assertError(other, 403, 40302);
  const reader = await post({ token: nationalToken(), body: { timestamp: 'bad' } });
  assertError(reader, 403, 40303);
});

test('timestamp not ISO 8601 UTC gives 400 with a 40013 item', async () => {
  for (const timestamp of [undefined, 'yesterday', '2026-09-01T03:00:00+05:30', '2026-09-01', 1767225600000]) {
    const res = await post({ body: reading(30, { timestamp }) });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40013], String(timestamp));
  }
});

test('timestamp off a 15-minute boundary gives 400 with a 40014 item', async () => {
  for (const timestamp of ['2026-09-01T03:10:00Z', '2026-09-01T03:15:30Z', '2026-09-01T03:15:00.500Z']) {
    const res = await post({ body: reading(30, { timestamp }) });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40014], timestamp);
  }
});

test('power_kw outside 0..capacity_kw or not a number gives a 40016 item', async () => {
  for (const power_kw of [undefined, -0.1, CAPACITY_KW + 0.1, '2.5', null]) {
    const res = await post({ body: reading(30, { power_kw }) });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40016], String(power_kw));
  }
});

test('energy_kwh below 0 or not a number gives a 40017 item', async () => {
  for (const energy_kwh of [undefined, -1, '10', true]) {
    const res = await post({ body: reading(30, { energy_kwh }) });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40017], String(energy_kwh));
  }
});

test('voltage outside 0..300 or not a number gives a 40018 item', async () => {
  for (const voltage of [undefined, -1, 300.1, '230']) {
    const res = await post({ body: reading(30, { voltage }) });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40018], String(voltage));
  }
});

test('boundary values 0 and the maximum are accepted', async () => {
  const res = await post({ body: reading(40, { power_kw: CAPACITY_KW, voltage: 300 }) });
  assert.equal(res.statusCode, 201);
  const zero = await post({ body: reading(41, { power_kw: 0, voltage: 0 }) });
  assert.equal(zero.statusCode, 201);
});

test('several problems are reported together', async () => {
  const res = await post({ body: { timestamp: '2026-09-01T03:07:00Z', power_kw: 99, energy_kwh: -5, voltage: 'x' } });
  assertError(res, 400, 40010);
  assert.deepEqual(itemCodes(res), [40014, 40016, 40017, 40018]);
});

test('an empty body or an array reports every field missing', async () => {
  for (const body of ['{}', '[]']) {
    const res = await post({ body });
    assertError(res, 400, 40010);
    assert.deepEqual(itemCodes(res), [40013, 40016, 40017, 40018]);
  }
});

test('read-only fields in the body give 400 with one 40019 item each', async () => {
  const res = await post({
    body: reading(50, { reading_id: 'RD-X', installation_id: OTHER, received_at: at(50) }),
  });
  assertError(res, 400, 40010);
  assert.deepEqual(itemCodes(res), [40019, 40019, 40019]);
  for (const field of ['reading_id', 'installation_id', 'received_at']) {
    assert.ok(res.body.error.some((item) => item.message.startsWith(field)), field);
  }
});

test('unknown extra fields are ignored', async () => {
  const res = await post({ body: reading(60, { firmware: '1.2', note: 'x' }) });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.firmware, undefined);
  assert.equal(res.body.note, undefined);
});

test('the same timestamp again gives 409 40901', async () => {
  const first = await post({ body: reading(70) });
  assert.equal(first.statusCode, 201);
  const again = await post({ body: reading(70) });
  assertError(again, 409, 40901);
  // An older timestamp that is already stored is also a duplicate.
  const olderStored = await post({ body: reading(10) });
  assertError(olderStored, 409, 40901);
});

test('a timestamp older than the latest reading gives 409 40903', async () => {
  const res = await post({ body: reading(69) });
  assertError(res, 409, 40903);
});

test('energy_kwh lower than the latest reading gives 409 40902; equal is accepted', async () => {
  const latest = await post({ body: reading(80, { energy_kwh: 5000 }) });
  assert.equal(latest.statusCode, 201);
  const lower = await post({ body: reading(81, { energy_kwh: 4999.999 }) });
  assertError(lower, 409, 40902);
  const equal = await post({ body: reading(81, { energy_kwh: 5000, power_kw: 0 }) });
  assert.equal(equal.statusCode, 201);
});

test('400 comes before 409', async () => {
  const res = await post({ body: reading(70, { voltage: 999 }) });
  assertError(res, 400, 40010);
});

test('two concurrent requests with the same timestamp: one 201, one 409 40901', async () => {
  const body = reading(90, { energy_kwh: 6000 });
  const results = await Promise.all([post({ body }), post({ body })]);
  const statuses = results.map((res) => res.statusCode).sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(results.find((res) => res.statusCode === 409).body.code, 40901);
  assert.equal(await GenerationReading.countDocuments({ installation_id: OWN, timestamp: new Date(at(90)) }), 1);
});

test('readings are append-only: PUT, PATCH, DELETE give 405 with Allow', async () => {
  const collection = `${API}/installations/${OWN}/readings`;
  const member = `${collection}/RD-9001-20260901023000`;
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const onCollection = await request({ method, path: collection });
    assertError(onCollection, 405, 40501);
    assert.equal(onCollection.headers.allow, 'GET, POST');

    const onMember = await request({ method, path: member, headers: { Authorization: `Bearer ${deviceToken(OWN)}` } });
    assertError(onMember, 405, 40501);
    assert.equal(onMember.headers.allow, 'GET');
  }
  const postOnMember = await request({ method: 'POST', path: member });
  assertError(postOnMember, 405, 40501);
  assert.equal(await GenerationReading.countDocuments({ reading_id: 'RD-9001-20260901023000' }), 1);
});

test('GET on the readings collection needs a solar:read bearer token', async () => {
  const path = `${API}/installations/${OWN}/readings`;
  const withKey = await request({ path, headers: { 'X-API-Key': OWN_KEY } });
  assertError(withKey, 401, 40101);
  const withToken = await request({ path, headers: { Authorization: `Bearer ${nationalToken()}` } });
  assert.equal(withToken.statusCode, 200);
  assert.ok(withToken.body.count >= 1);
  assert.ok(!withToken.raw.includes('api_key_hash'));
  assert.ok(!withToken.raw.includes('"_id"'));
});

test('no api_key_hash or _id in any write response', async () => {
  const res = await post({ body: reading(100, { energy_kwh: 7000 }) });
  assert.equal(res.statusCode, 201);
  assert.ok(!res.raw.includes('api_key_hash'));
  assert.ok(!res.raw.includes('"_id"'));
  assert.ok(!res.raw.includes(sha256(OWN_KEY)));
});
