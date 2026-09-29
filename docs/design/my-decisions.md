# My decisions — SLSEA Solar Generation API

Last updated: 2026-09-29 · Module: NB6007CEM CW1 · Attempt: fresh submission (no earlier submission, no marker feedback) · Repo: built and tested locally on `dev_hashini`, merged into `dev` · Viva: date/format not known yet · Deadline: Sun 4 Oct 2026 (confirmed) · Stack: Node/Express, Mongoose, MongoDB Atlas, Azure App Service (`DECIDED · YOU`, replaced Render on 2026-09-20) · **Local-first: everything is developed and tested locally; Azure hosts one deployed app (29 Sep), kept as the submitted app** (`DECIDED · YOU`, 2026-09-20, 2026-09-29) · Diagrams: `docs/design/diagrams/` (12)

**Status labels (strict).**
- `DECIDED · BRIEF §n` — the current coursework brief says it.
- `DECIDED · WP §n` / `DECIDED · LEC Sn` — an explicit rule in the white paper (the brief's design authority) or in the current lecture notes.
- `DECIDED · YOU` — I deliberately confirmed it in the planning conversation.
- `SUPERSEDED` — replaced by a later decision. Replaced lines are kept, word for word, in §17 (decision history), so each section shows only what is in force.
- `PROPOSAL` — a technical choice the coursework does not specify. Not mine until I confirm it.
- `OPEN` — cannot be confirmed from the sources, or sources conflict. Not chosen.

**Rubric (updated 2026-09-26).** The final marking rubric `NB6007CEM_Marking_Rubric.pdf` (module NB6007CEM, last modified 25 Aug 2026) is current and authoritative for marking; its weights match brief §11. The older rubric (NIB304CEM, batch 24.1P) is only a supplementary hint (see `PLAN.md` §17). The device JWT change in §9 follows the final rubric's Security bands.

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
- `DECIDED · YOU (2026-09-26)` The rule above is kept for installation writes (Phase 7): server-set fields in a POST or PUT body (`district_id`, `province_id`, `api_key_hash`, `device_key`, `created_at`, `updated_at`, `last_reading`) are ignored and recomputed, so a GET body can be PUT back. One exception: on PUT an `installation_id` that differs from the path id → 400 (40028); on POST an `installation_id` in the body is ignored (the server names installations). This supersedes the "read-only fields give 400" line of my Phase 7 prompt, which was never built. Readings keep their 40019 rule: a different resource, written by a device client.
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
- `DECIDED · YOU (2026-09-27)` How: the seed window ends at the time the seed is run; a second script tops up each installation from its newest reading to "now" without wiping anything (safe to re-run because of the unique installation+timestamp rule); both are run before submission and before the viva; the README states the "data as of" time. No background job generating fake device data on the host. Readings at night are 0 kW by design, so "current total power" can legitimately be 0 outside daylight.

## 3. Why no Device entity
- `DECIDED · BRIEF §3` `meter_id` is an attribute of the installation. One installation has one meter, so a Device entity adds a join and nothing else. The brief calls a needless Device entity a modelling flaw.
- `PROPOSAL` The device key hash also sits on the installation.
- A Device entity would only earn its place if I had to track meter replacement, calibration or battery history. I don't.

## 4. Why readings are an append-only time series
- `DECIDED · BRIEF §3` Readings are their own append-only series. Keeping only `last_power` on the installation would destroy the history, which is the "single most common modelling mistake" the brief names.
- `DECIDED · BRIEF §6` One series serves two needs: operational (what is generating now) and analytical (history over time and by region).
- `DECIDED · YOU` No PUT, PATCH or DELETE on readings. Only POST adds one.
- `DECIDED · YOU (2026-09-26)` Those forbidden calls answer 405 (40501) with an `Allow` header (`GET, POST` on the collection, `GET` on a single reading), before any credential check. (Neither the brief nor WP §9 names 405.)

## 5. Resource types

| Resource | Type | Basis |
|---|---|---|
| `/provinces`, `/districts`, `/substations`, `/installations` (+ members) | collection + atomic | `DECIDED · WP §4.1–4.2`; top-level shape `DECIDED · YOU` (OQ-05) |
| `/installations/{installation-id}` | composite: installation + `last_reading` (or `null`) | composite required `DECIDED · BRIEF §5`; contents `DECIDED · YOU (2026-09-27)` (OQ-08) |
| `/installations/{installation-id}/readings` | scoped collection (GET, POST) | required `DECIDED · BRIEF §5`; scoping `DECIDED · WP §4.6, §5.6` |
| `/substations/{substation-id}/readings`, `/districts/{district-id}/readings`, `/provinces/{province-id}/readings` | **scoped collections, GET only** — readings of every installation under that parent | `DECIDED · YOU` (OQ-04); supported by `BRIEF §5` (filter by jurisdiction), `§6` ("by region"), `WP §4.6, §5.6` |
| `/installations/{installation-id}/readings/{reading-id}` | atomic, only under its installation | `PROPOSAL` — needed so the `Location` of a POST resolves (WP §7.3, LEC S8) |
| `/installations/{installation-id}/last-reading` | processing function (derived: newest reading) | required `DECIDED · BRIEF §5`; noun sub-resource form `DECIDED · YOU` (OQ-21) |
| `/districts/{district-id}/generation-summary` | processing function (derived), **stretch** | `DECIDED · BRIEF §5` (stretch only); form `DECIDED · YOU` (OQ-21) |
| `POST /login` | processing function (verb name, issues a token) | `DECIDED · YOU` (OQ-11), `WP §5.1, §7.3` |

- `DECIDED · YOU` (OQ-21) **URI names are the name of the thing, not the kind of resource.** Derived resources under a parent are noun sub-resources: `…/installations/{installation-id}/last-reading` (scoped to one installation) and `…/districts/{district-id}/generation-summary` (scoped to one district, because that is what it summarises). "Processing function" is the design vocabulary for the *kind* (WP §4.5); it is never a URI segment, so there is no `/processing-functions` path. This follows the lectures (LEC S5/S6) and differs from WP §5.1, which asks for verb names and no sub-resource form for these. Not confirmed with the lecturer: my own decision.
- `PROPOSAL` Composite and `last-reading` use one shared "newest reading" helper, so the logic is not duplicated (LEC S6). The composite never embeds the history.
- `PROPOSAL` No controller resources: nothing needs an all-or-nothing update of several resources (WP §4.4).
- `DECIDED · YOU (2026-09-26)` Generation summary, "today": the Asia/Colombo calendar day (fixed +05:30, computed explicitly, never from the server timezone), from local 00:00 up to the request time (`as_of`).
- `DECIDED · YOU (2026-09-26)` Current power = sum of `power_kw` of each installation's newest reading at or before now. `newest_reading_at` and `oldest_latest_reading_at` (the newest and oldest of those timestamps) let a client see stale meters; no hidden staleness cut-off.
- `DECIDED · YOU (2026-09-26)` Today's energy = per installation, `energy_kwh` of its last reading today minus that of its first reading today (0 with fewer than two readings today), summed over the district. Valid because `energy_kwh` is cumulative and solar output is zero around midnight, so nothing is lost at the day boundary. kWh and kW rounded to 3 decimals. Considered: newest minus the last reading before local midnight (captures energy when a meter is silent across the morning but counts several silent days as today); rejected in favour of last-minus-first today, which never overcounts. Limitation: a meter silent from midnight until after sunrise undercounts today.
- `DECIDED · YOU (2026-09-26)` Response: a plain object (no collection envelope) with `district_id`, `date`, `timezone`, `as_of`, `installations_total`, `installations_reporting_today`, `current_power_kw`, `today_energy_kwh`, `newest_reading_at`, `oldest_latest_reading_at`. Same scope rules as `GET /districts/{district-id}`; no query parameters (unknown ones ignored). It carries a strong ETag like every GET, but its body contains `as_of`, so the ETag changes on every request and it never returns 304 (accepted; `as_of` stays). No `Last-Modified`. Computed in MongoDB: one aggregation with three `$lookup`s on the `(installation_id, timestamp)` index, one key per installation each.

## 6. URIs, base path, naming, scoping
- `DECIDED · YOU` Base path `/solar/v1.0` (WP §5.4–5.5). `/`, `/docs`, `/docs.json` sit outside it.
- `DECIDED · YOU (2026-09-26)` **OpenAPI surface (BRIEF §7 item 2).** One hand-written OpenAPI 3.0.3 file, `docs/openapi.yaml`, is the single source (not generated from code comments). It documents what the code does; a difference between spec and code is reported, not silently fixed in either. It is read once at start-up (`yaml`); Swagger UI (`swagger-ui-express`, assets from the package, no CDN) at `GET /docs` (which redirects 301 to `/docs/`) and the spec as JSON at `GET /docs.json`, both public, outside `/solar/v1.0`, before the 404 catch-all. `servers` is the relative `/solar/v1.0`, so the same spec works locally and on Azure. `swagger-ui-dist` telemetry is switched off (`scarfSettings.enabled: false`). Tested by `test/openapi.test.js` (valid spec, every documented operation exists, 405 `Allow` equals the documented methods, every error code is in the description).
- `DECIDED · YOU (2026-09-26)` **Spec content.** One `http` bearer scheme (JWT); every protected operation states its scope in its description and in `x-required-scope`, and lists 401 and 403 (40303). `POST /login` shows both body forms (`oneOf`) with placeholder values only. Operations are tagged Auth, Hierarchy, Installations, Readings, Operational and list their parameters with constraints, bodies, status codes with the one Error schema, and response headers. 304 is documented on conditional GETs (not on the generation summary, which never returns 304, §5); 405 with `Allow` is stated per path and in the description; 500 is mentioned once in the description, not per operation (LEC S7). The error-code table (§12, retired codes marked) is in `info.description`.
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
| `POST …/readings` | **201** + `Location`, `ETag`, `Last-Modified`, body | 400, 401, 403, 405, 406, 409, 413, 415 | 201 + `Location` `DECIDED · BRIEF §5`; headers `DECIDED · BRIEF App. A`; 409 `PROPOSAL` |
| `POST /installations` `DECIDED · YOU (2026-09-26)` | **201** + `Location`, strong `ETag` (the one GET returns), `Last-Modified`, `Cache-Control: no-store`, body with `device_key` | 400, 401, 403, 405, 406, 409, 413, 415 | `WP §7.3, §9`; §13 |
| `PUT /installations/{id}` `DECIDED · YOU (2026-09-26)` | 200 + the GET representation, new `ETag`, `Last-Modified` | 400, 401, 403, 404, 405, 406, 409, 412, 413, 415 | `WP §7.2, §10.5`; §13 |
| `DELETE /installations/{id}` `DECIDED · YOU (2026-09-26)` | 200 + the deleted representation, then 404 on repeat | 401, 403, 404, 405, 406, 409, 412 | `WP §7.4`; §13 |
| `POST /login` `DECIDED · YOU (2026-09-26)` | 200 + token, `Cache-Control: no-store` (`DECIDED · YOU (2026-09-27)`) | 400, 401, 405, 406, 413, 415 | check order 405, 406, 415, then 400/401 |

- `DECIDED · YOU (2026-09-26)` `Content-Location` on 201 (WP §7.3 mentions it when the body repeats the resource).
- `PROPOSAL` Bad input is 400, never 422. DELETE is 200, not 204 (WP §7.4).
- `DECIDED · WP §10.1` A wrong `Accept` gets 406 even with one media type. `DECIDED · WP §9` Wrong request `Content-Type` → 415. Every 401 carries `WWW-Authenticate`.
- `DECIDED · YOU (2026-09-26)` 406 (40601, standard error body, sent as JSON) when an `Accept` header is present and does not allow `application/json` (`req.accepts`). No `Accept` or `*/*` is fine. Checked right after 405 and before 415 and 401, on every `/solar/v1.0` route including `/login` and the device POST (diagram 04c).
- `DECIDED · YOU (2026-09-26)` Idempotency of ingest: a retry with the same installation + timestamp gets 409 (40901), not a second row. The unique `(installation_id, timestamp)` index is the final guard (duplicate key error 11000), so two concurrent requests cannot both succeed. 409 is standard HTTP but not in WP §9's list.
- The order in which checks run on each route is `DECIDED · YOU (2026-09-26)` (§8, §9) and drawn in diagram `04c`.
- `DECIDED · YOU (2026-09-27)` **Body-reading errors come first.** `express.json()` reads the body before any route check, so on any URI these come before 405, 406 and 401, with the standard error body: malformed JSON → 400 (40001); a body over 100 KB → **413 (41301)**; an unsupported charset or encoding → 415 (41501). Before this they became 500 (security review, 2026-09-27). Noted in diagram `04c`.
- `DECIDED · YOU (2026-09-27)` **Security headers** on every response (one middleware, no new dependency, no helmet): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000`; `X-Powered-By` stays disabled. **No Content-Security-Policy:** a strict policy would break Swagger UI's inline scripts and styles at `/docs`.
- `DECIDED · YOU (2026-09-27)` **CORS stays open** (`Access-Control-Allow-Origin: *`). Reason: credentials are bearer tokens only, never cookies, so a browser never attaches them by itself and there is no CSRF; the API is meant to be called by dashboards and other clients.
- `DECIDED · YOU (2026-09-27)` `POST /login` sends `Cache-Control: no-store` on the token response (RFC 6749 §5.1), as `POST /installations` does for the device key.
- `DECIDED · YOU (2026-09-26)` **405 (40501) with `Allow` on every URI that exists but does not support the method**, before 406 and 401: `Allow: GET` on `/provinces`, `/districts`, `/substations`, their members, their `/readings`, `/districts/{district-id}/generation-summary` and `/installations/{installation-id}/last-reading`; `Allow: GET, POST` on `/installations`; `Allow: GET, PUT, DELETE` on `/installations/{installation-id}`; `Allow: POST` on `/login`; the readings rules in §4 are unchanged. HEAD works wherever GET does (not listed in `Allow`). OPTIONS is answered by the CORS middleware before the routes. (Neither the brief nor WP §9 names 405.)
- `DECIDED · YOU (2026-09-26)` Check order on the installation writes: 405, 406, 415 (POST/PUT only), 401, 403 insufficient scope (40303), 403/404 by jurisdiction and existence, 412, 400, 409 (diagram `04c`).
- `DECIDED · YOU (2026-09-26)` The `Content-Location` rule above applies to `POST …/readings`. `POST /installations` sends **no** `Content-Location`: its body differs from the GET representation because it carries `device_key` (WP §7.3 ties `Content-Location` to a body that is the resource as GET returns it). Its `ETag` is set to the strong ETag that GET will return (the composite with `last_reading: null`), not Express's hash of the 201 body, so it can be used for `If-Match` at once.

## 9. Write path: device auth and ingest
- `DECIDED · YOU (2026-09-26)` (OQ-10) Missing, invalid or expired token → **401** (40101/40102). A valid device token used on a different installation → **403** (40302). Matches WP §9.
- `DECIDED · BRIEF §5` A device authenticates as its installation. `DECIDED · LEC S8` The installation id comes from the path only, never the body.
- `DECIDED · YOU (2026-09-26)` **Device JWT (client-credentials pattern), replaces X-API-Key.** Reason: the final rubric's Security bands put "JWT bearer authentication with correctly designed scopes (for example installation-write …)" at First, "JWT bearer on the write path" at Upper second and "API-key authentication on the write path" at Lower second. WP §12.1 allows simple credentials "for requests that generate more secure access tokens"; WP §12.2: "In case the token provided is not sufficient for the scopes, the request fails."
  - `POST /login` accepts `{username, password}` (users, unchanged) or `{installation_id, device_key}` (devices). Both forms, or neither complete form, → 400 (40010) with a 40022 item; a started but incomplete form → per-field items (40011/40012 user, 40020/40021 device).
  - Device check: load the installation's `api_key_hash` by `installation_id`, compare SHA-256(`device_key`) with `crypto.timingSafeEqual`; an unknown id (or one without a key) is compared with a dummy hash. Unknown id and wrong key → the same 401 body (40106) with `WWW-Authenticate: Bearer realm="solar"`. The key, its hash and the body are never logged.
  - Device token: HS256, 1 hour, claims `sub` = installation id, `role` "device", `scope` "readings:write"; no jurisdiction claims. Same 200 `{access_token, token_type: "Bearer", expires_in: 3600}`.
  - `POST …/readings` takes `Authorization: Bearer` only; X-API-Key is no longer accepted (a request with only X-API-Key → 401, 40101).
- `DECIDED · YOU (2026-09-26)` Every installation created by the seed or by `POST /installations` gets a device key (§13, OQ-28). The unique index on `api_key_hash` stays **partial** (only where the field is a string): a document without a key is still valid, it just cannot log in. See `docs/design/data-model.md`.
- `DECIDED · YOU (2026-09-26)` A reader or admin token on the device route is valid but lacks `readings:write` → 403 (40303, insufficient scope). The route runs `authenticate`, then `requireScope('readings:write')`, then the own-installation check.
- `DECIDED · YOU (2026-09-26)` (OQ-09) The device supplies the event `timestamp` (required, UTC); the server adds `received_at`. LEC S8 accepts device or server time.
- `DECIDED · YOU` **No timestamp tolerance or "not in the future" rule.** Neither the brief nor the reference material has one. Limitation to state: a device with a wrong clock can store odd timestamps.
- `DECIDED · YOU (2026-09-26)` Content-Type other than `application/json` → 415 (41501). Check order on this route: 405, 406, 415, 401, 403 insufficient scope (40303), 403 not own installation (40302), 400, 409.
- `DECIDED · YOU (2026-09-26)` Body: only `timestamp`, `power_kw`, `energy_kwh`, `voltage` are read; `reading_id`, `installation_id`, `received_at` are server-set and give 400 if sent (40019 each); other unknown fields are ignored.
- `DECIDED · YOU (2026-09-26)` Validation, all problems in one 400 (40010) with per-field `error[]`: `timestamp` ISO 8601 UTC ending in `Z` (40013) on a 15-minute boundary (40014); `power_kw` a number from 0 to the installation's `capacity_kw` (40016); `energy_kwh` a number ≥ 0 (40017); `voltage` a number from 0 to 300 (40018).
- `DECIDED · YOU (2026-09-26)` (OQ-27) Compared with the newest stored reading: a timestamp older than it → 409 (40903); `energy_kwh` lower than its `energy_kwh` → 409 (40902); equal is allowed. Consequence: late or out-of-order readings are refused.
- `DECIDED · YOU (2026-09-26)` (OQ-26) No 404 on this route: a device token whose installation is not the path installation, or whose path installation does not exist, gets 403 (40302). The route never reveals whether an installation exists.

## 10. Read path: user auth, scopes, jurisdiction
- `DECIDED · YOU` JWT bearer for users; `POST /login` issues it. `DECIDED · BRIEF §2` National, provincial and district users, read scope by jurisdiction. `DECIDED · BRIEF §5` A district user cannot read another district.
- `DECIDED · LEC S7` A valid user outside their jurisdiction → 403 (LEC S7's example).
- `DECIDED · YOU (2026-09-26)` A user token carries `scope` (`solar:read`; admin `solar:read installations:write`, renamed from `solar:write`, which nothing checked), `jurisdiction_level`, `jurisdiction_id`, 1-hour expiry. Own JWT, **not full OAuth** (no authorization server).
- `DECIDED · YOU (2026-09-26)` Scopes are enforced in one middleware (`requireScope`): every GET route needs `solar:read`; `POST …/readings` needs `readings:write`. Missing scope → 403 (40303) with `WWW-Authenticate: Bearer realm="solar", error="insufficient_scope", scope="<needed scope>"` (RFC 6750 §3.1). A device token cannot read; a user token cannot post readings. WP §12.2.
- `DECIDED · YOU (2026-09-26)` National sees all; provincial sees their province and below; district sees their district and below.
- `DECIDED · YOU (2026-09-26)` (OQ-04) **The scope check runs on the path parent.** A district user may call `/districts/{own-district}/readings` and `/substations/{a-substation-in-it}/readings`, but `/provinces/{their-province}/readings` is broader than their jurisdiction → 403. Province and district users get 403 before any 404, so they cannot learn whether an id exists; national users get 404 for a missing id.
- `DECIDED · YOU` (2026-09-26) Collections are narrowed to the caller's scope; an explicit filter naming another jurisdiction → 200 with `count` 0, not 403. Reason: a filter narrows and never reveals; same as an unknown filter value.
- `DECIDED · YOU` (2026-09-26) A province or district user reads only their own subtree; ancestors above it (the parent province or district record, and its `/readings`) → 403. Reason: least privilege, one rule: a user reads only their own subtree.
- `DECIDED · YOU (2026-09-26)` (OQ-15) The README lists the demo usernames, roles and jurisdictions but **no passwords and no device keys**; they are given only in the report appendix, so no credential is ever committed. The README says where to find them. Still not in the public Swagger (public admin credentials would let anyone change the live API); the spec's description says demo accounts are provided separately to the marker.
- Basic auth is not used (WP §12.1: only viable over HTTPS, and it carries no scopes). Users are seeded; no `/users` endpoints.
- `DECIDED · YOU (2026-09-27)` **Signing secret.** `JWT_SECRET` must be at least 32 bytes (for example `openssl rand -hex 32`); `src/server.js` refuses to start otherwise, with a message that never prints the value or its length. Reason: an HS256 secret that is too short can be brute-forced offline from one issued token.
- `DECIDED · YOU (2026-09-27)` **No `iss`/`aud` claims.** Each environment uses its own `JWT_SECRET` (Azure gets a new one, never the local value), so a token from one environment is not valid in another.
- `DECIDED · YOU (2026-09-27)` **Access control combines scopes and attributes.** Scopes (`solar:read`, `readings:write`, `installations:write`) decide what kind of action a token may take; the jurisdiction attributes in the token (`jurisdiction_level`, `jurisdiction_id`) are compared with the resource's `district_id`/`province_id` to decide where. Trade-off: full attribute-based access control (more attributes such as time, device state or per-installation grants, evaluated by a policy engine) would be finer-grained but harder to test and audit; this API keeps three fixed scopes and one jurisdiction rule in `services/scope.js`, fully tested. Limit: it cannot express per-installation read grants without new code.
- `DECIDED · YOU (2026-09-27)` A token whose `exp` is missing or not a number → 401 (40102). `jwt.verify` alone accepts a token without `exp`; every token this API issues has one (1 hour).

## 11. Query surface
- `DECIDED · WP §10.3` `offset` + `limit`; the response has `count` (total matching), `next`, `previous`. `PROPOSAL` (built in D6, 2026-09-26) defaults `offset=0`, `limit=20`; `limit` must be 1–100; bad values → 400 with per-field `error[]`. An `offset` past the end → 200 with empty `data` and the full `count`. A filter given twice → 400 (keeps an array out of the database query). Unrecognised query parameters are ignored.
- `DECIDED · YOU` (OQ-23) Sort syntax `sort=(timestamp DESC)`; several fields `sort=(a ASC, b DESC)`. `DECIDED · BRIEF §5` sort by timestamp asc/desc. `PROPOSAL` whitelist: readings → `timestamp`; installations → `installation_id`, `name`, `capacity_kw`. Default: readings newest first, others by id. Unknown field → 400.
- `DECIDED · YOU (2026-09-26)` Hierarchy sort whitelists (as built): provinces → `province_id`, `name`; districts → `district_id`, `name`; substations → `substation_id`, `name`. Default and final tie-break: the collection's id, ascending. Same syntax and 40005 rule as above.
- `DECIDED · YOU (2026-09-27)` Ties are broken by `installation_id` (always appended after the requested sort). Many installations share the same 15-minute timestamp, so without a tie-break the pages of a jurisdiction history could repeat or skip rows.
- `DECIDED · BRIEF §5` Filter by time window. `DECIDED · YOU (2026-09-27)` (OQ-20) parameters `from` and `to`, ISO 8601 UTC ending in `Z`, both inclusive, on every readings collection.
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
- `DECIDED · BRIEF §5` / `WP §10.4` Conditional GET: unchanged → 304, empty body; `If-None-Match` beats `If-Modified-Since`. Express 5's own check (`fresh` 2.0) already ignores `If-Modified-Since` when `If-None-Match` is present, so there is no custom check.
- `DECIDED · YOU (2026-09-26)` (OQ-29) ETag: strong, content-based (`app.set('etag', 'strong')`), on every GET and the 201. Reason: it works for collections and derived resources too, and a strong tag is needed for `If-Match` on admin PUT (OQ-24, 412).
- `DECIDED · YOU (2026-09-26)` `Last-Modified` only where a real timestamp exists: installation (the later of `updated_at` and `last_reading.received_at`, because the member is the composite), a reading and `last-reading` (`received_at`), and the 201 (`received_at`). None on provinces, districts, substations, collections or the generation summary.
- `DECIDED · YOU (2026-09-26)` Protected GETs send `Cache-Control: private, no-cache` and `Vary: Authorization`: the response depends on the caller's scope, shared caches must never reuse it, and `no-cache` forces revalidation with the ETag. `GET /` is unchanged.
- `DECIDED · YOU (2026-09-26)` 304: empty body, keeps `ETag` (and `Last-Modified` where it applies); only after authentication and scope checks pass (401/403/404 never become 304). HEAD follows the same rules.
- Note for OQ-24: the installation member's ETag covers `last_reading`, so it changes with each new reading.
- `DECIDED · YOU (2026-09-26, chosen as option A after the explain measurement)` Jurisdiction readings routes sort across installations in memory (top-k, bounded by offset + limit). Measured with explain on PV-04 (48 installations, ~32,000 readings), 26 Sep: 8-77 ms, no disk use, far under the Atlas 32 MB sort limit. Accepted as-is; a (timestamp, installation_id) index or an offset cap is the fix if the data grows.
- Projection is optional in WP §10.2 and not in the brief. Not built.

## 12. Error contract
- `DECIDED · WP §11` `code` (integer) and `message` are required. `DECIDED · BRIEF §5` One consistent schema with a code, a message and supporting detail across the API.
- `PROPOSAL` Detail via `description`, `moreInfo` (a docs URL) and `error[]` with `{code, message}` per field (WP §11 fields).
- `DECIDED · YOU (2026-09-29)` Integer codes = HTTP status × 100 + a number (for example 40001). Reason: WP §11 only requires an integer, product-specific code; the S7 lecture demo uses status × 1000 + n.
- Codes in use (2026-09-27): 40001 malformed JSON · 40002 invalid query parameters · 40003 offset · 40004 limit · 40005 sort · 40006 filter given twice · 40007 `from` not a valid UTC timestamp · 40008 `to` not a valid UTC timestamp · 40009 `from` later than `to` (40003–40009 as per-field items in `error[]`) · 40010 invalid request body · 40011 `username` missing or not a non-empty string · 40012 `password` missing or not a non-empty string (40011–40012 as per-field items in `error[]`) · 40013 `timestamp` missing or not an ISO 8601 UTC timestamp · 40014 `timestamp` not on a 15-minute boundary · 40016 `power_kw` not a number from 0 to `capacity_kw` · 40017 `energy_kwh` not a number ≥ 0 · 40018 `voltage` not a number from 0 to 300 · 40019 read-only field sent (40013–40019 as per-field items in `error[]`) · 40020 `installation_id` missing or not a non-empty string · 40021 `device_key` missing or not a non-empty string · 40022 login body has both credential forms or neither (40020–40022 as per-field items in `error[]`, added 2026-09-26) · 40023 `name` missing or not a non-empty string · 40024 `meter_id` missing or not a non-empty string · 40025 `substation_id` missing or not a non-empty string · 40026 `substation_id` does not name an existing substation · 40027 `capacity_kw` not a number greater than 0 and at most 1000 · 40028 `installation_id` in a PUT body differs from the path (40023–40028 as per-field items in `error[]`, added 2026-09-26) · 40101 authentication required (no bearer token) · 40102 invalid or expired token · 40103 invalid username or password · 40104 API key required (retired 2026-09-26, X-API-Key removed) · 40105 API key not accepted (retired 2026-09-26, X-API-Key removed) · 40106 invalid device credentials (added 2026-09-26) · 40301 outside your jurisdiction · 40302 not your installation · 40303 insufficient scope (added 2026-09-26) · 40401 route not found · 40402 resource not found · 40403 no reading yet (installation exists) · 40501 method not allowed · 40601 not acceptable (Accept does not allow application/json) · 40901 duplicate reading · 40902 `energy_kwh` lower than the latest reading · 40903 reading older than the latest reading · 40904 duplicate `meter_id` · 40905 installation has readings (DELETE refused) · 40906 no installation id could be assigned (3 duplicate-key retries, or past INS-9999) · 41201 precondition failed (`If-Match` does not match) (40904–41201 added 2026-09-26) · 41301 payload too large (body over 100 KB, added 2026-09-27) · 41501 unsupported media type · 50001 unexpected error.
- `PROPOSAL` Unknown routes and 5xx use the same body; no stack traces.
- `DECIDED · YOU (2026-09-26)` `WWW-Authenticate` is `Bearer realm="solar"` on every 401, for users and devices; `error="invalid_token"` when a token was sent and rejected. A 403 for a missing scope carries `error="insufficient_scope", scope="…"`.

## 13. Writable resources, roles and authorization
- `DECIDED · YOU` (OQ-03) **Writable:** readings (create only) and installations (create, replace, delete). **Read-only:** provinces, districts, substations, users (seeded), and every derived resource. Basis: the brief's write path is device ingestion (§5), and it asks for create/retrieve/update/delete "across the writable resources", so installations are the one asset that needs full CRUD (LEC S7/S8 make the same split for vehicles). The hierarchy is fixed reference data.
- `DECIDED · YOU` **Who may write what:**

| Client | Credential | Allowed | Refused with |
|---|---|---|---|
| Device `DECIDED · YOU (2026-09-26)` | JWT from `POST /login` (`installation_id` + `device_key`), scope `readings:write` | `POST /installations/{own-id}/readings` only | another installation → 403 (40302); no, invalid or expired token → 401; any GET → 403 (40303, needs `solar:read`) |
| Reader (national / provincial / district) | JWT, scope `solar:read` | `GET` inside jurisdiction | `POST` readings → 403 (40303); `POST`/`PUT`/`DELETE` installations → 403; outside jurisdiction → 403 |
| Admin `DECIDED · YOU (2026-09-26)` | JWT, scope `solar:read` + `installations:write`, jurisdiction national | all `GET`; `POST`, `PUT`, `DELETE` on installations | posting readings → 403 (40303, needs `readings:write`) |
| Anyone | — | nothing on readings except POST by a device; no PUT/PATCH/DELETE on readings (405) | — |

- `DECIDED · YOU (2026-09-27)` Only a national admin is seeded. The code limits any admin to its own subtree (tested in `test/admin-crud.test.js`); province- or district-level admin accounts are not seeded, and there are no `/users` endpoints to create them.
- Interpretation: brief §2 calls SLSEA users "read-clients". The admin writes installations, never readings, so I read §2 as "users never write generation readings" and §5's "writable resources" as the reason for an admin role.
- `DECIDED · WP §7.2` PUT replaces the whole resource. `DECIDED · WP §7.4` DELETE is 200 then 404. `DECIDED · WP §10.5` A stale `If-Match` → 412.
- `DECIDED · YOU (2026-09-26)` (Q6) **Permission.** `POST`, `PUT` and `DELETE` on installations need scope `installations:write` (`requireScope`; otherwise 403/40303), plus the existing jurisdiction rule (`scope.js`): a target installation or substation outside the admin's subtree → 403 (40301), as for reads; a national admin gets 404 for a missing installation. Only a national admin exists today.
- `DECIDED · YOU (2026-09-26)` (Q3) **Body for POST and PUT:** `name` (non-empty string), `meter_id` (non-empty string), `substation_id` (must exist, else 400/40026), `capacity_kw` (number > 0 and ≤ 1000; the upper bound is `DECIDED · YOU (2026-09-27)`). All four required on both: PUT is a whole replacement (WP §7.2), no partial update. Whitespace-only strings count as empty; values are stored trimmed. `district_id` and `province_id` always come from the substation (§2). Server-set fields in the body are ignored (§2); unknown fields are ignored. All problems in one 400 (40010) with `error[]`. Duplicate `meter_id` → 409 (40904), checked first; the unique index is the final guard.
- `DECIDED · YOU (2026-09-26)` (Q2) **Id:** the server picks the next `INS-NNNN` after the highest existing number; on a duplicate-key error (two admins at once) it retries with a fresh id, at most 3 attempts, then 409 (40906).
- `DECIDED · YOU (2026-09-26)` (Q1, **OQ-28**) **Key issuance:** POST generates a device key (`crypto.randomBytes(32)`, hex), stores only its SHA-256 hex in `api_key_hash`, and returns the plain key **once** as `device_key` in the 201 body, with `Cache-Control: no-store`. It is never returned again and never logged. The device then uses `POST /login` with `installation_id` + `device_key` (§9).
- `DECIDED · YOU (2026-09-26)` **PUT** `/installations/{installation-id}`: the installation must exist (404 national, 403 scoped, as for reads); PUT never creates one (the server names installations, WP §7.2 note). Success: 200 with the same representation GET returns (the composite), a new strong ETag and `Last-Modified`; `updated_at` changes.
- `DECIDED · YOU (2026-09-26)` (Q4, **OQ-24**) **`If-Match` is optional** on PUT and DELETE. If present and it does not match the current strong ETag of `GET /installations/{installation-id}` → 412 (41201). `If-Match: *` matches any existing installation; a weak tag (`W/…`) never matches (strong comparison). The current ETag is computed with Express's own ETag function (`req.app.get('etag fn')`) over the same JSON GET sends. When `If-Match` matched, the update or delete also filters on the `updated_at` that was read, so a change in between gives 412 instead of a lost update. Note: the composite ETag covers `last_reading`, so it changes whenever a new reading arrives; a stale `If-Match` after a device posts gives 412 and the admin re-GETs (accepted; admin edits are rare).
- `DECIDED · YOU (2026-09-26)` (Q5, **OQ-13**) **DELETE:** if the installation has any readings → 409 (40905) and nothing is deleted (the history is append-only evidence). Otherwise it is deleted → 200 with the deleted installation's representation; a repeat DELETE → 404 (WP §7.4).
- Known limits (2026-09-26): the DELETE "has readings" check and the delete are not atomic (no transaction), so a reading arriving in between is left without its installation; ids stop at INS-9999 (the device token also requires four digits), after which POST gives 409 (40906).
- Known limit (2026-09-26): moving an installation to another substation (PUT) moves its whole reading history to the new district's and province's views, because readings carry only installation_id.

## 14. Deliberate deviations and unlisted choices
1. `DECIDED · YOU` (OQ-21) Derived resources are noun sub-resources (`…/last-reading`, `…/generation-summary`), as the lectures teach, although WP §5.1 says verb names, not under an individual resource. Not confirmed with the lecturer.
2. `DECIDED · YOU` (OQ-04) Readings collections also exist under substation, district and province. This extends the brief's "scoped readings sub-collection under each installation" to satisfy "filter by jurisdiction" and "by region"; the lecture map (LEC S3/S4) shows readings under one parent only.
3. `PROPOSAL` 409 for duplicate readings and duplicate `meter_id` (not in WP §9's list). 405 with `Allow`. (The custom `ApiKey` challenge was removed on 2026-09-26 with X-API-Key.)
4. `PROPOSAL` Own JWT instead of OAuth (WP §12.2 prefers OAuth). Devices use the same token issuer in a client-credentials pattern (device key → token), not an OAuth authorization server.
5. Not built: `301` for old versions (only v1.0 exists), projection, `300` negotiation.
6. Where LEC and WP disagree I followed WP: error body (WP §11 over the LEC S8 sketch) and verb names for `/login`. For the single reading I followed LEC S8 + WP §7.3 over LEC S3, because a `Location` must be retrievable.

## 15. Richardson placement
- `DECIDED · BRIEF cover` Level 2: resources with URIs, correct methods, headers and status codes.
- Not Level 3: no hypermedia controls telling clients what to do next. WP §1 says no established practice exists. `next`/`previous` are pagination links only.
- Note: WP §1 says "Level 1" but describes Level 2 features, and §2 says "Level 2".

## 16. Open items and limits
- **Delivery process (`DECIDED · YOU`):** all development, database work and testing run locally (Mac, Node 22, Atlas database `slsea_local`); branches `dev_hashini` (mine) → `dev` (central, default branch); `deployment_dev` is the deploy branch and is updated by merge request **only for releases: the first deploy (`DECIDED · YOU (2026-09-29)`: Tue 29 Sep 2026; the planned Mon 28 Sep smoke deploy did not happen) and the final release (Thu 1 Oct)**; a GitHub Actions workflow deploys it to Azure App Service; `deployment_qa` kept as a best-practice marker and **not deployed**; **`main` never touched**; `DECIDED · YOU (2026-09-29)` the app deployed on 29 Sep (`solar-api-dev-hr`) is kept as the submitted app (no delete-and-recreate) and is scaled F1 → B1 before submission. `PROPOSAL`: merge-commit MRs, tag `pN` on `dev` at phase end, tag `submission` on `deployment_dev`, freeze rule, Azure readiness rules (`PLAN.md` §12a), runbook (`PLAN.md` §12b); diagram `08`.
- **Genuinely OPEN:**
  - External: viva date and format (OQ-25).
- **Closed 2026-09-29 (`DECIDED · YOU`):** OQ-32 (workflow authentication: the publish-profile method works; Actions run #1 green, `docs/evidence/azure-deploy-2026-09-29.md`); the app deployed on 29 Sep is kept as the submitted app (no delete-and-recreate), scaled F1 → B1 before submission; error codes = HTTP status × 100 + a number (§12).
- **Closed 2026-09-27 (`DECIDED · YOU`):** OQ-08 (composite = installation + `last_reading`), OQ-20 (`from`/`to`, UTC with `Z`, inclusive), the `installation_id` tie-break, the top-up script, the `capacity_kw` upper bound of 1000 (§2, §5, §11, §13); smoke deploy date Mon 28 Sep 2026. The in-memory top-k sort (§11) was decided on 2026-09-26 as option A.
- **Closed 2026-09-26, Phase 7 (`DECIDED · YOU`):** OQ-03 built (admin CRUD on installations), OQ-13 (DELETE refused while readings exist), OQ-24 (optional `If-Match`, 412), OQ-28 (key returned once in the 201); 405 on every read-only URI (§8, §13).
- **Closed 2026-09-26 (`DECIDED · YOU`):** OQ-26 (403, no 404 on POST readings), OQ-27 (older → 40903, lower energy → 40902), OQ-09 (device timestamp, server `received_at`), validation limits (§9), OQ-29 (strong content ETag), the 406 rule, Cache-Control/Vary.
- **Closed 2026-09-21:** OQ-33 (India South Central works; Basic B1 about US$13.14/month; Free F1 also available), OQ-34 (Express 5). The final rubric (25 Aug 2026 version) was received and is used from 2026-09-26.
- **Closed 2026-09-20 (`DECIDED · YOU`):** OQ-31 (Azure App Service instead of Render), local-first development, deployment by one GitHub Actions workflow, OQ-35 (local database `slsea_local`, deployed database `slsea_dev`), a zero-cost Azure validation now and a throwaway smoke deploy around 25–27 Sep.
- **Closed 2026-09-19 (`DECIDED · YOU`):** OQ-03, 04, 05, 06, 07, 14 (15-minute seed), 17 (deadline Sun 4 Oct 2026), 19 (Mongoose), 21, plus stored derived ids with seed integrity check and the seed size.
- **Sources not seen:** S3/S4 exist only in the lecturer's repo; S9–S15 are unavailable. WP covers the rules, but I cannot see how the lecturer applies them. Decisions above were made without lecturer confirmation.
- **Known limits:** deployment risk is concentrated in the last week (mitigated by the zero-cost validation, the production-mode rehearsals and the smoke deploy); no correction of a wrong reading; no rate limiting; the Azure credit is finite (delete the plan after marking); no old-version redirect; no country-wide readings list; only a national admin is seeded (no `/users` endpoints to create province- or district-level admins); a wrong device clock can store odd timestamps; the DELETE readings check is not atomic; installation ids stop at INS-9999.
  - `DECIDED · YOU (2026-09-26)` no key rotation through the API; an operator can rotate all demo passwords and device keys at once with scripts/seed.js --rotate-credentials.
  - moving an installation to another substation (PUT) moves its whole reading history to the new district's and province's views, because readings carry only installation_id.
  - demo passwords from before 2026-09-26 remain in git history (commit 1d622b5); they were rotated and no longer work.
  - no token revocation: rotating passwords or keys does not cancel tokens already issued; they stay valid until their 1-hour expiry.
  - `DECIDED · YOU (2026-09-27)` scripts/seed-keys.txt (git-ignored) is set to mode 600 after every write (seed and `--rotate-credentials`), not only when it is first created.

## 17. Decision history (superseded lines)

Lines replaced by a later decision, moved here word for word from their sections on 2026-09-26 so the sections above show only what is in force. The replacing decision is in the section named.

### From §8 Methods, status codes, headers
- SUPERSEDED 2026-09-26 (Phase 7, rows below) `POST /installations` — success: 201 + same headers; errors: 400, 401, 403, 409, 415; basis: `DECIDED · YOU` (OQ-03); 409 `PROPOSAL`
- SUPERSEDED 2026-09-26 (Phase 7, rows below) `PUT /installations/{id}` — success: 200 (whole replacement); errors: 400, 401, 403, 404, 412, 415; basis: whole replacement `DECIDED · WP §7.2`; 412 on stale `If-Match` `DECIDED · WP §10.5`
- SUPERSEDED 2026-09-26 (Phase 7, rows below) `DELETE /installations/{id}` — success: 200, then 404 on repeat; errors: 401, 403, 404; basis: `DECIDED · WP §7.4`
- SUPERSEDED 2026-09-26 (415 added, row below) `POST /login` — success: 200 + token; errors: 400, 401; basis: `DECIDED · YOU`

### From §9 Write path: device auth and ingest
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU` (OQ-10) Missing or unknown/invalid API key → **401**. A valid key used on a different installation → **403**. Matches WP §9.
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` Mechanism: long random key in the `X-API-Key` header; store only its SHA-256 hash on the installation (partial unique index); hash the presented key and look it up: missing header → 401 (40104), no match → 401 (40105), both with `WWW-Authenticate: ApiKey realm="solar"`; match on another installation → 403 (40302). The key, its hash and the header are never logged.
- SUPERSEDED 2026-09-26 (OQ-28 decided, §13) `PROPOSAL` The unique index on `api_key_hash` is **partial** (only where the field is a string), because a new installation may exist before it has a key (OQ-28, open). See `docs/design/data-model.md`.
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` A JWT sent to the device route is not a valid credential → 401. The route is mounted before the bearer middleware.
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` Content-Type other than `application/json` → 415 (41501). Check order on this route: 415, 401, 403, 400, 409.
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` (OQ-26) No 404 on this route: a valid key used on an installation that is not its own, or that does not exist, gets 403 (40302). The route never reveals whether an installation exists.

### From §10 Read path: user auth, scopes, jurisdiction
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` The token carries `scope` (`solar:read`; admin also `solar:write`), `jurisdiction_level`, `jurisdiction_id`, short expiry (about 1 hour). WP §12.2 describes scopes; how I use them is my choice. It is my own JWT, **not full OAuth** (no authorization server).
- SUPERSEDED 2026-09-26 (decided below) `PROPOSAL` (OQ-15) Demo users and device keys are documented in the README and Swagger, marked demo-only.
- SUPERSEDED 2026-09-26 (decided below: no credentials in the README) `DECIDED · YOU (2026-09-26)` (OQ-15) Demo logins go in the README (private repo) and the report appendix, **not** in the public Swagger: public admin credentials would let anyone change the live API. The spec's description says demo accounts are provided separately to the marker.

### From §11 Query surface
- SUPERSEDED 2026-09-27 (OQ-20 decided, §11) `DECIDED · BRIEF §5` Filter by time window. `PROPOSAL` (OQ-20) parameters `from` and `to`, ISO 8601, both inclusive, on every readings collection.

### From §12 Error contract
- SUPERSEDED 2026-09-29 (code format decided, §12; detail fields kept as `PROPOSAL`) `PROPOSAL` Detail via `description`, `moreInfo` (a docs URL) and `error[]` with `{code, message}` per field (WP §11 fields). Integer codes = HTTP status × 100 + a number (for example 40001).
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) `DECIDED · YOU (2026-09-26)` `WWW-Authenticate` is `Bearer realm="solar"` for users and a custom `ApiKey realm="solar"` for devices (WP requires the header, not a scheme name).

### From §13 Writable resources, roles and authorization
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) Device — credential: `X-API-Key`; allowed: `POST /installations/{own-id}/readings` only; refused with: another installation → 403; no or unknown key → 401; any other route → 401 (not a valid credential there)
- SUPERSEDED 2026-09-26 (final rubric: JWT on the write path; see below) Admin — credential: JWT, scope `solar:read` + `solar:write`, jurisdiction national; allowed: all `GET`; `POST`, `PUT`, `DELETE` on installations; refused with: posting readings → 401 (needs a device key)
- SUPERSEDED 2026-09-26 (decided below) `PROPOSAL` `POST /installations` takes `name`, `meter_id`, `substation_id`, `capacity_kw`; the server sets `installation_id`, `district_id`, `province_id`, `created_at`, `updated_at`; duplicate `meter_id` → 409; unknown `substation_id` → 400. PUT takes the same four fields; the derived ids are recomputed if `substation_id` changes; the client cannot change `installation_id`, `created_at`, the derived ids or the key hash.
- SUPERSEDED 2026-09-26 (decided below) `PROPOSAL` (OQ-24) `If-Match` is optional on PUT.
- SUPERSEDED 2026-09-26 (decided below: 409 while readings exist) `PROPOSAL` (OQ-13) Deleting an installation keeps its readings in the database (history is evidence, LEC S8), but the API can no longer reach them. State the trade-off in the report.
- SUPERSEDED 2026-09-26 (decided below) **`OPEN`** (OQ-28) How a newly created installation receives a device key. Default idea: return the plain key once in the 201 body (differs from what GET returns). Otherwise only seeded installations can ever have a working device.
- SUPERSEDED 2026-09-27 (reworded, §13) `DECIDED · YOU` The admin is one national-level role. Province- or district-level admins are not built (limitation).

### From §16 Open items and limits
- SUPERSEDED 2026-09-26 (closed, §13) OQ-28: how a new installation gets a device key.
- SUPERSEDED 2026-09-26 (13 and 24 closed) **Awaiting my yes (`PROPOSAL`, each needed by its phase):** OQ-08 (composite contents), 12 (403 for out-of-scope, narrowing), 13, 15, 20 (`from`/`to`), 24; tie-break rule; parent-record visibility; top-up script.
- SUPERSEDED 2026-09-26 (OQ-15 decided, §10) **Awaiting my yes (`PROPOSAL`, each needed by its phase):** OQ-08 (composite contents), 12 (403 for out-of-scope, narrowing), 15, 20 (`from`/`to`); tie-break rule; parent-record visibility; top-up script; the `capacity_kw` upper bound of 1000.
- SUPERSEDED 2026-09-27 (smoke deploy date decided, §16) **Delivery process (`DECIDED · YOU`):** all development, database work and testing run locally (Mac, Node 22, Atlas database `slsea_local`); branches `dev_hashini` (mine) → `dev` (central, default branch); `deployment_dev` is the deploy branch and is updated by merge request **only for the smoke deploy (planned for 25 Sep; moved because 23–25 Sep were lost; deleted afterwards) and the final deploy (Thu 1 Oct)**; a GitHub Actions workflow deploys it to Azure App Service; `deployment_qa` kept as a best-practice marker and **not deployed**; **`main` never touched**; the final Azure app is the submitted URL. `PROPOSAL`: merge-commit MRs, tag `pN` on `dev` at phase end, tag `submission` on `deployment_dev`, freeze rule, Azure readiness rules (`PLAN.md` §12a), runbook (`PLAN.md` §12b); diagram `08`.
- SUPERSEDED 2026-09-29 (first deploy 29 Sep, app kept, §16) **Delivery process (`DECIDED · YOU`):** all development, database work and testing run locally (Mac, Node 22, Atlas database `slsea_local`); branches `dev_hashini` (mine) → `dev` (central, default branch); `deployment_dev` is the deploy branch and is updated by merge request **only for the smoke deploy (`DECIDED · YOU (2026-09-27)`: Mon 28 Sep 2026, moved from 25 Sep because 23–25 Sep were lost; deleted afterwards) and the final deploy (Thu 1 Oct)**; a GitHub Actions workflow deploys it to Azure App Service; `deployment_qa` kept as a best-practice marker and **not deployed**; **`main` never touched**; the final Azure app is the submitted URL. `PROPOSAL`: merge-commit MRs, tag `pN` on `dev` at phase end, tag `submission` on `deployment_dev`, freeze rule, Azure readiness rules (`PLAN.md` §12a), runbook (`PLAN.md` §12b); diagram `08`.
- SUPERSEDED 2026-09-29 (closed, §16) OQ-32: workflow authentication to Azure (publish profile, OIDC or CLI ZIP fallback) — decided at the smoke deploy.
- SUPERSEDED 2026-09-27 (closed, §16) **Built but still `PROPOSAL` (awaiting my yes):** OQ-08 (composite contents), OQ-20 (`from`/`to`); tie-break rule; top-up script; the `capacity_kw` upper bound of 1000. (OQ-12 and parent-record visibility were decided in §10 on 2026-09-26.)