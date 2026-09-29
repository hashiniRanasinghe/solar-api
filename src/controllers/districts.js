const service = require('../services/districts');
const { pageLinks } = require('../utils/links');

async function list(req, res) {
  const { items, count, offset, limit } = await service.list(req.query, req.user);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

async function get(req, res) {
  const item = await service.get(req.params.districtId, req.user);
  res.json(item);
}

async function listReadings(req, res) {
  const { items, count, offset, limit } = await service.listReadings(req.params.districtId, req.query, req.user);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

// A single derived resource: a plain object, not a collection envelope.
async function generationSummary(req, res) {
  res.json(await service.generationSummary(req.params.districtId, req.user));
}

module.exports = { list, get, listReadings, generationSummary };
