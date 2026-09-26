const { Installation } = require('../models');
const { createReadRepository } = require('./read-repository');

// The device key hash is never fetched on read paths.
const { findPage, findById } = createReadRepository(Installation, 'installation_id', '-api_key_hash');

// Ids of the installations under one parent (field is substation_id,
// district_id or province_id). Uses that field's index; only ids are read.
async function findIdsBy(field, value) {
  return Installation.distinct('installation_id', { [field]: value });
}

// The installation that owns a device key. Only the fields the ingest path
// needs are read; the hash itself is not returned.
async function findByApiKeyHash(hash) {
  return Installation.findOne({ api_key_hash: hash }).select('installation_id capacity_kw');
}

module.exports = { findPage, findById, findIdsBy, findByApiKeyHash };
