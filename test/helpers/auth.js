// Tokens for the tests, signed with JWT_SECRET from the environment. No seeded
// password or device key is read.
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/env');

const SCOPES = { reader: 'solar:read', admin: 'solar:read solar:write' };

function mintToken(
  { sub = 'test.user', role = 'reader', jurisdiction_level = 'national', jurisdiction_id = null } = {},
  options = {}
) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to run the tests');
  }
  const claims = { role, jurisdiction_level, jurisdiction_id, scope: SCOPES[role] };
  return jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: 3600, subject: sub, ...options });
}

const nationalToken = () => mintToken();
const provinceToken = (id) => mintToken({ jurisdiction_level: 'province', jurisdiction_id: id });
const districtToken = (id) => mintToken({ jurisdiction_level: 'district', jurisdiction_id: id });

module.exports = { mintToken, nationalToken, provinceToken, districtToken };
