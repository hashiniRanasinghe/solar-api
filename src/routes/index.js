const express = require('express');
const authController = require('../controllers/auth');
const acceptJson = require('../middleware/accept-json');
const authenticate = require('../middleware/authenticate');
const privateCache = require('../middleware/private-cache');

const router = express.Router();

// Open: login issues the token. Everything after authenticate needs a bearer token.
router.post('/login', acceptJson, authController.login);

// Device ingest: X-API-Key only, so it is mounted before the bearer
// middleware. GET on these URIs falls through to the routes below.
router.use('/installations/:installationId/readings', require('./device-readings'));

// 406 before 401, then the bearer token, then cache headers for the reads.
router.use(acceptJson);
router.use(authenticate);
router.use(privateCache);

router.use('/provinces', require('./provinces'));
router.use('/districts', require('./districts'));
router.use('/substations', require('./substations'));
router.use('/installations', require('./installations'));

module.exports = router;
