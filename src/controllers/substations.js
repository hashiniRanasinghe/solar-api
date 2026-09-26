const service = require('../services/substations');
const { pageLinks } = require('../utils/links');

async function list(req, res) {
  const { items, count, offset, limit } = await service.list(req.query);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

async function get(req, res) {
  const item = await service.get(req.params.substationId);
  res.json(item);
}

async function listReadings(req, res) {
  const { items, count, offset, limit } = await service.listReadings(req.params.substationId, req.query);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

module.exports = { list, get, listReadings };
