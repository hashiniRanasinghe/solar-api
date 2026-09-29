// Login and bearer-token checks. Read-only: the only database access is the
// user lookup for an unknown username. Login success uses a mocked user whose
// bcrypt hash is made here from a test-only password; no seeded password is used.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MONGODB_URI, JWT_SECRET } = require('../src/config/env');
const usersRepository = require('../src/repositories/users');
const { mintToken, nationalToken, deviceToken } = require('./helpers/auth');

const API = '/solar/v1.0';
const CHALLENGE = 'Bearer realm="solar"';
const INVALID_TOKEN_CHALLENGE = 'Bearer realm="solar", error="invalid_token"';
const TEST_PASSWORD = 'test-only-password';

let server;

before(async () => {
  assert.ok(MONGODB_URI, 'MONGODB_URI must be set to run the auth tests');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

function request({ method = 'GET', path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, raw: data, body: JSON.parse(data) });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function getWithAuth(path, authorization) {
  return request({ path, headers: authorization === undefined ? {} : { Authorization: authorization } });
}

function login(credentials) {
  return request({
    method: 'POST',
    path: `${API}/login`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

function assertErrorBody(body, status, code) {
  assert.equal(body.code, code);
  assert.equal(Math.floor(body.code / 100), status);
  assert.equal(typeof body.message, 'string');
  assert.equal(typeof body.description, 'string');
  assert.equal(body.moreInfo, '/docs');
  assert.ok(Array.isArray(body.error));
}

function mockUser(t, { role = 'reader', level = 'national', jurisdictionId } = {}) {
  const user = {
    username: 'mock.user',
    password_hash: bcrypt.hashSync(TEST_PASSWORD, 4),
    role,
    jurisdiction_level: level,
    jurisdiction_id: jurisdictionId,
  };
  return t.mock.method(usersRepository, 'findByUsername', async () => user);
}

test('GET / stays open', async () => {
  const res = await getWithAuth('/');
  assert.equal(res.statusCode, 200);
});

test('no bearer token gives 401/40101 with WWW-Authenticate and no error attribute', async () => {
  for (const authorization of [undefined, 'Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ']) {
    for (const path of [`${API}/provinces`, `${API}/installations/INS-0001/readings`]) {
      const res = await getWithAuth(path, authorization);
      assert.equal(res.statusCode, 401, `${authorization} ${path}`);
      assertErrorBody(res.body, 401, 40101);
      assert.equal(res.headers['www-authenticate'], CHALLENGE);
    }
  }
});

test('malformed, wrongly signed, unsigned, expired or badly claimed tokens give 401/40102 invalid_token', async () => {
  const unsigned = [
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: 'x', role: 'reader', jurisdiction_level: 'national', scope: 'solar:read' })
    ).toString('base64url'),
    '',
  ].join('.');
  const tokens = {
    malformed: 'abc.def',
    otherSecret: jwt.sign({ role: 'reader', jurisdiction_level: 'national', scope: 'solar:read' }, 'another-secret', {
      subject: 'x',
    }),
    unsigned,
    expired: mintToken({}, { expiresIn: -60 }),
    badLevel: mintToken({ jurisdiction_level: 'galaxy' }),
    districtWithoutId: mintToken({ jurisdiction_level: 'district', jurisdiction_id: null }),
    deviceBadSub: deviceToken('mock.user'),
    deviceWrongScope: jwt.sign({ role: 'device', scope: 'solar:read' }, JWT_SECRET, { subject: 'INS-0001' }),
    expiredDevice: deviceToken('INS-0001', { expiresIn: -60 }),
  };
  for (const [name, token] of Object.entries(tokens)) {
    const res = await getWithAuth(`${API}/provinces`, `Bearer ${token}`);
    assert.equal(res.statusCode, 401, name);
    assertErrorBody(res.body, 401, 40102);
    assert.equal(res.headers['www-authenticate'], INVALID_TOKEN_CHALLENGE, name);
  }
});

function signByHand(payload) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsignedToken = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
}

test('a correctly signed token without exp, or with a non-number exp, gives 401/40102', async () => {
  const userClaims = { role: 'reader', jurisdiction_level: 'national', scope: 'solar:read' };
  const tokens = {
    userNoExp: jwt.sign(userClaims, JWT_SECRET, { algorithm: 'HS256', subject: 'x' }),
    deviceNoExp: jwt.sign({ role: 'device', scope: 'readings:write' }, JWT_SECRET, {
      algorithm: 'HS256',
      subject: 'INS-0001',
    }),
    // jwt.sign refuses a string exp, so this one is signed by hand (HS256).
    stringExp: signByHand({ ...userClaims, sub: 'x', exp: String(Math.floor(Date.now() / 1000) + 3600) }),
  };
  for (const [name, token] of Object.entries(tokens)) {
    assert.notEqual(typeof jwt.decode(token).exp, 'number', name);
    const res = await getWithAuth(`${API}/provinces`, `Bearer ${token}`);
    assert.equal(res.statusCode, 401, name);
    assertErrorBody(res.body, 401, 40102);
    assert.equal(res.headers['www-authenticate'], INVALID_TOKEN_CHALLENGE, name);
  }
});

test('login with missing or non-string fields gives 400/40010 with per-field items', async () => {
  const cases = [
    [{ username: 'a' }, [40012]],
    [{ password: 'a' }, [40011]],
    [{ username: 5, password: 'a' }, [40011]],
    [{ username: 'a', password: { $ne: '' } }, [40012]],
    [{ username: '', password: '' }, [40011, 40012]],
    [{ installation_id: 'INS-0001' }, [40021]],
    [{ device_key: 'x' }, [40020]],
    [{ installation_id: 7, device_key: '' }, [40020, 40021]],
    [{ installation_id: 'INS-0001', device_key: { $ne: '' } }, [40021]],
    [{}, [40022]],
    [[], [40022]],
    [{ username: 'a', password: 'b', installation_id: 'INS-0001', device_key: 'x' }, [40022]],
    [{ username: 'a', device_key: 'x' }, [40022]],
  ];
  for (const [credentials, codes] of cases) {
    const res = await login(credentials);
    assert.equal(res.statusCode, 400, JSON.stringify(credentials));
    assertErrorBody(res.body, 400, 40010);
    assert.deepEqual(res.body.error.map((e) => e.code).sort(), codes);
  }

  const emptyJson = await request({
    method: 'POST',
    path: `${API}/login`,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(emptyJson.statusCode, 400);
  assertErrorBody(emptyJson.body, 400, 40010);
  assert.deepEqual(emptyJson.body.error.map((e) => e.code), [40022]);
});

test('login without a JSON Content-Type gives 415/41501, after 405 and 406 and before 400/401', async () => {
  const credentials = 'username=a&password=b';
  for (const headers of [{}, { 'Content-Type': 'text/plain' }, { 'Content-Type': 'application/x-www-form-urlencoded' }]) {
    const res = await request({ method: 'POST', path: `${API}/login`, headers, body: credentials });
    assert.equal(res.statusCode, 415, JSON.stringify(headers));
    assertErrorBody(res.body, 415, 41501);
  }

  const withCharset = await request({
    method: 'POST',
    path: `${API}/login`,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: '{}',
  });
  assert.equal(withCharset.statusCode, 400);
  assertErrorBody(withCharset.body, 400, 40010);

  const notAcceptable = await request({
    method: 'POST',
    path: `${API}/login`,
    headers: { 'Content-Type': 'text/plain', Accept: 'text/html' },
    body: credentials,
  });
  assert.equal(notAcceptable.statusCode, 406);
  assertErrorBody(notAcceptable.body, 406, 40601);

  const notAllowed = await request({ method: 'PUT', path: `${API}/login`, headers: { 'Content-Type': 'text/plain', Accept: 'text/html' } });
  assert.equal(notAllowed.statusCode, 405);
  assert.equal(notAllowed.headers.allow, 'POST');
});

test('unknown user and wrong password give the same 401/40103 body', async (t) => {
  const unknown = await login({ username: 'no.such.user.for.tests', password: 'whatever' });

  mockUser(t);
  const wrongPassword = await login({ username: 'mock.user', password: 'not-the-password' });

  for (const res of [unknown, wrongPassword]) {
    assert.equal(res.statusCode, 401);
    assertErrorBody(res.body, 401, 40103);
    assert.equal(res.headers['www-authenticate'], CHALLENGE);
  }
  assert.equal(unknown.raw, wrongPassword.raw);
});

test('login success returns a bearer token that works on GET /provinces', async (t) => {
  const mock = mockUser(t, { level: 'district', jurisdictionId: 'DT-01' });
  const res = await login({ username: 'mock.user', password: TEST_PASSWORD });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['access_token', 'expires_in', 'token_type']);
  assert.equal(res.body.token_type, 'Bearer');
  assert.equal(res.body.expires_in, 3600);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(mock.mock.callCount(), 1);
  assert.ok(!res.raw.includes('password'));

  const claims = jwt.decode(res.body.access_token, { complete: true });
  assert.equal(claims.header.alg, 'HS256');
  assert.deepEqual(Object.keys(claims.payload).sort(), [
    'exp',
    'iat',
    'jurisdiction_id',
    'jurisdiction_level',
    'role',
    'scope',
    'sub',
  ]);
  assert.equal(claims.payload.sub, 'mock.user');
  assert.equal(claims.payload.scope, 'solar:read');
  assert.equal(claims.payload.jurisdiction_id, 'DT-01');
  assert.equal(claims.payload.exp - claims.payload.iat, 3600);

  const provinces = await getWithAuth(`${API}/provinces`, `Bearer ${res.body.access_token}`);
  assert.equal(provinces.statusCode, 200);
});

test('an admin token carries solar:read installations:write', async (t) => {
  mockUser(t, { role: 'admin' });
  const res = await login({ username: 'mock.user', password: TEST_PASSWORD });
  assert.equal(res.statusCode, 200);
  const claims = jwt.decode(res.body.access_token);
  assert.equal(claims.scope, 'solar:read installations:write');
  assert.equal(claims.jurisdiction_id, null);
});

test('an authenticated request to an unknown route still gives 404/40401', async () => {
  const res = await getWithAuth(`${API}/no-such-route`, `Bearer ${nationalToken()}`);
  assert.equal(res.statusCode, 404);
  assertErrorBody(res.body, 404, 40401);
});
