const service = require('../services/installations');
const { pageLinks } = require('../utils/links');
const { setLastModified } = require('../utils/last-modified');
const { etagOf, checkIfMatch } = require('../utils/if-match');

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

// 201 with the new installation and its device key, shown only here (hence
// no-store). The body differs from the GET representation because of
// device_key, so there is no Content-Location, and the ETag is set to the one
// GET will return, so it can be used for If-Match right away.
async function create(req, res) {
  const { installation, representation, deviceKey } = await service.create(req.body, req.user);
  res.status(201);
  res.set({
    Location: `${req.baseUrl}/${installation.installation_id}`,
    ETag: etagOf(req, representation),
    'Cache-Control': 'no-store',
  });
  setLastModified(res, installation.updated_at);
  res.json({ ...installation, device_key: deviceKey });
}

// The current representation (403/404) is compared with If-Match (412)
// before the body is read (400, 409). The response is what GET returns.
async function replace(req, res) {
  const { installationId } = req.params;
  const current = await service.get(installationId, req.user);
  const matched = checkIfMatch(req, current);
  const item = await service.replace(installationId, req.body, req.user, matched ? current.updated_at : null);
  setLastModified(res, item.updated_at, item.last_reading && item.last_reading.received_at);
  res.json(item);
}

// 200 with the deleted representation; a repeat DELETE gives 404 (WP section 7.4).
async function remove(req, res) {
  const { installationId } = req.params;
  const current = await service.get(installationId, req.user);
  const matched = checkIfMatch(req, current);
  await service.remove(installationId, matched ? current.updated_at : null);
  res.json(current);
}

module.exports = { list, get, getLastReading, listReadings, getReading, create, replace, remove };
