# Data model — SLSEA Solar Generation API

Section 1 is the conceptual model, independent of any database (diagram `docs/design/diagrams/03a-conceptual-model.mmd`). Section 2 is how it is stored in MongoDB (diagram `docs/design/diagrams/03-er-model.mmd`; schemas in `src/models/`). Decisions behind both: `docs/design/my-decisions.md` §2–§5.

## 1. Conceptual model (implementation-independent)

### Entities

| Entity | What it is | Attributes |
|---|---|---|
| Province | Top-level jurisdiction | identifier, name |
| District | Mid-level jurisdiction | identifier, name |
| Substation | Grid node that installations connect to | identifier, name |
| Installation | A rooftop solar site (the asset that reports) | identifier, name, meter identifier (`meter_id`), capacity in kW |
| Generation reading | One timestamped report from an installation's meter | time of the reading, instantaneous power (kW), energy so far (kWh, a running total), voltage |
| User | An SLSEA person who reads data | username, role (reader or admin), jurisdiction level (national, province or district) |

### Relationships

| Relationship | Cardinality |
|---|---|
| Province contains District | 1 to many |
| District contains Substation | 1 to many |
| Substation connects Installation | 1 to many |
| Installation reports Generation reading | 1 to many |
| User has jurisdiction over Province or District | each user 0 or 1 (0 for a national user; a province or district user has exactly one, matching the level) |

### Rules

- A generation reading belongs to exactly one installation and is never changed: the history is append-only.
- The meter identifier is an attribute of the installation, not a separate Device entity: one installation has one meter.
- Energy is a running total: it never decreases from one reading of an installation to the next, so energy over a period is the last value minus the first.
- An installation's district and province follow from its substation; they are not separate facts about the installation.

## 2. Physical model (MongoDB)

**Conventions.** Fields are snake_case. Every public id is a string business id: `PV-01`, `DT-01`, `SS-001`, `INS-0001`, `RD-0001-20260926041500` (`RD-<installation number>-<UTC yyyymmddhhmmss>`), `USR-01`. The Mongo `_id` (and `__v`) is never returned. Timestamps are stored as UTC dates and returned as ISO 8601 ending in `Z`. The entity "Reading" is the collection `generation_readings` and the Mongoose model `GenerationReading` (collection name set explicitly).

### 2.1 Collections

#### `provinces`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `province_id` | string | yes | unique | e.g. `PV-01` |
| `name` | string | yes | — | |

#### `districts`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `district_id` | string | yes | unique | e.g. `DT-01` |
| `name` | string | yes | — | |
| `province_id` | string | yes | yes | source of truth (set directly) |

#### `substations`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `substation_id` | string | yes | unique | e.g. `SS-001` |
| `name` | string | yes | — | |
| `district_id` | string | yes | yes | source of truth |
| `province_id` | string | yes | yes | **derived** from `district_id`, server-set, read-only |

#### `installations`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `installation_id` | string | yes | unique | e.g. `INS-0001`; set by the server on `POST /installations` |
| `meter_id` | string | yes | unique | an attribute of the installation, not a Device entity (§2.5) |
| `name` | string | yes | — | |
| `substation_id` | string | yes | yes | source of truth for the whole derived chain |
| `district_id` | string | yes | yes | **derived** from `substation_id`, server-set, read-only |
| `province_id` | string | yes | yes | **derived** from `substation_id`, server-set, read-only |
| `capacity_kw` | number | yes | — | > 0 and ≤ 1000; ceiling for `power_kw` validation and the seed |
| `api_key_hash` | string | no | partial unique (only where a string) | SHA-256 hex of the device key; **never returned**. Every seeded or `POST`-created installation has one; the plain key is shown once (seed output file or the 201 body) |
| `created_at` | date (UTC) | yes | — | Mongoose timestamps |
| `updated_at` | date (UTC) | yes | — | Mongoose timestamps; used for `Last-Modified` and the `If-Match` write filter |

#### `generation_readings`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `reading_id` | string | yes | unique | the `Location` target of `GET /installations/{installation-id}/readings/{reading-id}` |
| `installation_id` | string | yes | unique with `timestamp` | carries no substation, district or province id (§2.5) |
| `timestamp` | date (UTC) | yes | unique with `installation_id` | device event time, on a 15-minute boundary |
| `power_kw` | number | yes | — | instantaneous, 0 to `capacity_kw` |
| `energy_kwh` | number | yes | — | **cumulative** running total, never decreases per installation |
| `voltage` | number | yes | — | 0 to 300 |
| `received_at` | date (UTC) | yes | — | set by the server, separate from the device `timestamp`; used for `Last-Modified` |

#### `users`
| Field | Type | Required | Index | Notes |
|---|---|---|---|---|
| `user_id` | string | yes | unique | e.g. `USR-01` |
| `username` | string | yes | unique | |
| `password_hash` | string | yes | — | bcrypt; never returned |
| `role` | string | yes | — | `reader` or `admin` |
| `jurisdiction_level` | string | yes | — | `national`, `province` or `district` |
| `jurisdiction_id` | string | no | — | not set when `national` (`null` in the token); otherwise a province or district id, chosen by `jurisdiction_level` |

Users are seeded; there are no `/users` endpoints.

### 2.2 Indexes and the queries they serve

| Index | Serves |
|---|---|
| unique `province_id`, `district_id`, `substation_id`, `installation_id` | member lookups (`GET /…/{id}`) |
| `districts.province_id`; `substations.district_id`, `substations.province_id` | catalogue filters `?province_id=`, `?district_id=` |
| `installations.substation_id`, `.district_id`, `.province_id` | catalogue filters on `/installations`; finding the installation ids under a substation, district or province for the jurisdiction readings routes |
| unique `installations.meter_id` | duplicate `meter_id` → 409 (40904) |
| partial unique `installations.api_key_hash` | no two installations share a device key; partial because the field is not required |
| unique `generation_readings.reading_id` | reading member lookup (`Location` target) |
| unique `generation_readings.(installation_id, timestamp)` | idempotent ingest (same timestamp → 409, 40901); read backwards for `last-reading` and the composite, forwards and backwards for history and the generation summary |
| unique `users.username` | `POST /login` |

Readings sort by the requested field, then `installation_id` as the tie-break, so pages of a jurisdiction history never repeat or skip rows. Under a substation, district or province the query is `installation_id IN (…)` plus the `from`/`to` window; MongoDB sorts across installations in memory (top-k, bounded by `offset + limit`). Measured on the largest province (48 installations, about 32,000 readings): 8–77 ms, no disk use (my-decisions §11).

### 2.3 Derived-id rule

`substation_id` on an installation is the **source of truth**. `district_id` and `province_id` on installations, and `province_id` on substations, are computed and stored **by the server only**. If a client sends them (for example a PUT body copied from a GET), they are ignored and recomputed.

Why stored instead of joined on every request: scope checks and jurisdiction filters become one lookup instead of a walk up the chain.

How they are kept correct: for seeded data, the seed runs an integrity check that every installation's stored `district_id`/`province_id` match its substation's chain, and every substation's stored `province_id` matches its district's (`scripts/seed.js`, "Seed integrity check"). For installations created or replaced through the API, the service always derives both from the substation (`src/services/installations.js`), tested in `test/admin-crud.test.js`.

### 2.4 Relationships (as stored)

```
Province 1───* District 1───* Substation 1───* Installation 1───* GenerationReading
```

A `User` is linked to at most one province or one district through `jurisdiction_level` + `jurisdiction_id`; national users have no link.

Path from any resource up to its province and district (used by the scope check):

| Resource | Holds | Lookups to reach province and district |
|---|---|---|
| Installation | `substation_id` + derived `district_id`, `province_id` | none |
| Substation | `district_id` + derived `province_id` | none |
| District | `province_id` | none |
| Reading | `installation_id` only | one (the installation) |

### 2.5 What is deliberately not stored

- **No Device entity.** `meter_id` and `api_key_hash` are installation attributes. One installation has one meter, so a Device collection would add a join and nothing else (BRIEF §3).
- **No jurisdiction ids on readings.** A jurisdiction readings query first finds the installation ids under the path parent, then reads their readings. Copying ids onto about 161,000 rows would add a consistency burden. Side effect: if an installation moves to another substation, its whole history moves with it.
- **No `last_power` on the installation.** The newest reading is derived from the time series (composite `last_reading`, `last-reading`), so the history is never overwritten (BRIEF §3).
- **Secrets are never returned.** `api_key_hash` and `password_hash` are removed from every JSON response by the models' `toJSON`.
