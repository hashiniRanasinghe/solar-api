const express = require('express');

const router = express.Router();

router.use('/provinces', require('./provinces'));
router.use('/districts', require('./districts'));
router.use('/substations', require('./substations'));
router.use('/installations', require('./installations'));

module.exports = router;
