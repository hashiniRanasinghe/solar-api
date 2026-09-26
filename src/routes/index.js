const express = require('express');
const authController = require('../controllers/auth');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Open: login issues the token. Everything below needs a bearer token.
router.post('/login', authController.login);

router.use(authenticate);

router.use('/provinces', require('./provinces'));
router.use('/districts', require('./districts'));
router.use('/substations', require('./substations'));
router.use('/installations', require('./installations'));

module.exports = router;
