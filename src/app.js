const express = require('express');
const cors = require('cors');
const { APP_ENV } = require('./config/env');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', environment: APP_ENV });
});

const v1Router = express.Router();
app.use('/solar/v1.0', v1Router);

module.exports = app;
