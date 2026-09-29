const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usersRepository = require('../repositories/users');
const installationsRepository = require('../repositories/installations');
const { JWT_SECRET } = require('../config/env');
const { AppError, FIELD_ERROR } = require('../utils/errors');

const ALGORITHM = 'HS256';
const EXPIRES_IN = 3600;
const USER_ROLES = ['reader', 'admin'];
const LEVELS = ['national', 'province', 'district'];
const SCOPES = { reader: 'solar:read', admin: 'solar:read installations:write', device: 'readings:write' };
const INSTALLATION_ID = /^INS-\d{4}$/;
const USER_FIELDS = ['username', 'password'];
const DEVICE_FIELDS = ['installation_id', 'device_key'];

// Compared against when the username is unknown, so both failures take about
// the same time (same bcrypt cost as the seeded users).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
// Same idea for devices: an unknown installation (or one without a key) is
// compared against this, so the response does not reveal which ids exist.
const DUMMY_KEY_HASH = crypto.randomBytes(32);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

// Two credential forms: users {username, password}, devices
// {installation_id, device_key}. A form is chosen by which fields are sent;
// both forms, or neither, is a 400 with one 40022 item.
function readCredentials(body) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const sent = (fields) => fields.some((field) => source[field] !== undefined);
  const isUser = sent(USER_FIELDS);
  const isDevice = sent(DEVICE_FIELDS);
  if (isUser === isDevice) {
    throw AppError.invalidBody([
      {
        code: FIELD_ERROR.credentials,
        message: 'send either username and password, or installation_id and device_key',
      },
    ]);
  }

  const fields = isUser ? USER_FIELDS : DEVICE_FIELDS;
  const errors = [];
  for (const field of fields) {
    const value = source[field];
    if (typeof value !== 'string' || value.length === 0) {
      errors.push({ code: FIELD_ERROR[field], message: `${field} must be a non-empty string` });
    }
  }
  if (errors.length > 0) {
    throw AppError.invalidBody(errors);
  }
  return isUser
    ? { kind: 'user', username: source.username, password: source.password }
    : { kind: 'device', installationId: source.installation_id, deviceKey: source.device_key };
}

function issueToken(subject, claims) {
  const accessToken = jwt.sign(claims, JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
    subject,
  });
  return { access_token: accessToken, token_type: 'Bearer', expires_in: EXPIRES_IN };
}

// Unknown username and wrong password give the same 401.
async function loginUser({ username, password }) {
  const user = await usersRepository.findByUsername(username);
  const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !matches) {
    throw AppError.invalidCredentials();
  }
  return issueToken(user.username, {
    role: user.role,
    jurisdiction_level: user.jurisdiction_level,
    jurisdiction_id: user.jurisdiction_level === 'national' ? null : user.jurisdiction_id,
    scope: SCOPES[user.role],
  });
}

// Client-credentials style: the device key is exchanged for a short-lived
// token (WP section 12.1). Only the SHA-256 hash is stored; the compare is
// constant-time. Unknown installation and wrong key give the same 401. The
// key and its hash are never logged.
async function loginDevice({ installationId, deviceKey }) {
  const stored = await installationsRepository.findKeyHash(installationId);
  const expected = stored ? Buffer.from(stored, 'hex') : DUMMY_KEY_HASH;
  const presented = sha256(deviceKey);
  const matches = expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
  if (!stored || !matches) {
    throw AppError.invalidDeviceCredentials();
  }
  return issueToken(installationId, { role: 'device', scope: SCOPES.device });
}

async function login(body) {
  const credentials = readCredentials(body);
  return credentials.kind === 'user' ? loginUser(credentials) : loginDevice(credentials);
}

// A device token: sub is an installation id, scope exactly readings:write.
function readDeviceClaims({ sub, scope }) {
  if (typeof sub !== 'string' || !INSTALLATION_ID.test(sub) || scope !== SCOPES.device) {
    throw AppError.invalidToken();
  }
  return { role: 'device', installation_id: sub, scope: [scope] };
}

function readUserClaims(claims) {
  const { sub, role, jurisdiction_level: level, jurisdiction_id: jurisdictionId, scope } = claims;
  const valid =
    typeof sub === 'string' &&
    USER_ROLES.includes(role) &&
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

// Returns the caller or throws 401 invalid_token. A user is { username, role,
// jurisdiction_level, jurisdiction_id, scope }; a device is { role: 'device',
// installation_id, scope }.
function verifyToken(token) {
  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch {
    throw AppError.invalidToken();
  }
  // jwt.verify accepts a token without exp; every token issued here has one.
  if (typeof claims.exp !== 'number') {
    throw AppError.invalidToken();
  }
  return claims.role === 'device' ? readDeviceClaims(claims) : readUserClaims(claims);
}

module.exports = { login, verifyToken };
