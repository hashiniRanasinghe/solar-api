const express = require('express');
const allowMethods = require('../middleware/allow-methods');

// 405 with Allow on every URI that exists but does not support the method,
// before 406 and 401. The hierarchy and the derived resources are read-only;
// installations are the one writable collection besides readings (whose
// guards are in device-readings.js). HEAD is served wherever GET is.
const router = express.Router();
const READ_ONLY = ['GET', 'HEAD'];

router.all('/login', allowMethods(['POST']));
router.all(
  [
    '/provinces',
    '/provinces/:provinceId',
    '/provinces/:provinceId/readings',
    '/districts',
    '/districts/:districtId',
    '/districts/:districtId/readings',
    '/districts/:districtId/generation-summary',
    '/substations',
    '/substations/:substationId',
    '/substations/:substationId/readings',
    '/installations/:installationId/last-reading',
  ],
  allowMethods(READ_ONLY)
);
router.all('/installations', allowMethods(['GET', 'HEAD', 'POST']));
router.all('/installations/:installationId', allowMethods(['GET', 'HEAD', 'PUT', 'DELETE']));

module.exports = router;
