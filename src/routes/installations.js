const express = require('express');
const controller = require('../controllers/installations');

const router = express.Router();

router.get('/', controller.list);
router.get('/:installationId', controller.get);
router.get('/:installationId/last-reading', controller.getLastReading);
router.get('/:installationId/readings', controller.listReadings);
router.get('/:installationId/readings/:readingId', controller.getReading);

module.exports = router;
