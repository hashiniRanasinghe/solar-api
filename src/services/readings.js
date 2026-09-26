const readingsRepository = require('../repositories/readings');
const { parseListQuery } = require('./list-query');

// Same query on every readings collection: from, to, sort, offset, limit.
// Default newest first; installation_id is always the final tie-break.
const LIST_CONFIG = {
  idField: 'installation_id',
  sortFields: ['timestamp'],
  defaultSort: { timestamp: -1 },
  timeWindow: true,
};

function parseQuery(query) {
  return parseListQuery(query, LIST_CONFIG);
}

// Readings history for a set of installations (one for an installation,
// several for a substation, district or province). The filter holds the
// time window from parseQuery.
async function listForInstallations(installationIds, { filter, sort, offset, limit }) {
  const scoped = { ...filter, installation_id: { $in: installationIds } };
  const { items, count } = await readingsRepository.findPage({ filter: scoped, sort, offset, limit });
  return { items, count, offset, limit };
}

// The one "newest reading" helper, shared by the installation composite and
// last-reading. Returns null when the installation has no reading yet.
async function newestReading(installationId) {
  return readingsRepository.findNewest(installationId);
}

async function getOne(installationId, readingId) {
  return readingsRepository.findOne(installationId, readingId);
}

module.exports = { parseQuery, listForInstallations, newestReading, getOne };
