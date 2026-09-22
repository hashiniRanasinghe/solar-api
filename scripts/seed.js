'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { MONGODB_URI } = require('../src/config/env');
const connectDB = require('../src/config/db');
const { Province, District, Substation, Installation, User } = require('../src/models');

const OUTPUT_FILE = path.join(__dirname, 'seed-keys.txt');
const BATCH_SIZE = 500;

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

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32). Fixed seed so --reset always regenerates
// the same ids, names and district/substation/installation distributions.
// ---------------------------------------------------------------------------
const RNG_SEED = 1337;

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function getDbNameFromUri(uri) {
  try {
    return new URL(uri).pathname.replace(/^\//, '') || '(no database in URI path)';
  } catch (err) {
    return '(could not parse MONGODB_URI)';
  }
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

async function main() {
  if (!MONGODB_URI) {
    console.error('Seed aborted: MONGODB_URI is not set.');
    process.exit(1);
  }

  const { provinces, districts } = buildProvincesAndDistricts();
  const { substations, installations, deviceKeys } = buildSubstationsAndInstallations(districts);
  const { users, demoUsers } = buildDemoUsers(provinces, districts);

  console.log(`Target database (from MONGODB_URI): ${getDbNameFromUri(MONGODB_URI)}`);
  console.log(
    `Planned counts: provinces=${provinces.length}, districts=${districts.length}, ` +
      `substations=${substations.length}, installations=${installations.length}, users=${users.length}`
  );

  if (isDryRun) {
    console.log('\n--dry-run: no database connection made, nothing written.');
    return;
  }

  await connectDB();

  const existingCounts = await Promise.all([
    Province.countDocuments(),
    District.countDocuments(),
    Substation.countDocuments(),
    Installation.countDocuments(),
    User.countDocuments(),
  ]);
  const alreadySeeded = existingCounts.some((count) => count > 0);

  if (alreadySeeded && !isReset) {
    console.log(
      '\nOne or more target collections already have data and --reset was not given; ' +
        'skipping seed (safe to run twice by accident). Use --reset to reseed.'
    );
    await require('mongoose').disconnect();
    return;
  }

  if (isReset) {
    console.log('\n--reset: clearing provinces, districts, substations, installations, users...');
    await Promise.all([
      Province.deleteMany({}),
      District.deleteMany({}),
      Substation.deleteMany({}),
      Installation.deleteMany({}),
      User.deleteMany({}),
    ]);
  }

  console.log('Inserting seed data...');
  await insertInBatches(Province, provinces);
  await insertInBatches(District, districts);
  await insertInBatches(Substation, substations);
  await insertInBatches(Installation, installations);
  await insertInBatches(User, users);

  console.log('Syncing indexes...');
  await Promise.all([
    Province.syncIndexes(),
    District.syncIndexes(),
    Substation.syncIndexes(),
    Installation.syncIndexes(),
    User.syncIndexes(),
  ]);

  const integrityPassed = await verifyIntegrity(substations, installations);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ device_keys: deviceKeys, demo_users: demoUsers }, null, 2),
    { mode: 0o600 }
  );

  console.log('\nSeed summary');
  console.log(`  provinces: ${provinces.length}`);
  console.log(`  districts: ${districts.length}`);
  console.log(`  substations: ${substations.length}`);
  console.log(`  installations: ${installations.length}`);
  console.log(`  users: ${users.length}`);
  console.log(`  device keys and demo passwords written to: ${path.relative(process.cwd(), OUTPUT_FILE)}`);

  await require('mongoose').disconnect();

  if (!integrityPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.name);
  process.exit(1);
});
