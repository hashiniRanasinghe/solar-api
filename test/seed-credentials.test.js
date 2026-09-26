// Pure seed credential helpers: no database, no network. Never prints a
// generated value.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  generateDemoPassword,
  generateDeviceKey,
  parseSeedArgs,
} = require('../scripts/lib/credentials');

test('demo password is base64url of at least 12 random bytes', () => {
  const password = generateDemoPassword();
  assert.match(password, /^[A-Za-z0-9_-]+$/);
  assert.ok(Buffer.from(password, 'base64url').length >= 12);
});

test('demo passwords differ between calls', () => {
  assert.notEqual(generateDemoPassword(), generateDemoPassword());
});

test('device key is 64 hex characters and its hash is its SHA-256 hex', () => {
  const { plainKey, api_key_hash } = generateDeviceKey();
  assert.match(plainKey, /^[0-9a-f]{64}$/);
  assert.equal(api_key_hash, crypto.createHash('sha256').update(plainKey).digest('hex'));
});

test('device keys differ between calls', () => {
  assert.notEqual(generateDeviceKey().plainKey, generateDeviceKey().plainKey);
});

test('parseSeedArgs reads each flag', () => {
  assert.deepEqual(parseSeedArgs([]), { reset: false, dryRun: false, rotate: false });
  assert.deepEqual(parseSeedArgs(['--reset']), { reset: true, dryRun: false, rotate: false });
  assert.deepEqual(parseSeedArgs(['--dry-run']), { reset: false, dryRun: true, rotate: false });
  assert.deepEqual(parseSeedArgs(['--rotate-credentials']), {
    reset: false,
    dryRun: false,
    rotate: true,
  });
  assert.deepEqual(parseSeedArgs(['--reset', '--dry-run']), {
    reset: true,
    dryRun: true,
    rotate: false,
  });
});

test('--rotate-credentials cannot be combined with --reset or --dry-run', () => {
  assert.throws(() => parseSeedArgs(['--rotate-credentials', '--reset']));
  assert.throws(() => parseSeedArgs(['--dry-run', '--rotate-credentials']));
});

test('seed.js hard-codes no password string', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed.js'), 'utf8');
  assert.doesNotMatch(source, /password:\s*['"`]/);
});
