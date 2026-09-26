const express = require('express');
const controller = require('../controllers/districts');

const router = express.Router();

router.get('/', controller.list);
router.get('/:districtId', controller.get);

module.exports = router;
