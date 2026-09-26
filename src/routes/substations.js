const express = require('express');
const controller = require('../controllers/substations');

const router = express.Router();

router.get('/', controller.list);
router.get('/:substationId', controller.get);

module.exports = router;
