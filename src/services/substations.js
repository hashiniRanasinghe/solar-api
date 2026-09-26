const repository = require('../repositories/substations');
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

module.exports = { list, get };
