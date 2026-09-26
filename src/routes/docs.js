const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

// The hand-written OpenAPI file is the single source. It is read once at
// start-up; a missing or invalid file stops the server from starting.
const SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

// Public (no token), outside /solar/v1.0. Swagger UI assets come from the
// installed package, not a CDN.
const router = express.Router();

router.get('/docs.json', (req, res) => {
  res.json(spec);
});
router.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

module.exports = { router, spec };
