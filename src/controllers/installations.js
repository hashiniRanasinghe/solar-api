const service = require('../services/installations');
const { pageLinks } = require('../utils/links');

async function list(req, res) {
  const { items, count, offset, limit } = await service.list(req.query);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

async function get(req, res) {
  const item = await service.get(req.params.installationId);
  res.json(item);
}

module.exports = { list, get };
