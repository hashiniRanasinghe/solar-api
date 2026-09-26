'use strict';

const { GenerationReading } = require('../../src/models');

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32). Fixed seed so --reset always regenerates
// the same ids, names and district/substation/installation distributions.
// ---------------------------------------------------------------------------
const RNG_SEED = 1337;

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh mulberry32 keyed by integers (installation number, stream, day or
// slot index). A reading's values then depend only on (installation, time),
// not on when the script ran or how many readings came before it, so the
// seed and the top-up script produce the same value for the same slot.
function keyedRng(...parts) {
  let h = RNG_SEED >>> 0;
  parts.forEach((part) => {
    h = Math.imul(h ^ (part >>> 0), 0x9e3779b1);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
  });
  return mulberry32(h >>> 0);
}

function uniform(rng, min, max) {
  return min + rng() * (max - min);
}

// Stream ids, so each kind of value draws from its own keyed sequence.
const STREAM_WEATHER = 1;
const STREAM_SLOT = 2;
const STREAM_INSTALLATION = 3;

// ---------------------------------------------------------------------------
// Time. Everything is UTC epoch-millisecond arithmetic; no Date getters that
// depend on the server timezone. Asia/Colombo is a fixed UTC+05:30 (no
// daylight saving since 2006), so the offset is a constant.
// ---------------------------------------------------------------------------
const SLOT_MINUTES = 15;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBO_OFFSET_MS = 330 * 60 * 1000;

const SUNRISE_HOUR = 6;
const SUNSET_HOUR = 18;

function floorToSlot(ms) {
  return Math.floor(ms / SLOT_MS) * SLOT_MS;
}

function ceilToSlot(ms) {
  return Math.ceil(ms / SLOT_MS) * SLOT_MS;
}

function colomboLocal(ms) {
  const localMs = ms + COLOMBO_OFFSET_MS;
  const dayIndex = Math.floor(localMs / DAY_MS);
  const hourFraction = (localMs - dayIndex * DAY_MS) / (60 * 60 * 1000);
  return { dayIndex, hourFraction };
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Reading values (seed realism only; validation limits are still OPEN).
// ---------------------------------------------------------------------------
const WEATHER_MIN = 0.6;
const WEATHER_MAX = 1.0;
const POWER_NOISE_FRACTION = 0.03; // +/- 3% of capacity, daylight only
// Starting cumulative total = capacity x this many kWh per kW, i.e. roughly
// 4 months to 2 years of earlier generation, so totals differ per site.
const BASELINE_KWH_PER_KW_MIN = 500;
const BASELINE_KWH_PER_KW_MAX = 3000;
const NOMINAL_VOLTAGE = 230; // Sri Lankan single-phase supply
const VOLTAGE_SITE_SPREAD = 3;
const VOLTAGE_SLOT_SPREAD = 3;
const RECEIVED_DELAY_MIN_S = 2;
const RECEIVED_DELAY_MAX_S = 30;

function installationNumber(installationId) {
  return Number.parseInt(installationId.slice('INS-'.length), 10);
}

function readingId(installationId, ms) {
  const digits = new Date(ms).toISOString().replace(/\D/g, '').slice(0, 14);
  return `RD-${installationId.slice('INS-'.length)}-${digits}`;
}

function baselineEnergyKwh(installationId, capacityKw) {
  const rng = keyedRng(installationNumber(installationId), STREAM_INSTALLATION);
  return round(capacityKw * uniform(rng, BASELINE_KWH_PER_KW_MIN, BASELINE_KWH_PER_KW_MAX), 3);
}

function siteVoltageOffset(insNum) {
  const rng = keyedRng(insNum, STREAM_INSTALLATION);
  rng(); // first draw is the energy baseline
  return uniform(rng, -VOLTAGE_SITE_SPREAD, VOLTAGE_SITE_SPREAD);
}

function weatherFactor(insNum, localDayIndex) {
  return uniform(keyedRng(insNum, STREAM_WEATHER, localDayIndex), WEATHER_MIN, WEATHER_MAX);
}

// Builds one installation's readings for every 15-minute slot from startMs
// to endMs inclusive (both on slot boundaries), continuing a cumulative
// energy total from startEnergyKwh.
function buildReadings(installation, startMs, endMs, startEnergyKwh) {
  const { installation_id: installationId, capacity_kw: capacityKw } = installation;
  const insNum = installationNumber(installationId);
  const voltageOffset = siteVoltageOffset(insNum);
  const docs = [];
  let energyKwh = startEnergyKwh;

  for (let ms = startMs; ms <= endMs; ms += SLOT_MS) {
    const slotRng = keyedRng(insNum, STREAM_SLOT, ms / SLOT_MS);
    const powerNoise = uniform(slotRng, -POWER_NOISE_FRACTION, POWER_NOISE_FRACTION);
    const voltageNoise = uniform(slotRng, -VOLTAGE_SLOT_SPREAD, VOLTAGE_SLOT_SPREAD);
    const delaySeconds =
      RECEIVED_DELAY_MIN_S +
      Math.floor(slotRng() * (RECEIVED_DELAY_MAX_S - RECEIVED_DELAY_MIN_S + 1));

    const { dayIndex, hourFraction } = colomboLocal(ms);
    let powerKw = 0;
    if (hourFraction > SUNRISE_HOUR && hourFraction < SUNSET_HOUR) {
      const curve = Math.sin(
        (Math.PI * (hourFraction - SUNRISE_HOUR)) / (SUNSET_HOUR - SUNRISE_HOUR)
      );
      powerKw = capacityKw * weatherFactor(insNum, dayIndex) * curve + capacityKw * powerNoise;
      powerKw = round(Math.min(capacityKw, Math.max(0, powerKw)), 3);
    }

    energyKwh = round(energyKwh + powerKw * (SLOT_MINUTES / 60), 3);

    docs.push({
      reading_id: readingId(installationId, ms),
      installation_id: installationId,
      timestamp: new Date(ms),
      power_kw: powerKw,
      energy_kwh: energyKwh,
      voltage: round(NOMINAL_VOLTAGE + voltageOffset + voltageNoise, 1),
      received_at: new Date(ms + delaySeconds * 1000),
    });
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Database helpers.
// ---------------------------------------------------------------------------
const READINGS_BATCH_SIZE = 5000;

async function insertBatch(batch) {
  try {
    await GenerationReading.insertMany(batch, { ordered: false });
    return { inserted: batch.length, duplicates: 0 };
  } catch (err) {
    const writeErrors = [].concat(err.writeErrors || []);
    const allDuplicates =
      writeErrors.length > 0 && writeErrors.every((writeError) => writeError.code === 11000);
    if (!allDuplicates) throw err;
    return { inserted: batch.length - writeErrors.length, duplicates: writeErrors.length };
  }
}

// Inserts documents from an iterable of arrays (one array per installation)
// in fixed-size unordered batches, printing progress after each batch.
// Duplicate-key rows (already present) are counted, not treated as failure.
async function insertReadingsInBatches(docGroups) {
  let buffer = [];
  let batchNumber = 0;
  let inserted = 0;
  let duplicates = 0;

  async function flush() {
    batchNumber += 1;
    const result = await insertBatch(buffer);
    inserted += result.inserted;
    duplicates += result.duplicates;
    console.log(
      `  batch ${batchNumber}: inserted ${result.inserted}` +
        `${result.duplicates ? `, already present ${result.duplicates}` : ''} (total ${inserted})`
    );
    buffer = [];
  }

  for (const group of docGroups) {
    for (const doc of group) {
      buffer.push(doc);
      // eslint-disable-next-line no-await-in-loop
      if (buffer.length === READINGS_BATCH_SIZE) await flush();
    }
  }
  if (buffer.length > 0) await flush();

  return { inserted, duplicates };
}

// Counts readings whose energy_kwh is lower than the previous reading of the
// same installation (by timestamp). Runs entirely in the database. The
// leading $sort matches the (installation_id, timestamp) index, so no
// in-memory sort is needed (Atlas free tier does not allow disk use; a
// $project placed first would force a blocking sort over every reading).
async function countEnergyDecreases() {
  const result = await GenerationReading.aggregate([
    { $sort: { installation_id: 1, timestamp: 1 } },
    {
      $setWindowFields: {
        partitionBy: '$installation_id',
        sortBy: { timestamp: 1 },
        output: { previous_energy_kwh: { $shift: { output: '$energy_kwh', by: -1 } } },
      },
    },
    { $match: { $expr: { $lt: ['$energy_kwh', '$previous_energy_kwh'] } } },
    { $count: 'decreases' },
  ]);
  return result.length ? result[0].decreases : 0;
}

function getDbNameFromUri(uri) {
  try {
    return new URL(uri).pathname.replace(/^\//, '') || '(no database in URI path)';
  } catch (err) {
    return '(could not parse MONGODB_URI)';
  }
}

module.exports = {
  RNG_SEED,
  mulberry32,
  SLOT_MS,
  floorToSlot,
  ceilToSlot,
  baselineEnergyKwh,
  buildReadings,
  insertReadingsInBatches,
  countEnergyDecreases,
  getDbNameFromUri,
};
