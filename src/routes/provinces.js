const express = require('express');
const controller = require('../controllers/provinces');

const router = express.Router();

router.get('/', controller.list);
router.get('/:provinceId', controller.get);

module.exports = router;
