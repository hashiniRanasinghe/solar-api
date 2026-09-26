const readingsRepository = require('../repositories/readings');
const { parseListQuery } = require('./list-query');
const { AppError, FIELD_ERROR } = require('../utils/errors');
const { parseUtcTimestamp } = require('../utils/time-window');
const { readingId } = require('../utils/reading-id');

// Same query on every readings collection: from, to, sort, offset, limit.
// Default newest first; installation_id is always the final tie-break.
const LIST_CONFIG = {
  idField: 'installation_id',
  sortFields: ['timestamp'],
  defaultSort: { timestamp: -1 },
  timeWindow: true,
};

function parseQuery(query) {
  return parseListQuery(query, LIST_CONFIG);
}

// Readings history for a set of installations (one for an installation,
// several for a substation, district or province). The filter holds the
// time window from parseQuery.
async function listForInstallations(installationIds, { filter, sort, offset, limit }) {
  const scoped = { ...filter, installation_id: { $in: installationIds } };
  const { items, count } = await readingsRepository.findPage({ filter: scoped, sort, offset, limit });
  return { items, count, offset, limit };
}

// The one "newest reading" helper, shared by the installation composite and
// last-reading. Returns null when the installation has no reading yet.
async function newestReading(installationId) {
  return readingsRepository.findNewest(installationId);
}

async function getOne(installationId, readingId) {
  return readingsRepository.findOne(installationId, readingId);
}

// ---------------------------------------------------------------------------
// Ingest (device POST). Readings are append-only.
// ---------------------------------------------------------------------------
const SLOT_MS = 15 * 60 * 1000;
const MAX_VOLTAGE = 300;
const READ_ONLY_FIELDS = ['reading_id', 'installation_id', 'received_at'];

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Reads timestamp, power_kw, energy_kwh and voltage from the body. Server-set
// fields in the body and every invalid value are reported together in one
// 400; other unknown fields are ignored.
function parseReadingBody(body, capacityKw) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = [];

  for (const field of READ_ONLY_FIELDS) {
    if (Object.hasOwn(source, field)) {
      errors.push({ code: FIELD_ERROR.readOnly, message: `${field} is set by the server and must not be sent` });
    }
  }

  const timestamp = parseUtcTimestamp(source.timestamp);
  if (!timestamp) {
    errors.push({
      code: FIELD_ERROR.timestamp,
      message: 'timestamp must be an ISO 8601 UTC timestamp such as 2026-09-20T10:15:00Z',
    });
  } else if (timestamp.getTime() % SLOT_MS !== 0) {
    errors.push({
      code: FIELD_ERROR.timestampBoundary,
      message: 'timestamp must be on a 15-minute boundary (:00, :15, :30 or :45, zero seconds)',
    });
  }

  const { power_kw: powerKw, energy_kwh: energyKwh, voltage } = source;
  if (!isNumber(powerKw) || powerKw < 0 || powerKw > capacityKw) {
    errors.push({
      code: FIELD_ERROR.power_kw,
      message: `power_kw must be a number from 0 to the installation's capacity_kw (${capacityKw})`,
    });
  }
  if (!isNumber(energyKwh) || energyKwh < 0) {
    errors.push({ code: FIELD_ERROR.energy_kwh, message: 'energy_kwh must be a number of 0 or more' });
  }
  if (!isNumber(voltage) || voltage < 0 || voltage > MAX_VOLTAGE) {
    errors.push({ code: FIELD_ERROR.voltage, message: `voltage must be a number from 0 to ${MAX_VOLTAGE}` });
  }

  if (errors.length > 0) {
    throw AppError.invalidBody(errors);
  }
  return { timestamp, power_kw: powerKw, energy_kwh: energyKwh, voltage };
}

// Conflicts with what is stored (OQ-27): the same timestamp -> 40901; older
// than the newest reading -> 40903; energy_kwh lower than the newest -> 40902.
// The unique (installation_id, timestamp) index is the final guard, so two
// concurrent requests with the same timestamp cannot both succeed.
async function checkAgainstStored(installationId, values) {
  const newest = await readingsRepository.findNewest(installationId);
  if (!newest) return;

  const time = values.timestamp.getTime();
  const newestTime = newest.timestamp.getTime();
  if (time === newestTime) {
    throw AppError.duplicateReading();
  }
  if (time < newestTime) {
    const stored = await readingsRepository.existsAt(installationId, values.timestamp);
    throw stored ? AppError.duplicateReading() : AppError.olderThanLatest();
  }
  if (values.energy_kwh < newest.energy_kwh) {
    throw AppError.energyDecreased();
  }
}

// installation is the device's own installation (installation_id,
// capacity_kw), already authenticated against the path.
async function create(installation, body) {
  const { installation_id: installationId } = installation;
  const values = parseReadingBody(body, installation.capacity_kw);
  await checkAgainstStored(installationId, values);

  try {
    return await readingsRepository.insert({
      reading_id: readingId(installationId, values.timestamp.getTime()),
      installation_id: installationId,
      ...values,
      received_at: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      throw AppError.duplicateReading();
    }
    throw err;
  }
}

module.exports = { parseQuery, listForInstallations, newestReading, getOne, create };
