'use strict';

// Pure credential helpers for the seed script (no database, no output).
const crypto = require('crypto');

// 18 random bytes -> 24 base64url characters.
function generateDemoPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

// Same key format as POST /installations: 32 random bytes as hex; only the
// SHA-256 hex is stored.
function generateDeviceKey() {
  const plainKey = crypto.randomBytes(32).toString('hex');
  const api_key_hash = crypto.createHash('sha256').update(plainKey).digest('hex');
  return { plainKey, api_key_hash };
}

// Throws on a combination that must not run together.
function parseSeedArgs(args) {
  const options = {
    reset: args.includes('--reset'),
    dryRun: args.includes('--dry-run'),
    rotate: args.includes('--rotate-credentials'),
  };
  if (options.rotate && (options.reset || options.dryRun)) {
    throw new Error('--rotate-credentials cannot be combined with --reset or --dry-run');
  }
  return options;
}

module.exports = { generateDemoPassword, generateDeviceKey, parseSeedArgs };
