const { FIELD_ERROR } = require('./errors');

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const DIGITS = /^\d+$/;

// Reads offset and limit from the query. Bad values are pushed onto errors.
function parsePagination(query, errors) {
  let offset = DEFAULT_OFFSET;
  let limit = DEFAULT_LIMIT;

  if (query.offset !== undefined) {
    if (typeof query.offset === 'string' && DIGITS.test(query.offset)) {
      offset = Number(query.offset);
    } else {
      errors.push({ code: FIELD_ERROR.offset, message: 'offset must be a non-negative integer' });
    }
  }

  if (query.limit !== undefined) {
    const value = typeof query.limit === 'string' && DIGITS.test(query.limit)
      ? Number(query.limit)
      : NaN;
    if (value >= 1 && value <= MAX_LIMIT) {
      limit = value;
    } else {
      errors.push({
        code: FIELD_ERROR.limit,
        message: `limit must be an integer from 1 to ${MAX_LIMIT}`,
      });
    }
  }

  return { offset, limit };
}

module.exports = { parsePagination, DEFAULT_LIMIT, MAX_LIMIT };
