const { AppError } = require('../utils/errors');

// 405 with an Allow header for any method the URI does not support. Allowed
// methods fall through to the routes that handle them. HEAD is served with
// GET, so it is allowed but not listed.
function allowMethods(allowed) {
  const allow = allowed.filter((method) => method !== 'HEAD').join(', ');
  return (req, res, next) => {
    if (!allowed.includes(req.method)) {
      throw AppError.methodNotAllowed(allow);
    }
    next();
  };
}

module.exports = allowMethods;
