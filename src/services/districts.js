const repository = require('../repositories/districts');
const { parseListQuery } = require('./list-query');
const { AppError } = require('../utils/errors');

const LIST_CONFIG = {
  idField: 'district_id',
  sortFields: ['district_id', 'name'],
  filterFields: ['province_id'],
};

async function list(query) {
  const { filter, sort, offset, limit } = parseListQuery(query, LIST_CONFIG);
  const { items, count } = await repository.findPage({ filter, sort, offset, limit });
  return { items, count, offset, limit };
}

async function get(id) {
  const item = await repository.findById(id);
  if (!item) {
    throw AppError.resourceNotFound('district');
  }
  return item;
}

module.exports = { list, get };
