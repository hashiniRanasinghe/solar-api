const repository = require('../repositories/installations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const scope = require('./scope');
const { AppError } = require('../utils/errors');

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
async function get(id, user) {
  const installation = await findOrThrow(id, user);
  const lastReading = await readings.newestReading(id);
  return { ...installation.toJSON(), last_reading: lastReading ? lastReading.toJSON() : null };
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

module.exports = { list, get, getLastReading, listReadings, getReading, idsUnder };
