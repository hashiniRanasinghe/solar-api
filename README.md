# SLSEA Solar Generation API

Backend REST API for the Sri Lanka Sustainable Energy Authority (NB6007CEM CW1). Metering devices post generation readings for their own installation; SLSEA users read them inside their jurisdiction (national, provincial or district). Hierarchy: Province > District > Substation > Installation > Reading.

| | |
|---|---|
| Base path | `/solar/v1.0` (`/`, `/docs`, `/docs.json` sit outside it) |
| Maturity | Richardson Level 2 (resources, HTTP methods, headers and status codes; no hypermedia controls) |
| Live URL | *added at deployment* |
| Data as of | *added at deployment* |
| API docs | Swagger UI at `/docs`, OpenAPI 3.0.3 spec as JSON at `/docs.json` (source: `docs/openapi.yaml`) |
| Stack | Node 22, Express 5, Mongoose, MongoDB Atlas |

## Quick start (local)

**Requirements:** Node 22 LTS, at least 22.19. `package.json` asks for `>=22.19`, because the dev dependency `@apidevtools/swagger-parser` (used by the spec test) needs `>=22.19.0`. A MongoDB Atlas database.

```sh
npm ci
cp .env.example .env      # then fill in the values yourself; never commit .env
```

| Variable | Purpose | Required |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string; the database name in it selects the database (`slsea_local` for local work) | yes |
| `JWT_SECRET` | Signs and verifies the HS256 tokens. Must be at least 32 bytes (for example `openssl rand -hex 32`); the server refuses to start without it or with a shorter value. Use a different value in each environment | yes |
| `PORT` | Port to listen on (default `3000`; Azure sets it) | no |
| `APP_ENV` | Name returned by `GET /` as `environment` (default `local`) | no |

`dotenv` loads `.env` but never overrides variables already set in the environment.

**Seed the database** (`scripts/seed.js`): 9 provinces, 25 districts, 40 substations, 240 installations, 4 demo users, and one reading every 15 minutes for 7 days per installation (161,280 readings), ending at run time.

| Command | What it does |
|---|---|
| `node scripts/seed.js --dry-run` | Prints the target database name, planned counts and the readings window. Connects to nothing, writes nothing |
| `node scripts/seed.js` | Seeds empty collections; skips the hierarchy/users and the readings if they already hold data. Runs integrity checks. Writes demo passwords and device keys to the git-ignored `scripts/seed-keys.txt` (never printed) |
| `node scripts/seed.js --reset` | Deletes provinces, districts, substations, installations, users and readings, then reseeds. **Generates new demo passwords and device keys** and rewrites `scripts/seed-keys.txt` |
| `node scripts/seed.js --rotate-credentials` | Needs seeded data. New random passwords for every user and new device keys for every installation; rewrites `scripts/seed-keys.txt`; touches nothing else. Prints counts only. Cannot be combined with `--reset` or `--dry-run` |
| `node scripts/topup.js` | Appends 15-minute readings from each installation's newest reading up to now. Deletes nothing; safe to re-run |

Readings at night are 0 kW by design, so current power can be 0 outside daylight.

**Run and test**

| Command | What it does |
|---|---|
| `npm start` | `node src/server.js`; connects to the database, then listens on `PORT` |
| `npm run dev` | Same with `node --watch` (restarts on file changes) |
| `npm test` | `TZ=UTC node --test --test-concurrency=1` over `test/**/*.test.js`: one file at a time, in UTC like Azure |

Tests start the app in-process (no running server needed) and need `MONGODB_URI` and `JWT_SECRET`. Read tests use the seeded `slsea_local` and write nothing. `test/admin-crud.test.js` and `test/device-write.test.js` write only to `slsea_test` on the same cluster (they refuse any other database name) and empty it before and after. Tests mint their own tokens; they read no seeded password or key.

## Authentication

`POST /solar/v1.0/login` issues a JWT (HS256, 1 hour). Send it as `Authorization: Bearer <token>`. The body has exactly one of two forms:

| Caller | Body | Token scope |
|---|---|---|
| Reader (national, provincial or district) | `{"username": "...", "password": "..."}` | `solar:read` |
| Admin (national) | `{"username": "...", "password": "..."}` | `solar:read installations:write` |
| Device | `{"installation_id": "INS-0001", "device_key": "..."}` | `readings:write` (own installation only) |

Response: `200 {"access_token": "...", "token_type": "Bearer", "expires_in": 3600}`.

- 401 = no token, or a token or login that is not accepted (always with `WWW-Authenticate: Bearer realm="solar"`).
- 403 = valid token but refused: missing scope (40303, `error="insufficient_scope"`), outside the caller's jurisdiction (40301), or another installation (40302).
- A device token cannot read; a user token cannot post readings.

**Swagger UI:** open `/docs`, run `POST /login` with "Try it out", copy `access_token`, click **Authorize** and paste the token only (Swagger adds `Bearer`).

**curl** (local; secrets are read without echo and never placed on the command line):

```sh
BASE=http://localhost:3000/solar/v1.0

# User login
read -r -p 'username: ' U; read -rs -p 'password: ' P; echo
TOKEN=$(printf '{"username":"%s","password":"%s"}' "$U" "$P" \
  | curl -s -X POST "$BASE/login" -H 'Content-Type: application/json' --data @- \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
unset P
curl -s "$BASE/districts?limit=5" -H "Authorization: Bearer $TOKEN"

# Device login and one reading. The timestamp must be UTC on a 15-minute boundary
# and newer than the installation's newest reading, and energy_kwh (cumulative)
# not lower than it (see GET /installations/{id}/last-reading); otherwise 400 or 409.
read -r -p 'installation_id: ' I; read -rs -p 'device_key: ' K; echo
DTOKEN=$(printf '{"installation_id":"%s","device_key":"%s"}' "$I" "$K" \
  | curl -s -X POST "$BASE/login" -H 'Content-Type: application/json' --data @- \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
unset K
read -r -p 'timestamp (e.g. 2026-09-26T12:15:00Z): ' TS; read -r -p 'energy_kwh: ' E
curl -i -X POST "$BASE/installations/$I/readings" \
  -H "Authorization: Bearer $DTOKEN" -H 'Content-Type: application/json' \
  -d "{\"timestamp\":\"$TS\",\"power_kw\":2.5,\"energy_kwh\":$E,\"voltage\":230}"
```

## Demo accounts

| Username | Role | Jurisdiction |
|---|---|---|
| `national.admin` | admin | national |
| `national.reader` | reader | national |
| `western.reader` | reader | province `PV-01` (Western) |
| `colombo.reader` | reader | district `DT-01` (Colombo) |

Passwords and a demo device key are in the report appendix (not committed).

## Endpoints

All paths below are under `/solar/v1.0` unless marked. Full parameters, bodies, headers and error codes: `/docs`.

| Tag | Method | URI | Scope | Success |
|---|---|---|---|---|
| — | GET | `/` (outside `/solar/v1.0`) | none | 200 `{status, environment}` |
| — | GET | `/docs`, `/docs.json` (outside `/solar/v1.0`) | none | 301 to `/docs/` / 200 |
| Auth | POST | `/login` | none | 200 |
| Hierarchy | GET | `/provinces` | `solar:read` | 200, 304 |
| Hierarchy | GET | `/provinces/{province-id}` | `solar:read` | 200, 304 |
| Hierarchy | GET | `/districts` (`?province_id=`) | `solar:read` | 200, 304 |
| Hierarchy | GET | `/districts/{district-id}` | `solar:read` | 200, 304 |
| Hierarchy | GET | `/substations` (`?district_id=`, `?province_id=`) | `solar:read` | 200, 304 |
| Hierarchy | GET | `/substations/{substation-id}` | `solar:read` | 200, 304 |
| Installations | GET | `/installations` (`?province_id=`, `?district_id=`, `?substation_id=`) | `solar:read` | 200, 304 |
| Installations | POST | `/installations` | `installations:write` | 201 (body carries `device_key` once) |
| Installations | GET | `/installations/{installation-id}` (composite with `last_reading`) | `solar:read` | 200, 304 |
| Installations | PUT | `/installations/{installation-id}` | `installations:write` | 200 |
| Installations | DELETE | `/installations/{installation-id}` (refused while it has readings) | `installations:write` | 200 |
| Readings | GET | `/installations/{installation-id}/readings` | `solar:read` | 200, 304 |
| Readings | POST | `/installations/{installation-id}/readings` | `readings:write` | 201 |
| Readings | GET | `/installations/{installation-id}/readings/{reading-id}` | `solar:read` | 200, 304 |
| Readings | GET | `/substations/{substation-id}/readings` | `solar:read` | 200, 304 |
| Readings | GET | `/districts/{district-id}/readings` | `solar:read` | 200, 304 |
| Readings | GET | `/provinces/{province-id}/readings` | `solar:read` | 200, 304 |
| Operational | GET | `/installations/{installation-id}/last-reading` | `solar:read` | 200, 304 |
| Operational | GET | `/districts/{district-id}/generation-summary` | `solar:read` | 200 |

There is no global `/readings` and no `/devices`. Readings are append-only: PUT, PATCH and DELETE on them give 405.

## Behaviour summary

| Topic | Behaviour |
|---|---|
| Collections | `{count, next, previous, data}`; `next`/`previous` are relative links or `null`. Empty collection = 200 with empty `data`; missing member = 404 |
| Paging | `offset` (default 0), `limit` (1-100, default 20). An `offset` past the end gives 200 with empty `data` |
| Sorting | `sort=(field ASC\|DESC)`, several fields comma-separated. Readings: `timestamp` (default newest first, ties broken by `installation_id`). Installations: `installation_id`, `name`, `capacity_kw`. Hierarchy: its id and `name`. Unknown field = 400 |
| Filtering | Readings: `from`, `to` (inclusive, ISO 8601 UTC ending `Z`). Catalogue filters as in the endpoint table. A filter given twice = 400; unknown parameters are ignored |
| Errors | One body everywhere: `{code, message, description, moreInfo, error[]}`; `code` = HTTP status x 100 + n (for example 40001). Code table: `/docs` (spec description) and `docs/design/my-decisions.md` §12 |
| Conditional GET | Strong ETag on every GET; `If-None-Match` (or `If-Modified-Since` where `Last-Modified` is sent) gives 304 with an empty body. Protected reads send `Cache-Control: private, no-cache` and `Vary: Authorization` |
| Writes | 201 carries `Location`, `ETag`, `Last-Modified` (and `Content-Location` on readings). Optional `If-Match` on installation PUT/DELETE; stale = 412 |
| 405 / 406 / 415 | Unsupported method on a known URI = 405 with `Allow`; `Accept` without `application/json` = 406; write body not `application/json` = 415 |
| Jurisdiction | National sees all; provincial its province and below; district its district and below. Collections are narrowed to the caller's scope. Province and district users get 403 before 404, so they cannot learn whether an id outside their jurisdiction exists |

## Project structure

| Path | Role |
|---|---|
| `src/server.js` | Checks `JWT_SECRET`, connects to the database, listens on `PORT` |
| `src/app.js` | Express app: CORS, JSON body parser, `GET /`, docs, `/solar/v1.0` router, 404, error handler |
| `src/routes/` | URI + method to middleware and controller; 405 guards |
| `src/middleware/` | Cross-cutting checks: 406, 415, bearer token, scope, own installation, cache headers, errors |
| `src/controllers/` | HTTP in and out; thin |
| `src/services/` | Rules: jurisdiction scope, query parsing, readings, summary, login |
| `src/repositories/` | The only code that queries MongoDB |
| `src/models/` | Mongoose schemas and indexes |
| `src/utils/` | Errors, pagination, links, sort, time window, ETag/If-Match helpers |
| `src/config/` | Environment variables and database connection |
| `scripts/` | Seed, top-up and their helpers (`scripts/lib/`) |
| `test/` | `node --test` suites |
| `docs/openapi.yaml` | The OpenAPI spec served at `/docs` |
| `docs/design/` | `my-decisions.md` (design decisions), `data-model.md` (data model), `diagrams/` (12 Mermaid sources; index in `PLAN.md` §18) |
| `docs/evidence/` | Evidence for the report |
| `ai-log.md` | AI usage log; the source of the AI-disclosure appendix |

## Known limitations

From `docs/design/my-decisions.md` §16:

- Deployment risk is concentrated in the last week (mitigated by the zero-cost validation, the production-mode rehearsals and the smoke deploy).
- No correction of a wrong reading.
- No key rotation through the API; an operator can rotate all demo passwords and device keys at once with `scripts/seed.js --rotate-credentials`.
- No rate limiting.
- The Azure credit is finite (delete the plan after marking).
- No old-version redirect.
- No country-wide readings list.
- One national admin role only.
- A wrong device clock can store odd timestamps.
- The DELETE readings check is not atomic.
- Installation ids stop at INS-9999.
- Moving an installation to another substation (PUT) moves its whole reading history to the new district's and province's views, because readings carry only installation_id.
- Demo passwords from before 2026-09-26 remain in git history (commit 1d622b5); they were rotated and no longer work.
- No token revocation: rotating passwords or keys does not cancel tokens already issued; they stay valid until their 1-hour expiry.

## Deployment

**Status: pending (planned 1 Oct).** Azure App Service (Linux, Node 22 LTS), deployed by one GitHub Actions workflow on push to `deployment_dev`, database `slsea_dev`. App settings (names only): `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `APP_ENV`; Azure sets `PORT`. Start: `npm ci --omit=dev && npm start`. The `docs/` folder must be in the deploy package (the spec is read at start-up).

Branches: `dev_hashini` (work) → merge request → `dev` (default branch) → release merge request → `deployment_dev` (deploys).
