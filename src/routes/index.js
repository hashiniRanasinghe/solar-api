const express = require('express');
const authController = require('../controllers/auth');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Open: login issues the token. Everything after authenticate needs a bearer token.
router.post('/login', authController.login);

// Device ingest: X-API-Key only, so it is mounted before the bearer
// middleware. GET on these URIs falls through to the routes below.
router.use('/installations/:installationId/readings', require('./device-readings'));

router.use(authenticate);

router.use('/provinces', require('./provinces'));
router.use('/districts', require('./districts'));
router.use('/substations', require('./substations'));
router.use('/installations', require('./installations'));

module.exports = router;
