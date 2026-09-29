// Start-up refuses a JWT_SECRET shorter than 32 bytes. The server runs in a
// child process in a temporary directory, so dotenv finds no .env there and
// only the dummy value below is seen. MONGODB_URI is left unset; its own
// check also exits 1, so the test asserts on the JWT_SECRET message.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '..', 'src', 'server.js');
const MESSAGE = 'Start-up failed: JWT_SECRET must be set and at least 32 bytes';

function start(jwtSecret) {
  const env = { PATH: process.env.PATH, PORT: '0' };
  if (jwtSecret !== undefined) env.JWT_SECRET = jwtSecret;
  return spawnSync(process.execPath, [SERVER], { cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 10000 });
}

test('a JWT_SECRET shorter than 32 bytes stops start-up without printing the value', () => {
  const dummy = 'dummy-secret-31-bytes-long-abcd';
  assert.equal(Buffer.byteLength(dummy), 31);

  const result = start(dummy);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(MESSAGE), result.stderr);
  assert.ok(!result.stderr.includes(dummy));
  assert.ok(!result.stdout.includes(dummy));
});

test('a missing JWT_SECRET stops start-up with the same message', () => {
  const result = start(undefined);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(MESSAGE), result.stderr);
});
