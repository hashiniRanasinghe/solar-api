// Reads the seeded database (slsea_local). Read-only: no writes, no index builds.
// The substation, district and province are INS-0001's parents, read from the
// database; expected counts and timestamps also come from the database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { GenerationReading, Installation } = require('../src/models');
const installationsRepository = require('../src/repositories/installations');

const API = '/solar/v1.0';

let server;
let parents;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the jurisdiction readings tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const installation = await Installation.findOne({ installation_id: 'INS-0001' });
  parents = [];
  for (const [collection, field] of [
    ['substations', 'substation_id'],
    ['districts', 'district_id'],
    ['provinces', 'province_id'],
  ]) {
    const id = installation[field];
    const ids = await Installation.distinct('installation_id', { [field]: id });
    parents.push({ collection, id, ids, base: `${API}/${collection}/${id}/readings` });
  }
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

// Rows are ordered by timestamp in the given direction, then installation_id ascending.
function assertOrdered(rows, direction) {
  for (let i = 1; i < rows.length; i += 1) {
    const a = rows[i - 1];
    const b = rows[i];
    if (a.timestamp === b.timestamp) {
      assert.ok(a.installation_id < b.installation_id, 'installation_id breaks ties');
    } else if (direction === 'DESC') {
      assert.ok(a.timestamp > b.timestamp, 'newest first');
    } else {
      assert.ok(a.timestamp < b.timestamp, 'oldest first');
    }
  }
}

test('count equals the database count and every row belongs to the parent, newest first', async () => {
  for (const { base, ids } of parents) {
    const expectedCount = await GenerationReading.countDocuments({ installation_id: { $in: ids } });
    const res = await get(`${base}?limit=100`);
    assert.equal(res.statusCode, 200, base);
    assert.deepEqual(Object.keys(res.body), ['count', 'next', 'previous', 'data']);
    assert.equal(res.body.count, expectedCount, base);
    assert.equal(res.body.data.length, 100);
    assert.equal(res.body.previous, null);
    assert.ok(res.body.data.every((r) => ids.includes(r.installation_id)), base);
    assertOrdered(res.body.data, 'DESC');

    const newest = await GenerationReading.findOne({ installation_id: { $in: ids } }).sort({ timestamp: -1 });
    assert.equal(res.body.data[0].timestamp, newest.timestamp.toISOString());
  }
});

test('sort=(timestamp ASC) gives oldest first', async () => {
  for (const { base, ids } of parents) {
    const res = await get(`${base}?sort=(timestamp%20ASC)&limit=100`);
    assert.equal(res.statusCode, 200, base);
    assertOrdered(res.body.data, 'ASC');
    const oldest = await GenerationReading.findOne({ installation_id: { $in: ids } }).sort({ timestamp: 1 });
    assert.equal(res.body.data[0].timestamp, oldest.timestamp.toISOString());
    assert.ok(res.body.data.every((r) => ids.includes(r.installation_id)), base);
  }
});

test('a from/to window bounds the results and its count matches the database', async () => {
  for (const { base, ids } of parents) {
    const times = await GenerationReading.distinct('timestamp', { installation_id: ids[0] });
    times.sort((a, b) => a - b);
    const fromDate = times[20];
    const toDate = times[27];
    const from = fromDate.toISOString();
    const to = toDate.toISOString();

    const expectedCount = await GenerationReading.countDocuments({
      installation_id: { $in: ids },
      timestamp: { $gte: fromDate, $lte: toDate },
    });
    const res = await get(`${base}?from=${from}&to=${to}&limit=100`);
    assert.equal(res.statusCode, 200, base);
    assert.equal(res.body.count, expectedCount, base);
    assert.ok(res.body.count > 0);
    assert.ok(res.body.data.every((r) => r.timestamp >= from && r.timestamp <= to), base);
    assert.ok(res.body.data.every((r) => ids.includes(r.installation_id)), base);
  }
});

test('the next link can be followed and keeps from, to and sort', async () => {
  for (const { base, ids } of parents) {
    const times = await GenerationReading.distinct('timestamp', { installation_id: ids[0] });
    times.sort((a, b) => a - b);
    const from = times[0].toISOString();
    const to = times[times.length - 1].toISOString();

    const first = await get(`${base}?from=${from}&to=${to}&sort=(timestamp%20ASC)&limit=10`);
    assert.equal(first.statusCode, 200, base);
    const next = new URL(first.body.next, 'http://x');
    assert.equal(next.pathname, base);
    assert.equal(next.searchParams.get('from'), from);
    assert.equal(next.searchParams.get('to'), to);
    assert.equal(next.searchParams.get('sort'), '(timestamp ASC)');
    assert.equal(next.searchParams.get('offset'), '10');

    const second = await get(first.body.next);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.count, first.body.count);
    assert.ok(second.body.previous.startsWith(`${base}?`));

    const both = [...first.body.data, ...second.body.data];
    assertOrdered(both, 'ASC');
    assert.equal(new Set(both.map((r) => r.reading_id)).size, 20, 'no overlap between pages');
  }
});

test('unknown parent gives 404/40402 on all three routes, before a bad-from 400', async () => {
  for (const path of [
    `${API}/substations/SS-999/readings`,
    `${API}/substations/SS-999/readings?from=bad`,
    `${API}/districts/DT-99/readings`,
    `${API}/districts/DT-99/readings?from=bad`,
    `${API}/provinces/PV-99/readings`,
    `${API}/provinces/PV-99/readings?from=bad`,
  ]) {
    const res = await get(path);
    assert.equal(res.statusCode, 404, path);
    assertErrorBody(res.body, 404, 40402);
  }
});

test('a bad from gives 400/40002 with a 40007 item', async () => {
  for (const { base } of parents) {
    const res = await get(`${base}?from=yesterday`);
    assert.equal(res.statusCode, 400, base);
    assertErrorBody(res.body, 400, 40002);
    assert.ok(res.body.error.some((e) => e.code === 40007), base);
  }
});

test('a parent with no installations gives 200 and an empty collection', async (t) => {
  // Every seeded substation has installations, so the id lookup is mocked here.
  const mock = t.mock.method(installationsRepository, 'findIdsBy', async () => []);
  try {
    const res = await get(parents[0].base);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.next, null);
    assert.equal(res.body.previous, null);
    assert.equal(mock.mock.callCount(), 1);
  } finally {
    mock.mock.restore();
  }
});

test('no api_key_hash or _id in any response', async () => {
  for (const { base } of parents) {
    const res = await get(`${base}?limit=100`);
    assert.equal(res.statusCode, 200);
    assert.ok(!res.raw.includes('api_key_hash'));
    assert.ok(!res.raw.includes('"_id"'));
  }
});
