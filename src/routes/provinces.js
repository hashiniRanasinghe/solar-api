const express = require('express');
const requireScope = require('../middleware/require-scope');
const controller = require('../controllers/provinces');

const router = express.Router();
const read = requireScope('solar:read');

router.get('/', read, controller.list);
router.get('/:provinceId', read, controller.get);
router.get('/:provinceId/readings', read, controller.listReadings);

module.exports = router;
