const repository = require('../repositories/provinces');
const installations = require('./installations');
const readings = require('./readings');
const { parseListQuery } = require('./list-query');
const scope = require('./scope');

const LIST_CONFIG = {
  idField: 'province_id',
  sortFields: ['province_id', 'name'],
  filterFields: [],
};

async function list(query, user) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const scoped = scope.narrow(filter, user, 'province');
  const { items, count } = await repository.findPage({ filter: scoped, sort, offset, limit });
  return { items, count, offset, limit };
}

async function get(id, user) {
  return scope.findInScope(repository, id, user, 'province');
}

// Readings of every installation under this province. The province must be in
// the caller's scope (403) and exist (404) before the query is read (400); one
// with no installations gives an empty collection.
async function listReadings(id, query, user) {
  await get(id, user);
  const parsed = readings.parseQuery(query);
  const ids = await installations.idsUnder('province_id', id);
  return readings.listForInstallations(ids, parsed);
}

module.exports = { list, get, listReadings };
