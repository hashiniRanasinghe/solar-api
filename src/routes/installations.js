const express = require('express');
const requireScope = require('../middleware/require-scope');
const controller = require('../controllers/installations');

const router = express.Router();
const read = requireScope('solar:read');

router.get('/', read, controller.list);
router.get('/:installationId', read, controller.get);
router.get('/:installationId/last-reading', read, controller.getLastReading);
router.get('/:installationId/readings', read, controller.listReadings);
router.get('/:installationId/readings/:readingId', read, controller.getReading);

module.exports = router;
