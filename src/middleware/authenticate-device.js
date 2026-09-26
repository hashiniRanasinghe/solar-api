const crypto = require('node:crypto');
const installationsRepository = require('../repositories/installations');
const { AppError } = require('../utils/errors');

// Device key in X-API-Key. Only its SHA-256 hash is stored, so the hash is
// looked up: no match -> 401; a match on another installation (or on a path
// id that does not exist) -> 403. Sets req.installation. The header, the key
// and its hash are never logged.
async function authenticateDevice(req, res, next) {
  const key = req.get('X-API-Key');
  if (typeof key !== 'string' || key.length === 0) {
    throw AppError.apiKeyRequired();
  }
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const installation = await installationsRepository.findByApiKeyHash(hash);
  if (!installation) {
    throw AppError.invalidApiKey();
  }
  if (installation.installation_id !== req.params.installationId) {
    throw AppError.notOwnInstallation();
  }
  req.installation = installation;
  next();
}

module.exports = authenticateDevice;
