const express = require('express');
const cors = require('cors');
const { APP_ENV } = require('./config/env');
const { AppError } = require('./utils/errors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
// Strong, content-based ETag on every response body (OQ-29); needed later for
// If-Match. Express's freshness check then answers 304.
app.set('etag', 'strong');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', environment: APP_ENV });
});

// Swagger UI at /docs and the spec at /docs.json, public, before the 404.
app.use(require('./routes/docs').router);

app.use('/solar/v1.0', require('./routes'));

app.use((req, res, next) => {
  next(AppError.routeNotFound());
});

app.use(errorHandler);

module.exports = app;
