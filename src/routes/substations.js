const express = require('express');
const controller = require('../controllers/substations');

const router = express.Router();

router.get('/', controller.list);
router.get('/:substationId', controller.get);
router.get('/:substationId/readings', controller.listReadings);

module.exports = router;
