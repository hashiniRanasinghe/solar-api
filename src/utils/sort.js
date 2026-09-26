const { FIELD_ERROR } = require('./errors');

// White paper syntax: sort=(field ASC) or sort=(a ASC, b DESC).
const WRAPPED = /^\((.+)\)$/;
const TERM = /^([a-z_]+)\s+(asc|desc)$/i;

// Returns a MongoDB sort object. The business id is always the final key so
// pages are stable. defaultSort applies when no sort is given. A bad value is
// pushed onto errors.
function parseSort(raw, allowedFields, idField, errors, defaultSort = {}) {
  const sort = {};

  if (raw === undefined) {
    Object.assign(sort, defaultSort);
  } else {
    const terms = typeof raw === 'string' ? parseTerms(raw, allowedFields) : null;
    if (!terms) {
      errors.push({
        code: FIELD_ERROR.sort,
        message: `sort must be (field ASC|DESC, ...) using: ${allowedFields.join(', ')}`,
      });
      return { [idField]: 1 };
    }
    for (const [field, direction] of terms) {
      sort[field] = direction;
    }
  }

  if (!(idField in sort)) {
    sort[idField] = 1;
  }
  return sort;
}

// Returns [[field, 1 | -1], ...] or null when the syntax or a field is not accepted.
function parseTerms(raw, allowedFields) {
  const wrapped = WRAPPED.exec(raw.trim());
  if (!wrapped) return null;

  const terms = [];
  const seen = new Set();
  for (const part of wrapped[1].split(',')) {
    const match = TERM.exec(part.trim());
    if (!match) return null;
    const field = match[1];
    if (!allowedFields.includes(field) || seen.has(field)) return null;
    seen.add(field);
    terms.push([field, match[2].toUpperCase() === 'ASC' ? 1 : -1]);
  }
  return terms;
}

module.exports = { parseSort };
