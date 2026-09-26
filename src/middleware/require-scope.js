const { AppError } = require('../utils/errors');

// The token must carry this scope (WP section 12.2: a token that is not
// sufficient for the scope fails). Runs after authenticate. Reads need
// solar:read; POST readings needs readings:write, so a device token cannot
// read and a user token cannot post readings.
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.user.scope.includes(scope)) {
      throw AppError.insufficientScope(scope);
    }
    next();
  };
}

module.exports = requireScope;
