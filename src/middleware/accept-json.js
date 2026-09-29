const { AppError } = require('../utils/errors');

// Every response is JSON, so an Accept header that does not allow
// application/json gets 406 (WP section 10.1). No Accept header or */* passes.
function acceptJson(req, res, next) {
  if (!req.accepts('application/json')) {
    throw AppError.notAcceptable();
  }
  next();
}

module.exports = acceptJson;
