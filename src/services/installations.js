const repository = require('../repositories/installations');
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

async function get(id) {
  const item = await repository.findById(id);
  if (!item) {
    throw AppError.resourceNotFound('installation');
  }
  return item;
}

module.exports = { list, get };
