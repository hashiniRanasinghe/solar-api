// Jurisdiction scope on the GET routes. Reads the seeded database (slsea_local),
// read-only. Expected counts come from the database. Tokens are minted here.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { Installation, Substation, District, Province, GenerationReading } = require('../src/models');
const { nationalToken, provinceToken, districtToken } = require('./helpers/auth');

const API = '/solar/v1.0';

let server;
const TOKENS = {
  national: nationalToken(),
  pv01: provinceToken('PV-01'),
  dt01: districtToken('DT-01'),
};
// INS-0001 is in DT-01 (PV-01); INS-0013 is in DT-02 (PV-01).
let pv02Installation;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the scope tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  pv02Installation = (await Installation.findOne({ province_id: 'PV-02' }).sort({ installation_id: 1 }))
    .installation_id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

function get(path, who) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get(
        { host: '127.0.0.1', port, path: `${API}${path}`, headers: { Authorization: `Bearer ${TOKENS[who]}` } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, raw: data, body: JSON.parse(data) });
          });
        }
      )
      .on('error', reject);
  });
}

function assertErrorBody(body, status, code) {
  assert.equal(body.code, code);
  assert.equal(Math.floor(body.code / 100), status);
  assert.equal(typeof body.message, 'string');
  assert.equal(body.moreInfo, '/docs');
  assert.ok(Array.isArray(body.error));
}

async function expectStatus(who, paths, status, code) {
  for (const path of paths) {
    const res = await get(path, who);
    assert.equal(res.statusCode, status, `${who} ${path}`);
    if (code) assertErrorBody(res.body, status, code);
  }
}

async function newestReadingId(installationId) {
  return (await GenerationReading.findOne({ installation_id: installationId }).sort({ timestamp: -1 })).reading_id;
}

async function installationRoutes(id) {
  return [
    `/installations/${id}`,
    `/installations/${id}/last-reading`,
    `/installations/${id}/readings`,
    `/installations/${id}/readings/${await newestReadingId(id)}`,
  ];
}

test('national user sees every collection in full and gets 404 for unknown ids', async () => {
  const expected = { provinces: 9, districts: 25, substations: 40, installations: 240 };
  for (const [name, count] of Object.entries(expected)) {
    const res = await get(`/${name}`, 'national');
    assert.equal(res.statusCode, 200, name);
    assert.equal(res.body.count, count, name);
  }
  await expectStatus(
    'national',
    ['/provinces/PV-02', '/provinces/PV-02/readings', '/districts/DT-02', '/substations/SS-003/readings',
      ...(await installationRoutes('INS-0013'))],
    200
  );
  await expectStatus(
    'national',
    ['/provinces/PV-99', '/districts/DT-99/readings', '/substations/SS-999', '/installations/INS-9999/readings?from=bad'],
    404,
    40402
  );
});

test('DT-01 user reads DT-01, its substations and its installations with their readings', async () => {
  await expectStatus(
    'dt01',
    ['/districts/DT-01', '/districts/DT-01/readings', '/substations/SS-001', '/substations/SS-001/readings',
      ...(await installationRoutes('INS-0001'))],
    200
  );
});

test('DT-01 user gets 403/40301 on DT-02, on PV-01 and on installations in other districts', async () => {
  await expectStatus(
    'dt01',
    ['/districts/DT-02', '/districts/DT-02/readings', '/provinces/PV-01', '/provinces/PV-01/readings',
      '/substations/SS-003', '/substations/SS-003/readings',
      ...(await installationRoutes('INS-0013')),
      ...(await installationRoutes(pv02Installation))],
    403,
    40301
  );
});

test('DT-01 user collections are narrowed to DT-01', async () => {
  const cases = [
    ['/installations', await Installation.countDocuments({ district_id: 'DT-01' })],
    ['/substations', await Substation.countDocuments({ district_id: 'DT-01' })],
    ['/districts', 1],
    ['/provinces', 0],
  ];
  for (const [path, count] of cases) {
    const res = await get(path, 'dt01');
    assert.equal(res.statusCode, 200, path);
    assert.equal(res.body.count, count, path);
  }
  const res = await get('/installations?limit=100', 'dt01');
  assert.ok(res.body.data.every((i) => i.district_id === 'DT-01'));
  assert.equal(res.body.count, 12);
});

test('PV-01 user reads its subtree, gets 403 on PV-02 and its contents, collections narrowed', async () => {
  await expectStatus(
    'pv01',
    ['/provinces/PV-01', '/provinces/PV-01/readings', '/districts/DT-02', '/substations/SS-003/readings',
      ...(await installationRoutes('INS-0013'))],
    200
  );
  await expectStatus(
    'pv01',
    ['/provinces/PV-02', '/provinces/PV-02/readings', '/districts/DT-04', '/districts/DT-04/readings',
      ...(await installationRoutes(pv02Installation))],
    403,
    40301
  );

  const cases = [
    ['/provinces', 1],
    ['/districts', await District.countDocuments({ province_id: 'PV-01' })],
    ['/substations', await Substation.countDocuments({ province_id: 'PV-01' })],
    ['/installations', await Installation.countDocuments({ province_id: 'PV-01' })],
  ];
  for (const [path, count] of cases) {
    const res = await get(path, 'pv01');
    assert.equal(res.statusCode, 200, path);
    assert.equal(res.body.count, count, path);
  }
  assert.equal(await Province.countDocuments({ province_id: 'PV-01' }), 1);
});

test('a filter naming another jurisdiction only narrows: 200 with count 0', async () => {
  const cases = [
    ['dt01', '/installations?district_id=DT-02'],
    ['dt01', '/installations?province_id=PV-02'],
    ['dt01', '/substations?district_id=DT-02'],
    ['pv01', '/districts?province_id=PV-02'],
    ['pv01', '/installations?province_id=PV-02'],
  ];
  for (const [who, path] of cases) {
    const res = await get(path, who);
    assert.equal(res.statusCode, 200, `${who} ${path}`);
    assert.equal(res.body.count, 0, `${who} ${path}`);
    assert.deepEqual(res.body.data, []);
  }
  const inside = await get('/installations?substation_id=SS-001', 'dt01');
  assert.equal(inside.body.count, await Installation.countDocuments({ substation_id: 'SS-001' }));
});

test('scoped users get 403 for unknown ids, and 403 comes before a query 400', async () => {
  for (const who of ['pv01', 'dt01']) {
    await expectStatus(
      who,
      ['/provinces/PV-99', '/districts/DT-99', '/substations/SS-999/readings', '/installations/INS-9999',
        '/installations/INS-9999/readings?from=bad', `/installations/${pv02Installation}/readings?from=bad`],
      403,
      40301
    );
  }
  await expectStatus('dt01', ['/districts/DT-02/readings?from=bad'], 403, 40301);
  await expectStatus('dt01', ['/districts/DT-01/readings?from=bad'], 400, 40002);
});

test('no api_key_hash or _id for scoped users', async () => {
  for (const path of ['/installations?limit=100', '/installations/INS-0001']) {
    const res = await get(path, 'dt01');
    assert.equal(res.statusCode, 200);
    assert.ok(!res.raw.includes('api_key_hash'));
    assert.ok(!res.raw.includes('"_id"'));
  }
});
