const { verifyToken } = require('../services/auth');
const { AppError } = require('../utils/errors');

// Bearer token on every route after /login. Sets req.user. The header and the
// token are never logged.
function authenticate(req, res, next) {
  const header = req.get('Authorization');
  const match = typeof header === 'string' ? /^Bearer (\S+)$/i.exec(header) : null;
  if (!match) {
    throw AppError.authenticationRequired();
  }
  req.user = verifyToken(match[1]);
  next();
}

module.exports = authenticate;
