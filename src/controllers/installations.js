const service = require('../services/installations');
const { pageLinks } = require('../utils/links');

async function list(req, res) {
  const { items, count, offset, limit } = await service.list(req.query, req.user);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

async function get(req, res) {
  const item = await service.get(req.params.installationId, req.user);
  res.json(item);
}

async function getLastReading(req, res) {
  const reading = await service.getLastReading(req.params.installationId, req.user);
  res.json(reading);
}

async function listReadings(req, res) {
  const { items, count, offset, limit } = await service.listReadings(
    req.params.installationId,
    req.query,
    req.user
  );
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

async function getReading(req, res) {
  const reading = await service.getReading(
    req.params.installationId,
    req.params.readingId,
    req.user
  );
  res.json(reading);
}

module.exports = { list, get, getLastReading, listReadings, getReading };
