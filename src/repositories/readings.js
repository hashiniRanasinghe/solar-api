const { GenerationReading, Installation } = require('../models');
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

// True when the installation already has a reading at this timestamp. Uses
// the unique (installation_id, timestamp) index.
async function existsAt(installationId, timestamp) {
  return (await GenerationReading.exists({ installation_id: installationId, timestamp })) !== null;
}

// Appends one reading. A duplicate (installation_id, timestamp) rejects with
// the driver's duplicate key error (code 11000).
async function insert(doc) {
  return GenerationReading.create(doc);
}

// One reading of an installation inside a time window: the first (direction 1)
// or the last (direction -1). Each lookup reads the (installation_id, timestamp)
// index for one installation and stops after one key.
function oneReading(as, timestamp, direction) {
  return {
    $lookup: {
      from: GenerationReading.collection.name,
      localField: 'installation_id',
      foreignField: 'installation_id',
      pipeline: [
        { $match: { timestamp } },
        { $sort: { timestamp: direction } },
        { $limit: 1 },
        { $project: { _id: 0, timestamp: 1, power_kw: 1, energy_kwh: 1 } },
      ],
      as,
    },
  };
}

// Per district: the installations, then for each one its newest reading at or
// before now and its first and last reading of the day (dayStart to now),
// folded into one document. energy_kwh is cumulative, so last minus first is
// the energy of the day; one reading or none gives 0.
function generationSummaryPipeline(districtId, dayStart, now) {
  const today = { $gte: dayStart, $lte: now };
  return [
    { $match: { district_id: districtId } },
    { $project: { _id: 0, installation_id: 1 } },
    oneReading('newest', { $lte: now }, -1),
    oneReading('first_today', today, 1),
    oneReading('last_today', today, -1),
    {
      $project: {
        newest: { $first: '$newest' },
        first_today: { $first: '$first_today' },
        last_today: { $first: '$last_today' },
      },
    },
    {
      $group: {
        _id: null,
        installations_total: { $sum: 1 },
        installations_reporting_today: { $sum: { $cond: [{ $ifNull: ['$last_today', false] }, 1, 0] } },
        current_power_kw: { $sum: { $ifNull: ['$newest.power_kw', 0] } },
        today_energy_kwh: {
          $sum: { $ifNull: [{ $subtract: ['$last_today.energy_kwh', '$first_today.energy_kwh'] }, 0] },
        },
        newest_reading_at: { $max: '$newest.timestamp' },
        oldest_latest_reading_at: { $min: '$newest.timestamp' },
      },
    },
    { $project: { _id: 0 } },
  ];
}

// Returns the folded totals, or null when the district has no installations.
async function districtGenerationSummary(districtId, dayStart, now) {
  const [summary] = await Installation.aggregate(generationSummaryPipeline(districtId, dayStart, now));
  return summary || null;
}

module.exports = {
  findPage,
  findNewest,
  findOne,
  existsAt,
  insert,
  generationSummaryPipeline,
  districtGenerationSummary,
};
