const service = require('../services/installations');
const { pageLinks } = require('../utils/links');
const { setLastModified } = require('../utils/last-modified');

async function list(req, res) {
  const { items, count, offset, limit } = await service.list(req.query, req.user);
  const { next, previous } = pageLinks(req, { offset, limit, count });
  res.json({ count, next, previous, data: items });
}

// Last-Modified: the composite changes when the installation is updated or a
// new reading arrives, so the later of the two.
async function get(req, res) {
  const item = await service.get(req.params.installationId, req.user);
  setLastModified(res, item.updated_at, item.last_reading && item.last_reading.received_at);
  res.json(item);
}

async function getLastReading(req, res) {
  const reading = await service.getLastReading(req.params.installationId, req.user);
  setLastModified(res, reading.received_at);
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
  setLastModified(res, reading.received_at);
  res.json(reading);
}

module.exports = { list, get, getLastReading, listReadings, getReading };
