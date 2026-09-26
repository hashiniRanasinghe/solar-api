const express = require('express');
const controller = require('../controllers/districts');

const router = express.Router();

router.get('/', controller.list);
router.get('/:districtId', controller.get);
router.get('/:districtId/readings', controller.listReadings);

module.exports = router;
