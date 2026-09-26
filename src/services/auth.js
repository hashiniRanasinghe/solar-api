const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usersRepository = require('../repositories/users');
const { JWT_SECRET } = require('../config/env');
const { AppError, FIELD_ERROR } = require('../utils/errors');

const ALGORITHM = 'HS256';
const EXPIRES_IN = 3600;
const ROLES = ['reader', 'admin'];
const LEVELS = ['national', 'province', 'district'];
const SCOPES = { reader: 'solar:read', admin: 'solar:read solar:write' };

// Compared against when the username is unknown, so both failures take about
// the same time (same bcrypt cost as the seeded users).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

function readCredentials(body) {
  const source = body && typeof body === 'object' ? body : {};
  const errors = [];
  for (const field of ['username', 'password']) {
    const value = source[field];
    if (typeof value !== 'string' || value.length === 0) {
      errors.push({ code: FIELD_ERROR[field], message: `${field} must be a non-empty string` });
    }
  }
  if (errors.length > 0) {
    throw AppError.invalidBody(errors);
  }
  return { username: source.username, password: source.password };
}

// Unknown username and wrong password give the same 401.
async function login(body) {
  const { username, password } = readCredentials(body);
  const user = await usersRepository.findByUsername(username);
  const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !matches) {
    throw AppError.invalidCredentials();
  }

  const claims = {
    role: user.role,
    jurisdiction_level: user.jurisdiction_level,
    jurisdiction_id: user.jurisdiction_level === 'national' ? null : user.jurisdiction_id,
    scope: SCOPES[user.role],
  };
  const accessToken = jwt.sign(claims, JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
    subject: user.username,
  });
  return { access_token: accessToken, token_type: 'Bearer', expires_in: EXPIRES_IN };
}

// Returns the caller ({ username, role, jurisdiction_level, jurisdiction_id,
// scope }) or throws 401 invalid_token.
function verifyToken(token) {
  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch {
    throw AppError.invalidToken();
  }

  const { sub, role, jurisdiction_level: level, jurisdiction_id: jurisdictionId, scope } = claims;
  const valid =
    typeof sub === 'string' &&
    ROLES.includes(role) &&
    LEVELS.includes(level) &&
    typeof scope === 'string' &&
    (level === 'national' || (typeof jurisdictionId === 'string' && jurisdictionId.length > 0));
  if (!valid) {
    throw AppError.invalidToken();
  }
  return {
    username: sub,
    role,
    jurisdiction_level: level,
    jurisdiction_id: level === 'national' ? null : jurisdictionId,
    scope: scope.split(' '),
  };
}

module.exports = { login, verifyToken };
