const express = require('express');
const controller = require('../controllers/device-readings');
const acceptJson = require('../middleware/accept-json');
const requireJson = require('../middleware/require-json');
const authenticateDevice = require('../middleware/authenticate-device');
const allowMethods = require('../middleware/allow-methods');

// Mounted at /installations/:installationId/readings BEFORE the bearer
// middleware: POST takes only a device key (X-API-Key), never a bearer token.
// Readings are append-only, so every other write method gets 405. GET falls
// through to the bearer-protected read routes.
const router = express.Router({ mergeParams: true });

// Order: 405, 406, 415, then 401/403 (device key), then 400 and 409 in the
// service.
router.all('/', allowMethods(['GET', 'HEAD', 'POST']));
router.all('/:readingId', allowMethods(['GET', 'HEAD']));
router.post('/', acceptJson, requireJson, authenticateDevice, controller.createReading);

module.exports = router;
