'use strict';

// Appends 15-minute readings for every installation from its newest stored
// reading up to now (floored to 15 minutes), using the same curve and
// cumulative-energy rules as the seed. Never deletes anything; safe to re-run
// (adds nothing when already current).

const mongoose = require('mongoose');

const { MONGODB_URI } = require('../src/config/env');
const connectDB = require('../src/config/db');
const { Installation, GenerationReading } = require('../src/models');
const {
  floorToSlot,
  ceilToSlot,
  buildReadings,
  insertReadingsInBatches,
  countEnergyDecreases,
  getDbNameFromUri,
} = require('./lib/readings');

async function main() {
  if (!MONGODB_URI) {
    console.error('Top-up aborted: MONGODB_URI is not set.');
    process.exit(1);
  }

  console.log(`Target database (from MONGODB_URI): ${getDbNameFromUri(MONGODB_URI)}`);
  const endMs = floorToSlot(Date.now());
  console.log(`Topping up readings to ${new Date(endMs).toISOString()} (UTC, 15-minute boundary)`);

  await connectDB();

  const installations = await Installation.find({}, 'installation_id capacity_kw')
    .sort({ installation_id: 1 })
    .lean();

  const groups = [];
  const skippedNoReadings = [];
  for (const installation of installations) {
    // Newest reading per installation, served by the (installation_id, timestamp) index.
    // eslint-disable-next-line no-await-in-loop
    const latest = await GenerationReading.findOne(
      { installation_id: installation.installation_id },
      'timestamp energy_kwh'
    )
      .sort({ timestamp: -1 })
      .lean();

    if (!latest) {
      skippedNoReadings.push(installation.installation_id);
    } else {
      // A device reading off a 15-minute boundary is followed by the next boundary.
      const startMs = ceilToSlot(latest.timestamp.getTime() + 1);
      if (startMs <= endMs) {
        groups.push(buildReadings(installation, startMs, endMs, latest.energy_kwh));
      }
    }
  }

  const planned = groups.reduce((sum, group) => sum + group.length, 0);
  console.log(
    `Installations: ${installations.length}, needing readings: ${groups.length}, ` +
      `readings to add: ${planned}`
  );

  let inserted = 0;
  let duplicates = 0;
  if (planned === 0) {
    console.log('Already current: nothing to add.');
  } else {
    ({ inserted, duplicates } = await insertReadingsInBatches(groups));
  }

  if (skippedNoReadings.length > 0) {
    console.log(
      `Skipped ${skippedNoReadings.length} installation(s) with no readings yet (new installation or not seeded): ` +
        skippedNoReadings.join(', ')
    );
  }

  const decreases = await countEnergyDecreases();
  const pass = decreases === 0;
  console.log('\nTop-up summary');
  console.log(`  readings added: ${inserted}${duplicates ? `, already present: ${duplicates}` : ''}`);
  console.log(`  energy_kwh decreases within an installation: ${decreases}`);
  console.log(`  result: ${pass ? 'PASS' : 'FAIL'}`);

  await mongoose.disconnect();

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error('Top-up failed:', err.name, err.codeName || '');
  process.exit(1);
});
