const express = require('express');
const controller = require('../controllers/installations');

const router = express.Router();

router.get('/', controller.list);
router.get('/:installationId', controller.get);

module.exports = router;
