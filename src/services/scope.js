const { AppError } = require('../utils/errors');

// The jurisdiction rules, in one place. A national user reads everything; a
// province or district user reads only their own subtree. Ancestors above the
// subtree are outside it (a district user cannot read its province).
const MATCH_NOTHING = { _id: { $in: [] } };

function scopeFilter(user, resource) {
  const { jurisdiction_level: level, jurisdiction_id: id } = user;
  if (level === 'national') {
    return {};
  }
  if (level === 'province') {
    return { province_id: id };
  }
  return resource === 'province' ? MATCH_NOTHING : { district_id: id };
}

// Collections: the caller's filter narrowed to the subtree. A filter naming
// another jurisdiction only narrows further (200, count 0); it never reveals.
function narrow(filter, user, resource) {
  const scope = scopeFilter(user, resource);
  return Object.keys(scope).length === 0 ? filter : { $and: [filter, scope] };
}

// Members and path parents. Out of scope gives 403 before 404, so a scoped
// user cannot tell whether an id exists; a national user gets 404.
async function findInScope(repository, id, user, resource) {
  const item = await repository.findById(id, scopeFilter(user, resource));
  if (item) {
    return item;
  }
  if (user.jurisdiction_level === 'national') {
    throw AppError.resourceNotFound(resource);
  }
  throw AppError.outOfScope();
}

module.exports = { scopeFilter, narrow, findInScope };
