const service = require('../services/auth');

// A token response must not be stored by any cache (RFC 6749 section 5.1).
async function login(req, res) {
  const token = await service.login(req.body);
  res.set('Cache-Control', 'no-store');
  res.json(token);
}

module.exports = { login };
