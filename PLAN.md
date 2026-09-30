# PLAN.md — NB6007CEM Coursework 1 (SLSEA Solar Generation API)

> **Status (2026-09-29, rev 15):** Phases 0–7 are built and tested locally: 142 tests in 13 suites pass (`npm test`), merged into `dev` (merge commit `f77d772`). Stretch A8 (district generation summary) is built. Phase 8 security review, fixes and audit done 27 Sep (commit `477d7d6`); production-mode rehearsal passed 27 Sep; deploy workflow merged into `dev` 27 Sep. **Deployed 29 Sep** to Azure web app `solar-api-dev-hr` (Free F1) by release PR #8 and Actions run #1 (commit `c30ad47`); `slsea_dev` seeded; live checks passed (`docs/evidence/azure-deploy-2026-09-29.md`). The Mon 28 Sep smoke deploy did not happen; this app is kept as the submitted app. Code freeze done 27 Sep (tag `p8` on `dev`, `050be73`). Not done yet: the rest of Phase 8 (explain-back), scale F1 → B1, the final release (1 Oct), the report and the viva. Development is **local-first**: Azure hosts only the one deployed app.
> **Truth order:** brief PDF → module white paper (REST API Design Guidelines, WSO2-based) → lecture notes S1–S8 → this file. A higher source always wins over this file.
> **Attempt status `[YOU]`:** fresh submission — no earlier submission and no marker feedback. Brief §14 ("make good the original submission") does not apply.

**Tags**

| Tag | Meaning |
|---|---|
| `[BRIEF §n]` | Stated in the coursework brief |
| `[WP §n]` | Stated in the white paper (WSO2 REST API Design Guidelines) |
| `[LEC Sn]` | Stated in lecture notes/slides of session n |
| `[YOU]` | My own fixed decision (recorded in `docs/design/my-decisions.md`) |
| `[PROPOSAL]` | A suggestion. Becomes `[YOU]` only when I confirm it in `docs/design/my-decisions.md` |
| `[UNCONFIRMED]` | A rule I cannot see (the lecturer's S9–S15 choices). Not treated as fact |

---

## 0. Sources

| Source | Status |
|---|---|
| Brief (9 pp) | Read in full |
| Marking rubric | Final rubric `NB6007CEM_Marking_Rubric.pdf` (NB6007CEM, last modified 25 Aug 2026): current and authoritative; weights match brief §11. The older `outdated_use_as_a_ref.pdf` (NIB304CEM, batch 24.1P) is supplementary only (§17) |
| White paper | Read in full; cited as `[WP §n]` |
| Lectures S1, S2, S5–S8 | Read (project files) |
| Lectures S3, S4 | Read from the lecturer repo `dev`; not in the project files |
| Lectures S9–S15 | Not available anywhere. The white paper covers the rules; only the lecturer's own interpretation is missing |
| Reference repos (lecturer, two classmates) | Understanding only. Traps seen and avoided: base path `/v1/api/` (not WP §5.4 form), a global `/pings` collection (the phantom-collection trap in `[LEC S3/S4]`), an error body of `{error}` only, a hard-coded fallback secret. **No code copied** |

Where a lecture note and the white paper disagree, the white paper is the design authority (brief cover) — see §4a.

---

## 1. Goal and gates

| Hard gate `[BRIEF §12]` | Status |
|---|---|
| Public HTTPS API on Azure App Service, seeded, operational at submission time | [ ] deployed 29 Sep; must be operational at submission time |
| Live OpenAPI/Swagger from the deployment (`/docs`) | local done (`docs/openapi.yaml`, `test/openapi.test.js`); live `/docs` screenshot in `docs/evidence/live/swagger/` (29 Sep) |
| Repo shared with the module leader as collaborator; incremental commits | [ ] `nirangadh` accepted the invitation 27 Sep |
| Report 2250–2750 words with the six required sections | [ ] |
| Signed declaration + AI-disclosure appendix (from `ai-log.md`) | [ ] |
| Viva: any artefact I cannot explain forfeits its marks | [ ] |

Report prose is **my own**. Turnitin similarity < 15% and AI score < 15% are screening thresholds, not allowances `[BRIEF announcement sheet]`.

---

## 2. Requirements checklist (from the brief)

"Done (local)" means built and covered by the named tests; it becomes fully done only when it works on the deployed URL.

| ID | Requirement | Source | Rubric area | Status · evidence |
|---|---|---|---|---|
| G1 | Public HTTPS API on Azure App Service, populated with seed data and operational at submission time (one GitHub Actions workflow) | §7.1, §12, §13 | Deployment | [ ] deployed 29 Sep · `docs/evidence/azure-deploy-2026-09-29.md` |
| G2 | Live OpenAPI (Swagger) surface served from the deployment | §7.2 | Deployment / API design | done (local) · `test/openapi.test.js` |
| G3 | Git repo shared with the module leader; incremental commit history | §7.3, §12, §13 | Deployment | history yes; collaborator accepted 27 Sep |
| G4 | Report 2250–2750 words, 6 identifiable sections | §8, §12 | Report | [ ] |
| G5 | Signed declaration + AI-disclosure appendix | §7.4, §10 | Gate | [ ] |
| G6 | Viva attended; every artefact explainable | §9, §10 | Gate | [ ] |
| G7 | Backend only; JSON for all resources | §5, §13 | API design | done (local) |
| M1 | Entities: Province, District, Substation, Installation, GenerationReading, User; 1-to-many chain | §3 | Architecture | done · `src/models/`, `data-model.md` |
| M2 | `meter_id` is an installation attribute. **No Device entity** | §3 | Architecture | done |
| M3 | Readings are an append-only time series, not `last_power` on installation | §3 | Architecture | done · 405 on PUT/PATCH/DELETE (`device-write.test.js`) |
| M4 | Reading has installation, timestamp, power (kW), **cumulative** energy (kWh), voltage; extra fields justified | §3 | Architecture | done |
| M5 | Seed: 9 provinces, 25 districts, ≥20 substations, ≥200 installations, ≥1 week readings per installation, FK-consistent | §4 | Functionality | done · 9/25/40/240, 161,280 readings; seed integrity check PASS |
| M6 | Data model documented before resources/URIs | App. A (§3) | Architecture | done · `docs/design/data-model.md` (21 Sep, before the routes) |
| A1 | Collection + atomic: provinces, districts, substations, installations | §5 | API design | done · `hierarchy.test.js` |
| A2 | Installation **composite** (installation + `last_reading`) | §5 | API design | done · `installations.test.js` |
| A3 | **Last-known-reading** per installation, as a derived resource | §5, §6 | API design | done · `installations.test.js` |
| A4 | **Readings sub-collection** under each installation (plus under substation/district/province, OQ-04) | §5, §6 | API design | done · `installations.test.js`, `jurisdiction-readings.test.js` |
| A5 | URI naming/scoping, JSON, headers Location/ETag/Last-Modified/Content-Type, codes 200/201/400/404/406/412 | App. A | API design | done · `conditional-get.test.js`, `device-write.test.js`, `admin-crud.test.js` |
| A6 | Ingestion: correct method, 201, `Location` | §5 | API design | done · `device-write.test.js` |
| A7 | Correct CRUD + idempotency on writable resources: readings = create only (device); installations = POST/PUT/DELETE (admin) | §5 | API design | done · `admin-crud.test.js` |
| A8 | **Stretch:** district generation summary (current total power, today's total energy) | §5, §6 | Coverage (First band) | done · `generation-summary.test.js` |
| V1 | Pagination: total count + next/previous links | §5 | Coverage | done · `hierarchy.test.js` |
| V2 | Filtering: jurisdiction and time window | §5, §6 | Coverage | done · `jurisdiction-readings.test.js`, `installations.test.js` |
| V3 | Sorting by timestamp asc/desc | §5 | Coverage | done · `installations.test.js`, `jurisdiction-readings.test.js` |
| V4 | Conditional GET → 304, empty body | §5, App. A | Coverage | done · `conditional-get.test.js` |
| V5 | One consistent error schema | §5, App. A; `[WP §11]` | Coverage | done · `errors.test.js` |
| S1 | Device authenticates as its installation; writes only that installation's readings | §2, §5 | Security | done · `device-write.test.js`, `auth.test.js` |
| S2 | Read scope by jurisdiction; a district user cannot read another district | §2, §5 | Security | done · `scope.test.js` |
| S3 | Users never write readings | §2 | Security | done · 403 (40303) · `device-write.test.js`, `admin-crud.test.js` |
| S4 | 401 vs 403 used correctly; `WWW-Authenticate` on 401 | `[LEC S7, S8]` | Security | done · `auth.test.js`, `scope.test.js` |
| R1–R6 | Report sections: Architecture & data model · API design · Security · Deployment · Richardson (incl. why not L3) · Critical evaluation | §8 | Report | [ ] |

**Rubric weights (brief §11):** API design 20 · Architecture 15 · Coverage 15 · Security 15 · Implementation with generated code 10 · Deployment 10 · Report 10 · Functionality 5 = 100. "Coverage" means design-spine breadth and advanced behaviour (V1–V5, A8), **not test coverage**. The final rubric's Coverage First band expects the generation summary; its eligibility gate requires the API deployed and operational against seed data at submission.

---

## 3. Fixed facts

| Fact | Tag |
|---|---|
| Richardson Level 2 (L3 out of scope) | `[YOU]` `[BRIEF cover]` |
| Hierarchy Province → District → Substation → Installation → Reading, plus User | `[YOU]` `[BRIEF §3]` |
| No Device entity; `meter_id` is an installation attribute | `[YOU]` `[BRIEF §3]` |
| Readings append-only: no PUT/PATCH/DELETE on readings (405) | `[YOU]` `[LEC S7]` |
| Devices write only their own installation: device JWT from `POST /login` (`installation_id` + `device_key`), scope `readings:write` (replaced X-API-Key on 2026-09-26) | `[YOU]` `[BRIEF §2]` `[WP §12.1, §12.2]`, final rubric Security |
| Users read by jurisdiction: JWT Bearer with scope `solar:read` and jurisdiction claims | `[YOU]` |
| Scopes enforced on every route: reader `solar:read`; admin `solar:read installations:write`; device `readings:write` | `[YOU]` `[WP §12.2]` |
| JSON field names snake_case; URI segments lowercase with hyphens, plural collections | `[YOU]` `[WP §5.1]` |
| Readings only as scoped collections; **no global `/readings`**, no `/devices` | `[WP §4.6, §5.6]` |
| **Readings by jurisdiction:** GET-only collections under `/substations/{id}`, `/districts/{id}`, `/provinces/{id}` plus under installations; path = which parent, query = how to read it | `[YOU]` (OQ-04) |
| **Writable:** readings (POST, device only) and installations (POST/PUT/DELETE, admin only; the only seeded admin is national, and the code limits any admin to its own subtree). **Read-only:** hierarchy, users, derived resources | `[YOU]` (OQ-03) |
| Noun sub-resources for derived resources (`last-reading`, `generation-summary`) | `[YOU]` (OQ-21) |
| Hierarchy top-level with query filters; `/substations`; string ids (`INS-0001`); Mongo `_id` hidden; Mongoose | `[YOU]` (OQ-05, 06, 07, 19) |
| `energy_kwh` is a **cumulative** running total | `[BRIEF §3]` |
| `district_id`/`province_id` derived from `substation_id`, stored read-only, never client-supplied | `[YOU]` |
| Seed: 9 / 25 / 40 / 240, 15-minute readings for 7 days (161,280), ending at run time; top-up script keeps it current | `[YOU]` |
| **No timestamp tolerance / future-time rule** | `[YOU]` |
| Base path `/solar/v1.0`; `/`, `/docs`, `/docs.json` outside it | `[YOU]` `[WP §5.4–5.5]` (OQ-22) |
| `POST /login` issues tokens (processing function, 200 + token) | `[YOU]` `[WP §5.1, §7.3]` (OQ-11) |
| Sort syntax `sort=(timestamp DESC)` / `sort=(a ASC, b DESC)` | `[YOU]` `[WP §10.2]` (OQ-23) |
| Stack: Node ≥ 22.19, Express 5, Mongoose 8, MongoDB Atlas M0, Azure App Service (Linux, Node 22 LTS), Swagger UI | `[YOU]` |
| **Local-first:** all development and tests on the Mac against Atlas `slsea_local`; Azure hosts only the deployed app (`solar-api-dev-hr`, deployed 29 Sep, kept as the submitted app) | `[YOU]` (2026-09-20, 2026-09-29) |
| Branches `dev_hashini` → `dev` (default) → `deployment_dev` (deploy branch); `deployment_qa` a marker, never deployed; `main` never touched | `[YOU]` (OQ-30) |
| Deployment by **one GitHub Actions workflow** on push to `deployment_dev`; deployed database `slsea_dev` | `[YOU]` (OQ-31, OQ-35) |
| Deadline **Sun 4 Oct 2026** | `[YOU]` (OQ-17) |
| No `localhost` in the spec or the report | `[YOU]` |

---

## 4. Defaults checked against the white paper

| Item | Result | Detail |
|---|---|---|
| Pagination | Confirmed `[WP §10.3]` | `offset` + `limit`; response carries `count`, `next`, `previous`. The `data` key is my choice (envelope is "application specific") |
| Sort syntax | Changed `[WP §10.2]` | WP form `sort=(price ASC, delivery-date DESC)`; `-field` is not in the WP (OQ-23) |
| Filter | Confirmed `[WP §10.2, §7.1]` | attribute=value on the collection. Projection optional; not built |
| Error body | Changed `[WP §11]` | integer `code` (required), `message` (required), `description`, `moreInfo`, `error[]` per field |
| DELETE | Confirmed `[WP §7.4]` | 200 first call, 404 afterwards; not 204 |
| 201 response | Extended `[WP §7.3, §9]` | `Location` + `ETag` + `Last-Modified` + body, plus `Content-Location` when the body is the resource |
| 401 vs 403 | Clarified `[WP §9]` | 401 = credentials missing or not accepted, with `WWW-Authenticate`. 403 = understood but refused (another installation, outside jurisdiction, missing scope) |
| 406 / 415 | Confirmed `[WP §10.1, §9]` | A different `Accept` gets 406 even with one media type; wrong request `Content-Type` gets 415 |
| Conditional GET | Confirmed `[WP §10.4]` | `If-None-Match` takes precedence over `If-Modified-Since`; unchanged → 304, empty body |
| Concurrency | Confirmed `[WP §10.5]` | `If-Match` on PUT/DELETE; stale → 412 |
| PUT / PATCH | Confirmed `[WP §7.2, §4.5]` | PUT is whole-document; no PATCH |
| Base path + version | New `[WP §5.4, §5.5]` | `/{feature-code}/v{major}.{minor}/…` → `/solar/v1.0` (OQ-22) |
| Processing-function naming | Conflict, decided `[YOU]`: lecture form | WP: verb names, not sub-resources. Lecture: noun sub-resource (OQ-21) |
| Bearer + scopes | Confirmed `[WP §12.2]` | Token carries scopes; insufficient scope → the request fails (403) |
| Richardson level | Note `[WP §1]` | §1 says "Level 1" but lists Level 2 features, and §2 says "Level 2". The white paper is inconsistent on this point |

### 4a. Where lecture notes and the white paper disagree

| Topic | Lecture says | White paper says | Followed |
|---|---|---|---|
| Processing-function URI | noun sub-resource (`/vehicles/{id}/last-position`) `[LEC S5/S6]` | verb, top-level `[WP §5.1]` | Lecture form, deviation recorded (OQ-21) |
| Verbs in URIs | only controllers `[LEC S5]` | processing functions and controllers `[WP §5.1]` | WP (`/login`) |
| Wrong device credential | 401 in S7, 403 in S8 | 401 = not accepted; 403 = understood but refused `[WP §9]` | Bad key or token 401; token for another installation 403 |
| Error body | `{error}` then `code, message, moreInfo` `[LEC S8]` | integer `code`, `message`, `description`, `moreInfo`, `error[]` `[WP §11]` | WP |
| Envelope | none until S9 `[LEC S5]` | count/next/previous, shape app-specific `[WP §10.3]` | WP + brief |

---

## 5. Technology / stack

| Area | Choice | Note |
|---|---|---|
| Runtime | Node ≥ 22.19 (`engines`); Node 22 LTS on Azure | The dev dependency `@apidevtools/swagger-parser` needs ≥ 22.19 |
| Framework | Express 5 (OQ-34) | Rejected async handlers reach the error handler; no async wrapper |
| Database | MongoDB Atlas M0, Mongoose 8 (OQ-19) | Persistence needed because POST readings must survive restarts |
| Auth | `jsonwebtoken` (HS256, 1 hour), `bcryptjs` for passwords, SHA-256 + `timingSafeEqual` for device keys | Random high-entropy device keys do not need bcrypt |
| Docs | `swagger-ui-express` + `yaml`; hand-written `docs/openapi.yaml` (OpenAPI 3.0.3), single source | Swagger UI assets from the package (no CDN); `swagger-ui-dist` telemetry off |
| Hosting | Azure App Service, Linux, Node 22 LTS, India South Central (OQ-33); web app `solar-api-dev-hr` on Free F1 since 29 Sep, scaled to Basic B1 before submission; paid from the Azure for Students credit, no card | Deployed by one GitHub Actions workflow (OQ-31) with the publish profile (OQ-32, closed 29 Sep) |
| Tests | Node built-in `node --test`; the app runs in-process (no `BASE_URL`); `TZ=UTC`, one file at a time | Read tests use `slsea_local`; write tests use `slsea_test` and empty it |
| Dev reload | `node --watch` | |
| Not used | TypeScript, Docker, GraphQL, Redis, rate limiting, lint/test pipelines | Keep the pipeline minimal |

**Dependencies:** `express dotenv cors mongoose jsonwebtoken bcryptjs swagger-ui-express yaml`. Dev: `@apidevtools/swagger-parser`.

---

## 6. Architecture

Diagram `docs/design/diagrams/09-layered-architecture.mmd`.

```text
src/
  app.js  server.js                 server checks JWT_SECRET, connects, listens on process.env.PORT
  config/       env.js  db.js
  routes/       index.js (mounting order), method-guards.js (405), device-readings.js, installation-writes.js,
                provinces.js  districts.js  substations.js  installations.js  docs.js
  middleware/   allow-methods (405)  accept-json (406)  require-json (415)  authenticate (401)
                require-scope (403 40303)  own-installation (403 40302)  private-cache  security-headers
                errorHandler (also 400/413/415 from the body parser)
  controllers/  HTTP in and out; set Location, ETag, Last-Modified
  services/     auth, scope (jurisdiction), list-query, readings, installations, provinces, districts, substations
  repositories/ the only code that queries MongoDB
  models/       Mongoose schemas and indexes
  utils/        errors, pagination, sort, links, time-window, if-match, last-modified, reading-id
scripts/        seed.js, topup.js, lib/ (readings, credentials)
test/           13 suites, 142 tests
docs/           openapi.yaml, design/ (my-decisions.md, data-model.md, diagrams/), evidence/
```

One line per layer: routes wire URI + method to middleware and controller · controllers translate HTTP to a service call and back · services hold the rules (validation, scope, readings, summary) · repositories are the only code that talks to MongoDB · middleware handles cross-cutting checks. Layering is `[YOU]` (the brief does not require it).

---

## 7. API / endpoint plan (as built)

All paths are relative to `/solar/v1.0`; `/`, `/docs`, `/docs.json` stay outside it. Path variables: `{province-id}`, `{district-id}`, `{substation-id}`, `{installation-id}`, `{reading-id}`.

| # | Method + URI | Resource type | Auth | Success | Errors |
|---|---|---|---|---|---|
| 1 | `GET /` | health | none | 200 | — |
| 2 | `GET /docs` (301 to `/docs/`), `GET /docs.json` | docs from `docs/openapi.yaml` | none | 200 | — |
| 3 | `POST /login` | processing function `[WP §5.1, §7.3]` | `{username, password}` or `{installation_id, device_key}` | 200 + token, `Cache-Control: no-store` | 400 (40001 malformed JSON; 40010 with items 40011/40012 user, 40020/40021 device, 40022 both or neither form), 401 (40103 user, 40106 device), 405, 406, 413 (41301), 415; order 405, 406, 415, 400, 401 |
| 4 | `GET /provinces`, `/provinces/{province-id}` | collection, atomic | JWT `solar:read` | 200 / 304 | 400, 401, 403, 404 |
| 5 | `GET /districts`, `/districts/{district-id}` (`?province_id=`) | collection, atomic | JWT `solar:read` | 200 / 304 | 400, 401, 403, 404 |
| 6 | `GET /substations`, `/substations/{substation-id}` (`?district_id=`, `?province_id=`) | collection, atomic | JWT `solar:read` | 200 / 304 | 400, 401, 403, 404 |
| 7 | `GET /installations` (`?province_id=`, `?district_id=`, `?substation_id=`, `sort`, `offset`, `limit`) | collection | JWT `solar:read` | 200 / 304 | 400, 401, 403 |
| 8 | `GET /installations/{installation-id}` | **composite**: installation + `last_reading` (`null` if none) | JWT `solar:read` | 200 / 304 | 401, 403, 404 |
| 9 | `GET /installations/{installation-id}/last-reading` | derived; lecture form (OQ-21) | JWT `solar:read` | 200 / 304 | 401, 403, 404 (40403 no reading yet) |
| 10 | `GET /installations/{installation-id}/readings` | **scoped collection**: `from`, `to`, `sort`, `offset`, `limit` | JWT `solar:read` | 200 / 304 | 400, 401, 403, 404 |
| 10a–c | `GET /substations/{id}/readings`, `/districts/{id}/readings`, `/provinces/{id}/readings` | **scoped collections** (OQ-04), same query | JWT `solar:read` | 200 / 304 | 400, 401, 403, 404 |
| 11 | `GET /installations/{installation-id}/readings/{reading-id}` | atomic, target of `Location` `[LEC S8]` | JWT `solar:read` | 200 / 304 | 401, 403, 404 |
| 12 | `POST /installations/{installation-id}/readings` | ingestion `[WP §7.3]` | device JWT `readings:write` | **201** + `Location`, `Content-Location`, `ETag`, `Last-Modified`, body | 400, 401, 403 (40303, 40302), 405, 406, 409 (40901 same time, 40903 older, 40902 lower energy), 413, 415; **no 404** (OQ-26) |
| 13 | `POST /installations` | create; server picks the next `INS-NNNN`, issues the device key once (OQ-28) | JWT admin `installations:write` | **201** + `Location`, `ETag` (as GET), `Last-Modified`, `Cache-Control: no-store`; no `Content-Location` | 400 (40010 + 40023–40027), 401, 403, 405, 406, 409 (40904, 40906), 413, 415 |
| 14 | `PUT /installations/{installation-id}` | whole-document replace `[WP §7.2]`; never creates | JWT admin | 200 + GET representation, new `ETag`, `Last-Modified` | 400 (40010, 40028), 401, 403, 404, 405, 406, 409, 412 (optional `If-Match`), 413, 415 |
| 15 | `DELETE /installations/{installation-id}` | delete; refused while readings exist (OQ-13) | JWT admin | 200 + deleted representation, then 404 | 401, 403, 404, 405, 406, 409 (40905), 412 |
| 16 | `GET /districts/{district-id}/generation-summary` | derived, stretch A8 (OQ-21) | JWT `solar:read` | 200 (never 304: `as_of` changes) | 401, 403, 404 |

**Same query on every readings collection** (`from`, `to`, `sort=(timestamp DESC)`, `offset`, `limit`); ties broken by `installation_id`. Rule (OQ-04): *path = which parent; query = how to read it*. Rejected: `GET /readings?district_id=` (phantom global collection), filters only on `/installations`, copying jurisdiction ids onto every reading.

**Deliberately absent** (reasons in my-decisions.md): global `/readings` · `/devices` · PUT/PATCH/DELETE on readings · any PATCH · writes on province/district/substation · `/users` endpoints (users are seeded).

**Global behaviour:** `res.json()` everywhere · 406 on a non-JSON `Accept` · 415 on a non-JSON write body · while the body is read, before any other check: 400 (40001) malformed JSON, 413 (41301) over 100 KB, 415 (41501) unsupported charset or encoding · `nosniff`, `X-Frame-Options: DENY` and HSTS on every response · 400 with per-field `error[]` (422 not used) · 304 on `If-None-Match` (precedence) or `If-Modified-Since` · 412 on a stale `If-Match` · every 401 carries `WWW-Authenticate: Bearer realm="solar"`; a missing scope gives 403 with `error="insufficient_scope"` · one error body, codes = HTTP status × 100 + n · 405 + `Allow` on a known URI with an unsupported method · empty collection 200, missing member 404.

**Composite vs last-reading:** the composite serves "installation + latest state in one call"; `last-reading` serves reading-only clients. One helper feeds both `[LEC S6]`.

---

## 8. Database (MongoDB Atlas)

Full detail: `docs/design/data-model.md`. Public ids are string business ids (`PV-01`, `DT-01`, `SS-001`, `INS-0001`, `RD-0001-20260926041500`); `_id` is never exposed (OQ-07).

| Collection | Key fields | Indexes |
|---|---|---|
| `provinces` | `province_id`, `name` | unique `province_id` |
| `districts` | `district_id`, `name`, `province_id` | unique `district_id`; `province_id` |
| `substations` | `substation_id`, `name`, `district_id`, `province_id` (derived) | unique `substation_id`; `district_id`; `province_id` |
| `installations` | `installation_id`, `meter_id`, `name`, `substation_id`, `district_id` (derived), `province_id` (derived), `capacity_kw`, `api_key_hash` (never returned), `created_at`, `updated_at` | unique `installation_id`; unique `meter_id`; partial unique `api_key_hash`; `substation_id`; `district_id`; `province_id` |
| `generation_readings` | `reading_id`, `installation_id`, `timestamp`, `power_kw`, `energy_kwh`, `voltage`, `received_at` | unique `reading_id`; unique `(installation_id, timestamp)` (also serves newest reading and history, read in either direction) |
| `users` | `user_id`, `username`, `password_hash`, `role`, `jurisdiction_level`, `jurisdiction_id` | unique `username` |

- **Derived ids `[YOU]`:** `substation_id` is the source of truth; `district_id`/`province_id` are server-set, stored read-only and recomputed if a client sends them. Seeded data is proven by the seed integrity check; API writes derive them in `services/installations.js` (tested in `admin-crud.test.js`).
- **Readings carry no jurisdiction ids `[YOU]` (OQ-04):** a jurisdiction route finds the installation ids under the path parent, then queries their readings. History follows an installation if its substation changes (known limit).
- **Device key** lives on the installation (`api_key_hash`), consistent with M2. The partial unique index allows a document without a key (it just cannot log in).
- **Idempotent ingest:** the unique `(installation_id, timestamp)` index makes a retried POST give 409 (40901) instead of a second row.

**Seed (`scripts/seed.js`)** `[BRIEF §4]` `[YOU]`: 9 provinces, 25 districts, 40 substations, 240 installations, 15-minute readings for 7 days (161,280), ending at run time; deterministic RNG, batch inserts, half-sine daylight curve 06:00–18:00 Asia/Colombo stored in UTC, cumulative non-decreasing `energy_kwh`, integrity checks. It also seeds 4 demo users and one device key per installation; plain passwords and keys go only to the git-ignored `scripts/seed-keys.txt` (never printed; OQ-15: the report appendix, not the README or Swagger). `--dry-run`, `--reset`, `--rotate-credentials`. **Freshness:** `scripts/topup.js` appends readings from each installation's newest reading up to now (safe to re-run); run it before submission and before the viva. No background generator on the server. Night readings are 0 kW by design.

**Atlas storage (M0, 512 MB):** checked 27 Sep: the `sample_mflix` sample database was dropped and `slsea_local` is 22.28 MB, so no trim is needed before seeding `slsea_dev` (§12b).

---

## 9. Authentication and security

| Concern | Control | Where | Tag |
|---|---|---|---|
| Write/read split | One bearer scheme, split by scope: POST readings needs `readings:write` (device tokens only); every GET needs `solar:read` (user tokens only). X-API-Key is not accepted | `authenticate`, `require-scope` | `[BRIEF §2]` `[WP §12.2]` |
| Device login | `POST /login` with `{installation_id, device_key}`: SHA-256 of the key compared with `api_key_hash` by `timingSafeEqual`; unknown id compared with a dummy hash; unknown id and wrong key give the same 401 (40106). Token HS256, 1 hour, `sub` = installation id, scope `readings:write` | `services/auth.js` | `[WP §12.1]` `[YOU]` |
| Device = its installation | Token `sub` must equal `{installation-id}` in the path; `installation_id` is never taken from the body | `own-installation` | `[LEC S8]` |
| 401 | Credential missing or not accepted (bad login, missing, expired or invalid token) + `WWW-Authenticate` | `authenticate`, login | `[WP §9]` |
| 403 | Understood but refused: device token for another installation (40302); outside jurisdiction (40301); token lacking the scope (40303, `error="insufficient_scope"`) | `own-installation`, `require-scope`, `services/scope.js` | `[WP §9]` OQ-10 |
| Roles (OQ-03) | **Device:** POST own readings only. **Reader:** GET inside jurisdiction. **Admin:** GET and POST/PUT/DELETE installations inside its jurisdiction (the seeded admin is national, so all) | `require-scope`, `services/scope.js` | `[YOU]` |
| Jurisdiction | National sees all; province/district users see their subtree only; ancestors → 403; scoped users get 403 before 404; collections narrowed to scope (a filter naming another jurisdiction → 200, count 0); on readings routes the check runs on the **path parent** | `services/scope.js` | `[YOU]` (OQ-04, OQ-12) |
| Users never write readings | User tokens never carry `readings:write` → 403 (40303) | `require-scope` | `[BRIEF §2]` |
| Passwords / keys | bcrypt; SHA-256 device key hash with a constant-time compare; secrets, hashes and login bodies never logged or returned | services, models `toJSON` | `[YOU]` |
| Secrets | `.env` git-ignored; `.env.example` committed; no hard-coded fallback secrets; the server refuses to start without a `JWT_SECRET` of at least 32 bytes (the value is never printed), and each environment has its own secret (no `iss`/`aud`, 27 Sep); demo passwords generated at seed time (never committed since 26 Sep) | config, seed | `[YOU]` |
| Injection / input | Every query and body value type-checked; a filter given twice → 400 (no arrays reach the database); range checks on `power_kw`, `voltage`, `energy_kwh`; `limit` 1–100; Express JSON body limit (default 100 kB) | services | `[YOU]` |
| Tokens | HS256 pinned; a token whose `exp` is missing or not a number → 401 (40102) (27 Sep) | `services/auth.js` | `[YOU]` |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000` on every response; no CSP (it would break Swagger UI); `X-Powered-By` off; `Cache-Control: no-store` on the login token (27 Sep) | `middleware/security-headers.js`, `controllers/auth.js` | `[YOU]` |
| CORS | Open (`*`): bearer tokens only, no cookies, so no CSRF; the API is meant to be called by dashboards and other clients (27 Sep) | `app.js` | `[YOU]` |
| Transport | HTTPS via Azure App Service (HTTPS Only on) | deploy | `[LEC S7]` |
| Error leakage | Central handler; no stack traces | `errorHandler.js` | `[YOU]` |
| Honest labelling | Own JWT issued by `/login`, not a full OAuth 2.0 flow | report | `[PROPOSAL]` |

---

## 10. Testing

The brief does not require automated tests. They are for my confidence, viva evidence and traceability.

| Level | What | How |
|---|---|---|
| Behaviour (automated) | 13 suites, 142 tests: status codes, headers, bodies, scope, errors, spec parity | `npm test` (`TZ=UTC`, one file at a time, app in-process). Read tests use `slsea_local`; `admin-crud` and `device-write` write only to `slsea_test` and empty it |
| Seed integrity | Counts, derived ids match their parents, 672 readings per installation, 15-minute boundaries, no energy decrease | printed by `scripts/seed.js` (PASS/FAIL) |
| Production-mode rehearsal | The app runs from repo contents only, as on Azure | fresh clone, `npm ci --omit=dev`, `TZ=UTC NODE_ENV=production PORT=8080 node --env-file=<git-ignored file> src/server.js`; run again in Phase 8 |
| Live smoke check (deploys) | The automated suite cannot target a URL (no `BASE_URL`), so the live check is a short curl checklist | `GET /` (200, `environment: dev`), `/docs` loads, login 200, one read 200, 401 without a token, 403 across jurisdictions, 304 with `If-None-Match`, one device POST 201 with a fresh timestamp. Save the `curl -i` output in `docs/evidence/live/` |
| Manual evidence | `curl -i` outputs and Swagger screenshots for the report | Captured on the deployed HTTPS URL, not on localhost; saved in `docs/evidence/live/` (crop tokens; no `localhost` in the report) |

---

## 11. Documentation

| Artefact | Purpose |
|---|---|
| `README.md` | What it is, local run/seed/test, authentication, demo usernames (no passwords), endpoint table, known limits; live URL added at deployment |
| `docs/design/my-decisions.md` | My decisions with their status and the superseded history |
| `docs/design/data-model.md` | Collections, fields, indexes, derived-id rule, what is not stored |
| `docs/design/diagrams/*.mmd` | 12 Mermaid sources (§18) |
| `docs/openapi.yaml` | The contract; hand-written, documents what the code does; served at `/docs` and `/docs.json` |
| `ai-log.md` | Every AI prompt (chat + Claude Code); source of the AI-disclosure appendix |
| `docs/evidence/` | Azure validation, curl transcripts, screenshots |

**Report evidence checklist (evidence only — I write all prose):** Swagger screenshots and `curl -i` output are captured on the deployed HTTPS URL (https://solar-api-dev-hr-e0ctb9b8eqd7bqa4.indiasouthcentral-01.azurewebsites.net, Swagger UI at https://solar-api-dev-hr-e0ctb9b8eqd7bqa4.indiasouthcentral-01.azurewebsites.net/docs), not on localhost.

| Section | Evidence to have ready |
|---|---|
| R1 Architecture & data model | ER diagram (03); entity table; sample installation JSON with `meter_id` and no `last_*` fields; reading count (time series); layer diagram (09) |
| R2 API design | Resource map (02) with resource types; §5.1/§5.6 check per URI; method table (safe/idempotent); `curl -i` for 200/201/304/400/404/405/406/409/412/415; pagination, filter, sort, conditional GET examples; error-body sample; request pipeline (04c) |
| R3 Security | Write-read split (01, 10); 401/403 matrix transcripts; district user denied on another district; key hashing and device-JWT flow (04a); user flow (04b) |
| R4 Deployment | Live URL; Azure app and plan settings (names only); the workflow file and a green Actions run; Atlas databases; `/docs` screenshot; seed counts; deploy findings (`docs/evidence/azure-deploy-2026-09-29.md`); `git log --oneline --graph`; deployment diagram (08); cost note |
| R5 Richardson | Level 0/1/2 evidence; why not Level 3 (no hypermedia controls; pagination links are not HATEOAS); cite WP §1 carefully |
| R6 Critical evaluation | Test results; known limits (my-decisions §16); "what I would change" |
| Outside word count | Signed declaration; AI-disclosure appendix from `ai-log.md`; diagrams, tables, code listings, references `[BRIEF §8]` |

---

## 12. Git, branching and environments (local-first)

**Approach `[YOU]`:** develop, run and test everything locally. Azure hosts one app, `solar-api-dev-hr`, **deployed 29 Sep** (the Mon 28 Sep smoke deploy did not happen) and **kept as the submitted app** (`DECIDED · YOU`, 29 Sep: no delete-and-recreate; scale F1 → B1 before submission); the **final release** goes to the same app (Thu 1 Oct). Azure requirements are respected during development (§12a). `main` is never used.

| Branch | Role | Deployed? |
|---|---|---|
| `dev_hashini` | My working branch; all commits (Claude Code works here under my review) | No; runs locally against `slsea_local` |
| `dev` | Central branch and GitHub default; receives work only by merge (pull request or merge commit) | No |
| `deployment_dev` | Deploy branch; updated from `dev` only by release merges (first release 29 Sep, PR #8; final release Thu 1 Oct); a push triggers the workflow; tag `submission` lives here | Only then |
| `deployment_qa` | Marker of a QA stage; never deployed | No |

| Where | Branch | Database | Purpose |
|---|---|---|---|
| Local (Mac, Node 22) | `dev_hashini` | Atlas `slsea_local` (tests also `slsea_test`) | All development and tests |
| Azure `solar-api-dev-hr`, deployed Tue 29 Sep | `deployment_dev` | `slsea_dev` (seeded 29 Sep; top-up before submission) | **The submitted URL**; F1 now, B1 before submission; final release Thu 1 Oct; keep until marking and the viva are done |

**Rules**

| Step | When | Gate |
|---|---|---|
| `dev_hashini` → `dev` | After a build step or a set of steps | Tests pass, explain-back done, `ai-log.md` entry in the same commit. Merge commit, no squash |
| Keep in sync | After each merge into `dev` | `git switch dev_hashini && git pull origin dev` |
| Tag a phase | End of a phase | `pN` on the `dev` tip. Tags: `p1` = `135e7e8` (phase 1); annotated `p4` = `5f4b246` (phases 2–4), `p7` = `f77d772` (phases 5–7) and `p8` = `050be73` (phase 8, code freeze, 27 Sep). `p2` and `p3` (both wrongly on `135e7e8`) were deleted on 27 Sep |
| First deploy | Tue 29 Sep (the Mon 28 Sep smoke deploy did not happen) | Runbook §12b step 1; done; the app is kept (no delete) |
| Freeze | End of Phase 8 | Full local suite green, rehearsal passes. Only fixes for real problems after this |
| Final release | Thu 1 Oct | Runbook §12b step 2 (same app, scaled to B1 before submission); tag `submission` on `deployment_dev` |
| After the final deploy | Until marking and the viva are done | Merge nothing into `dev` or `deployment_dev`; check `dev` = `deployment_dev` |
| Broken deploy | — | Fix on `dev_hashini` → `dev`, release again, tag `pNb`. Never move or delete a pushed tag. Exception (`DECIDED · YOU`, 2026-09-27): `p2` and `p3` were deleted because they were created by mistake on the same commit as `p1` and marked no phase; the rule applies from now on. |

- OpenAPI `servers` is the relative `/solar/v1.0`. `GET /` returns `environment` (`APP_ENV`: `local` on the Mac, `dev` on Azure).
- **One GitHub Actions workflow** (`.github/workflows/deploy-deployment-dev.yml`), triggered only by pushes to `deployment_dev` (and manually), written on `dev_hashini`. Azure's Deployment Center must not commit its own workflow. Authentication: publish profile (OQ-32, closed 29 Sep: it works).
- Cost guard: read the estimated price, set a budget alert, delete the plan only after marking and the viva. Never upgrade to Pay-As-You-Go, never attach a card.

| Other rule | Detail |
|---|---|
| History | Small commits; no squash, no rebase of pushed history, no force-push `[BRIEF §7.3, §13]` |
| Format | `type(scope): summary` — `feat`, `fix`, `docs`, `test`, `chore`, `refactor` |
| Secrets | `.env`, `.env.*`, `*.env`, `atlas-credentials*`, `refs/`, `*.zip`, `seed-keys.txt`, publish profiles are git-ignored. Never share a ZIP that contains `.env` or `seed-keys.txt`. Rotate anything exposed |
| Reference repos | In `refs/` only; never copy code |
| Collaborator | Lecturer `nirangadh`: accepted 27 Sep |
| AI log | Claude Code appends factual entries (CLAUDE.md rule); I fill the review lines and add chat sessions |

**Risks:** a marker looking for `main` finds nothing, so the default branch must be `dev`; `deployment_qa` is kept as a marker of a QA stage; this assignment deploys one environment; the release merge is manual, so forgetting it leaves the live URL behind `dev`; deployment risk sits in the last week.

---

## 12a. Azure readiness (rules during development)

| Area | Rule |
|---|---|
| Port and config | Listen only on `process.env.PORT`. All configuration from environment variables; no `.env` in production; `dotenv` never overrides existing variables |
| Node version | Local Node 22 = Azure Node 22 LTS; `engines` is `>=22.19` |
| Clean start | `npm ci --omit=dev && npm start` works from a fresh clone; `package-lock.json` in sync; runtime packages in `dependencies` |
| File-name case | Every `require` path matches exact case (Linux is case-sensitive) |
| Timezone | Azure runs in UTC; the Asia/Colombo day is computed explicitly; tests run with `TZ=UTC` |
| Memory | Aggregation (district summary) and paging in the database |
| Local state | Write nothing to disk; log to stdout, never secrets |
| HTTPS | Azure ends TLS; links and `Location` headers are relative |
| Docs | Swagger UI from the package; the `docs/` folder must be in the deploy package (the spec is read at start-up) |
| Atlas | Network Access `0.0.0.0/0`; `mongodb+srv://` URI |
| Errors | Malformed JSON fails in `express.json()` before auth and still gets the standard error body |

---

## 12b. Azure runbook

**Step 0: zero-cost validation — done 21 Sep.** India South Central passed validation; Basic B1 about US$13.14/month; Free F1 available; Node 22 LTS on Linux available; basic authentication off by default (`docs/evidence/azure-validation.md`).

**Step 1: first deploy — done Tue 29 Sep** (the Mon 28 Sep smoke deploy did not happen). Findings: `docs/evidence/azure-deploy-2026-09-29.md`. Web app `solar-api-dev-hr`, Free F1, resource group `rg-solar-api-dev`; release PR #8, Actions run #1 green in 34 s (commit `c30ad47`); `slsea_dev` seeded (9/25/40/240, 4 users, 161,280 readings, both integrity checks PASS); live checks passed. `DECIDED · YOU (2026-09-29)`: this app is kept as the submitted app, so step 9 is not done.

1. Local: the production-mode rehearsal passes; the workflow file has reached `dev`.
2. Atlas: storage checked 27 Sep (M0 512 MB; `sample_mflix` dropped, `slsea_local` 22.28 MB); no trim needed before seeding `slsea_dev`.
3. Azure: create the resource group and web app (F1 first, B1 if blocked), Node 22 LTS, Linux, India South Central. Basic authentication **on** for the publish-profile method. App settings: `MONGODB_URI` (database `slsea_dev`), `JWT_SECRET` (a **new** value, `openssl rand -hex 32`), `NODE_ENV=production`, `APP_ENV=dev`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (the workflow already runs `npm ci`, so Azure must not build again). HTTPS Only **on**; Always On **on** (B1).
4. GitHub: secret `AZURE_WEBAPP_PUBLISH_PROFILE` (delete the downloaded file afterwards; never commit it), variable `AZURE_WEBAPP_NAME`.
5. Release merge `dev` → `deployment_dev`. Watch the Actions run and the Azure log stream. Open the URL.
6. Seed `slsea_dev` from the Mac with a git-ignored env file: `node --env-file=.env.deploy scripts/seed.js` (it prints the database name first; new passwords and keys go to `scripts/seed-keys.txt`).
7. Live smoke checklist (§10). Save the `curl -i` output.
8. Write findings (region, authentication method, timings, problems) to `docs/evidence/`.
9. ~~Delete the resource group, remove the secret~~ — not done: the app is kept as the submitted app (`DECIDED · YOU`, 29 Sep).

**Step 2: final release (Thu 1 Oct), same app.** No new app. Before submission scale the plan F1 → Basic B1 and turn Always On on; release merge `dev` → `deployment_dev`; tag `submission` on `deployment_dev`; top up the seed; re-run the live checklist (§10); take the report screenshots on the live URL (values hidden) into `docs/evidence/live/`; set a budget alert; **keep everything running** until marking and the viva are done.

**Fallback.** If neither publish profile nor OIDC works in the university tenant: `az webapp deploy` with a ZIP of the `deployment_dev` tip, or the VS Code Azure extension. If Azure is blocked altogether, the app is portable to another host.

---

## 13. Phases and timeline

| Phase | Deliverable | Status |
|---|---|---|
| 0 / 0b | Plan, `my-decisions.md`, diagrams | done 19–20 Sep |
| 1 | Walking skeleton, repo hygiene, local-first plan, Azure zero-cost validation | done 21 Sep (tag `p1`) |
| 2 | Data model, models, full seed + top-up, error contract, hierarchy reads with paging | done 21–26 Sep |
| 3 | Installation composite, `last-reading`, readings history, readings under substation/district/province | done 26 Sep |
| 4 | Device write path: POST readings, 201 + headers, 409 rules, device auth | done 26 Sep (device JWT from the same day) |
| 5 | Users, `POST /login`, JWT with scopes, jurisdiction scope on all reads | done 26 Sep |
| 6 | Query surface, conditional GET (strong ETag, 304), 406 | done 26 Sep |
| 7 | Admin CRUD on installations, 405 everywhere, district summary (stretch), OpenAPI at `/docs` | done 26 Sep |
| 7b | Credential fix: demo passwords generated at seed time, `--rotate-credentials`; README | done 26 Sep |
| 8 | Hardening: security review (E1), audit (E2), explain-back, production-mode rehearsal, **code freeze** | code freeze done 27 Sep (tag `p8` = `050be73`); explain-back next |
| 4b | **First deploy** (runbook §12b step 1): `solar-api-dev-hr`, seed, live checks; the app is kept | done 29 Sep (the Mon 28 Sep smoke deploy did not happen) |
| 9 | **Final release** to the same app: scale F1 → B1, release merge, tag `submission`, top-up, live checks, screenshots | Thu 1 Oct |
| 10 | Report (I write it) and final checks | 30 Sep – 3 Oct |

**Remaining timeline** (deadline **Sun 4 Oct 2026**; LMS time of day to note):

| Date | Work |
|---|---|
| Sun 27 Sep | Done: Atlas database user password rotated (exposed in an earlier ZIP) and `.env` updated, the app connects; phase tags fixed (`p4`, `p7`); Phase 8 security review, fixes and audit done; production-mode rehearsal passed; deploy workflow merged into `dev`. To do: fill my ai-log review lines |
| Mon 28 Sep | Smoke deploy did not happen |
| Tue 29 Sep | Done: deployed to Azure (`solar-api-dev-hr`, F1), `slsea_dev` seeded, live checks passed, OQ-32 closed |
| Tue 29 – Wed 30 Sep | Phase 8 finish: explain-back; report drafting starts |
| Thu 1 Oct | **Final release** to the same app; scale F1 → B1 before submission |
| Fri 2 Oct | Report final; word count; Turnitin + AI score; contradiction check |
| Sat 3 Oct | Live re-check, declaration signed, submit (buffer day) |
| Sun 4 Oct | Deadline |

Never cut: the final deployment, seed at full scale, device auth, jurisdiction scope, 201 + `Location`, pagination, conditional GET, error schema, report evidence. Viva date pending (OQ-25).

---

## 14. Requirement → implementation → evidence

| Req | Implementation | Evidence |
|---|---|---|
| G1 | Azure App Service, deploy workflow, Atlas `slsea_dev`, seed | live smoke checklist (§10), Actions run, screenshots |
| G2 | `swagger-ui-express`, `docs/openapi.yaml`, `src/routes/docs.js` | `test/openapi.test.js` (valid spec; every documented operation exists; 405 `Allow` = documented methods; every error code documented) |
| G3 | Git workflow §12 | `git log --oneline --graph`, collaborator screenshot |
| G4–G6 | Report, declaration, viva | manual checklist |
| M1–M4 | `src/models/`, `data-model.md` | model files; seed integrity output; 405 on reading writes (`device-write.test.js`) |
| M5 | `scripts/seed.js`, `scripts/topup.js` | seed output: counts 9/25/40/240/161,280 and integrity PASS |
| A1, V1 | hierarchy routes, `utils/pagination.js`, `services/list-query.js` | `hierarchy.test.js` |
| V3 | `utils/sort.js` | `installations.test.js`, `jurisdiction-readings.test.js` (timestamp ASC/DESC) |
| A2–A4 | installations routes, `services/readings.js` | `installations.test.js`, `jurisdiction-readings.test.js` |
| A5, V4 | Express strong ETag, `private-cache`, `accept-json`, `utils/last-modified.js` | `conditional-get.test.js` |
| A6 | `routes/device-readings.js`, `controllers/device-readings.js` | `device-write.test.js` (201 + headers, `Location` resolves, 409 rules) |
| A7 | `routes/installation-writes.js`, `services/installations.js`, `utils/if-match.js`, `routes/method-guards.js` | `admin-crud.test.js` |
| A8 | `services/readings.js` (`districtSummary`), `repositories/readings.js` | `generation-summary.test.js` |
| V2 | readings routes under four parents; catalogue filters; `utils/time-window.js` | `jurisdiction-readings.test.js`, `installations.test.js`, `hierarchy.test.js` |
| V5 | `utils/errors.js`, `middleware/errorHandler.js` | `errors.test.js` and error bodies in every suite |
| S1 | device login, `authenticate`, `require-scope`, `own-installation` | `device-write.test.js`, `auth.test.js` |
| S2 | `services/scope.js` | `scope.test.js` |
| S3 | `require-scope` | `device-write.test.js` and `admin-crud.test.js` (user tokens → 403, 40303) |
| S4 | `authenticate`, `require-scope` | `auth.test.js`, `scope.test.js` |
| R1–R6 | Report | evidence checklist §11 |

---

## 15. Open questions and decisions

**Still open:** OQ-25 (viva date). OQ-32 was closed on 29 Sep (publish profile works). OQ-08, OQ-20, the tie-break rule, the top-up script and the `capacity_kw` bound of 1000 were confirmed on 27 Sep (my-decisions §16). Everything else is decided; details in `my-decisions.md`.

| ID | Question → answer | Status |
|---|---|---|
| OQ-01 | Missing sources: white paper and final rubric received; S3/S4 files and S9–S15 still missing | partly resolved |
| OQ-02 | Fresh submission; brief §14 not applicable | DECIDED `[YOU]` |
| OQ-03 | Writable = readings (device POST) and installations (admin POST/PUT/DELETE); roles device / reader / admin | DECIDED `[YOU]`, built |
| OQ-04 | Readings collections under installation, substation, district, province; path = parent, query = how | DECIDED `[YOU]`, built (own decision, not confirmed with the lecturer) |
| OQ-05 | Hierarchy top-level with query filters | DECIDED `[YOU]` |
| OQ-06 | `/substations` | DECIDED `[YOU]` |
| OQ-07 | String ids; `_id` hidden | DECIDED `[YOU]` |
| OQ-08 | Composite contents: installation + `last_reading` only | DECIDED `[YOU]` (27 Sep), built |
| OQ-09 | Device-supplied `timestamp`, server `received_at`; duplicate → 409 | DECIDED `[YOU]` (my-decisions §9) |
| OQ-10 | Missing/invalid token → 401; device token for another installation → 403 | DECIDED `[YOU]` (revised for device JWT) |
| OQ-11 | `POST /login`, 200 + token | DECIDED `[YOU]` |
| OQ-12 | Out of scope → 403 (scoped users before 404); collections narrowed | DECIDED `[YOU]` (my-decisions §10) |
| OQ-13 | DELETE with readings → 409 (40905); without → 200, repeat 404 | DECIDED `[YOU]` |
| OQ-14 | 15-minute seed interval | DECIDED `[YOU]` |
| OQ-15 | Demo usernames in the README; passwords and a device key only in the report appendix; nothing in Swagger | DECIDED `[YOU]` |
| OQ-16 | Lecturer `nirangadh` as collaborator | DECIDED |
| OQ-17 | Deadline Sun 4 Oct 2026 | DECIDED `[YOU]` |
| OQ-18 | The repo started empty (19 Sep) | DECIDED `[YOU]` (historical) |
| OQ-19 | Mongoose | DECIDED `[YOU]` |
| OQ-20 | Query names: JSON attribute names + `from`/`to` (UTC with `Z`, inclusive) | DECIDED `[YOU]` (27 Sep), built |
| OQ-21 | Noun sub-resources `last-reading`, `generation-summary` (deviation from WP §5.1) | DECIDED `[YOU]` |
| OQ-22 | Base path `/solar/v1.0` | DECIDED `[YOU]` |
| OQ-23 | `sort=(timestamp DESC)`, multi-field | DECIDED `[YOU]` |
| OQ-24 | Optional `If-Match` on PUT/DELETE → 412; write also filters on the `updated_at` read | DECIDED `[YOU]` |
| OQ-25 | Viva date/format | **PENDING** |
| OQ-26 | No 404 on POST readings; token for another or unknown installation → 403 (40302) | DECIDED `[YOU]` |
| OQ-27 | Same timestamp → 40901; older → 40903; lower `energy_kwh` → 40902; equal allowed | DECIDED `[YOU]` (known limit: two concurrent requests with different timestamps can both pass) |
| OQ-28 | New installation's device key returned once in the 201 (`no-store`) | DECIDED `[YOU]` |
| OQ-29 | Strong content-based ETag | DECIDED `[YOU]` |
| OQ-30 | Branch model (§12) | DECIDED `[YOU]` |
| OQ-31 | Azure App Service instead of Render; one GitHub Actions workflow | DECIDED `[YOU]` |
| OQ-32 | Workflow authentication: publish profile, OIDC or CLI ZIP fallback → publish profile (Actions run #1 green, 29 Sep) | DECIDED (29 Sep) |
| OQ-33 | Region India South Central; B1 about US$13.14/month | DECIDED (21 Sep) |
| OQ-34 | Express 5 | DECIDED `[YOU]` (21 Sep) |
| OQ-35 | `slsea_local` locally, `slsea_dev` deployed | DECIDED `[YOU]` |

**Assumptions:** Azure provides HTTPS (HTTPS Only on) · the one deployed app (`solar-api-dev-hr`) is the only Azure spend · Atlas Network Access allows Azure (`0.0.0.0/0`) · `mongodb+srv://` URI · the student subscription may restrict regions and quotas · timestamps UTC.

---

## 16. Working rules

- Small diffs; commit on `dev_hashini`; merge into `dev`; release to `deployment_dev` only by release merges (29 Sep, final 1 Oct). Never touch `main`.
- Log every AI prompt in `ai-log.md` (chat prompts count).
- I write all report text; the AI only flags missing evidence, contradictions with the code and rubric gaps.
- Never copy code from the classmate repos.
- Explain-back every module before moving on; if I can't explain it, I don't submit it.
- Proposals stay proposals until I record them in `docs/design/my-decisions.md`.

---

## 17. Outdated rubric — supplementary only

The final rubric `NB6007CEM_Marking_Rubric.pdf` (25 Aug 2026) is authoritative. The older `outdated_use_as_a_ref.pdf` (NIB304CEM, batch 24.1P) was used before 26 Sep only as a hint; one change came from comparing them: device JWT instead of X-API-Key (my-decisions §9).

| Pattern in the outdated rubric | Use here |
|---|---|
| API design top level: filtering, sorting, conditional GET, full range of headers | Built |
| Code: modular structure, short comments, exception handling, no lint errors | Layers and a central error handler built; no linter added |
| Version control: regular commits, branching and merging | `dev_hashini` → `dev` → `deployment_dev` with merge commits and tags |
| Functionality: "adequately tested" | 142 automated tests |
| Architecture: documentation, scalability, reliability, security | Diagrams and decisions; scale and reliability limits stated honestly in the critical evaluation |
| AI-content threshold 5% | **Outdated.** The current brief says below 15%; write my own prose regardless |

---

## 18. Diagrams

Sources in `docs/design/diagrams/` (Mermaid). Each file starts with `%%` comments naming its basis (brief, white paper, lectures) and the decisions it follows. Checked on 2026-09-26 with the Mermaid 11 parser; 06–09 also rendered and checked by eye.

| File | Shows | Report section |
|---|---|---|
| `01-context.mmd` | Devices (write), users (read), admin, marker, Azure, Atlas; dashboards out of scope | R1, R4 |
| `02-resource-model.mmd` | Resources by kind, URI scoping, the four readings parents, what is not built | R1, R2 |
| `03a-conceptual-model.mmd` | Conceptual model (implementation-independent): entities, key attributes, cardinalities | R1 |
| `03-er-model.mmd` | Entities, keys, derived ids, cumulative energy, no Device entity | R1 |
| `04a-auth-device-write.mmd` | Device login and POST readings: 401 vs 403 | R3 |
| `04b-auth-user-read.mmd` | User login and jurisdiction-scoped read | R3 |
| `04c-request-pipeline.mmd` | Order of checks and where each status code comes from | R2, R3 |
| `05-flow-ingest-reading.mmd` | Device pushes a reading: 405/406/415/401/403/400/409/201 | R2 |
| `06-flow-readings-history.mmd` | Readings under a parent: 403/404/400/304/200 | R2 |
| `07-flow-operational-reads.mmd` | Composite, `last-reading`, generation summary | R2 |
| `08-deployment.mmd` | Local-first setup, workflow, the one Azure app (`solar-api-dev-hr`, deployed 29 Sep, kept; F1 → B1 before submission), Atlas databases, cost guard | R4 |
| `09-layered-architecture.mmd` | Routes → middleware → controllers → services → repositories | R1 |
| `10-roles-and-permissions.mmd` | Device / reader / admin: allowed and refused | R3 |

Removed on 2026-09-26: `11-branching-and-environments.mmd` (its release path is already in 08; branch rules are in §12), `12-roadmap.mmd` (a progress tracker, replaced by §13) and the diagrams `README.md` (this table replaces it). They remain in git history.

Export for the report: `npx @mermaid-js/mermaid-cli -i <file>.mmd -o <file>.svg`, then check the rendering by eye.
