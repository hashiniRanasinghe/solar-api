const installationsRepository = require('../repositories/installations');
const { AppError } = require('../utils/errors');

// A device token writes only for its own installation (sub = installation
// id). Another installation, or a path id that does not exist, gives 403 so
// the route never reveals which ids exist (OQ-26). Sets req.installation.
async function ownInstallation(req, res, next) {
  const { installationId } = req.params;
  if (req.user.installation_id !== installationId) {
    throw AppError.notOwnInstallation();
  }
  const installation = await installationsRepository.findById(installationId);
  if (!installation) {
    throw AppError.notOwnInstallation();
  }
  req.installation = installation;
  next();
}

module.exports = ownInstallation;
