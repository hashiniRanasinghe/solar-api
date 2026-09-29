const repository = require('../repositories/districts');
const installations = require('./installations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const scope = require('./scope');

const LIST_CONFIG = {
  idField: 'district_id',
  sortFields: ['district_id', 'name'],
  filterFields: ['province_id'],
};

async function list(query, user) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const scoped = scope.narrow(filter, user, 'district');
  const { items, count } = await repository.findPage({ filter: scoped, sort, offset, limit });
  return { items, count, offset, limit };
}

async function get(id, user) {
  return scope.findInScope(repository, id, user, 'district');
}

// Readings of every installation under this district. The district must be in
// the caller's scope (403) and exist (404) before the query is read (400); one
// with no installations gives an empty collection.
async function listReadings(id, query, user) {
  await get(id, user);
  const parsed = readings.parseQuery(query);
  const ids = await installations.idsUnder('district_id', id);
  return readings.listForInstallations(ids, parsed);
}

// The district must be in scope (403) and exist (404). now is injectable so
// tests can fix the clock; the route always uses the current time.
async function generationSummary(id, user, now = Date.now()) {
  await get(id, user);
  return readings.districtSummary(id, now);
}

module.exports = { list, get, listReadings, generationSummary };
