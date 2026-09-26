const repository = require('../repositories/installations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const { AppError } = require('../utils/errors');

const LIST_CONFIG = {
  idField: 'installation_id',
  sortFields: ['installation_id', 'name', 'capacity_kw'],
  filterFields: ['province_id', 'district_id', 'substation_id'],
};

async function list(query) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const { items, count } = await repository.findPage({ filter, sort, offset, limit });
  return { items, count, offset, limit };
}

async function findOrThrow(id) {
  const item = await repository.findById(id);
  if (!item) {
    throw AppError.resourceNotFound('installation');
  }
  return item;
}

// Composite: the installation plus its newest reading (null if none). The
// history is never embedded; it is the readings sub-collection.
async function get(id) {
  const installation = await findOrThrow(id);
  const lastReading = await readings.newestReading(id);
  return { ...installation.toJSON(), last_reading: lastReading ? lastReading.toJSON() : null };
}

async function getLastReading(id) {
  await findOrThrow(id);
  const reading = await readings.newestReading(id);
  if (!reading) {
    throw AppError.noReadingYet();
  }
  return reading;
}

// The installation must exist before the query is read (404 before 400).
async function listReadings(id, query) {
  await findOrThrow(id);
  return readings.listForInstallations([id], readings.parseQuery(query));
}

async function getReading(id, readingId) {
  await findOrThrow(id);
  const reading = await readings.getOne(id, readingId);
  if (!reading) {
    throw AppError.resourceNotFound('reading');
  }
  return reading;
}

module.exports = { list, get, getLastReading, listReadings, getReading };
