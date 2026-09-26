const express = require('express');
const controller = require('../controllers/device-readings');
const acceptJson = require('../middleware/accept-json');
const requireJson = require('../middleware/require-json');
const authenticate = require('../middleware/authenticate');
const requireScope = require('../middleware/require-scope');
const ownInstallation = require('../middleware/own-installation');
const allowMethods = require('../middleware/allow-methods');

// Mounted at /installations/:installationId/readings before the read routes.
// POST takes a device bearer token (scope readings:write) issued by
// POST /login. Readings are append-only, so every other write method gets 405.
// GET falls through to the read routes (scope solar:read).
const router = express.Router({ mergeParams: true });

// Order: 405, 406, 415, 401 (token), 403 insufficient scope, 403 not own
// installation, then 400 and 409 in the service.
router.all('/', allowMethods(['GET', 'HEAD', 'POST']));
router.all('/:readingId', allowMethods(['GET', 'HEAD']));
router.post(
  '/',
  acceptJson,
  requireJson,
  authenticate,
  requireScope('readings:write'),
  ownInstallation,
  controller.createReading
);

module.exports = router;
