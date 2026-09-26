// Business id of a reading: RD-<installation number>-<UTC yyyymmddhhmmss>.
// Shared by the seed scripts and the ingest path, so both give the same id
// for the same installation and timestamp.
function readingId(installationId, ms) {
  const digits = new Date(ms).toISOString().replace(/\D/g, '').slice(0, 14);
  return `RD-${installationId.slice('INS-'.length)}-${digits}`;
}

module.exports = { readingId };
