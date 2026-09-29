const crypto = require('node:crypto');
const repository = require('../repositories/installations');
const substationsRepository = require('../repositories/substations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const scope = require('./scope');
const { AppError, FIELD_ERROR } = require('../utils/errors');

const LIST_CONFIG = {
  idField: 'installation_id',
  sortFields: ['installation_id', 'name', 'capacity_kw'],
  filterFields: ['province_id', 'district_id', 'substation_id'],
};

async function list(query, user) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const scoped = scope.narrow(filter, user, 'installation');
  const { items, count } = await repository.findPage({ filter: scoped, sort, offset, limit });
  return { items, count, offset, limit };
}

// The installation in the caller's scope: 403 out of scope, 404 missing.
async function findOrThrow(id, user) {
  return scope.findInScope(repository, id, user, 'installation');
}

// Composite: the installation plus its newest reading (null if none). The
// history is never embedded; it is the readings sub-collection.
function composite(installation, lastReading) {
  return { ...installation.toJSON(), last_reading: lastReading ? lastReading.toJSON() : null };
}

async function get(id, user) {
  const installation = await findOrThrow(id, user);
  return composite(installation, await readings.newestReading(id));
}

async function getLastReading(id, user) {
  await findOrThrow(id, user);
  const reading = await readings.newestReading(id);
  if (!reading) {
    throw AppError.noReadingYet();
  }
  return reading;
}

// The installation must be in scope and exist before the query is read
// (403, then 404, before 400).
async function listReadings(id, query, user) {
  await findOrThrow(id, user);
  return readings.listForInstallations([id], readings.parseQuery(query));
}

async function getReading(id, readingId, user) {
  await findOrThrow(id, user);
  const reading = await readings.getOne(id, readingId);
  if (!reading) {
    throw AppError.resourceNotFound('reading');
  }
  return reading;
}

// Installation ids under a substation, district or province, for the
// jurisdiction readings collections.
async function idsUnder(field, value) {
  return repository.findIdsBy(field, value);
}

// ---------------------------------------------------------------------------
// Admin writes (scope installations:write). PUT is a whole replacement of the
// four client fields (WP section 7.2); the server names installations, so PUT
// never creates one.
// ---------------------------------------------------------------------------
const ID_PREFIX = 'INS-';
const MAX_ID_NUMBER = 9999;
const ID_ATTEMPTS = 3;
const MAX_CAPACITY_KW = 1000;
const TEXT_FIELDS = ['name', 'meter_id', 'substation_id'];

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

// Reads name, meter_id, substation_id and capacity_kw. Server-set fields
// (district_id, province_id, created_at, updated_at, last_reading, ...) and
// other unknown fields are ignored, so a GET body can be PUT back. On PUT an
// installation_id that differs from the path id is an error; on POST it is
// ignored. Returns the values and the problems found so far.
function parseInstallationBody(body, pathId) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = [];

  if (pathId !== undefined && source.installation_id !== undefined && source.installation_id !== pathId) {
    errors.push({
      code: FIELD_ERROR.installationIdMismatch,
      message: `installation_id in the body must match the path (${pathId}) or be left out`,
    });
  }
  for (const field of TEXT_FIELDS) {
    if (!isText(source[field])) {
      errors.push({ code: FIELD_ERROR[field], message: `${field} must be a non-empty string` });
    }
  }
  const capacityKw = source.capacity_kw;
  if (typeof capacityKw !== 'number' || !Number.isFinite(capacityKw) || capacityKw <= 0 || capacityKw > MAX_CAPACITY_KW) {
    errors.push({
      code: FIELD_ERROR.capacity_kw,
      message: `capacity_kw must be a number greater than 0 and at most ${MAX_CAPACITY_KW}`,
    });
  }

  const values = {};
  for (const field of TEXT_FIELDS) {
    if (isText(source[field])) values[field] = source[field].trim();
  }
  values.capacity_kw = capacityKw;
  return { values, errors };
}

// The validated body with district_id and province_id derived from the
// substation (never taken from the client). A substation outside a scoped
// admin's subtree gives 403 (the caller cannot tell whether it exists); for a
// national admin an unknown substation is a 400 field item.
async function readInstallationBody(body, user, pathId) {
  const { values, errors } = parseInstallationBody(body, pathId);
  if (values.substation_id !== undefined) {
    const substation = await substationsRepository.findById(
      values.substation_id,
      scope.scopeFilter(user, 'substation')
    );
    if (substation) {
      values.district_id = substation.district_id;
      values.province_id = substation.province_id;
    } else if (user.jurisdiction_level !== 'national') {
      throw AppError.outOfScope();
    } else {
      errors.push({ code: FIELD_ERROR.unknownSubstation, message: 'substation_id does not name an existing substation' });
    }
  }
  if (errors.length > 0) {
    throw AppError.invalidBody(errors);
  }
  return values;
}

function isDuplicateKey(err, field) {
  return err.code === 11000 && Boolean(err.keyPattern && err.keyPattern[field]);
}

// The next id after the highest one. Ids stop at INS-9999 (the device token
// also requires four digits).
function nextId(highestId) {
  const next = highestId ? Number(highestId.slice(ID_PREFIX.length)) + 1 : 1;
  if (next > MAX_ID_NUMBER) {
    throw AppError.installationIdUnavailable();
  }
  return `${ID_PREFIX}${String(next).padStart(4, '0')}`;
}

// A new device key: 32 random bytes as hex. Only its SHA-256 hex is stored;
// the plain key is returned once, to the caller of POST, and never logged.
function newDeviceKey() {
  const deviceKey = crypto.randomBytes(32).toString('hex');
  return { deviceKey, apiKeyHash: crypto.createHash('sha256').update(deviceKey).digest('hex') };
}

// Two admins creating at once can pick the same next id; the unique index
// rejects the second, which retries with a fresh id (at most 3 attempts).
// Returns the installation fields, the representation GET will return, and
// the plain device key.
async function create(body, user) {
  const values = await readInstallationBody(body, user);
  if (await repository.meterIdTaken(values.meter_id)) {
    throw AppError.duplicateMeterId();
  }
  const { deviceKey, apiKeyHash } = newDeviceKey();

  for (let attempt = 1; attempt <= ID_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const installationId = nextId(await repository.findHighestId());
    try {
      // eslint-disable-next-line no-await-in-loop
      const installation = await repository.insert({ installation_id: installationId, ...values, api_key_hash: apiKeyHash });
      return { installation: installation.toJSON(), representation: composite(installation, null), deviceKey };
    } catch (err) {
      if (isDuplicateKey(err, 'meter_id')) throw AppError.duplicateMeterId();
      if (!isDuplicateKey(err, 'installation_id')) throw err;
    }
  }
  throw AppError.installationIdUnavailable();
}

// expectedUpdatedAt is set when If-Match matched: if the installation changed
// after that check, nothing matches and the answer is 412.
async function replace(id, body, user, expectedUpdatedAt) {
  const values = await readInstallationBody(body, user, id);
  if (await repository.meterIdTaken(values.meter_id, id)) {
    throw AppError.duplicateMeterId();
  }
  let installation;
  try {
    installation = await repository.replace(id, values, expectedUpdatedAt);
  } catch (err) {
    if (isDuplicateKey(err, 'meter_id')) throw AppError.duplicateMeterId();
    throw err;
  }
  if (!installation) {
    throw expectedUpdatedAt ? AppError.preconditionFailed() : AppError.resourceNotFound('installation');
  }
  return composite(installation, await readings.newestReading(id));
}

// An installation with readings is never deleted (readings are append-only
// evidence). Known limit: the check and the delete are not atomic, so a
// reading that arrives in between is left without its installation.
async function remove(id, expectedUpdatedAt) {
  if (await readings.newestReading(id)) {
    throw AppError.installationHasReadings();
  }
  if (!(await repository.remove(id, expectedUpdatedAt))) {
    throw expectedUpdatedAt ? AppError.preconditionFailed() : AppError.resourceNotFound('installation');
  }
}

module.exports = { list, get, getLastReading, listReadings, getReading, idsUnder, create, replace, remove };
