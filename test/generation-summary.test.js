// District generation summary (A8). Reads the seeded database (slsea_local),
// read-only. Expected values are computed here from the database. HTTP tests
// run on the real clock; fixed-clock cases call the service with an injected
// now, so JWT expiry and driver timers are untouched.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI } = require('../src/config/env');
const { Installation, GenerationReading } = require('../src/models');
const districts = require('../src/services/districts');
const { nationalToken, districtToken } = require('./helpers/auth');

const API = '/solar/v1.0';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NATIONAL = { jurisdiction_level: 'national', jurisdiction_id: null };

let server;
let dt01Ids;
const TOKENS = {
  national: nationalToken(),
  dt01: districtToken('DT-01'),
  dt02: districtToken('DT-02'),
};

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the generation summary tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  dt01Ids = await Installation.distinct('installation_id', { district_id: 'DT-01' });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

function get(path, who) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const headers = who ? { Authorization: `Bearer ${TOKENS[who]}` } : {};
    http
      .get({ host: '127.0.0.1', port, path: `${API}${path}`, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, raw: data, body: JSON.parse(data) });
        });
      })
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

const round3 = (value) => Math.round(value * 1000) / 1000;

// The database and the test add the values in a different order, which can
// change the last rounded digit.
function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= 0.001, `${label}: ${actual} vs ${expected}`);
}

// Local 00:00 of the Colombo day containing ms, worked out independently of
// the code under test (Intl for the local date, the fixed +05:30 offset).
function colomboMidnight(ms) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(ms));
  return { date, start: Date.parse(`${date}T00:00:00+05:30`) };
}

async function newestAtOrBefore(id, now) {
  return GenerationReading.findOne({ installation_id: id, timestamp: { $lte: new Date(now) } }).sort({ timestamp: -1 });
}

async function expectedPower(now) {
  let total = 0;
  for (const id of dt01Ids) {
    const newest = await newestAtOrBefore(id, now);
    if (newest) total += newest.power_kw;
  }
  return round3(total);
}

async function expectedEnergy(start, now) {
  let total = 0;
  let reporting = 0;
  const window = { $gte: new Date(start), $lte: new Date(now) };
  for (const id of dt01Ids) {
    const first = await GenerationReading.findOne({ installation_id: id, timestamp: window }).sort({ timestamp: 1 });
    const last = await GenerationReading.findOne({ installation_id: id, timestamp: window }).sort({ timestamp: -1 });
    if (last) reporting += 1;
    if (first && last) total += last.energy_kwh - first.energy_kwh;
  }
  return { energy: round3(total), reporting };
}

test('national user gets a plain object with current_power_kw summed from each newest reading', async () => {
  const res = await get('/districts/DT-01/generation-summary?unknown=1', 'national');
  assert.equal(res.statusCode, 200);
  const { body } = res;
  const now = Date.parse(body.as_of);

  for (const key of ['count', 'next', 'previous', 'data']) {
    assert.equal(Object.hasOwn(body, key), false, `no ${key}`);
  }
  assert.equal(res.raw.includes('"_id"'), false);
  assert.equal(res.raw.includes('api_key_hash'), false);

  assert.equal(body.district_id, 'DT-01');
  assert.equal(body.timezone, 'Asia/Colombo');
  assert.equal(body.date, colomboMidnight(now).date);
  assert.equal(body.installations_total, dt01Ids.length);
  assertClose(body.current_power_kw, await expectedPower(now), 'current_power_kw');

  const newestTimes = [];
  for (const id of dt01Ids) {
    const newest = await newestAtOrBefore(id, now);
    if (newest) newestTimes.push(newest.timestamp.getTime());
  }
  assert.equal(body.newest_reading_at, new Date(Math.max(...newestTimes)).toISOString());
  assert.equal(body.oldest_latest_reading_at, new Date(Math.min(...newestTimes)).toISOString());
});

test('fixed now: today_energy_kwh is the per-installation last-minus-first sum for the Colombo day', async () => {
  const latest = await GenerationReading.findOne({ installation_id: { $in: dt01Ids } }).sort({ timestamp: -1 });
  const { date, start } = colomboMidnight(latest.timestamp.getTime() - 2 * DAY_MS);
  const now = start + 14 * HOUR_MS;

  const summary = await districts.generationSummary('DT-01', NATIONAL, now);
  const { energy, reporting } = await expectedEnergy(start, now);

  assert.equal(summary.date, date);
  assert.equal(summary.as_of, new Date(now).toISOString());
  assert.ok(reporting > 0, 'the chosen day has readings');
  assert.equal(summary.installations_reporting_today, reporting);
  assertClose(summary.today_energy_kwh, energy, 'today_energy_kwh');
  assert.ok(summary.today_energy_kwh > 0);
  assertClose(summary.current_power_kw, await expectedPower(now), 'current_power_kw');
});

test('fixed now on a day with no readings: today_energy_kwh is 0', async () => {
  const oldest = await GenerationReading.findOne().sort({ timestamp: 1 });
  const now = oldest.timestamp.getTime() - 10 * DAY_MS;

  const summary = await districts.generationSummary('DT-01', NATIONAL, now);

  assert.equal(summary.installations_total, dt01Ids.length);
  assert.equal(summary.installations_reporting_today, 0);
  assert.equal(summary.today_energy_kwh, 0);
  assert.equal(summary.current_power_kw, 0);
  assert.equal(summary.newest_reading_at, null);
  assert.equal(summary.oldest_latest_reading_at, null);
});

test('scope: DT-01 user 200, DT-02 user 403, unknown district 404 national and 403 scoped', async () => {
  assert.equal((await get('/districts/DT-01/generation-summary', 'dt01')).statusCode, 200);

  const other = await get('/districts/DT-01/generation-summary', 'dt02');
  assert.equal(other.statusCode, 403);
  assertErrorBody(other.body, 403, 40301);

  const missingNational = await get('/districts/DT-99/generation-summary', 'national');
  assert.equal(missingNational.statusCode, 404);
  assertErrorBody(missingNational.body, 404, 40402);

  const missingScoped = await get('/districts/DT-99/generation-summary', 'dt01');
  assert.equal(missingScoped.statusCode, 403);
  assertErrorBody(missingScoped.body, 403, 40301);
});

test('no token: 401 with WWW-Authenticate', async () => {
  const res = await get('/districts/DT-01/generation-summary');
  assert.equal(res.statusCode, 401);
  assertErrorBody(res.body, 401, 40101);
  assert.ok(res.headers['www-authenticate']);
});
