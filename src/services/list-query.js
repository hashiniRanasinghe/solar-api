const { AppError, FIELD_ERROR } = require('../utils/errors');
const { parsePagination } = require('../utils/pagination');
const { parseSort } = require('../utils/sort');

// Turns a collection query string into { filter, sort, offset, limit }.
// config: { idField, sortFields, filterFields }. Every bad parameter is
// reported together in one 400. Callers may add keys to filter (for example
// a jurisdiction scope) before passing it to the repository.
function parseListQuery(query, { idField, sortFields, filterFields = [] }) {
  const errors = [];
  const filter = {};

  for (const field of filterFields) {
    const value = query[field];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      filter[field] = value;
    } else {
      errors.push({ code: FIELD_ERROR.filter, message: `${field} must be given at most once` });
    }
  }

  const { offset, limit } = parsePagination(query, errors);
  const sort = parseSort(query.sort, sortFields, idField, errors);

  if (errors.length > 0) {
    throw AppError.invalidQuery(errors);
  }
  return { filter, sort, offset, limit };
}

module.exports = { parseListQuery };
