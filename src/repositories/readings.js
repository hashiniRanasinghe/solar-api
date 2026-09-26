const { GenerationReading } = require('../models');
const { createReadRepository } = require('./read-repository');

const { findPage } = createReadRepository(GenerationReading, 'reading_id');

// Newest reading of one installation. Reads the (installation_id, timestamp)
// index backwards, so only one document is examined.
async function findNewest(installationId) {
  return GenerationReading.findOne({ installation_id: installationId }).sort({ timestamp: -1 });
}

// A reading only counts as found when it belongs to the given installation.
async function findOne(installationId, readingId) {
  return GenerationReading.findOne({ reading_id: readingId, installation_id: installationId });
}

module.exports = { findPage, findNewest, findOne };
