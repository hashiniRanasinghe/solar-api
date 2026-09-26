const repository = require('../repositories/substations');
const installations = require('./installations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const { AppError } = require('../utils/errors');

const LIST_CONFIG = {
  idField: 'substation_id',
  sortFields: ['substation_id', 'name'],
  filterFields: ['district_id', 'province_id'],
};

async function list(query) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const { items, count } = await repository.findPage({ filter, sort, offset, limit });
  return { items, count, offset, limit };
}

async function get(id) {
  const item = await repository.findById(id);
  if (!item) {
    throw AppError.resourceNotFound('substation');
  }
  return item;
}

// Readings of every installation under this substation. The substation must exist
// before the query is read (404 before 400); one with no installations gives
// an empty collection.
async function listReadings(id, query) {
  await get(id);
  const parsed = readings.parseQuery(query);
  const ids = await installations.idsUnder('substation_id', id);
  return readings.listForInstallations(ids, parsed);
}

module.exports = { list, get, listReadings };
