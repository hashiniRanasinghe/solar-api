const service = require('../services/auth');

async function login(req, res) {
  res.json(await service.login(req.body));
}

module.exports = { login };
