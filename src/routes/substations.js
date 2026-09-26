const express = require('express');
const requireScope = require('../middleware/require-scope');
const controller = require('../controllers/substations');

const router = express.Router();
const read = requireScope('solar:read');

router.get('/', read, controller.list);
router.get('/:substationId', read, controller.get);
router.get('/:substationId/readings', read, controller.listReadings);

module.exports = router;
