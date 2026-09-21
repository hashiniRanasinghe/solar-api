# My decisions — SLSEA Solar Generation API

Date: 2026-09-20 (rev 4) · Module: NB6007CEM CW1 · Attempt: fresh submission (no earlier submission, no marker feedback) · Repo: local skeleton pushed on `dev_hashini` · Viva: date/format not known yet · Deadline: Sun 4 Oct 2026 (confirmed) · Stack: Node/Express, Mongoose, MongoDB Atlas, Azure App Service (`DECIDED · YOU`, replaced Render on 2026-09-20) · **Local-first: everything is developed and tested locally; Azure only for a smoke deploy and the final deploy** (`DECIDED · YOU`, 2026-09-20) · Diagrams: `docs/design/diagrams/` (14)

**Honest note.** Claude drafted this file from the current brief, white paper (WP), lecture notes (LEC S1–S8), `PLAN.md` and the 3 reference repos. I must read every line, change what I disagree with and be able to explain all of it at the viva. This is logged in `ai-log.md`. The report is written by me.

**Status labels (strict).**
- `DECIDED · BRIEF §n` — the current coursework brief says it.
- `DECIDED · WP §n` / `DECIDED · LEC Sn` — an explicit rule in the white paper (the brief's design authority) or in the current lecture notes.
- `DECIDED · YOU` — I deliberately confirmed it in the planning conversation.
- `PROPOSAL` — a technical choice the coursework does not specify. Not mine until I confirm it.
- `OPEN` — cannot be confirmed from the sources, or sources conflict. Not chosen.

The marking rubric I have is outdated (it names module NIB304CEM, batch 24.1P). It is **not** a source for any decision here; it is only a supplementary hint about assessment areas (see `PLAN.md` §17).

---

## 1. What the system is
- `DECIDED · BRIEF §2` Devices send readings. SLSEA users and applications read them. Users never write readings.
- `DECIDED · BRIEF §2` A device writes readings **only for its own installation**. A user reads **only inside their jurisdiction** (national, provincial, district).
- `DECIDED · BRIEF §2` The API itself enforces this. Without it, a faulty or stolen device could add fake readings to another site's history, and a district user could read other districts, which would spoil the dashboards.

## 2. Entities and hierarchy
- `DECIDED · BRIEF §3` Chain: **Province → District → Substation → Installation → Reading**, one-to-many at each step, plus **User** with a role and a jurisdiction.
- `DECIDED · BRIEF §3` A reading has at least: installation, timestamp, power (kW), **cumulative** energy (kWh), voltage. `energy_kwh` is a running total, not a per-interval amount. (Confirmed by me.)
- `DECIDED · YOU` The hierarchy is **derived from `substation_id`**: an installation stores only `substation_id` as the source of truth; `district_id` and `province_id` come from the substation → district → province chain. Clients never supply them. This is how the hierarchy cannot become inconsistent.
- `DECIDED · YOU` How the derived ids are kept: the server sets and **stores** them read-only on the installation (and `province_id` on the substation), so queries and scope checks stay one lookup. A **seed integrity check** proves they match their parents. If a client sends them (for example in a PUT copied from a GET), the server ignores them and recomputes. Rejected: joining up the chain on every request (no stored copy, but slower and awkward for filters).
- `PROPOSAL` Fields (snake_case):

| Entity | Fields |
|---|---|
| Province | `province_id`, `name` |
| District | `district_id`, `name`, `province_id` |
| Substation | `substation_id`, `name`, `district_id`, `province_id` (derived) |
| Installation | `installation_id`, `meter_id`, `name`, `substation_id`, `district_id` (derived), `province_id` (derived), `capacity_kw`, `created_at`, `updated_at`, hidden `api_key_hash` |
| Reading | `reading_id`, `installation_id`, `timestamp`, `power_kw`, `energy_kwh`, `voltage`, `received_at` |
| User | `user_id`, `username`, `password_hash`, `role` (`reader`/`admin`), `jurisdiction_level` (`national`/`province`/`district`), `jurisdiction_id` |

- `PROPOSAL` Extra fields I must justify: `name`, `capacity_kw` (realistic seed and validation), `received_at` (when the server got it, separate from device time), `created_at`/`updated_at` (for `Last-Modified` and `ETag`).
- `DECIDED · BRIEF §4` Seed minimum: 9 provinces, 25 districts, 20+ substations, 200+ installations, 1 week+ of readings per installation, foreign-key consistent, with pagination genuinely needed.
- `DECIDED · YOU` Seed size: **40 substations, 240 installations, one reading every 15 minutes for 7 days** (about 161,000 readings). `PROPOSAL` Diurnal curve in Asia/Colombo time, stored in UTC.
- `DECIDED · YOU` The seed must contain **recent/current readings** so every endpoint shows working data.
- `PROPOSAL` How: the seed window ends at the time the seed is run; a second script tops up each installation from its newest reading to "now" without wiping anything (safe to re-run because of the unique installation+timestamp rule); both are run before submission and before the viva; the README states the "data as of" time. No background job generating fake device data on the host. Readings at night are 0 kW by design, so "current total power" can legitimately be 0 outside daylight.

## 3. Why no Device entity
- `DECIDED · BRIEF §3` `meter_id` is an attribute of the installation. One installation has one meter, so a Device entity adds a join and nothing else. The brief calls a needless Device entity a modelling flaw.
- `PROPOSAL` The device key hash also sits on the installation.
- A Device entity would only earn its place if I had to track meter replacement, calibration or battery history. I don't.

## 4. Why readings are an append-only time series
- `DECIDED · BRIEF §3` Readings are their own append-only series. Keeping only `last_power` on the installation would destroy the history, which is the "single most common modelling mistake" the brief names.
- `DECIDED · BRIEF §6` One series serves two needs: operational (what is generating now) and analytical (history over time and by region).
- `DECIDED · YOU` No PUT, PATCH or DELETE on readings. Only POST adds one.
- `PROPOSAL` Those forbidden calls answer 405 with an `Allow` header. (Neither the brief nor WP §9 names 405.)

## 5. Resource types

| Resource | Type | Basis |
|---|---|---|
| `/provinces`, `/districts`, `/substations`, `/installations` (+ members) | collection + atomic | `DECIDED · WP §4.1–4.2`; top-level shape `DECIDED · YOU` (OQ-05) |
| `/installations/{installation-id}` | composite: installation + `last_reading` (or `null`) | composite required `DECIDED · BRIEF §5`; contents `PROPOSAL` (OQ-08) |
| `/installations/{installation-id}/readings` | scoped collection (GET, POST) | required `DECIDED · BRIEF §5`; scoping `DECIDED · WP §4.6, §5.6` |
| `/substations/{substation-id}/readings`, `/districts/{district-id}/readings`, `/provinces/{province-id}/readings` | **scoped collections, GET only** — readings of every installation under that parent | `DECIDED · YOU` (OQ-04); supported by `BRIEF §5` (filter by jurisdiction), `§6` ("by region"), `WP §4.6, §5.6` |
| `/installations/{installation-id}/readings/{reading-id}` | atomic, only under its installation | `PROPOSAL` — needed so the `Location` of a POST resolves (WP §7.3, LEC S8) |
| `/installations/{installation-id}/last-reading` | processing function (derived: newest reading) | required `DECIDED · BRIEF §5`; noun sub-resource form `DECIDED · YOU` (OQ-21) |
| `/districts/{district-id}/generation-summary` | processing function (derived), **stretch** | `DECIDED · BRIEF §5` (stretch only); form `DECIDED · YOU` (OQ-21) |
| `POST /login` | processing function (verb name, issues a token) | `DECIDED · YOU` (OQ-11), `WP §5.1, §7.3` |

- `DECIDED · YOU` (OQ-21) **URI names are the name of the thing, not the kind of resource.** Derived resources under a parent are noun sub-resources: `…/installations/{installation-id}/last-reading` (scoped to one installation) and `…/districts/{district-id}/generation-summary` (scoped to one district, because that is what it summarises). "Processing function" is the design vocabulary for the *kind* (WP §4.5); it is never a URI segment, so there is no `/processing-functions` path. This follows the lectures (LEC S5/S6) and differs from WP §5.1, which asks for verb names and no sub-resource form for these. Not confirmed with the lecturer: my own decision, and a possible viva question.
- `PROPOSAL` Composite and `last-reading` use one shared "newest reading" helper, so the logic is not duplicated (LEC S6). The composite never embeds the history.
- `PROPOSAL` No controller resources: nothing needs an all-or-nothing update of several resources (WP §4.4).
- `PROPOSAL` "Today's energy" in the summary = newest cumulative value minus the cumulative value at the last reading before local midnight (Asia/Colombo), summed over the district. Needed because `energy_kwh` is cumulative. Summary response fields are not decided yet.

## 6. URIs, base path, naming, scoping
- `DECIDED · YOU` Base path `/solar/v1.0` (WP §5.4–5.5). `/`, `/docs`, `/docs.json` sit outside it.
- `DECIDED · WP §5.1` Lowercase, hyphens, plural collections, singular members, path variables like `{installation-id}`.
- `DECIDED · YOU` (OQ-05) Hierarchy resources are **top-level** and filtered by query (`/districts?province_id=…`), not nested.
- `DECIDED · YOU` (OQ-06) The name is `/substations`.
- `DECIDED · WP §4.6, §5.6` / `BRIEF §5` **No global `/readings`.** Readings always sit under a parent in the path: an installation, or (`DECIDED · YOU`, OQ-04) a substation, district or province. `/devices` does not exist.
- Routes (all under the base path):
  - `GET /provinces`, `/provinces/{province-id}`; same for `/districts`, `/substations`
  - `GET, POST /installations`; `GET, PUT, DELETE /installations/{installation-id}`
  - `GET /installations/{installation-id}/last-reading`
  - `GET, POST /installations/{installation-id}/readings`; `GET …/readings/{reading-id}`
  - `GET /substations/{substation-id}/readings`, `GET /districts/{district-id}/readings`, `GET /provinces/{province-id}/readings`
  - `GET /districts/{district-id}/generation-summary` (stretch)
  - `POST /login`
- `DECIDED · WP §4.5, §7.2` / `LEC S7, S8` No PATCH anywhere (partial updates would use processing functions); no write routes for province, district or substation.
- `PROPOSAL` No `/users` endpoints; users are seeded.

## 7. Representation
- `DECIDED · BRIEF §5` JSON for all resources. `DECIDED · YOU` snake_case field names.
- `DECIDED · WP §10.3` Collections carry `count`, `next`, `previous`. `PROPOSAL` The items key is `data`; `next`/`previous` are relative paths keeping the other parameters and are `null` at the ends. Members are plain objects.
- `DECIDED · LEC S8` Empty collection → 200; missing member → 404.
- `DECIDED · YOU` (OQ-07) IDs are strings: `PV-01`, `DT-01`, `SS-001`, `INS-0001`, `RD-…`. Mongo `_id` is never shown.
- `PROPOSAL` Timestamps are ISO 8601 in UTC, ending in `Z`. Units are in field names.

## 8. Methods, status codes, headers

| Call | Success | Errors | Basis |
|---|---|---|---|
| GET (any) | 200, or 304 with empty body | 400, 401, 403, 404, 406 | `DECIDED · WP §7.1, §9, §10.4` |
| `POST …/readings` | **201** + `Location`, `ETag`, `Last-Modified`, body | 400, 401, 403, 409, 415 | 201 + `Location` `DECIDED · BRIEF §5`; headers `DECIDED · BRIEF App. A`; 409 `PROPOSAL` |
| `POST /installations` | 201 + same headers | 400, 401, 403, 409, 415 | `DECIDED · YOU` (OQ-03); 409 `PROPOSAL` |
| `PUT /installations/{id}` | 200 (whole replacement) | 400, 401, 403, 404, 412, 415 | whole replacement `DECIDED · WP §7.2`; 412 on stale `If-Match` `DECIDED · WP §10.5` |
| `DELETE /installations/{id}` | 200, then 404 on repeat | 401, 403, 404 | `DECIDED · WP §7.4` |
| `POST /login` | 200 + token | 400, 401 | `DECIDED · YOU` |

- `PROPOSAL` `Content-Location` on 201 (WP §7.3 mentions it when the body repeats the resource). Bad input is 400, never 422. DELETE is 200, not 204 (WP §7.4).
- `DECIDED · WP §10.1` A wrong `Accept` gets 406 even with one media type. `DECIDED · WP §9` Wrong request `Content-Type` → 415. Every 401 carries `WWW-Authenticate`.
- `PROPOSAL` Idempotency of ingest: a retry with the same installation + timestamp hits a unique rule and gets 409, not a second row. 409 is standard HTTP but not in WP §9's list.
- The order in which checks run is in diagram `04c` (`PROPOSAL`).

## 9. Write path: device auth and ingest
- `DECIDED · YOU` (OQ-10) Missing or unknown/invalid API key → **401**. A valid key used on a different installation → **403**. Matches WP §9.
- `DECIDED · BRIEF §5` A device authenticates as its installation. `DECIDED · LEC S8` The installation id comes from the path only, never the body.
- `PROPOSAL` Mechanism: long random key; store only its SHA-256 hash on the installation (unique index); hash the presented key, look it up: no match → 401, match on another installation → 403.
- `PROPOSAL` A JWT sent to the device route is not a valid credential → 401.
- `PROPOSAL` (OQ-09) The device supplies the event `timestamp` (required, UTC); the server adds `received_at`. LEC S8 accepts device or server time.
- `DECIDED · YOU` **No timestamp tolerance or "not in the future" rule.** Neither the brief nor the reference material has one. Limitation to state: a device with a wrong clock can store odd timestamps.
- `OPEN` Numeric limits for validation (power vs `capacity_kw`, voltage range). Fix in Phase 4 with a reason for each number.
- `OPEN` (OQ-27) Because `energy_kwh` is cumulative: is a value lower than the previous reading rejected? Late or out-of-order readings make this unclear.
- `OPEN` (OQ-26) LEC S7/S8 list 404 for the POST route, but with a key-hash lookup an unknown installation gives 401/403 first, so 404 cannot occur. Options: drop 404 from this route's contract, or check existence before the key (reveals which ids exist).

## 10. Read path: user auth, scopes, jurisdiction
- `DECIDED · YOU` JWT bearer for users; `POST /login` issues it. `DECIDED · BRIEF §2` National, provincial and district users, read scope by jurisdiction. `DECIDED · BRIEF §5` A district user cannot read another district.
- `DECIDED · LEC S7` A valid user outside their jurisdiction → 403 (LEC S7's example).
- `PROPOSAL` The token carries `scope` (`solar:read`; admin also `solar:write`), `jurisdiction_level`, `jurisdiction_id`, short expiry (about 1 hour). WP §12.2 describes scopes; how I use them is my choice. It is my own JWT, **not full OAuth** (no authorization server).
- `PROPOSAL` National sees all; provincial sees their province and below; district sees their district and below.
- `DECIDED · YOU` (OQ-04) **The scope check runs on the path parent.** A district user may call `/districts/{own-district}/readings` and `/substations/{a-substation-in-it}/readings`, but `/provinces/{their-province}/readings` is broader than their jurisdiction → 403. A missing parent id → 404 before the scope check.
- `PROPOSAL` Collections are narrowed to the caller's scope; an explicit filter naming another jurisdiction → 403.
- `PROPOSAL` A lower-level user may read the *record* of their own parent province/district (to navigate), never sibling data, and never that parent's `/readings`.
- `PROPOSAL` (OQ-15) Demo users and device keys are documented in the README and Swagger, marked demo-only.
- Basic auth is not used (WP §12.1: only viable over HTTPS, and it carries no scopes). Users are seeded; no `/users` endpoints.

## 11. Query surface
- `DECIDED · WP §10.3` `offset` + `limit`; the response has `count` (total matching), `next`, `previous`. `PROPOSAL` defaults `offset=0`, `limit=20`, maximum `100`; bad values → 400.
- `DECIDED · YOU` (OQ-23) Sort syntax `sort=(timestamp DESC)`; several fields `sort=(a ASC, b DESC)`. `DECIDED · BRIEF §5` sort by timestamp asc/desc. `PROPOSAL` whitelist: readings → `timestamp`; installations → `installation_id`, `name`, `capacity_kw`. Default: readings newest first, others by id. Unknown field → 400.
- `PROPOSAL` Ties are broken by `installation_id` (always appended after the requested sort). Many installations share the same 15-minute timestamp, so without a tie-break the pages of a jurisdiction history could repeat or skip rows.
- `DECIDED · BRIEF §5` Filter by time window. `PROPOSAL` (OQ-20) parameters `from` and `to`, ISO 8601, both inclusive, on every readings collection.
- `DECIDED · YOU` (**OQ-04**) **Jurisdiction filtering of readings is done by path scoping, and everything else by query string.** Closed on 2026-09-19 as my own decision, not confirmed with the lecturer.

| What the client controls | Where it goes | Why |
|---|---|---|
| Which installation / substation / district / province | **Path**: `/installations/{id}/readings`, `/substations/{id}/readings`, `/districts/{id}/readings`, `/provinces/{id}/readings` | The collection only makes sense under a parent (WP §4.6, §5.6). The query string does not identify a resource (WP §5.7). The path parent also gives one clear place for the scope check. |
| Time window, sort, page size, page offset | **Query**: `from`, `to`, `sort`, `offset`, `limit` | These control how a collection is read (WP §5.7, §10.2, §10.3) |
| Catalogue narrowing of installations (and hierarchy lists) | **Query** on the first-class collections: `/installations?province_id=&district_id=&substation_id=`, `/districts?province_id=`, `/substations?district_id=&province_id=` | These collections exist at the top level, so filtering them is normal (WP §7.1, §10.2) |

  - Rejected: `GET /readings?district_id=…`. That needs a global readings collection, the "phantom collection" trap in LEC S3/S4 and WP §4.6.
  - Rejected: filters on `/installations` only. They filter installations, not readings, and would force one request per installation to get a region's history.
  - Rejected: copying province/district/substation ids onto every reading (about 161,000 rows, plus a consistency burden). Instead the service finds the installation ids under the path parent (using the derived ids on installations) and queries their readings. Side effect: an installation's history follows it if its substation changes.
  - Consequence: there is no country-wide readings list. A national user browses provinces. At seed scale the largest result is one province's readings, which is fine.
  - The jurisdiction readings collections are **GET only**. A reading is created only under its own installation.
- `DECIDED · BRIEF §5` / `WP §10.4` Conditional GET: unchanged → 304, empty body; `If-None-Match` beats `If-Modified-Since`.
- `OPEN` (technical, Phase 6) How the `ETag` is built: Express's default vs an explicit one (installations need a strong one for `If-Match`).
- Projection is optional in WP §10.2 and not in the brief. Not built.

## 12. Error contract
- `DECIDED · WP §11` `code` (integer) and `message` are required. `DECIDED · BRIEF §5` One consistent schema with a code, a message and supporting detail across the API.
- `PROPOSAL` Detail via `description`, `moreInfo` (a docs URL) and `error[]` with `{code, message}` per field (WP §11 fields). Integer codes = HTTP status × 100 + a number (for example 40001).
- `PROPOSAL` Unknown routes and 5xx use the same body; no stack traces.
- `PROPOSAL` `WWW-Authenticate` is `Bearer realm="solar"` for users and a custom `ApiKey realm="solar"` for devices (WP requires the header, not a scheme name).

## 13. Writable resources, roles and authorization
- `DECIDED · YOU` (OQ-03) **Writable:** readings (create only) and installations (create, replace, delete). **Read-only:** provinces, districts, substations, users (seeded), and every derived resource. Basis: the brief's write path is device ingestion (§5), and it asks for create/retrieve/update/delete "across the writable resources", so installations are the one asset that needs full CRUD (LEC S7/S8 make the same split for vehicles). The hierarchy is fixed reference data.
- `DECIDED · YOU` **Who may write what:**

| Client | Credential | Allowed | Refused with |
|---|---|---|---|
| Device | `X-API-Key` | `POST /installations/{own-id}/readings` only | another installation → 403; no or unknown key → 401; any other route → 401 (not a valid credential there) |
| Reader (national / provincial / district) | JWT, scope `solar:read` | `GET` inside jurisdiction | `POST`/`PUT`/`DELETE` → 403; outside jurisdiction → 403 |
| Admin | JWT, scope `solar:read` + `solar:write`, jurisdiction national | all `GET`; `POST`, `PUT`, `DELETE` on installations | posting readings → 401 (needs a device key) |
| Anyone | — | nothing on readings except POST by a device; no PUT/PATCH/DELETE on readings (405) | — |

- `DECIDED · YOU` The admin is one national-level role. Province- or district-level admins are not built (limitation).
- Risk to explain: brief §2 calls SLSEA users "read-clients". The admin writes installations, never readings, so I read §2 as "users never write generation readings" and §5's "writable resources" as the reason for an admin role.
- `DECIDED · WP §7.2` PUT replaces the whole resource. `DECIDED · WP §7.4` DELETE is 200 then 404. `DECIDED · WP §10.5` A stale `If-Match` → 412.
- `PROPOSAL` `POST /installations` takes `name`, `meter_id`, `substation_id`, `capacity_kw`; the server sets `installation_id`, `district_id`, `province_id`, `created_at`, `updated_at`; duplicate `meter_id` → 409; unknown `substation_id` → 400. PUT takes the same four fields; the derived ids are recomputed if `substation_id` changes; the client cannot change `installation_id`, `created_at`, the derived ids or the key hash.
- `PROPOSAL` (OQ-24) `If-Match` is optional on PUT.
- `PROPOSAL` (OQ-13) Deleting an installation keeps its readings in the database (history is evidence, LEC S8), but the API can no longer reach them. State the trade-off in the report.
- **`OPEN`** (OQ-28) How a newly created installation receives a device key. Default idea: return the plain key once in the 201 body (differs from what GET returns). Otherwise only seeded installations can ever have a working device.

## 14. Deliberate deviations and unlisted choices
1. `DECIDED · YOU` (OQ-21) Derived resources are noun sub-resources (`…/last-reading`, `…/generation-summary`), as the lectures teach, although WP §5.1 says verb names, not under an individual resource. Not confirmed with the lecturer. Defend in the critical evaluation.
2. `DECIDED · YOU` (OQ-04) Readings collections also exist under substation, district and province. This extends the brief's "scoped readings sub-collection under each installation" to satisfy "filter by jurisdiction" and "by region"; the lecture map (LEC S3/S4) shows readings under one parent only.
3. `PROPOSAL` 409 for duplicate readings and duplicate `meter_id` (not in WP §9's list). 405 with `Allow`. Custom `ApiKey` challenge.
4. `PROPOSAL` Own JWT instead of OAuth (WP §12.2 prefers OAuth).
5. Not built: `301` for old versions (only v1.0 exists), projection, `300` negotiation.
6. Where LEC and WP disagree I followed WP: error body (WP §11 over the LEC S8 sketch) and verb names for `/login`. For the single reading I followed LEC S8 + WP §7.3 over LEC S3, because a `Location` must be retrievable.

## 15. Richardson placement
- `DECIDED · BRIEF cover` Level 2: resources with URIs, correct methods, headers and status codes.
- Not Level 3: no hypermedia controls telling clients what to do next. WP §1 says no established practice exists. `next`/`previous` are pagination links only.
- Cite carefully: WP §1 says "Level 1" but describes Level 2 features, and §2 says "Level 2".

## 16. Open items and limits
- **Delivery process (`DECIDED · YOU`):** all development, database work and testing run locally (Mac, Node 22, Atlas database `slsea_local`); branches `dev_hashini` (mine) → `dev` (central, default branch); `deployment_dev` is the deploy branch and is updated by merge request **only for the smoke deploy (about Fri 25 Sep, deleted afterwards) and the final deploy (Thu 1 Oct)**; a GitHub Actions workflow deploys it to Azure App Service; `deployment_qa` kept as a best-practice marker and **not deployed**; **`main` never touched**; the final Azure app is the submitted URL. `PROPOSAL`: merge-commit MRs, tag `pN` on `dev` at phase end, tag `submission` on `deployment_dev`, freeze rule, Azure readiness rules (`PLAN.md` §12a), runbook (`PLAN.md` §12b); diagram `11`.
- **Genuinely OPEN:**
  - OQ-26: 404 on `POST …/readings` (unreachable after the key lookup).
  - OQ-27: is a lower cumulative `energy_kwh` rejected?
  - OQ-28: how a new installation gets a device key.
  - OQ-29: ETag construction.
  - OQ-32: workflow authentication to Azure (publish profile, OIDC or CLI ZIP fallback) — decided at the smoke deploy.
  - OQ-33 closed 2026-09-21: India South Central works; Basic B1 is about US$13.14/month; Free F1 is also available.
  - OQ-34: Express 4 (installed) or 5.
  - Validation limits (power vs `capacity_kw`, voltage range).
  - External: viva date and format (OQ-25); current-batch rubric not available.
- **Closed 2026-09-20 (`DECIDED · YOU`):** OQ-31 (Azure App Service instead of Render), local-first development, deployment by one GitHub Actions workflow, OQ-35 (local database `slsea_local`, deployed database `slsea_dev`), a zero-cost Azure validation now and a throwaway smoke deploy around 25–27 Sep.
- **Closed 2026-09-19 (`DECIDED · YOU`):** OQ-03, 04, 05, 06, 07, 14 (15-minute seed), 17 (deadline Sun 4 Oct 2026), 19 (Mongoose), 21, plus stored derived ids with seed integrity check and the seed size.
- **Awaiting my yes (`PROPOSAL`, each needed by its phase):** OQ-08 (composite contents), 09 (device timestamp), 12 (403 for out-of-scope, narrowing), 13, 15, 20 (`from`/`to`), 24; tie-break rule; parent-record visibility; today's-energy baseline; top-up script.
- **Sources not seen:** S3/S4 exist only in the lecturer's repo; S9–S15 are unavailable. WP covers the rules, but I cannot see how the lecturer applies them. Decisions above were made without lecturer confirmation.
- **Known limits:** deployment risk is concentrated in the last week (mitigated by the zero-cost validation, the production-mode rehearsals and the smoke deploy); no correction of a wrong reading; no key rotation; no rate limiting; the Azure credit is finite (delete the plan after marking); no old-version redirect; no country-wide readings list; one national admin role only; a wrong device clock can store odd timestamps.