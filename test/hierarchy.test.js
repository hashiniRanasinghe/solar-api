// Reads the seeded database (slsea_local). Read-only: no writes, no index builds.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { nationalToken } = require('./helpers/auth');
const { MONGODB_URI } = require('../src/config/env');

// Every request is made as a national reader.
const TOKEN = nationalToken();

let server;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the hierarchy tests');
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
      .get({ host: '127.0.0.1', port, path, headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
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

// Reads offset/limit (and any other param) from a relative link.
function linkParams(link) {
  return new URLSearchParams(link.split('?')[1]);
}

function assertErrorBody(body, status, code) {
  assert.equal(body.code, code);
  assert.equal(Math.floor(body.code / 100), status);
  assert.equal(typeof body.message, 'string');
  assert.equal(typeof body.description, 'string');
  assert.equal(body.moreInfo, '/docs');
  assert.ok(Array.isArray(body.error));
}

test('collection counts match the seed', async () => {
  const expected = { provinces: 9, districts: 25, substations: 40, installations: 240 };
  for (const [name, count] of Object.entries(expected)) {
    const res = await get(`/solar/v1.0/${name}`);
    assert.equal(res.statusCode, 200, name);
    assert.equal(res.body.count, count, name);
    assert.equal(res.body.data.length, Math.min(count, 20), name);
    assert.deepEqual(Object.keys(res.body), ['count', 'next', 'previous', 'data']);
  }
});

test('pagination links at start, middle and end', async () => {
  const start = await get('/solar/v1.0/districts?limit=10');
  assert.equal(start.body.data.length, 10);
  assert.equal(start.body.previous, null);
  assert.ok(start.body.next.startsWith('/solar/v1.0/districts?'));
  assert.equal(linkParams(start.body.next).get('offset'), '10');
  assert.equal(linkParams(start.body.next).get('limit'), '10');

  const middle = await get('/solar/v1.0/districts?limit=10&offset=10');
  assert.equal(middle.body.data.length, 10);
  assert.equal(linkParams(middle.body.previous).get('offset'), '0');
  assert.equal(linkParams(middle.body.next).get('offset'), '20');
  assert.notEqual(middle.body.data[0].district_id, start.body.data[0].district_id);

  const end = await get('/solar/v1.0/districts?limit=10&offset=20');
  assert.equal(end.body.data.length, 5);
  assert.equal(end.body.next, null);
  assert.equal(linkParams(end.body.previous).get('offset'), '10');

  const past = await get('/solar/v1.0/districts?offset=100');
  assert.equal(past.statusCode, 200);
  assert.equal(past.body.count, 25);
  assert.deepEqual(past.body.data, []);
  assert.equal(past.body.next, null);
});

test('next and previous keep the other query parameters', async () => {
  const res = await get('/solar/v1.0/installations?province_id=PV-01&sort=(name%20DESC)&limit=5');
  const next = linkParams(res.body.next);
  assert.equal(next.get('province_id'), 'PV-01');
  assert.equal(next.get('sort'), '(name DESC)');
  assert.equal(next.get('offset'), '5');

  const follow = await get(res.body.next);
  assert.equal(follow.statusCode, 200);
  assert.equal(follow.body.count, res.body.count);
  assert.equal(linkParams(follow.body.previous).get('province_id'), 'PV-01');
});

test('filters return only matching rows', async () => {
  const districts = await get('/solar/v1.0/districts?province_id=PV-01');
  assert.ok(districts.body.count > 0 && districts.body.count < 25);
  assert.ok(districts.body.data.every((d) => d.province_id === 'PV-01'));

  const installations = await get('/solar/v1.0/installations?substation_id=SS-001&limit=100');
  assert.ok(installations.body.count > 0);
  assert.equal(installations.body.data.length, installations.body.count);
  assert.ok(installations.body.data.every((i) => i.substation_id === 'SS-001'));

  const substations = await get('/solar/v1.0/substations?district_id=DT-01&province_id=PV-01');
  assert.ok(substations.body.data.every((s) => s.district_id === 'DT-01'));

  const unknown = await get('/solar/v1.0/districts?province_id=PV-99');
  assert.equal(unknown.statusCode, 200);
  assert.equal(unknown.body.count, 0);
  assert.deepEqual(unknown.body.data, []);
  assert.equal(unknown.body.next, null);
  assert.equal(unknown.body.previous, null);
});

test('sort ascending and descending', async () => {
  const asc = await get('/solar/v1.0/provinces?sort=(name%20ASC)');
  const desc = await get('/solar/v1.0/provinces?sort=(name%20DESC)');
  const ascNames = asc.body.data.map((p) => p.name);
  const descNames = desc.body.data.map((p) => p.name);
  assert.deepEqual(ascNames, [...ascNames].sort());
  assert.deepEqual(descNames, [...ascNames].reverse());

  const byId = await get('/solar/v1.0/provinces');
  const ids = byId.body.data.map((p) => p.province_id);
  assert.deepEqual(ids, [...ids].sort());

  const cap = await get('/solar/v1.0/installations?sort=(capacity_kw%20DESC)&limit=100');
  const rows = cap.body.data;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const curr = rows[i];
    assert.ok(prev.capacity_kw >= curr.capacity_kw);
    if (prev.capacity_kw === curr.capacity_kw) {
      assert.ok(prev.installation_id < curr.installation_id, 'tie-break by installation_id');
    }
  }
});

test('bad pagination and sort give 400 with per-field errors', async () => {
  const cases = [
    ['/solar/v1.0/installations?limit=101', 40004],
    ['/solar/v1.0/installations?limit=-1', 40004],
    ['/solar/v1.0/installations?limit=abc', 40004],
    ['/solar/v1.0/installations?limit=0', 40004],
    ['/solar/v1.0/installations?offset=-1', 40003],
    ['/solar/v1.0/installations?offset=1.5', 40003],
    ['/solar/v1.0/installations?sort=(foo%20ASC)', 40005],
    ['/solar/v1.0/installations?sort=name', 40005],
    ['/solar/v1.0/provinces?sort=(capacity_kw%20ASC)', 40005],
    ['/solar/v1.0/installations?province_id=PV-01&province_id=PV-02', 40006],
  ];
  for (const [path, fieldCode] of cases) {
    const res = await get(path);
    assert.equal(res.statusCode, 400, path);
    assertErrorBody(res.body, 400, 40002);
    assert.ok(res.body.error.some((e) => e.code === fieldCode), path);
  }

  const both = await get('/solar/v1.0/districts?limit=500&sort=(x%20ASC)');
  assert.deepEqual(both.body.error.map((e) => e.code).sort(), [40004, 40005]);
});

test('members are bare objects; unknown members give 404', async () => {
  const district = await get('/solar/v1.0/districts/DT-01');
  assert.equal(district.statusCode, 200);
  assert.equal(district.body.district_id, 'DT-01');
  assert.equal(district.body.data, undefined);

  for (const path of [
    '/solar/v1.0/provinces/PV-99',
    '/solar/v1.0/districts/DT-99',
    '/solar/v1.0/substations/SS-999',
    '/solar/v1.0/installations/INS-9999',
  ]) {
    const res = await get(path);
    assert.equal(res.statusCode, 404, path);
    assertErrorBody(res.body, 404, 40402);
  }
});

test('installation responses never show api_key_hash or _id', async () => {
  const page = await get('/solar/v1.0/installations?limit=100');
  const member = await get('/solar/v1.0/installations/INS-0001');
  assert.equal(member.statusCode, 200);
  assert.equal(member.body.installation_id, 'INS-0001');
  for (const raw of [page.raw, member.raw]) {
    assert.ok(!raw.includes('api_key_hash'));
    assert.ok(!raw.includes('"_id"'));
  }
});
