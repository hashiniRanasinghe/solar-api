# AI usage log

Every prompt (Claude Code and chat) is logged here, in the same commit as the change it produced.
It becomes the AI-disclosure appendix of the report.

Note [added 2026-09-26]: most Claude Code prompts below were drafted in the Claude chat planning sessions and pasted into Claude Code by me. Answers to Claude Code's questions (for example option choices) were chosen by me, usually after a recommendation from Claude chat. Entries marked [added 2026-09-26] were logged late; see "Late entries" at the end.

Entry format (Claude Code writes the facts; I fill the last two lines):

## YYYY-MM-DD HH:MM - <step id>
Tool/model:
Branch:
Prompt: <verbatim, secrets redacted>
Files:
Checks:
Requirement IDs:
Outcome: done | partial | failed - <one factual line>
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-19 - planning (Claude chat)
Tool/model: Claude (chat)
Prompt: planning, decisions, diagrams and process design for the coursework (PLAN.md, STUDENT_PLAYBOOK.md, docs/design/my-decisions.md, docs/design/diagrams/*).
Branch: not recorded at the time [added 2026-09-26]
Files: PLAN.md, STUDENT_PLAYBOOK.md, docs/design/my-decisions.md, docs/design/diagrams/*.mmd (14) and docs/design/diagrams/README.md [added 2026-09-26]
Checks: Mermaid parser syntax check on all 14 diagram sources (layout not viewed) [added 2026-09-26]
Requirement IDs: M6 (data model documented before resources and URIs); design basis for the other IDs [added 2026-09-26]
Outcome: done - committed in 8370227 (docs: add plan, playbook, decisions, diagrams) [added 2026-09-26]
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-19 - D1/D2 (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Prompt: build D1+D2 as one small diff: package.json (dependencies only: express, dotenv, cors, mongoose; start/dev/test scripts), src/app.js (exports app; GET / outside the base path returns {status, environment}; empty router mounted at /solar/v1.0), src/server.js (listens on PORT, starts only after connectDB succeeds), src/config/env.js, src/config/db.js (mongoose connect on MONGODB_URI; on failure print a clear message with no URI or credential and exit non-zero; on success log only the database name), .env.example (placeholders only). Follow-up prompt: add "engines": {"node": ">=18"} to package.json; add serverSelectionTimeoutMS: 10000 to the mongoose.connect options; make sure the catch block never logs err, err.message, or any connection detail (rejected one corrupted diff draft; asked for and applied a corrected one that logs err.name plus a generic hint only).
What I accepted / changed / rejected: accepted the initial D1/D2 skeleton as-is. On the follow-up, rejected the first diff draft (asked to redo it), then accepted the corrected version: added "engines": {"node": ">=18"} to package.json; added serverSelectionTimeoutMS: 10000 to mongoose.connect in src/config/db.js; changed the catch block to log only err.name plus "check MONGODB_URI, the database user password and Atlas Network Access" (never err, err.message, or connection details). Verified locally: GET / returns 200, missing MONGODB_URI exits with a clear no-secret message.
Branch: dev_hashini [added 2026-09-26]
Files: package.json, src/app.js, src/server.js, src/config/env.js, src/config/db.js, .env.example [added 2026-09-26]
Checks: GET / returned 200 {"status":"ok","environment":"local"}; with MONGODB_URI unset the server exited with "Database connection failed: MONGODB_URI is not set." and printed no secret [added 2026-09-26]
Requirement IDs: G1 (foundation), G7 [added 2026-09-26]
Outcome: done - commits aafa4df (express app and mongoose connection) and aefd50f (fail fast in 10s, log err.name only, engines) [added 2026-09-26]
Reviewed by me: (student to fill)

---

## 2026-09-20 - repo hygiene (manual, guided by Claude chat)
Tool/model: manual git commands, guided by Claude chat
Branch: dev_hashini
Prompt: n/a (commands taken from the chat)
Files: .gitignore, docs/design/ (moved from docs/docs/design), .gitkeep (removed)
Checks: git check-ignore matched .env, .env.deploy and x.PublishSettings; git status showed 1 deleted file and 16 renames
Requirement IDs: none (repository hygiene)
Outcome: done - commit 64e5d99 changed only .gitignore; the .gitkeep removal and the docs move are in commit caf6a1f
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-20 - local-first plan and Azure decision (Claude chat)
Tool/model: Claude (chat)
Branch: dev_hashini
Prompt [corrected 2026-09-26; the earlier line was a placeholder summary, not my prompt]: (1) hosting, after Render asked for a card check: "is there any other free service i do have the git hub student pac as well"; choice "Azure App Service using my student credit (Basic plan, no card)". (2) "Update the plan based on this approach: Do all development, server setup, database work, and testing locally. Do not deploy to Azure during development. Complete and test everything locally first. Once the code is stable/frozen, do the final Azure deployment. Keep Azure deployment requirements in mind during development so we don't face issues later. This approach is mainly to minimize Azure credit/usage. First, review the ZIP, coursework, and references and give me the updated development plan. Do not make major changes yet. When we start making changes, do not give me the whole project as a ZIP. Give me only the files that need changes, one by one, and clearly explain what changed in each file. If you disagree with this approach or see any coursework/technical issue, tell me before we proceed." (3) choices: local database "Mac (VS Code + Node.js + Swagger) -> Internet -> MongoDB Atlas"; deployment "GitHub Actions workflow"; early checks "Zero-cost validation now, plus a short throwaway smoke deploy around 25-27 Sep". (4) "give the CLAUDE.md, PLAN.md, STUDENT_PLAYBOOK.md - updated full files"; "do we need anyother changes".
Files: CLAUDE.md, PLAN.md, STUDENT_PLAYBOOK.md, docs/design/my-decisions.md, docs/design/diagrams/*, .claude/settings.json, .gitignore
Checks: Mermaid parser passed for all 14 diagrams (syntax only); a clean "npm ci --omit=dev" and both start-up failure paths were run on the committed files with dummy credentials
Requirement IDs: G1, G3 (deployment planning)
Outcome: done - committed in 5e3bd12 and beb5070
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 - Phase 1 exit: rehearsal and tag p1 (manual, guided by Claude chat)
Tool/model: manual commands, guided by Claude chat
Branch: fresh clone of dev; tag on origin/dev
Prompt: guide me to Run the Phase 1 exit checks on the `dev` branch: verify the fresh clone, production-mode startup, database connection, `GET /` response, and create/push the `p1` tag. Record the results and any issues found.
Files: none changed
Checks: fresh clone had no .env or node_modules; npm ci --omit=dev installed 91 packages with 0 vulnerabilities; production-mode start connected to slsea_local and listened on 8080; curl GET / returned 200 with {"status":"ok","environment":"local"}
Requirement IDs: none yet (Phase 1 exit)
Outcome: done - tag p1 created on origin/dev (135e7e8) and pushed
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 13:14 - C1: data model doc + PLAN.md/my-decisions.md alignment (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt 1 (create the doc): Task: write docs/design/data-model.md (playbook C1). Read CLAUDE.md, docs/design/my-decisions.md (sections 2 to 5 and 8 to 13), PLAN.md section 8 and docs/design/diagrams/03-er-model.mmd first. Content: (1) per collection a table: field, type, required, unique or index, notes (snake_case; string business IDs; timestamps as UTC dates); (2) keys and indexes, each with the query it serves; (3) the derived-id rule: substation_id is the source of truth, district_id and province_id are server-set, read-only, never accepted from the client, and how a seed integrity check proves it; (4) relationships and cardinalities, and the path from any resource up to its province and district for scope checks; (5) what is NOT stored: no Device entity, no jurisdiction ids on readings, api_key_hash never returned; (6) an open-items section listing OQ-26 to OQ-29 and the validation limits as OPEN, without choosing. Reference diagrams/03-er-model.mmd instead of copying it. At the end, list every discrepancy between the diagram, my-decisions.md and PLAN.md section 8; do not fix them silently. Do not write code, seed data or report text. Do not read .env. Show a plan and section outline first; wait for my OK.
Prompt 2 (follow-up diff spec): Small follow-up diff to docs/design/data-model.md only. Do not touch other files. Show the diff before writing. 1. Conventions: state the naming once: entity Reading = collection generation_readings = Mongoose model GenerationReading (the model must set the collection name explicitly so Mongoose does not pluralise it). Use DT-01 as the district id example everywhere. 2. generation_readings: add a unique index on reading_id (needed by GET /installations/{installation-id}/readings/{reading-id}, the Location target). Say the reading_id generation method is not fixed (RD- prefix plus a unique value, PROPOSAL). Fix the wrong cross-reference in the reading_id row. 3. generation_readings indexes: MongoDB can read a compound index backwards, so one unique index on (installation_id, timestamp) serves duplicate detection and both sort directions. Propose dropping the separate (installation_id, timestamp desc) index as redundant; mark it PROPOSAL and say the check is explain() in Phase 3. Keep the tie-break note. 4. installations.api_key_hash: not required for every document while OQ-28 is open; use a partial unique index (only when the field is a string). Do not decide OQ-28. 5. Add indexes installations.province_id and substations.province_id as PROPOSAL (needed by /installations?province_id=, /substations?province_id= and the province readings route); say they are optional at this data size. 6. users.jurisdiction_id: state it is a polymorphic reference chosen by jurisdiction_level and that MongoDB does not enforce it, so the seed check and the service must. 7. Section 4: add generation_readings to the ancestry list: it stores installation_id only, so reaching its district and province is one installation lookup. 8. Section 7: rename it "Notes and gaps". Turn discrepancy 1 (naming), 2 (ER diagrams do not show indexes) and 4 (a user is scoped to at most one of province or district; the diagram's two optional relations are a valid depiction) into notes, not conflicts. Keep 3 as fixed. Add the real gaps found: reading_id index missing from PLAN.md section 8; redundant second readings index; api_key_hash partial index; province_id indexes. List which of PLAN.md section 8 and my-decisions.md need edits; do not make them. Requirement IDs for the log entry: M1 to M4 and M6. Append one factual ai-log.md entry, leaving the two review lines blank.
Prompt 3 (approval + two additions + downstream PLAN.md/my-decisions.md diffs): Yes, proceed with exactly this diff, plus two small additions: (a) In section 2, after the tie-break paragraph, add: for the jurisdiction readings routes the query is installation_id IN (...) plus the time window, sorted by (timestamp, installation_id); the (installation_id, timestamp) index serves the filter, and the final sort may run in memory, which is acceptable for one province (tens of thousands of rows); verify with explain() in Phase 6. (b) In the last paragraph of section 7, say the DT-01 fix belongs in PLAN.md section 8 (my-decisions.md already says DT-01 and stays unchanged). Then append one factual ai-log.md entry (requirement IDs M1 to M4 and M6; verbatim prompt; leave both review lines blank). Do not commit. [plus supplied exact diff hunks for PLAN.md section 8 (naming sentence, substations index, installations index/notes, generation_readings index/notes, device-key bullet) and one addition to my-decisions.md section 9 (partial-index PROPOSAL bullet); a self-check list and a commit/push/merge-request checklist for the student to run manually, not executed by Claude Code]
Files: docs/design/data-model.md (created, then edited for the follow-up diff); PLAN.md (edited, §8 only); docs/design/my-decisions.md (edited, §9 only, one bullet added)
Checks: git status --short after each stage confirmed only the intended files were touched; every Edit's old_string was matched against the file's actual current content before it was applied (Edit tool errors on a non-match, so no silent mismatch); no code executed, no seed data written, .env not read or touched; no commit made
Requirement IDs: M1, M2, M3, M4, M6
Outcome: done - data-model.md written and revised per both diffs; PLAN.md §8 and my-decisions.md §9 aligned to match (partial unique api_key_hash, unique reading_id, redundant readings-desc index flagged PROPOSAL for removal pending explain() in Phase 3, province_id indexes added as PROPOSAL, DT-01 example standardised in PLAN.md). Nothing committed, pushed, or merged by Claude Code; the explain-back questions, ai-log review lines, commit/push and merge request are left for the student to do manually.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 14:47 - D4 (first half): Mongoose models for the six collections (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt 1: Task: Mongoose models for the six collections in docs/design/data-model.md (Phase 2, playbook D4 first half). Read CLAUDE.md, docs/design/data-model.md (sections 1, 2, 3, 5) and PLAN.md section 8 first. Show the file list and the schema and index plan first; wait for my OK. Scope: only src/models/province.js, district.js, substation.js, installation.js, generation-reading.js, user.js and src/models/index.js exporting all six models. No seed, no routes, no services, and no hooks that compute derived ids (that belongs to the service layer, later). Rules: fields, types, required and unique/index exactly as data-model.md sections 1 and 2; snake_case; collection names set explicitly (generation_readings for the GenerationReading model); installations use created_at and updated_at through the Mongoose timestamps option mapped to those names; api_key_hash is NOT required and has a PARTIAL unique index (partialFilterExpression: the field is a string), do not decide OQ-28; unique reading_id; unique compound index (installation_id, timestamp) on readings; do NOT create the separate (installation_id, timestamp desc) index (proposed redundant, explain() check in Phase 3); include the province_id indexes on installations and substations (PROPOSAL); users.jurisdiction_id is an optional string; role and jurisdiction_level are strings with enum values only (reader/admin; national/province/district). No numeric min or max limits: validation limits are OPEN, do not choose them. Every schema gets a toJSON transform that removes _id and __v, and also api_key_hash and password_hash; versionKey false. Do not read .env. No new dependencies. After the change: state the requirement IDs (M1 to M4 and M6) and how to test; append one ai-log.md entry; do not commit.
Prompt 2 (approval + two checks): go. Two checks while writing: (1) on api_key_hash do not set unique or index on the field itself; use only schema.index({ api_key_hash: 1 }, { unique: true, partialFilterExpression: { api_key_hash: { $type: 'string' } } }), so there is no full unique index and no duplicate-index warning; (2) the generation_readings compound index on (installation_id, timestamp) must have unique: true; received_at is required with no default (the service sets it); do not use the timestamps option on readings.
Files created: src/models/province.js, src/models/district.js, src/models/substation.js, src/models/installation.js, src/models/generation-reading.js, src/models/user.js, src/models/index.js
Checks run: `node -e "require('./src/models')"` (loads mongoose and all six models without a DB connection) - pass, printed each model's collection name, schema paths and schema.indexes() with no Mongoose duplicate-index warnings; git status --short showed only src/models/ as new; no code committed; .env not read or touched
Requirement IDs: M1, M2, M4, M6
Outcome: done - all six models match data-model.md sections 1-2 exactly: field-level unique/index on business IDs and the derived substation_id/district_id/province_id fields, no field-level unique or index on api_key_hash (partial unique index only, via schema.index), unique compound (installation_id, timestamp) index on generation_readings with no separate desc index and no timestamps option, created_at/updated_at via the timestamps option on installations only, enum-constrained role/jurisdiction_level on users, no numeric min/max anywhere, toJSON transform stripping _id/__v/api_key_hash/password_hash on every schema, versionKey false. No hooks computing derived ids were added.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-22 10:34 - D5: error contract (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt 1: Task: the error contract (Phase 2, playbook D5). Read CLAUDE.md, docs/design/my-decisions.md section 12, PLAN.md sections 4, 7 (global behaviour) and 12a (Errors row) first. Show the file list and plan first; wait for my OK. Scope: src/utils/errors.js, src/middleware/errorHandler.js, edit src/app.js, package.json (test script only), test/errors.test.js. No routes, no auth, no database access. Rules: Express 5, so NO async wrapper. One error body everywhere: code (integer = HTTP status x 100 + a number), message, description, moreInfo, error[] (each item {code, message}; used for per-field validation later; omit or empty when unused). moreInfo is the relative path "/docs" for now (my choice, to confirm later). errors.js: an AppError class (status, number, message, description, error[]) plus the codes needed now: 40001 malformed JSON, 40401 route not found, 50001 unexpected error; nothing else yet. errorHandler.js: four-argument handler; an AppError uses its own fields; a body-parser JSON syntax error (err.type entity.parse.failed) becomes 400 / 40001; any other error becomes 500 / 50001 with a generic message; NEVER send stack traces, err.message or internals to the client; log only err.name and the status to stdout (no bodies, no secrets). app.js: app.disable('x-powered-by'); after the v1 router add a catch-all that answers 404 / 40401 with the same body; errorHandler last. Do not change GET /. Content-Type application/json via res.json(). Tests (node --test, no database): test/errors.test.js imports src/app.js and listens on port 0, then checks: unknown route gives 404 with integer code 40401 and the five body fields; a POST with malformed JSON and content-type application/json to /solar/v1.0/anything gives 400 / 40001; the X-Powered-By header is absent; GET / still returns 200 with status and environment; and, using a small separate Express app built in the test with the real errorHandler, an async route that throws gives 500 / 50001 with no stack in the body. package.json test script becomes: TZ=UTC node --test test/. Do not read .env. No new dependencies. After the change: state the requirement IDs (V5, A5) and how to test; append one ai-log.md entry; do not commit.
Prompt 2: go
Files created: src/utils/errors.js, src/middleware/errorHandler.js, test/errors.test.js
Files edited: src/app.js, package.json (test script only)
Checks run: `npm test` (TZ=UTC node --test) - 5/5 pass: unknown route 404/40401 with all five body fields; malformed JSON POST to /solar/v1.0/anything 400/40001; X-Powered-By header absent; GET / still 200 with status/environment; a separate Express app using the real errorHandler on a throwing async route gives 500/50001 with no stack or err.message text in the body. `git status --short` after each write confirmed only the scoped files changed. .env not read or touched.
Requirement IDs: V5, A5
Outcome: done, with one corrected deviation - the requested test script `TZ=UTC node --test test/` does not run on this machine's Node v22.22.2 (a bare directory argument to --test fails with MODULE_NOT_FOUND; reproduced independently in a throwaway directory outside the repo, so it is a Node CLI behaviour, not a project bug). Used `TZ=UTC node --test "test/**/*.test.js"` instead, which passes and scopes to the same test/ folder; flagged to the student before writing it, not silently fixed.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-22 11:19 - D4a: seed script part 1 - hierarchy, demo users, device keys (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt 1: Task: seed script part 1 - hierarchy, demo users, device keys (Phase 2, playbook D4a). Read CLAUDE.md, docs/design/data-model.md (all sections), PLAN.md section 8 (Seed) first. Show the file list and plan first; wait for my OK. Scope: scripts/seed.js and any small helper files under scripts/lib/ if genuinely needed (prefer one file). No routes, no readings yet (that is D4b, tomorrow). Uses the existing src/models and src/config/db.js. Data to generate, deterministically (fixed seed for randomness, no Math.random without a seeded RNG, so re-running with --reset gives identical ids and names every time): 9 provinces, 25 districts (distributed realistically across provinces, not exactly even), 40 substations (distributed across districts), 240 installations (distributed across substations). Business ids per data-model.md's format (PV-01, DT-01, SS-001, INS-0001, etc, zero-padded, sequential). Every installation gets a capacity_kw (a realistic small residential/commercial solar range, state the range and why in a comment) and a name. Derived ids: installations.district_id and province_id are computed from substation_id, never hand-typed twice; substations.province_id computed from district_id. Compute them in the seed script itself (not a model hook, per our earlier decision). Device keys: for every installation, generate a long random key (crypto.randomBytes, at least 32 bytes, hex), store only its SHA-256 hash in api_key_hash, and write the installation_id + plain key pairs to a single git-ignored file (scripts/output/device-keys.local.json or similar - confirm it matches an existing .gitignore pattern, or tell me if a new pattern is needed, don't just add one silently). Never print plain keys to stdout. Demo users: one national admin (role admin, jurisdiction_level national, scope implied by role), one national reader, one provincial reader (jurisdiction_id one real province), one district reader (jurisdiction_id one real district) - 4 users total. Passwords are simple demo passwords, hashed with bcrypt, written in plain form ONLY to that same git-ignored output file, never to stdout, never into a committed file. Usernames and demo passwords must also appear in a PROPOSAL note for me to put in the report/README later (not committed code). Script behaviour: Modes: default run seeds only if the target collections are empty (safe to run twice by accident); --reset drops and reseeds the six collections; --dry-run computes and prints counts and the target database name ONLY, writes nothing. ALWAYS print the target database name (from MONGODB_URI) before writing anything, and refuse to run against anything if MONGODB_URI is missing (reuse the existing fail-fast pattern from db.js). Use insertMany in batches, not one insert per document. Call syncIndexes() on each model after inserting, so the real database indexes match the schemas. Seed integrity check: after inserting, for every installation verify its stored district_id/province_id match what its substation_id's chain actually resolves to, and every substation verify its stored province_id matches its district_id's chain. Print a clear PASS/FAIL summary with counts; exit with a non-zero code if anything fails. End-of-run summary: counts per collection, and reminder of where the device keys and demo passwords file is (path only, not contents). Do not read .env. No readings yet - that's tomorrow (D4b). No new dependencies beyond what's already installed (crypto and bcryptjs should already cover this - bcryptjs is a dependency; confirm before assuming). After the change: state the requirement IDs (M1-M4, M6, plus whichever covers seed data e.g. F-something if PLAN.md has one) and how to test (dry-run then real run against slsea_local); append one ai-log.md entry; do not commit.
Prompt 2 (approval + two specifics): go, with two specifics: (1) install bcryptjs as a real dependency; (2) name the output file scripts/seed-keys.txt (reusing the existing .gitignore pattern) and write it as a single JSON object (not free-text) with two top-level keys: "device_keys" (installation_id -> plain key) and "demo_users" (username -> {password, role, jurisdiction_level, jurisdiction_id}), so it can be parsed back out later, not just read by eye.
Files created: scripts/seed.js
Files edited: package.json, package-lock.json (npm install bcryptjs)
Checks run: `node scripts/seed.js --dry-run` printed target database slsea_local and planned counts (9/25/40/240/4) with no database connection and no file written; `node scripts/seed.js` against slsea_local inserted all documents, ran syncIndexes, and printed a PASS integrity summary (substations checked 40 mismatches 0; installations checked 240 mismatches 0); re-running without --reset printed a skip message and wrote nothing (existing data detected); `node scripts/seed.js --reset` cleared and reseeded successfully with PASS again; verified via a one-off script (not committed) that installation ids/names/hierarchy are identical across two --reset runs while device keys differ each time (expected: ids/names come from the seeded RNG, keys come from crypto.randomBytes and must not be reproducible); read back scripts/seed-keys.txt with fs+JSON.parse (not `cat`) to confirm exactly two top-level keys (device_keys with 240 entries of 64 hex chars each, demo_users with 4 entries in the required shape) without printing any key or password value into this session; confirmed with `git check-ignore -v` that scripts/seed-keys.txt is ignored (existing bare-filename pattern in .gitignore, no .gitignore edit made) while scripts/seed.js itself is untracked and not ignored; spot-checked seeded documents directly in MongoDB (province/district/substation/installation samples, user jurisdiction fields, and that all 240 installations have an api_key_hash) confirming api_key_hash/password_hash are stripped by each model's toJSON transform; `npm test` still 5/5 pass; .env not read or touched at any point.
Requirement IDs: M1, M2, M3, M4, M6, M5 (PLAN.md's ID for the seed-scale/FK-consistency requirement; there is no separate F-series ID)
Outcome: done, with two decisions escalated to the student before writing any code (both answered "recommended" before implementation): (1) bcryptjs was listed in PLAN.md section 5 as the planned password-hashing library but was never actually installed (only cors/dotenv/express/mongoose were dependencies) - installed it for real per the student's instruction; (2) the existing .gitignore has a bare `seed-keys.txt` pattern (matches that filename at any path) that does not cover a path like scripts/output/device-keys.local.json - per the student's instruction, used scripts/seed-keys.txt instead so no .gitignore edit was needed. Also used the real Sri Lankan province/district names and their real parent relationships (public administrative data, not code or report text) instead of inventing arbitrary ones, since Sri Lanka has exactly 9 provinces and 25 districts, matching the brief's numbers exactly, and gives naturally uneven (not fabricated-random) district-per-province counts for free; substation and installation counts per parent use a seeded PRNG (mulberry32, fixed seed) since those aren't real public entities.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-26 08:31 - D4b: seed part 2 - generation readings and top-up script (Claude Code)
Tool/model: Claude Code (Opus 5.5)
Branch: dev_hashini
Prompt 1: Task: seed part 2 — generation readings and a top-up script (Phase 2, playbook D4b). Read CLAUDE.md, docs/design/data-model.md, docs/design/my-decisions.md sections 2, 4 and 9, PLAN.md section 8 (Seed), and the existing scripts/seed.js first. Show the file list and plan first; wait for my OK. Scope: edit scripts/seed.js (add readings); new scripts/topup.js. No routes. No new dependencies. Readings: for all 240 installations, one reading every 15 minutes for 7 days, ending at the seed run time floored to the last 15-minute boundary in UTC (about 161,280 readings). Timestamps stored in UTC. - power_kw: half-sine day curve in Asia/Colombo local time (compute the local-time offset explicitly, never from the server timezone): 0 at night, sunrise 06:00, sunset 18:00 local, peak at local noon = capacity_kw x a per-installation-per-day weather factor (seeded, 0.6-1.0), plus small seeded noise, never negative, never above capacity_kw. - energy_kwh: CUMULATIVE. Start each installation at a seeded baseline (so totals differ), then add power_kw x 0.25 each interval. Must never decrease. Round to 3 decimals. - voltage: realistic single-phase value around 230 V with small seeded variation (seed realism only; validation limits stay OPEN, do not add any to the models). - received_at: timestamp plus a small seeded delay (seconds). - reading_id: propose a deterministic format built from the installation number and the timestamp so ids are unique and stable across --reset runs; mark it PROPOSAL; show me the format before writing. - Deterministic: use the existing seeded RNG so re-runs give identical readings. - Insert with insertMany in batches (ordered: false), print progress per batch. Modes: --reset also clears generation_readings; default mode skips if readings already exist; --dry-run prints planned reading count and the time window only. Integrity check (extend the existing one): count per installation equals the expected count; every timestamp is on a 15-minute boundary and not in the future; energy_kwh never decreases per installation (use an aggregation, not by loading all readings into memory). PASS/FAIL with counts, non-zero exit on FAIL. scripts/topup.js: for each installation, continue from its latest stored reading up to now (floored to 15 minutes), same curve and cumulative-energy rules, so the demo data looks current before a demo or the viva. Prints the database name first, reuses the fail-fast pattern, batch inserts, runs the same energy check afterwards. Safe to run repeatedly (adds nothing if already current). Do not read .env. After the change: state requirement IDs (M3, M4, M5) and how to test; append one ai-log.md entry; do not commit.
Prompt 2 (answers to two questions): reading_id format "RD-0001-20260926041500 (Recommended)"; shared code location "scripts/lib/readings.js (Recommended)".
Prompt 3: plan approved (plan mode exit).
Files created: scripts/lib/readings.js, scripts/topup.js
Files edited: scripts/seed.js (mulberry32 and getDbNameFromUri moved to scripts/lib/readings.js unchanged; readings phase, modes and readings integrity check added)
Checks run: offline scratchpad script (not committed) - buildReadings output for INS-0001 over 672 slots identical under TZ=UTC and TZ=America/New_York (same hash), identical on two calls, 0 energy decreases, 0 negative or above-capacity power, 0 non-zero power outside 06:00-18:00 Colombo, a split run continued from stored energy equals the full run - pass; `node scripts/seed.js --dry-run` printed slsea_local, readings=161280 (240 x 672) and the UTC window, no connection - pass; first `node scripts/seed.js` inserted 161,280 readings then exited 1 (see Outcome); after the fix, cleared generation_readings only and re-ran `TZ=UTC node scripts/seed.js`: hierarchy skipped, 161,280 inserted, readings integrity PASS (240 installations, 0 without exactly 672, 0 unknown, 0 off-boundary/future timestamps, 0 energy decreases), exit 0 - pass; scripts/seed-keys.txt mtime unchanged across all runs (file contents not read) - pass; second `node scripts/seed.js` skipped readings, "Nothing to do", exit 0 - pass; `TZ=UTC node scripts/topup.js` twice when current: added 0, energy check PASS, exit 0 - pass; `TZ=UTC node scripts/topup.js` after the 03:00 UTC boundary: added 240 (one per installation), energy check PASS, exit 0 - pass; `npm test` 5/5 pass. --reset was not run (it would regenerate device keys).
Requirement IDs: M3, M4, M5
Outcome: done, with one failure found and corrected - the first seed run and the first top-up run exited 1 with MongoServerError QueryExceededMemoryLimitNoDiskUseAllowed: the energy check's $setWindowFields pipeline started with $project, which forced an in-memory sort over all readings, and the Atlas free tier does not allow disk use. I first misattributed the seed failure to syncIndexes because the scripts logged only err.name; both scripts now also log err.codeName. Fixed by starting the pipeline with $sort on (installation_id, timestamp), which uses the unique index (explain: IXSCAN, no SORT stage). reading_id format, energy baseline range (capacity x 500-3000 kWh), voltage spread (230 +/- 3 site +/- 3 slot) and keyed per-(installation, time) RNG draws are PROPOSAL.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-26 09:12 - D6: hierarchy read endpoints with pagination and sorting (Claude Code)
Tool/model: Claude Code (Opus 5.5)
Branch: dev_hashini
Prompt 1: Task: hierarchy read endpoints with pagination and sorting (Phase 2, playbook D6). Read CLAUDE.md, PLAN.md sections 4, 6 and 7, docs/design/my-decisions.md sections 5, 6, 7, 11 and 12, and the existing src/ code first. Show the file list and plan first; wait for my OK. Scope: the layered structure from PLAN.md section 6 for these routes only: src/routes/, src/controllers/, src/services/, src/repositories/, src/utils/pagination.js, src/utils/sort.js, src/utils/links.js, new error codes in src/utils/errors.js, route wiring in src/app.js, and test/hierarchy.test.js. Endpoints (all under /solar/v1.0, GET only, no auth yet — jurisdiction scope is added tomorrow): - /provinces and /provinces/:provinceId - /districts?province_id= and /districts/:districtId - /substations?district_id=&province_id= and /substations/:substationId - /installations?province_id=&district_id=&substation_id= and /installations/:installationId (plain member for now; the composite with last_reading comes in Phase 3) Express route params are camelCase; the documented URI templates keep hyphens. Rules: - Collections return {count, next, previous, data}; members return the plain object. count is the total matching the filter, not the page size. next and previous are relative paths that keep all other query params, null at the ends. - Pagination: offset default 0, limit default 20, max 100; non-integer, negative, or limit above 100 gives 400 with the standard error body and a per-field entry in error[]. - Sorting: the white-paper syntax sort=(field ASC) or sort=(a ASC, b DESC), per PLAN.md section 4; per-collection whitelist (installations: installation_id, name, capacity_kw; hierarchy collections: their id and name); unknown field or bad syntax gives 400; default sort is the business id ascending; always add the business id as the final tie-break. - Filters use the JSON attribute names; an unknown filter value simply returns an empty collection (200, count 0), not 404. - A missing member gives 404 with the standard error body. - api_key_hash and _id never appear (the model toJSON already handles this; do not bypass it with lean() unless you strip them yourself). - Only repositories talk to MongoDB; filters and sorting logic live in services so tomorrow's jurisdiction scope can narrow the same query without rewriting it. - New error codes follow the existing scheme (status x 100 + n); propose the numbers, show them to me. Tests: test/hierarchy.test.js reads the seeded slsea_local (read-only, connect in before, disconnect in after): counts 9/25/40/240; pagination next/previous correct at start, middle and end; a filter returns only matching rows; sort ASC and DESC; bad limit and bad sort give 400; unknown member gives 404; no api_key_hash in any installation response. npm test must still pass all existing tests. Do not read .env. No new dependencies. After the change: state requirement IDs (A1, A5, V1, V2, V3) and how to test with curl; append one ai-log.md entry; do not commit.
Prompt 2: plan approved (plan mode exit), including the proposed error codes 40002 (invalid query parameter, top level), 40003/40004/40005/40006 (error[] items for offset/limit/sort/repeated filter), 40402 (resource not found) and limit=0 -> 400 (PROPOSAL).
Files created: src/routes/index.js, src/routes/provinces.js, src/routes/districts.js, src/routes/substations.js, src/routes/installations.js, src/controllers/provinces.js, src/controllers/districts.js, src/controllers/substations.js, src/controllers/installations.js, src/services/list-query.js, src/services/provinces.js, src/services/districts.js, src/services/substations.js, src/services/installations.js, src/repositories/read-repository.js, src/repositories/provinces.js, src/repositories/districts.js, src/repositories/substations.js, src/repositories/installations.js, src/utils/pagination.js, src/utils/sort.js, src/utils/links.js, test/hierarchy.test.js
Files edited: src/utils/errors.js (invalidQuery, resourceNotFound, FIELD_ERROR codes), src/app.js (v1 router replaced by src/routes)
Checks run: `npm test` (TZ=UTC node --test) - 13/13 pass (5 existing errors tests + 8 new hierarchy tests against slsea_local, connected with autoIndex off so no writes): counts 9/25/40/240; districts limit=10 links at offset 0/10/20 and past the end; next/previous keep province_id and sort and the next link can be followed; filters on districts, substations and installations return only matching rows, unknown province_id gives 200 count 0; provinces sort by name ASC/DESC and installations sort by capacity_kw DESC with installation_id tie-break; 10 bad-query cases give 400/40002 with the expected error[] code, and two bad params together report both; four unknown members give 404/40402; no api_key_hash or _id in installation page or member bodies - pass. Manual run of src/server.js on a local port with curl: districts?province_id=PV-01&limit=2, installations sorted by capacity_kw DESC, limit=500 -> 400/40002, provinces/PV-99 -> 404/40402 - pass. .env not read.
Requirement IDs: A1, A5, V1, V2, V3
Outcome: done. Nothing failed. OpenAPI paths (mentioned in playbook D6) not added: docs/design/openapi.yaml does not exist and the prompt scoped it out. next/previous links percent-encode the sort value (for example sort=%28name+DESC%29), which Express decodes back to (name DESC).
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-26 09:35 - D7-D8: installation composite, last-reading and per-installation readings history (Claude Code)
Tool/model: Claude Code (Opus 5.5)
Branch: dev_hashini
Prompt 1: Task: installation composite, last-reading, and per-installation readings history (Phase 3, playbook D7-D8). Read CLAUDE.md, PLAN.md section 7 (rows 8-11), docs/design/my-decisions.md sections 5, 7, 8 and 11, docs/design/data-model.md section 2, and the existing D6 code in src/ first. Show the file list and plan first; wait for my OK. Scope: extend the existing layers (routes, controllers, services, repositories, utils); new error codes in src/utils/errors.js; test/installations.test.js. No auth yet. No conditional GET yet. No readings under substation/district/province yet (next task). Endpoints (under /solar/v1.0): - GET /installations/:installationId becomes the COMPOSITE: the installation fields plus last_reading (the newest reading object, or null if none). Never embed the history. - GET /installations/:installationId/last-reading: the newest reading only; 404 if the installation is missing; 404 with a distinct code if it has no reading yet. - GET /installations/:installationId/readings: scoped collection with the D6 envelope {count, next, previous, data}, offset/limit, sort=(timestamp ASC|DESC) (default newest first; whitelist timestamp only), and from/to (ISO 8601 UTC, both inclusive, either optional). Invalid from/to, or from later than to, gives 400 with per-field error[] items. 404 if the installation is missing. - GET /installations/:installationId/readings/:readingId: one reading; 404 if missing OR if it belongs to a different installation (match both ids). Rules: - ONE shared "newest reading" helper used by both the composite and last-reading (LEC S6), in the service layer. - Write the readings-history query in a service function that takes a SET of installation ids (here, one), time window, sort and paging, so the substation/district/province routes can reuse it next without rewriting. Sort always appends installation_id as the tie-break. - The query must use the unique (installation_id, timestamp) index. Atlas free tier refuses in-memory sorts that exceed its limit and disk use is not allowed: if you hit that, stop and report; do not add allowDiskUse. - api_key_hash and _id never appear in any response. - New error codes follow the existing scheme; propose the numbers and show them. Tests: test/installations.test.js against the seeded slsea_local (read-only; compute expected values from the database, do not hard-code timestamps, because the top-up script changes the newest reading): composite has last_reading equal to the newest reading; last-reading equals it; history returns only that installation's readings; count equals 672 or more; sort ASC and DESC; from/to bound the results; bad from gives 400; reading by id 200; the same reading id under a different installation gives 404; unknown installation gives 404 on all four routes; no api_key_hash or _id anywhere. npm test must still pass all existing tests. Do not read .env. No new dependencies. After the change: state requirement IDs (A2, A3, A4, V1, V2, V3) and curl commands to test; append one ai-log.md entry after the D6 entry and before "## Late entries"; do not commit.
Prompt 2: Approved, with these points: 1. Error codes 40403, 40007, 40008, 40009 accepted as proposed. 2. Choices 1-4 accepted. Mark 1 (UTC-only with Z), 2 (installation 404 before query 400) and the default sort (timestamp DESC) as PROPOSAL in your summary. 3. 40403 test: use t.mock.method as proposed. The service must call the repository through the module object (readingsRepository.findNewest), not a destructured import, or the mock will not take effect. Restore the mock after the test. 4. Yes, add the four new codes to the codes list in docs/design/my-decisions.md section 12. Change nothing else in that file. 5. In the ai-log entry, list the explain check you ran (index used, no in-memory sort) under Checks run, and state that 40403 is covered by a mock, not by seeded data. Everything else as planned. Do not commit.
Files created: src/utils/time-window.js, src/repositories/readings.js, src/services/readings.js, test/installations.test.js
Files edited: src/utils/errors.js (noReadingYet 40403; FIELD_ERROR from 40007, to 40008, timeWindow 40009), src/utils/sort.js (optional defaultSort), src/services/list-query.js (defaultSort and timeWindow options), src/services/installations.js (composite get, getLastReading, listReadings, getReading), src/controllers/installations.js, src/routes/installations.js, docs/design/my-decisions.md (section 12 codes list only)
Checks run: read-only explain('executionStats') on slsea_local (script in the session scratchpad, connection string not printed): history {installation_id: {$in: [INS-0001]}} sorted (timestamp DESC, installation_id ASC); history with a from/to window sorted (timestamp ASC, installation_id ASC); newest reading sorted timestamp DESC - all three plans LIMIT > FETCH > IXSCAN on installation_id_1_timestamp_1, no SORT stage (no in-memory sort), 20 documents examined for a 20-row page - pass; allowDiskUse not used. `npm test` (TZ=UTC node --test) - 23/23 pass (5 errors + 8 hierarchy + 10 new installations tests): composite last_reading and last-reading equal the newest reading read from the database; history count equals the database count for INS-0001 (674, >= 672), only INS-0001 rows, default newest first; sort ASC and DESC; an 11-row from/to window returns exactly those rows, from-only and to-only counts match the database; 7 bad from/to/sort cases give 400/40002 with 40007/40008/40009/40005 items, bad from and to together report both; reading by id 200, same id under INS-0002 404/40402; INS-9999 gives 404/40402 on all four routes (and before a bad-from 400); no api_key_hash or _id in the four response types. 40403 is covered by a t.mock.method mock of readingsRepository.findNewest (restored after the test), not by seeded data: every seeded installation has readings. Manual run of src/server.js on a local port with curl: composite, last-reading, readings?limit=2&sort=(timestamp ASC), from later than to -> 400/40009, reading id under INS-0002 -> 404 - pass. .env not read.
Requirement IDs: A2, A3, A4, V1, V2, V3
Outcome: done. Nothing failed. PROPOSAL (to confirm): from/to accept only UTC with a trailing Z (date-only and offsets give 400); the installation 404 is checked before the query 400; readings default sort is timestamp DESC. The "## Late entries" heading named in the prompt does not exist in ai-log.md; this entry was placed after the D6 entry and before the first "[added 2026-09-26]" entry. The heading was restored afterwards, directly below this entry [added 2026-09-26].
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## Late entries (added 2026-09-26)

These events happened earlier but were not logged at the time. Each keeps its original date. Facts only; the two review lines in each entry are left for my own review.

---

## 2026-09-19 - D2 first attempt: credential exposure incident (Claude Code) [added 2026-09-26]
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt (partly garbled in the saved transcript; gaps marked [...]): Task: add the MongoDB connection (D2). Read CLAUDE.md and docs/design/my-decisions.md first. Add config/db.js using mongoose (the only new dependency) and MONGODB_URI from .env [...]. Fail fast with a clear [message on f]ailure and exit non-zero; never print the URI or any credential. Start the server only [after the connection succ]eeds; on success log only the database name. Update .env.example w[ith a placeholder] URI (no real values). Keep GET / working. Show the file list and [a plan first; wait for my] OK. Small targeted diff. Done when: npm run de[v logs the datab]ase name and GET / returns 200; with a wrong password it exits with a clear message and no secrets.
Files: .gitignore (created at the repo root by Claude Code without being asked, because atlas-credentials.env was unprotected)
Checks: none (task stopped)
Requirement IDs: none (security incident)
Outcome: failed and stopped - while investigating, Claude Code ran an awk command on atlas-credentials.env that printed a real Atlas password into the session output, then reported it immediately and advised rotating the password. The task was restarted after /clear as the D1/D2 entry. Safeguards added afterwards: CLAUDE.md SECRETS rule (no shell access to secret files either), .claude/settings.json read denials, root .gitignore patterns (commit 7d261c9). Password rotation after this incident: not recorded.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-19 - Phase 1 explain-back exercises (Claude Code, read-only) [added 2026-09-26]
Tool/model: Claude Code (Sonnet 5)
Branch: dev_hashini
Prompt: 12 read-only explain-back exercises from the playbook (explain src/config/db.js line by line and quiz me; trace npm run dev to the first GET /; failure paths; middleware order; ten examiner questions; white-paper deviations; branch strategy; deployment risks; how CLAUDE.md protects secrets; requirement IDs satisfied; request lifecycle; ten-bullet summary). Follow-ups: "Go in listed order (1 -> 12)", "did u answerd all", "answer all", "you pick which three to test me on".
Files: none changed
Checks: none
Requirement IDs: none (viva preparation)
Outcome: done - after "answer all", Claude Code wrote reference answers to all 12 exercises itself instead of quizzing me. Checked 2026-09-26: the answer to exercise 6 says the lecture guidance outranks the white paper; that is wrong (brief cover, PLAN.md section 4a and CLAUDE.md: the white paper is the design authority; OQ-21 is a recorded deliberate deviation). The answer to exercise 9 does not mention the D2 password incident above. Exercises 7 and 8 describe Render, which was replaced by Azure on 2026-09-20.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-19 to 2026-09-26 - study aids (Claude chat) [added 2026-09-26]
Tool/model: Claude (chat)
Branch: n/a (not in the repo)
Prompt: requests for end-of-day progress reports ("prepare the Day N progress report"), plain-English explanations of technical terms ("I appreciate it if u can add technical terms like mongoose models and indexes in simple english"), a study PDF ("Create a detailed PDF that covers the relevant architecture and design information available in the project ... for me to study and understand the complete architecture and design of the project"), and a check of the finalized rubric against my decisions.
Files: none in the repo (day-01 to day-04 reports; "SLSEA_Solar_API_Architecture_and_Design_Study_Guide.pdf", 76 pages, generated from the repo on 2026-09-21)
Checks: the study guide was built only from the repo and the brief; its diagrams were rendered from the repo's Mermaid sources
Requirement IDs: none (study aids for the viva; not report text)
Outcome: done - used as AI-aids for understanding and viva preparation. They are AI-written; none of their text is used as report text.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 - OQ-34: Express 4 vs 5 test and upgrade to Express 5 (Claude chat + manual) [added 2026-09-26]
Tool/model: Claude (chat) ran the comparison in its own sandbox; the upgrade was run manually
Branch: dev_hashini
Prompt: "Decide OQ-34: Express 4 or 5" (from the Day 3 plan); "what is ur suggestion"; "done".
Files: package.json, package-lock.json (commit 4d4f23f); PLAN.md, docs/design/my-decisions.md, CLAUDE.md (commit c57ddce)
Checks: Claude chat test on the committed skeleton: with Express 4.22.3 an async route that throws left the request hanging (timeout) with an unhandled rejection; with Express 5.2.1 the same route reached the error middleware and returned 500; the skeleton's GET / returned 200 under Express 5
Requirement IDs: V5 (foundation for the error contract)
Outcome: done - upgraded to express ^5.2.1; OQ-34 recorded as DECIDED; CLAUDE.md forbids async wrapper helpers.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 - Azure zero-cost validation (H0) and OQ-33 (manual, guided by Claude chat) [added 2026-09-26]
Tool/model: manual (Azure portal), guided by Claude chat; Claude chat also web-searched how Azure for Students billing ends when the credit runs out
Branch: dev_hashini
Prompt: step-by-step guidance in the chat; screenshots of the Create Web App review page and the pricing page shared with Claude chat
Files: docs/evidence/azure-validation.md, docs/evidence/azure-validation-2026-09-21.png, PLAN.md, docs/design/my-decisions.md (commit 3454155)
Checks: the Create Web App wizard reached Review + create with Node 22 LTS on Linux, India South Central, Basic B1 (1.75 GB); the pricing page showed Basic B1 US$0.018/hour (US$13.14/month) and Free F1 available; the web app and App Service plan were not created
Requirement IDs: G1 (deployment planning)
Outcome: done - OQ-33 closed (India South Central). Whether the empty resource group rg-solar-api was created is not recorded.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-21 - documentation fixes from the Claude chat repo review (Claude chat + manual) [added 2026-09-26]
Tool/model: Claude (chat) supplied exact edits; applied manually
Branch: dev_hashini
Prompt: "Continue" (finish the study-guide review), which listed problems found in the repo with exact fixes
Files: PLAN.md (G1 requirement row, OQ-33 row, section 12 typo, section 18 paragraph), docs/evidence/azure-validation.md (price) (commit 5c4e81c)
Checks: none (documentation only)
Requirement IDs: none (documentation accuracy)
Outcome: done
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

---

## 2026-09-24 - Superpowers plugin and read-only project audit (Claude Code) [added 2026-09-26]
Tool/model: Claude Code (Sonnet 5), run after installing the Superpowers community plugin (obra/superpowers)
Branch: dev_hashini
Prompt: Task: audit the project so far against the coursework brief and the module reference material. This is a read-only analysis - do not write, edit, or create any file, and do not write report prose. Read, in this order: CLAUDE.md; the coursework brief (refs/course-library); the white paper (refs/course-library); PLAN.md in full; docs/design/my-decisions.md in full; docs/design/data-model.md; docs/design/diagrams/README.md; then the actual current code: src/**, scripts/**, test/**, package.json. Produce a structured analysis with these sections: 1. Requirement coverage: for each row in PLAN.md section 2 (the requirement checklist) and section 14 (traceability), state whether it is DESIGNED (in the docs) and separately whether it is BUILT (real code exists and runs), not just one combined status. Cite the specific file/section for each claim - no unsourced claims. 2. Brief compliance check: re-read the brief directly (not just PLAN.md's summary of it) and flag anything the brief requires that PLAN.md, my-decisions.md, or the current code does not yet address, or addresses differently than the brief states. Do not flag something as a gap if it is already logged as an OPEN question (OQ-n) in my-decisions.md - instead just list which OQ it maps to. 3. Consistency check between documents: find any place where PLAN.md, my-decisions.md, data-model.md, or the diagrams disagree with each other or with the actual code (e.g. a decision recorded as DECIDED that the code does not yet implement, or implements differently). 4. Rubric risk (brief section 11's mark weighting): for each of the 8 marked dimensions, give a one-line honest status - not just "on track" - and name the single biggest risk to that dimension's marks given how many days remain before 4 Oct. 5. What is NOT yet started at all, plainly listed, no hedging. Be blunt and specific. Do not soften findings to sound reassuring. If something cannot be verified from the repo as it exists right now, say "cannot verify" rather than assuming. Output as a plain markdown report in your response, not as a file. Do not touch .env. Do not modify ai-log.md - this is analysis, not a build step, so it does not need a log entry.
Files: none changed (read-only)
Checks: n/a
Requirement IDs: all (audit)
Outcome: done - report in the session only. Findings: no correctness or secret-handling problems in the built code; docs/design/data-model.md section 7 is stale (it lists PLAN.md section 8 edits as not made although they were made on 2026-09-21); ai-log review lines unfilled; API design, coverage, security, deployment and report not yet built. The prompt said not to log this session; that was a disclosure gap, corrected by this entry.
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)