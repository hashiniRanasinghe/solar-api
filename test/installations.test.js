// Reads the seeded database (slsea_local). Read-only: no writes, no index builds.
// Expected values come from the database because the top-up script moves the
// newest reading.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { GenerationReading } = require('../src/models');
const readingsRepository = require('../src/repositories/readings');

const ID = 'INS-0001';
const OTHER_ID = 'INS-0002';
const BASE = `/solar/v1.0/installations/${ID}`;

let server;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the installation tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

function get(path) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, raw: data, body: JSON.parse(data) });
        });
      })
      .on('error', reject);
  });
}

function assertErrorBody(body, status, code) {
  assert.equal(body.code, code);
  assert.equal(Math.floor(body.code / 100), status);
  assert.equal(typeof body.message, 'string');
  assert.equal(typeof body.description, 'string');
  assert.equal(body.moreInfo, '/docs');
  assert.ok(Array.isArray(body.error));
}

// A reading as the API sends it (toJSON, then through JSON).
function asSent(doc) {
  return JSON.parse(JSON.stringify(doc));
}

async function newestFromDb(installationId) {
  return asSent(await GenerationReading.findOne({ installation_id: installationId }).sort({ timestamp: -1 }));
}

test('composite has the installation fields and last_reading equal to the newest reading', async () => {
  const res = await get(BASE);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.installation_id, ID);
  assert.equal(typeof res.body.substation_id, 'string');
  assert.equal(typeof res.body.capacity_kw, 'number');
  assert.deepEqual(res.body.last_reading, await newestFromDb(ID));
  assert.equal(res.body.readings, undefined, 'history is never embedded');
});

test('last-reading equals the newest reading and the composite last_reading', async () => {
  const [last, composite] = await Promise.all([get(`${BASE}/last-reading`), get(BASE)]);
  assert.equal(last.statusCode, 200);
  assert.deepEqual(last.body, await newestFromDb(ID));
  assert.deepEqual(last.body, composite.body.last_reading);
});

test('last-reading gives 404/40403 when the installation has no reading yet', async (t) => {
  // No seeded installation lacks readings, so the repository is mocked here.
  const mock = t.mock.method(readingsRepository, 'findNewest', async () => null);
  try {
    const res = await get(`${BASE}/last-reading`);
    assert.equal(res.statusCode, 404);
    assertErrorBody(res.body, 404, 40403);

    const composite = await get(BASE);
    assert.equal(composite.statusCode, 200);
    assert.equal(composite.body.last_reading, null);
    assert.ok(mock.mock.callCount() >= 2);
  } finally {
    mock.mock.restore();
  }
});

test('history returns only this installation, newest first by default, with the full count', async () => {
  const expectedCount = await GenerationReading.countDocuments({ installation_id: ID });
  const res = await get(`${BASE}/readings?limit=100`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body), ['count', 'next', 'previous', 'data']);
  assert.equal(res.body.count, expectedCount);
  assert.ok(res.body.count >= 672);
  assert.equal(res.body.data.length, 100);
  assert.equal(res.body.previous, null);
  assert.ok(res.body.next.startsWith(`${BASE}/readings?`));
  assert.ok(res.body.data.every((r) => r.installation_id === ID));

  const times = res.body.data.map((r) => r.timestamp);
  assert.deepEqual(times, [...times].sort().reverse());
  assert.deepEqual(res.body.data[0], await newestFromDb(ID));
});

test('sort ASC and DESC on timestamp', async () => {
  const asc = await get(`${BASE}/readings?sort=(timestamp%20ASC)&limit=50`);
  const desc = await get(`${BASE}/readings?sort=(timestamp%20DESC)&limit=50`);
  assert.equal(asc.statusCode, 200);
  assert.equal(desc.statusCode, 200);

  const ascTimes = asc.body.data.map((r) => r.timestamp);
  const descTimes = desc.body.data.map((r) => r.timestamp);
  assert.deepEqual(ascTimes, [...ascTimes].sort());
  assert.deepEqual(descTimes, [...descTimes].sort().reverse());

  const oldest = asSent(await GenerationReading.findOne({ installation_id: ID }).sort({ timestamp: 1 }));
  assert.deepEqual(asc.body.data[0], oldest);
  assert.deepEqual(desc.body.data[0], await newestFromDb(ID));
});

test('from and to bound the results (both inclusive)', async () => {
  const window = await GenerationReading.find({ installation_id: ID })
    .sort({ timestamp: 1 })
    .skip(10)
    .limit(11);
  const from = window[0].timestamp.toISOString();
  const to = window[window.length - 1].timestamp.toISOString();

  const res = await get(`${BASE}/readings?from=${from}&to=${to}&sort=(timestamp%20ASC)`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 11);
  assert.equal(res.body.data[0].timestamp, from);
  assert.equal(res.body.data[10].timestamp, to);
  assert.ok(res.body.data.every((r) => r.timestamp >= from && r.timestamp <= to));

  const fromOnly = await get(`${BASE}/readings?from=${to}`);
  const expectedFromOnly = await GenerationReading.countDocuments({
    installation_id: ID,
    timestamp: { $gte: window[window.length - 1].timestamp },
  });
  assert.equal(fromOnly.body.count, expectedFromOnly);

  const toOnly = await get(`${BASE}/readings?to=${from}`);
  assert.equal(toOnly.body.count, 11);
});

test('bad from/to and a bad sort give 400 with per-field errors', async () => {
  const cases = [
    ['from=yesterday', 40007],
    ['from=2026-09-20', 40007],
    ['from=2026-09-20T00:00:00%2B05:30', 40007],
    ['from=2026-02-30T00:00:00Z', 40007],
    ['to=2026-13-01T00:00Z', 40008],
    ['from=2026-09-21T00:00:00Z&to=2026-09-20T00:00:00Z', 40009],
    ['sort=(installation_id%20ASC)', 40005],
  ];
  for (const [query, fieldCode] of cases) {
    const res = await get(`${BASE}/readings?${query}`);
    assert.equal(res.statusCode, 400, query);
    assertErrorBody(res.body, 400, 40002);
    assert.ok(res.body.error.some((e) => e.code === fieldCode), query);
  }

  const both = await get(`${BASE}/readings?from=x&to=y`);
  assert.deepEqual(both.body.error.map((e) => e.code).sort(), [40007, 40008]);
});

test('reading by id: 200 under its installation, 404 under another', async () => {
  const reading = await newestFromDb(ID);
  const res = await get(`${BASE}/readings/${reading.reading_id}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, reading);

  const other = await get(`/solar/v1.0/installations/${OTHER_ID}/readings/${reading.reading_id}`);
  assert.equal(other.statusCode, 404);
  assertErrorBody(other.body, 404, 40402);

  const missing = await get(`${BASE}/readings/RD-0001-0`);
  assert.equal(missing.statusCode, 404);
  assertErrorBody(missing.body, 404, 40402);
});

test('unknown installation gives 404 on all four routes, before any query 400', async () => {
  const reading = await newestFromDb(ID);
  for (const path of [
    '/solar/v1.0/installations/INS-9999',
    '/solar/v1.0/installations/INS-9999/last-reading',
    '/solar/v1.0/installations/INS-9999/readings',
    '/solar/v1.0/installations/INS-9999/readings?from=bad',
    `/solar/v1.0/installations/INS-9999/readings/${reading.reading_id}`,
  ]) {
    const res = await get(path);
    assert.equal(res.statusCode, 404, path);
    assertErrorBody(res.body, 404, 40402);
  }
});

test('no api_key_hash or _id in any response', async () => {
  const reading = await newestFromDb(ID);
  const responses = await Promise.all([
    get(BASE),
    get(`${BASE}/last-reading`),
    get(`${BASE}/readings?limit=100`),
    get(`${BASE}/readings/${reading.reading_id}`),
  ]);
  for (const res of responses) {
    assert.equal(res.statusCode, 200);
    assert.ok(!res.raw.includes('api_key_hash'));
    assert.ok(!res.raw.includes('"_id"'));
  }
});
