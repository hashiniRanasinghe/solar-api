const express = require('express');
const controller = require('../controllers/installations');
const acceptJson = require('../middleware/accept-json');
const requireJson = require('../middleware/require-json');
const authenticate = require('../middleware/authenticate');
const requireScope = require('../middleware/require-scope');

// Admin writes on installations (scope installations:write). Mounted at
// /installations before the read routes; GET falls through to them.
// Order: 406, 415 (POST, PUT), 401, 403 insufficient scope, then in the
// controller and service 403/404 by jurisdiction and existence, 412, 400, 409.
const router = express.Router();
const write = requireScope('installations:write');

router.post('/', acceptJson, requireJson, authenticate, write, controller.create);
router.put('/:installationId', acceptJson, requireJson, authenticate, write, controller.replace);
router.delete('/:installationId', acceptJson, authenticate, write, controller.remove);

module.exports = router;
