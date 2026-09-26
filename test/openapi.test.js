// The OpenAPI surface: the spec is valid, served without a token, and matches
// the routes. No database: every request here is refused (401, 400, 415) or
// served before any query runs.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const SwaggerParser = require('@apidevtools/swagger-parser');
const app = require('../src/app');
const { spec } = require('../src/routes/docs');
const { AppError, FIELD_ERROR } = require('../src/utils/errors');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BASE = spec.servers[0].url;

let server;

before(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function request({ method = 'GET', path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, raw: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// A concrete URL for a documented path: each {name} replaced by the example
// of its path parameter.
function concretePath(template) {
  const pathItem = spec.paths[template];
  const examples = {};
  for (const ref of pathItem.parameters || []) {
    const param = spec.components.parameters[ref.$ref.split('/').pop()];
    examples[param.name] = param.schema.example;
  }
  return BASE + template.replace(/\{([^}]+)\}/g, (_, name) => {
    assert.ok(examples[name], `no example for path parameter ${name} in ${template}`);
    return examples[name];
  });
}

function documentedMethods(template) {
  return METHODS.filter((method) => spec.paths[template][method.toLowerCase()]);
}

test('the spec is a valid OpenAPI 3.0 document', async () => {
  assert.equal(spec.openapi, '3.0.3');
  await SwaggerParser.validate(structuredClone(spec));
});

test('servers is the relative base path, so the same spec works locally and on Azure', () => {
  assert.deepEqual(spec.servers, [{ url: '/solar/v1.0' }]);
});

test('GET /docs serves Swagger UI and GET /docs.json the spec, both without a token', async () => {
  const redirect = await request({ path: '/docs' });
  assert.equal(redirect.statusCode, 301);
  assert.equal(redirect.headers.location, '/docs/');

  const ui = await request({ path: '/docs/' });
  assert.equal(ui.statusCode, 200);
  assert.match(ui.headers['content-type'], /^text\/html/);
  assert.match(ui.raw, /swagger-ui/);

  const json = await request({ path: '/docs.json' });
  assert.equal(json.statusCode, 200);
  assert.match(json.headers['content-type'], /^application\/json/);
  assert.deepEqual(JSON.parse(json.raw), spec);
});

test('GET / still works', async () => {
  const res = await request({ path: '/' });
  assert.equal(res.statusCode, 200);
});

test('every documented operation exists: no token gives neither 404 nor 405', async () => {
  for (const template of Object.keys(spec.paths)) {
    const path = concretePath(template);
    for (const method of documentedMethods(template)) {
      const res = await request({ method, path });
      assert.ok(![404, 405].includes(res.statusCode), `${method} ${path} gave ${res.statusCode}`);
    }
  }
});

test('every protected operation states its scope and lists 401 and 403', () => {
  for (const [template, pathItem] of Object.entries(spec.paths)) {
    for (const method of documentedMethods(template)) {
      const operation = pathItem[method.toLowerCase()];
      if (template === '/login') {
        assert.deepEqual(operation.security, []);
        continue;
      }
      const scope = operation['x-required-scope'];
      assert.ok(['solar:read', 'readings:write', 'installations:write'].includes(scope), `${method} ${template}`);
      assert.ok(operation.description.includes(`\`${scope}\``), `${method} ${template} description`);
      assert.ok(operation.responses['401'] && operation.responses['403'], `${method} ${template} 401/403`);
    }
  }
});

test('every undocumented method gives 405 with Allow listing exactly the documented methods', async () => {
  for (const template of Object.keys(spec.paths)) {
    const path = concretePath(template);
    const documented = documentedMethods(template);
    for (const method of METHODS.filter((m) => !documented.includes(m))) {
      const res = await request({ method, path });
      assert.equal(res.statusCode, 405, `${method} ${path}`);
      assert.equal(JSON.parse(res.raw).code, 40501);
      const allow = res.headers.allow.split(',').map((m) => m.trim()).sort();
      assert.deepEqual(allow, [...documented].sort(), `Allow on ${path}`);
    }
  }
});

// Every code the code can produce: each AppError factory (called with a
// placeholder argument) and every per-field item code.
function codesInUse() {
  const factories = Object.getOwnPropertyNames(AppError).filter(
    (name) => typeof AppError[name] === 'function' && !['length', 'name', 'prototype'].includes(name)
  );
  const codes = factories.map((name) => AppError[name]('x').code);
  return [...new Set([...codes, ...Object.values(FIELD_ERROR)])].sort();
}

test('every error code in src/utils/errors.js is in the spec description', () => {
  const codes = codesInUse();
  assert.ok(codes.length > 40);
  for (const code of codes) {
    assert.ok(spec.info.description.includes(`| ${code} |`), `code ${code} missing from info.description`);
  }
});

test('the spec holds no demo credentials', () => {
  const text = JSON.stringify(spec);
  assert.doesNotMatch(text, /national\.admin|national\.reader|western\.reader|colombo\.reader/);
  assert.doesNotMatch(text, /[0-9a-f]{64}/);
});
