'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { MONGODB_URI } = require('../src/config/env');
const connectDB = require('../src/config/db');
const {
  Province,
  District,
  Substation,
  Installation,
  GenerationReading,
  User,
} = require('../src/models');
const {
  RNG_SEED,
  mulberry32,
  SLOT_MS,
  floorToSlot,
  baselineEnergyKwh,
  buildReadings,
  insertReadingsInBatches,
  countEnergyDecreases,
  getDbNameFromUri,
} = require('./lib/readings');

const OUTPUT_FILE = path.join(__dirname, 'seed-keys.txt');
const BATCH_SIZE = 500;

// 7 days of 15-minute readings per installation, ending at the run time
// floored to the last 15-minute boundary (UTC).
const READING_DAYS = 7;
const READINGS_PER_INSTALLATION = (READING_DAYS * 24 * 60 * 60 * 1000) / SLOT_MS;

// Realistic small residential/commercial rooftop solar range for Sri Lanka:
// ~3 kW is close to the smallest single-phase residential net-metering
// installation, ~50 kW covers small commercial rooftops before a site needs
// a separate high-capacity connection agreement. Every seeded installation
// falls inside this band.
const CAPACITY_MIN_KW = 3;
const CAPACITY_MAX_KW = 50;

const args = process.argv.slice(2);
const isReset = args.includes('--reset');
const isDryRun = args.includes('--dry-run');

// Deterministic hierarchy RNG stream (mulberry32, fixed seed; see lib/readings.js).
const rng = mulberry32(RNG_SEED);

function rngInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededShuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Splits `total` across `parentCount` parents with a realistic (not exactly
// even) spread: a base share each, then the remainder handed to a seeded
// random subset of parents so the result is deterministic but uneven.
function distributeCounts(total, parentCount) {
  const base = Math.floor(total / parentCount);
  const remainder = total - base * parentCount;
  const counts = new Array(parentCount).fill(base);
  const order = seededShuffle([...Array(parentCount).keys()]);
  for (let i = 0; i < remainder; i += 1) {
    counts[order[i]] += 1;
  }
  return counts;
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

// ---------------------------------------------------------------------------
// Real Sri Lankan provinces and their districts (public administrative
// data): exactly 9 provinces and 25 districts, matching the brief's minimum
// seed size exactly, so this is used as-is rather than inventing names.
// ---------------------------------------------------------------------------
const PROVINCES = [
  { name: 'Western', districts: ['Colombo', 'Gampaha', 'Kalutara'] },
  { name: 'Central', districts: ['Kandy', 'Matale', 'Nuwara Eliya'] },
  { name: 'Southern', districts: ['Galle', 'Matara', 'Hambantota'] },
  { name: 'Northern', districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'] },
  { name: 'Eastern', districts: ['Trincomalee', 'Batticaloa', 'Ampara'] },
  { name: 'North Western', districts: ['Kurunegala', 'Puttalam'] },
  { name: 'North Central', districts: ['Anuradhapura', 'Polonnaruwa'] },
  { name: 'Uva', districts: ['Badulla', 'Monaragala'] },
  { name: 'Sabaragamuwa', districts: ['Ratnapura', 'Kegalle'] },
];

function buildProvincesAndDistricts() {
  const provinces = [];
  const districts = [];
  let districtCounter = 0;

  PROVINCES.forEach((entry, pIndex) => {
    const province_id = `PV-${pad(pIndex + 1, 2)}`;
    provinces.push({ province_id, name: entry.name });

    entry.districts.forEach((districtName) => {
      districtCounter += 1;
      districts.push({
        district_id: `DT-${pad(districtCounter, 2)}`,
        name: districtName,
        province_id, // source of truth, set directly (not derived)
      });
    });
  });

  return { provinces, districts };
}

// Substations and installations aren't real public entities, so their
// counts per parent come from the seeded RNG above; their derived ids are
// read off the parent objects this function already built, never re-typed.
function buildSubstationsAndInstallations(districts) {
  const substationCounts = distributeCounts(40, districts.length);
  const substations = [];
  let substationCounter = 0;

  districts.forEach((district, dIndex) => {
    const count = substationCounts[dIndex];
    for (let s = 0; s < count; s += 1) {
      substationCounter += 1;
      substations.push({
        substation_id: `SS-${pad(substationCounter, 3)}`,
        name: `${district.name} Substation ${s + 1}`,
        district_id: district.district_id, // source of truth
        province_id: district.province_id, // derived from district_id
      });
    }
  });

  const installationCounts = distributeCounts(240, substations.length);
  const installations = [];
  const deviceKeys = {}; // installation_id -> plain key (written to disk only)
  let installationCounter = 0;

  substations.forEach((substation, sIndex) => {
    const count = installationCounts[sIndex];
    for (let i = 0; i < count; i += 1) {
      installationCounter += 1;
      const installation_id = `INS-${pad(installationCounter, 4)}`;
      const plainKey = crypto.randomBytes(32).toString('hex');
      const api_key_hash = crypto.createHash('sha256').update(plainKey).digest('hex');
      deviceKeys[installation_id] = plainKey;

      installations.push({
        installation_id,
        meter_id: `MTR-${pad(installationCounter, 4)}`,
        name: `${substation.name} Installation ${i + 1}`,
        substation_id: substation.substation_id, // source of truth
        district_id: substation.district_id, // derived from substation_id
        province_id: substation.province_id, // derived from substation_id
        capacity_kw: rngInt(CAPACITY_MIN_KW, CAPACITY_MAX_KW),
        api_key_hash,
      });
    }
  });

  return { substations, installations, deviceKeys };
}

// Demo users: PROPOSAL usernames/passwords for the student to document in
// the report/README later. Plain passwords are written only to the
// git-ignored output file below, never printed to stdout.
function buildDemoUsers(provinces, districts) {
  const specs = [
    {
      user_id: 'USR-01',
      username: 'national.admin',
      password: 'AdminDemo#2026',
      role: 'admin',
      jurisdiction_level: 'national',
    },
    {
      user_id: 'USR-02',
      username: 'national.reader',
      password: 'ReaderDemo#2026',
      role: 'reader',
      jurisdiction_level: 'national',
    },
    {
      user_id: 'USR-03',
      username: 'western.reader',
      password: 'ProvinceDemo#2026',
      role: 'reader',
      jurisdiction_level: 'province',
      jurisdiction_id: provinces[0].province_id,
    },
    {
      user_id: 'USR-04',
      username: 'colombo.reader',
      password: 'DistrictDemo#2026',
      role: 'reader',
      jurisdiction_level: 'district',
      jurisdiction_id: districts[0].district_id,
    },
  ];

  const users = specs.map((spec) => ({
    user_id: spec.user_id,
    username: spec.username,
    password_hash: bcrypt.hashSync(spec.password, 10),
    role: spec.role,
    jurisdiction_level: spec.jurisdiction_level,
    ...(spec.jurisdiction_id ? { jurisdiction_id: spec.jurisdiction_id } : {}),
  }));

  const demoUsers = {};
  specs.forEach((spec) => {
    demoUsers[spec.username] = {
      password: spec.password,
      role: spec.role,
      jurisdiction_level: spec.jurisdiction_level,
      jurisdiction_id: spec.jurisdiction_id || null,
    };
  });

  return { users, demoUsers };
}

async function insertInBatches(Model, docs) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    await Model.insertMany(docs.slice(i, i + BATCH_SIZE));
  }
}

async function verifyIntegrity(substations, installations) {
  const substationParentById = new Map();
  const provinceIdByDistrictId = new Map();

  (await District.find({}, 'district_id province_id').lean()).forEach((d) => {
    provinceIdByDistrictId.set(d.district_id, d.province_id);
  });
  (await Substation.find({}, 'substation_id district_id province_id').lean()).forEach((s) => {
    substationParentById.set(s.substation_id, {
      district_id: s.district_id,
      province_id: s.province_id,
    });
  });

  let substationFailures = 0;
  substations.forEach((s) => {
    const expectedProvinceId = provinceIdByDistrictId.get(s.district_id);
    if (expectedProvinceId !== s.province_id) substationFailures += 1;
  });

  let installationFailures = 0;
  installations.forEach((ins) => {
    const parentSubstation = substationParentById.get(ins.substation_id);
    if (
      !parentSubstation ||
      parentSubstation.district_id !== ins.district_id ||
      parentSubstation.province_id !== ins.province_id
    ) {
      installationFailures += 1;
    }
  });

  const pass = substationFailures === 0 && installationFailures === 0;
  console.log('\nSeed integrity check');
  console.log(`  substations checked: ${substations.length}, mismatches: ${substationFailures}`);
  console.log(
    `  installations checked: ${installations.length}, mismatches: ${installationFailures}`
  );
  console.log(`  result: ${pass ? 'PASS' : 'FAIL'}`);

  return pass;
}

// Readings checks, all as database aggregations (no readings loaded here).
async function verifyReadings(installationIds, nowMs) {
  const countsById = new Map();
  (
    await GenerationReading.aggregate([{ $group: { _id: '$installation_id', count: { $sum: 1 } } }])
  ).forEach((row) => countsById.set(row._id, row.count));

  let wrongCount = 0;
  installationIds.forEach((id) => {
    if (countsById.get(id) !== READINGS_PER_INSTALLATION) wrongCount += 1;
  });
  const knownIds = new Set(installationIds);
  const orphanGroups = [...countsById.keys()].filter((id) => !knownIds.has(id)).length;

  const badTimestampRows = await GenerationReading.aggregate([
    {
      $match: {
        $expr: {
          $or: [
            { $ne: [{ $mod: [{ $toLong: '$timestamp' }, SLOT_MS] }, 0] },
            { $gt: ['$timestamp', new Date(nowMs)] },
          ],
        },
      },
    },
    { $count: 'bad' },
  ]);
  const badTimestamps = badTimestampRows.length ? badTimestampRows[0].bad : 0;

  const energyDecreases = await countEnergyDecreases();

  const pass =
    wrongCount === 0 && orphanGroups === 0 && badTimestamps === 0 && energyDecreases === 0;
  console.log('\nReadings integrity check');
  console.log(
    `  installations checked: ${installationIds.length}, ` +
      `without exactly ${READINGS_PER_INSTALLATION} readings: ${wrongCount}, ` +
      `reading groups for unknown installations: ${orphanGroups}`
  );
  console.log(`  timestamps off a 15-minute boundary or in the future: ${badTimestamps}`);
  console.log(`  energy_kwh decreases within an installation: ${energyDecreases}`);
  console.log(`  result: ${pass ? 'PASS' : 'FAIL'}`);

  return pass;
}

function* readingGroups(installations, startMs, endMs) {
  for (const installation of installations) {
    yield buildReadings(
      installation,
      startMs,
      endMs,
      baselineEnergyKwh(installation.installation_id, installation.capacity_kw)
    );
  }
}

async function main() {
  if (!MONGODB_URI) {
    console.error('Seed aborted: MONGODB_URI is not set.');
    process.exit(1);
  }

  const { provinces, districts } = buildProvincesAndDistricts();
  const { substations, installations, deviceKeys } = buildSubstationsAndInstallations(districts);
  const { users, demoUsers } = buildDemoUsers(provinces, districts);

  const windowEndMs = floorToSlot(Date.now());
  const windowStartMs = windowEndMs - (READINGS_PER_INSTALLATION - 1) * SLOT_MS;
  const plannedReadings = installations.length * READINGS_PER_INSTALLATION;

  console.log(`Target database (from MONGODB_URI): ${getDbNameFromUri(MONGODB_URI)}`);
  console.log(
    `Planned counts: provinces=${provinces.length}, districts=${districts.length}, ` +
      `substations=${substations.length}, installations=${installations.length}, users=${users.length}, ` +
      `readings=${plannedReadings} (${installations.length} x ${READINGS_PER_INSTALLATION})`
  );
  console.log(
    `Readings window (UTC, every 15 minutes): ${new Date(windowStartMs).toISOString()} ` +
      `to ${new Date(windowEndMs).toISOString()}`
  );

  if (isDryRun) {
    console.log('\n--dry-run: no database connection made, nothing written.');
    return;
  }

  await connectDB();

  if (isReset) {
    console.log(
      '\n--reset: clearing provinces, districts, substations, installations, users, generation_readings...'
    );
    await Promise.all([
      Province.deleteMany({}),
      District.deleteMany({}),
      Substation.deleteMany({}),
      Installation.deleteMany({}),
      User.deleteMany({}),
      GenerationReading.deleteMany({}),
    ]);
  }

  const existingCounts = await Promise.all([
    Province.countDocuments(),
    District.countDocuments(),
    Substation.countDocuments(),
    Installation.countDocuments(),
    User.countDocuments(),
  ]);
  const hierarchySeeded = existingCounts.some((count) => count > 0);
  const readingsSeeded = (await GenerationReading.countDocuments()) > 0;

  let hierarchyPassed = true;
  let readingsPassed = true;

  if (hierarchySeeded) {
    console.log(
      '\nHierarchy/user collections already have data and --reset was not given; ' +
        'skipping them (device keys file left unchanged). Use --reset to reseed.'
    );
  } else {
    console.log('\nInserting hierarchy and users...');
    await insertInBatches(Province, provinces);
    await insertInBatches(District, districts);
    await insertInBatches(Substation, substations);
    await insertInBatches(Installation, installations);
    await insertInBatches(User, users);

    // Written only when these installations were inserted, so the file's
    // plain keys always match the stored hashes.
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify({ device_keys: deviceKeys, demo_users: demoUsers }, null, 2),
      { mode: 0o600 }
    );
  }

  let readingsInserted = 0;
  if (readingsSeeded) {
    console.log(
      '\ngeneration_readings already has data and --reset was not given; skipping readings. ' +
        'Use scripts/topup.js to bring them up to now.'
    );
  } else {
    const storedInstallations = await Installation.find({}, 'installation_id capacity_kw')
      .sort({ installation_id: 1 })
      .lean();
    console.log(
      `\nInserting readings for ${storedInstallations.length} installations ` +
        `(${storedInstallations.length * READINGS_PER_INSTALLATION} planned)...`
    );
    ({ inserted: readingsInserted } = await insertReadingsInBatches(
      readingGroups(storedInstallations, windowStartMs, windowEndMs)
    ));
  }

  if (hierarchySeeded && readingsSeeded) {
    console.log('\nNothing to do.');
    await require('mongoose').disconnect();
    return;
  }

  console.log('\nSyncing indexes...');
  await Promise.all([
    Province.syncIndexes(),
    District.syncIndexes(),
    Substation.syncIndexes(),
    Installation.syncIndexes(),
    User.syncIndexes(),
    GenerationReading.syncIndexes(),
  ]);

  if (!hierarchySeeded) {
    hierarchyPassed = await verifyIntegrity(substations, installations);
  }
  if (!readingsSeeded) {
    const installationIds = (await Installation.find({}, 'installation_id').lean()).map(
      (ins) => ins.installation_id
    );
    readingsPassed = await verifyReadings(installationIds, Date.now());
  }

  console.log('\nSeed summary');
  if (!hierarchySeeded) {
    console.log(`  provinces: ${provinces.length}`);
    console.log(`  districts: ${districts.length}`);
    console.log(`  substations: ${substations.length}`);
    console.log(`  installations: ${installations.length}`);
    console.log(`  users: ${users.length}`);
    console.log(
      `  device keys and demo passwords written to: ${path.relative(process.cwd(), OUTPUT_FILE)}`
    );
  }
  if (!readingsSeeded) {
    console.log(`  generation_readings: ${readingsInserted}`);
  }

  await require('mongoose').disconnect();

  if (!hierarchyPassed || !readingsPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.name, err.codeName || '');
  process.exit(1);
});
