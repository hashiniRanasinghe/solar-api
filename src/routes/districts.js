const express = require('express');
const requireScope = require('../middleware/require-scope');
const controller = require('../controllers/districts');

const router = express.Router();
const read = requireScope('solar:read');

router.get('/', read, controller.list);
router.get('/:districtId', read, controller.get);
router.get('/:districtId/readings', read, controller.listReadings);
router.get('/:districtId/generation-summary', read, controller.generationSummary);

module.exports = router;
