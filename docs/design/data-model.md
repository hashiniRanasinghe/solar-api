# Data model — SLSEA Solar Generation API

Sources: `PLAN.md` §8 (Database plan), `docs/design/my-decisions.md` §2–5 and §8–13, `docs/design/diagrams/03-er-model.mmd` (referenced, not reproduced here — open it for the entity-relationship picture).

Conventions (`my-decisions.md` §2, §7): fields are snake_case; every public ID is a string business ID (`PV-01`, `DT-01`, `SS-001`, `INS-0001`, `RD-…`); the Mongo `_id` is never exposed; timestamps are UTC dates. Naming, stated once: the entity is "Reading" in `my-decisions.md`, the Mongo collection is `generation_readings` (`PLAN.md` §8), and the Mongoose model is `GenerationReading` — the model must set its collection name explicitly (`{ collection: 'generation_readings' }`) so Mongoose does not pluralise `GenerationReading` into something else.

## 1. Collections

### `provinces`
| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `province_id` | string | yes | unique | business ID, e.g. `PV-01` |
| `name` | string | yes | — | |

### `districts`
| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `district_id` | string | yes | unique | business ID |
| `name` | string | yes | — | |
| `province_id` | string | yes | index | source of truth — set directly, not derived |

### `substations`
| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `substation_id` | string | yes | unique | business ID |
| `name` | string | yes | — | |
| `district_id` | string | yes | index | source of truth |
| `province_id` | string | yes | index `PROPOSAL` | **derived** from `district_id`, server-set, read-only; index optional at this data size — see §2 |

### `installations`
| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `installation_id` | string | yes | unique | business ID, e.g. `INS-0001` |
| `meter_id` | string | yes | unique | attribute of the installation, not a separate Device entity (§5) |
| `name` | string | yes | — | |
| `substation_id` | string | yes | index | source of truth for the whole derived chain |
| `district_id` | string | yes | index | **derived** from `substation_id`, server-set, read-only |
| `province_id` | string | yes | index `PROPOSAL` | **derived** from `substation_id`, server-set, read-only; index optional at this data size — see §2 |
| `capacity_kw` | number | yes | — | ceiling for seed realism and validation |
| `api_key_hash` | string | no | partial unique (only where present as a string) | device credential hash (SHA-256 hex of the device key); **never returned** by any API response. Every installation created by the seed or by `POST /installations` gets a key (OQ-28 decided 2026-09-26: the plain key is returned once in the 201). Not required on the document: one without a key is valid but cannot log in (§6) |
| `created_at` | datetime (UTC) | yes | — | |
| `updated_at` | datetime (UTC) | yes | — | |

### `generation_readings`
Collection name and model mapping per Conventions above.

| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `reading_id` | string | yes | unique `PROPOSAL` | business ID; generation method not fixed — `RD-` prefix plus a unique value, `PROPOSAL`; needed as the `Location` target for `GET /installations/{installation-id}/readings/{reading-id}` |
| `installation_id` | string | yes | unique with `timestamp` | carries no district/province/substation id (§5) |
| `timestamp` | datetime (UTC) | yes | part of unique + sort index | device event time |
| `power_kw` | number | yes | — | instantaneous |
| `energy_kwh` | number | yes | — | **cumulative** running total, not per-interval |
| `voltage` | number | yes | — | |
| `received_at` | datetime (UTC) | yes | — | set by the server, separate from device `timestamp` |

### `users`
| Field | Type | Required | Unique / index | Notes |
|---|---|---|---|---|
| `user_id` | string | yes | unique | business ID |
| `username` | string | yes | unique | |
| `password_hash` | string | yes | — | |
| `role` | string | yes | — | `reader` or `admin` |
| `jurisdiction_level` | string | yes | — | `national`, `province`, or `district` |
| `jurisdiction_id` | string | no | — | empty when `national`; otherwise a province or district ID, chosen by `jurisdiction_level` — a polymorphic reference. MongoDB does not enforce which collection it points to; the seed integrity check and the service layer must (see §4) |

## 2. Keys and indexes

| Index | Query it serves |
|---|---|
| unique `provinces.province_id` | member lookup `GET /provinces/{id}` |
| unique `districts.district_id`; index `districts.province_id` | member lookup; `GET /districts?province_id=…` |
| unique `substations.substation_id`; index `substations.district_id` | member lookup; `GET /substations?district_id=…` |
| unique `installations.installation_id`; unique `installations.meter_id`; index `installations.substation_id`; index `installations.district_id` | member lookup; duplicate-`meter_id` rejection (409, `my-decisions.md` §13); resolving the installation IDs under a substation/district/province path parent for jurisdiction-scoped readings (§11, OQ-04) |
| partial unique `installations.api_key_hash` (index only where the field is a string) | no two installations share a device key; device login reads `api_key_hash` by `installation_id` (revised 2026-09-26: the hash is no longer looked up on ingest) — partial because the field is not required on the document (OQ-28 decided 2026-09-26, §6) |
| `installations.province_id`; `substations.province_id` `PROPOSAL` | `GET /installations?province_id=…`, `GET /substations?province_id=…`, and the province readings route; optional at this data size (240 installations / 40 substations) |
| unique `generation_readings.reading_id` | member lookup and the `Location` target for `GET /installations/{installation-id}/readings/{reading-id}` |
| unique `generation_readings.(installation_id, timestamp)` | idempotent device ingest — a retried POST for the same installation+timestamp hits this and gets 409 instead of a duplicate row (§9, §8 table). MongoDB can read a compound index backwards, so this one index also serves `last-reading` / per-installation history in both sort directions; `PLAN.md` §8's separate `(installation_id, timestamp desc)` index is `PROPOSAL`ed here as redundant — confirm with `explain()` in Phase 3 before dropping it |
| unique `users.username` | `POST /login` credential lookup |

Sort tie-break: readings queries sort by the requested field then `installation_id` (`my-decisions.md` §11), so many installations sharing a 15-minute timestamp still page deterministically. This is a query-time ordering rule, not a stored index, and isn't depicted in the ER diagram.

For the jurisdiction readings routes (substation/district/province `/readings`) the query is `installation_id IN (...)` (the resolved set under the path parent) plus the `from`/`to` time window, sorted by `(timestamp, installation_id)`. The `(installation_id, timestamp)` index serves the `IN (...)` + time-window filter; the final sort across installations may run in memory, which is acceptable at this data size for one province's worth of rows (tens of thousands) — verify with `explain()` in Phase 6.

## 3. Derived-id rule

`DECIDED · YOU` (`my-decisions.md` §2, `PLAN.md` §8): **`substation_id` on an installation is the source of truth.** `district_id` and `province_id` on `installations`, and `province_id` on `substations`, are computed and stored **by the server only** — read-only, never accepted from the client. If a client sends them (e.g. a PUT body copied from a prior GET), the server ignores those fields and recomputes them from the current `substation_id` / `district_id`.

Why stored rather than joined on every request: a stored read-only copy makes scope checks and jurisdiction filters a single lookup instead of a walk up the chain on every request (§2, rejected alternative: join on every request).

**Seed integrity check**: a check run over the seeded data proves the stored derived IDs match what the parent chain actually resolves to — that every installation's stored `district_id`/`province_id` agree with its `substation_id`'s chain, and every substation's stored `province_id` agrees with its `district_id`'s. This is the mechanism referenced in `PLAN.md` §8 ("proven consistent by a seed integrity test") and `my-decisions.md` §2. Its implementation belongs to the seed script, not to this document.

## 4. Relationships and cardinalities

One-to-many at each hierarchy step (`my-decisions.md` §2, diagram `03-er-model.mmd`):

```
Province 1───* District 1───* Substation 1───* Installation 1───* GenerationReading
```

`User` is separately linked to a province or a district depending on `jurisdiction_level` (`national` users have no jurisdiction link).

**Path from any resource up to its province and district (for scope checks):**
- An **installation** stores `substation_id` (truth) plus `district_id` and `province_id` (derived, stored) — its full ancestry is available from the installation document alone, no lookup needed.
- A **substation** stores `district_id` (truth) plus `province_id` (derived, stored) — same property one level up.
- A **district** stores `province_id` directly (truth, not derived — a district is one level under province, so this is not a multi-hop derivation).
- A **reading** (`generation_readings`) stores `installation_id` only — reaching its district and province is one installation lookup (the installation document already holds both, derived and stored).

This is what makes the path-based jurisdiction scope check (`my-decisions.md` §10, §11 — "the scope check runs on the path parent", OQ-04) a single-document read at every level, instead of a chain of parent lookups.

## 5. What is NOT stored

- **No Device entity.** `meter_id` and `api_key_hash` are attributes of `installations` (`my-decisions.md` §3). A separate Device collection would only add a join with nothing behind it.
- **No jurisdiction IDs on readings.** `generation_readings` documents carry only `installation_id`, never `district_id`/`province_id`/`substation_id`. A jurisdiction-scoped readings query (under a province/district/substation path) resolves the set of installation IDs under that path parent first (using the derived, indexed IDs on `installations`), then queries readings for those installation IDs (`my-decisions.md` §11 — rejected alternative: copying jurisdiction IDs onto ~161,000 reading rows).
- **`api_key_hash` is never returned** by any API response, on any resource, at any time (`PLAN.md` §8, diagram, `my-decisions.md` §2).

## 6. Open items — not decided here

These are `OPEN` in `my-decisions.md` (§11, §13, §16) and are listed, not resolved:

- SUPERSEDED 2026-09-26 (decided, see below) **OQ-28** — How a newly created installation receives its device key (candidate idea only: return the plain key once in the 201 body; not confirmed).
- SUPERSEDED 2026-09-26 (closed, see below) **OQ-29** — How the `ETag` is constructed (Express's default vs an explicit one; installations need a strong ETag for `If-Match`).

Closed on 2026-09-26 (`DECIDED · YOU`, `my-decisions.md` §9):

- **OQ-26** — no 404 on `POST …/readings`: a missing, invalid or expired token gives 401, and a device token for an installation that is not the path installation (also when that installation does not exist) gives 403, so the route never reveals which ids exist. (Revised 2026-09-26: the device key is checked against `api_key_hash` at `POST /login`, which returns a device JWT; X-API-Key was removed.)
- **OQ-27** — a reading is compared with the installation's newest stored reading: same `timestamp` → 409 (the unique `(installation_id, timestamp)` index is the final guard), older `timestamp` → 409, `energy_kwh` lower than the newest → 409; an equal `energy_kwh` is accepted.
- **Validation limits** — `power_kw` from 0 to the installation's `capacity_kw`; `energy_kwh` ≥ 0; `voltage` from 0 to 300; `timestamp` ISO 8601 UTC on a 15-minute boundary.
- **OQ-28** (Phase 7) — every installation created through `POST /installations` gets a device key: 32 random bytes as hex, only its SHA-256 hex stored in `api_key_hash`, the plain key returned once as `device_key` in the 201 body and never again (`my-decisions.md` §13). The server also sets `installation_id` (next `INS-NNNN`), `district_id` and `province_id` (from `substation_id`), `created_at` and `updated_at`.
- **OQ-29** — strong, content-based ETag (`app.set('etag', 'strong')`) on every GET and 201; used for `If-Match` on installation PUT and DELETE (`my-decisions.md` §11, §13).
- **OQ-13** (Phase 7) — an installation with readings cannot be deleted (409), so no reading is ever left without its installation through the API.

## 7. Notes and gaps

Notes (not conflicts — resolved by reading the three sources together):
- **Naming.** The "Reading" (`my-decisions.md`) / `generation_readings` (`PLAN.md`, diagram) naming gap is resolved by the Conventions statement above: entity Reading = collection `generation_readings` = Mongoose model `GenerationReading`.
- **Index detail in the diagram.** ER diagrams conventionally show fields, PK/FK/UK markers and relationships, not compound or partial index definitions — the diagram not depicting the `(installation_id, timestamp)` compound index or the `reading_id` index (§2) is expected diagram scope, not a discrepancy with `PLAN.md` or `my-decisions.md`.
- **User↔jurisdiction relationships.** A user is scoped to at most one of province or district (never both) via `jurisdiction_level` + `jurisdiction_id` (§1, §4). The diagram's two separate optional relationships (`USER }o..o| PROVINCE`, `USER }o..o| DISTRICT`) is a valid way to depict that, since at most one is ever populated for a given user. Not a conflict with the single-field schema.

Fixed:
- **Example-ID inconsistency** — `my-decisions.md` §2 used `DT-01`, `PLAN.md` §8 used `DT-03`. This document now uses `DT-01` throughout (Conventions).

Real gaps found (not fixed here):
- `reading_id` has no index in `PLAN.md` §8's index list, although it's needed as the `Location` target for `GET /installations/{installation-id}/readings/{reading-id}` (§1, §2).
- `PLAN.md` §8 lists `(installation_id, timestamp)` unique and `(installation_id, timestamp desc)` as two separate indexes on `generation_readings`; §2 above proposes the second is redundant (a compound index can be read backwards) — confirm with `explain()` in Phase 3 before dropping it.
- `PLAN.md` §8 lists `installations.api_key_hash` as a plain unique index; §1/§2 above use a **partial** unique index instead (built; kept after OQ-28 was decided, because the field is not required on the document).
- `installations.province_id` and `substations.province_id` have no index in `PLAN.md` §8; §2 above proposes adding both as optional, low-priority indexes.

Documents that would need edits to reflect the above (not made in this document): `PLAN.md` §8 (index list — add `reading_id`, drop or justify the redundant readings-desc index, change `api_key_hash` to partial, add the two `province_id` indexes; also the district-ID example, `DT-03` → `DT-01`) and §9 (note `api_key_hash`'s index is now proposed as partial, tied to OQ-28). `my-decisions.md` already uses `DT-01` and needs no change on that point.
