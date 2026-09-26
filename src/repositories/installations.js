const { Installation } = require('../models');
const { createReadRepository } = require('./read-repository');

// The device key hash is never fetched on read paths.
const { findPage, findById } = createReadRepository(Installation, 'installation_id', '-api_key_hash');

// Ids of the installations under one parent (field is substation_id,
// district_id or province_id). Uses that field's index; only ids are read.
async function findIdsBy(field, value) {
  return Installation.distinct('installation_id', { [field]: value });
}

// The stored device key hash of one installation, for device login only.
// Returns the hex string, or null when the installation or its key is missing.
async function findKeyHash(installationId) {
  const installation = await Installation.findOne({ installation_id: installationId }).select('api_key_hash').lean();
  return installation && typeof installation.api_key_hash === 'string' ? installation.api_key_hash : null;
}

// The highest installation id, or null when there is none. Ids have a fixed
// width (INS-NNNN), so the unique index sorts them in number order.
async function findHighestId() {
  const installation = await Installation.findOne({}, 'installation_id').sort({ installation_id: -1 }).lean();
  return installation ? installation.installation_id : null;
}

// True when another installation (not exceptId) already has this meter_id.
async function meterIdTaken(meterId, exceptId) {
  const filter = { meter_id: meterId };
  if (exceptId) filter.installation_id = { $ne: exceptId };
  return (await Installation.exists(filter)) !== null;
}

// A duplicate installation_id or meter_id rejects with the driver's duplicate
// key error (code 11000).
async function insert(doc) {
  return Installation.create(doc);
}

// expectedUpdatedAt (when If-Match was sent) makes the write conditional: a
// change made after the precondition was checked means nothing matches.
function writeFilter(installationId, expectedUpdatedAt) {
  const filter = { installation_id: installationId };
  if (expectedUpdatedAt) filter.updated_at = expectedUpdatedAt;
  return filter;
}

// Sets the client fields and the derived ids; updated_at is set by the
// schema timestamps. Returns the updated installation, or null when nothing
// matched.
async function replace(installationId, values, expectedUpdatedAt) {
  return Installation.findOneAndUpdate(writeFilter(installationId, expectedUpdatedAt), { $set: values }, { new: true })
    .select('-api_key_hash');
}

// True when one installation was deleted.
async function remove(installationId, expectedUpdatedAt) {
  const { deletedCount } = await Installation.deleteOne(writeFilter(installationId, expectedUpdatedAt));
  return deletedCount === 1;
}

module.exports = { findPage, findById, findIdsBy, findKeyHash, findHighestId, meterIdTaken, insert, replace, remove };
