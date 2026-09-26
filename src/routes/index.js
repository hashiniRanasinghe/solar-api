const express = require('express');
const authController = require('../controllers/auth');
const acceptJson = require('../middleware/accept-json');
const authenticate = require('../middleware/authenticate');
const privateCache = require('../middleware/private-cache');

const router = express.Router();

// 405 on every URI that does not support the method, before anything else.
router.use(require('./method-guards'));

// Open: login issues the token. Everything after authenticate needs a bearer token.
router.post('/login', acceptJson, authController.login);

// Device ingest: POST readings with a device token (readings:write). It runs
// its own checks in its own order; GET on these URIs falls through below.
router.use('/installations/:installationId/readings', require('./device-readings'));

// Admin POST, PUT, DELETE on installations (installations:write), with their
// own checks in their own order; GET falls through below.
router.use('/installations', require('./installation-writes'));

// 406 before 401, then the bearer token, then cache headers for the reads.
// Each read route requires the scope solar:read.
router.use(acceptJson);
router.use(authenticate);
router.use(privateCache);

router.use('/provinces', require('./provinces'));
router.use('/districts', require('./districts'));
router.use('/substations', require('./substations'));
router.use('/installations', require('./installations'));

module.exports = router;
