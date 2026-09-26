const express = require('express');
const controller = require('../controllers/districts');

const router = express.Router();

router.get('/', controller.list);
router.get('/:districtId', controller.get);
router.get('/:districtId/readings', controller.listReadings);
router.get('/:districtId/generation-summary', controller.generationSummary);

module.exports = router;
