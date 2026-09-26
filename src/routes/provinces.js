const express = require('express');
const controller = require('../controllers/provinces');

const router = express.Router();

router.get('/', controller.list);
router.get('/:provinceId', controller.get);
router.get('/:provinceId/readings', controller.listReadings);

module.exports = router;
