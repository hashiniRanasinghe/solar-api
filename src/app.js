const express = require('express');
const cors = require('cors');
const { APP_ENV } = require('./config/env');
const { AppError } = require('./utils/errors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', environment: APP_ENV });
});

app.use('/solar/v1.0', require('./routes'));

app.use((req, res, next) => {
  next(AppError.routeNotFound());
});

app.use(errorHandler);

module.exports = app;
