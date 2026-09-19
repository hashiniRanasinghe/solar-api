# STUDENT_PLAYBOOK.md — practical workflow (Mac · VS Code · Claude Code · Git)

> Companion to `PLAN.md`. If they disagree, `PLAN.md` wins. Do steps in order. **One step = one commit on `dev_hashini` = one `ai-log.md` entry.** Branches: `dev_hashini` (mine) → `dev` (central) → `deployment_dev` (deploy branch). `deployment_qa` is a marker, never deployed. **`main` is never used.** One deployment: from `deployment_dev`.
> Tags: `[YOU]` your decision · `[PROPOSAL]` suggestion until you confirm it in `docs/design/my-decisions.md` · `[WP §n]` white paper (now in the project; also put the PDF in `refs/whitepaper/`).

---

## 0. Ground rules

| Rule | Why |
|---|---|
| Claude Code writes **code**. I write **every word of the report** | Brief §10 + integrity policy |
| Log every prompt in `ai-log.md` (chat prompts too) | Mandatory disclosure appendix |
| Small diffs, targeted edits, no full-file rewrites unless I ask | Easier to review and explain |
| Explain-back before the next step | Unexplained artefact forfeits its marks at viva |
| Never copy code from the classmate repo | Reference repos are for understanding only |
| No secrets in git. Ever | `.env` ignored, `.env.example` committed |
| Brief > white paper > lecture notes > `PLAN.md` | If a prompt result contradicts them, the prompt result is wrong |

---

## 1. The loop for every build step

```text
1. git switch dev_hashini && git pull origin dev     (always work here; never on dev directly, never touch main)
2. In VS Code terminal:  claude        then /clear   (fresh context per step)
3. Plan mode first (Shift+Tab, or /plan): paste the step prompt. Read the plan.
   Reject anything outside PLAN.md (extra libraries, extra endpoints, extra files).
4. Approve → Claude edits. Read the diff:   git diff
5. Run it + run the tests for this step:   npm run dev   /   npm test
6. Explain-back: ask "Quiz me on <file>" (E1). If I can't answer, I don't commit.
7. Append the entry to ai-log.md
8. git add -p && git commit -m "type(scope): summary"
9. git push origin dev_hashini → open PR into dev ("Create a merge commit") → Dev redeploys → BASE_URL=<dev url> npm test
10. Phase end only: release dev → deployment_dev by MR, then tag pN (see "Release routine" below)
```

Commands can change between Claude Code versions; confirm with `/help`.

**Step prompt template** (paste, fill the brackets, keep the footer):

```text
Task: [one sentence]. Read CLAUDE.md and PLAN.md §7–§9 first.
Scope: only [files/folders]. Output a file list and a plan first; wait for my OK.
Constraints: small targeted diff; no new dependencies beyond PLAN.md §5; snake_case JSON;
hyphenated lowercase URIs; res.json() only; no comments longer than one line.
Done when: [exit test from PLAN.md §13].
```

**`CLAUDE.md`** (repo root, create in step A4; or run `/init` and then replace with this):

```markdown
# CLAUDE.md — SLSEA Solar Generation API (NB6007CEM CW1)

## Sources and rules
- Read PLAN.md and docs/design/my-decisions.md before any task.
- Priority when sources conflict: (1) the current coursework brief; (2) entries marked DECIDED in docs/design/my-decisions.md, including my recorded deliberate deviations from the white paper (for example OQ-21); (3) the WSO2 white paper; (4) lecture notes S1-S8; (5) PLAN.md and any PROPOSAL. Never "fix" a DECIDED item to match the white paper. Name the conflict and stop.
- NEVER write, rewrite or paraphrase report text. NEVER copy code from refs/.
- OPEN decisions (PLAN.md section 15: OQ-26 to OQ-29 and the validation limits): do NOT choose silently. Stop and ask.
- Small diffs. Show a plan and file list first. No secrets in code; no hard-coded fallback secrets.
- After each change: state which requirement ID (PLAN.md section 2) it serves and how to test it.

## Stack and model
- Node/Express, Mongoose, MongoDB Atlas, Render, OpenAPI at /docs. Nothing else without asking.
- Model: Province > District > Substation > Installation > Reading, plus User. NO Device entity (meter_id is an installation attribute).
- Installation stores substation_id; district_id/province_id are server-derived, stored read-only, never taken from the client.
- energy_kwh is CUMULATIVE (running total). String IDs (INS-0001); Mongo _id hidden.
- No timestamp tolerance or future-time rule. Do not add one.
- Seed: 9 provinces, 25 districts, 40 substations, 240 installations, 15-minute readings for 7 days, ending at run time; a top-up script appends up to now.

## API
- Base path /solar/v1.0 (GET /, /docs, /docs.json outside it). URIs: lowercase, hyphens, plural collections, nouns. JSON: snake_case, res.json().
- Hierarchy is top-level and read-only, filtered by query (/districts?province_id=...). /substations.
- Readings are append-only: POST only, and only under /installations/{installation-id}/readings. No PUT/PATCH/DELETE on readings. No global /readings.
- GET-only readings collections also under /substations/{id}, /districts/{id}, /provinces/{id}. Path = which parent. Query from, to, sort, offset, limit = how to read it. Sort tie-break: installation_id.
- Derived resources are noun sub-resources: /installations/{id}/last-reading, /districts/{id}/generation-summary. Never a URI segment called processing-functions.
- POST /login issues tokens. Collections return {count, next, previous, data}; members are bare objects. 404 for a missing member; 200 + empty data for an empty collection.
- Sort: sort=(timestamp DESC). Pagination: offset + limit.
- 201 responses carry Location, Content-Location, ETag, Last-Modified.
- One error body everywhere (white paper 11): {code (integer), message, description, moreInfo, error[] per field}.

## Auth
- Devices: X-API-Key, own installation only. Users: JWT Bearer with scopes + jurisdiction claims.
- 401 = credentials missing or not accepted (+WWW-Authenticate). 403 = understood but refused. Unknown API key 401; valid key for another installation 403.
- Writable: readings (device POST) and installations (admin POST/PUT/DELETE, scope solar:write, national). Everything else is read-only.

## Git and environment
- Work ONLY on branch dev_hashini. Never commit, merge, rebase or push on dev or deployment_dev; I open the merge requests (pull requests).
- Flow: dev_hashini -> MR -> dev -> release MR at phase end -> deployment_dev (Render tracks it; this is the submitted URL).
- NEVER create, use, merge into or touch main. deployment_qa is a marker branch, never deployed and never used: do not touch it.
- Never force-push, squash or rewrite pushed history.
- One deployment: deployment_dev (Render service solar-api-dev tracks branch deployment_dev, database slsea_dev). No QA service or database. My local .env uses database slsea_local. GET / also returns environment from APP_ENV.

## Local course reference library
- The course reference library is available locally at `refs/course-library/` (a git-ignored symlink to my course folder outside this repo).
- It holds the current coursework brief, lecture materials, student notes, demonstrations, REST API design guidance, and reference Git repository information.
- **The WSO2 REST API Design Guidelines v1 white paper is a key reference for this coursework.** Before making REST/API design decisions, consult `wso2_rest_api_design_guidelines-v1.pdf` in that folder.
- Use the white paper particularly for: URI/resource design, collection and member resources, HTTP methods, status codes, pagination, filtering, sorting, conditional requests, headers, content negotiation, error responses, authentication/authorization, and other REST conventions covered by the coursework.
- The coursework brief defines what the assignment requires. The white paper and the relevant lecture materials give the technical/design guidance for implementing those requirements.
- Use the S1-S8 lecture PDFs and student notes to understand the concepts and approaches taught in the module.
- `ref gits.rtf` describes the provided reference Git repositories. Use those repositories for learning and comparison where relevant.
- The marking rubric in that folder is OUTDATED (module NIB304CEM, batch 24.1P). Use it only as a hint about possible assessment areas. Never use its marks, criteria or wording as current requirements. The current brief and its section 11 weights rule.
- Do NOT copy code, report text, diagrams, documentation or other submitted content from the reference repositories or course materials.
- Do NOT copy a reference implementation just because it uses a particular approach. Adapt the concepts to this project's requirements and documented decisions.
- If sources appear to conflict, follow the priority list in Sources and rules, name the conflict, and do not silently make a major design decision.
- The reference library is read-only. Do not modify, rename, delete or generate files inside it.
- If the reference library cannot be accessed, say so clearly before starting a task that depends on it.
```

---

## Release routine (branches → deployment)

```text
dev_hashini  →(MR)→  dev  →(release MR, phase end only)→  deployment_dev  →  Render  (the submitted URL)
deployment_qa   kept as a best-practice marker, never deployed
main            never used
```

**After each build step (`dev_hashini` → `dev`)**

```bash
git add -p && git commit -m "feat(scope): summary"      # ai-log.md entry in the same commit
git push origin dev_hashini
# GitHub: Merge request (pull request)  base: dev  ←  compare: dev_hashini  → "Create a merge commit" (no squash) → merge
git switch dev_hashini && git pull origin dev
```

Run the step's tests locally **before** the merge request. Nothing deploys yet: your local `.env` points at `slsea_local`.

**At the end of a phase (release `dev` → `deployment_dev`)** — when on an up-to-date `dev`, the full `npm test` and the phase exit test in `PLAN.md` §13 pass locally:

```bash
# GitHub: Merge request  base: deployment_dev  ←  compare: dev  → "Create a merge commit" → merge
# Render deploys automatically (the service tracks deployment_dev). Wait for "Live".
BASE_URL=https://<solar-api-dev>.onrender.com npm test          # live smoke test
git fetch origin && git tag p2 origin/deployment_dev && git push origin p2      # p1…p8
```

If GitHub says "no history in common", delete `deployment_dev` and recreate it from `dev`. If a release breaks: fix on `dev_hashini`, MR into `dev`, release again, tag `p2b`. Never move or delete a pushed tag. No squash, no rebase of pushed history, no force-push.

**Freeze:** after the last live check, tag `submission` on `deployment_dev` and merge nothing more into `deployment_dev` **or** `dev` until marking and the viva are done. Before submitting, check that `dev` and `deployment_dev` are identical (GitHub → Compare `dev...deployment_dev` shows no differences).

---

## Part A — Setup (Mac + VS Code)

### A1. Tools

```bash
# Homebrew: https://brew.sh (skip if installed)
brew install git node
node -v && npm -v && git --version
git config --global user.name  "<your name>"
git config --global user.email "<your GitHub email>"
```

VS Code: open the project folder (`code .`), use the integrated terminal (Ctrl+`) for `claude`. Use `curl` for API calls (or Thunder Client if you prefer a GUI). No other extensions needed.

### A2. Accounts

GitHub, MongoDB Atlas, Render (sign in with GitHub), Claude Pro.

### A3. Local repo and branches (your GitHub repo is `hashiniRanasinghe/solar-api`)

Workflow: **work on `dev_hashini`, merge into `dev` by merge request** (GitHub calls it a pull request); release `dev` → `deployment_dev` by merge request at phase ends.

Where you are: `dev` already holds your docs commit. The branches `deployement_dev` and `deployemeny_qa` exist but are **misspelled**, and the default branch is still `dev_hashini`.

1. **Rename the branches on GitHub** (Code → branches → ⋯ → Rename branch): `deployement_dev` → `deployment_dev`, `deployemeny_qa` → `deployment_qa`.
2. **Check they share history with `dev`:** GitHub → Compare `dev...deployment_dev`. If it says "no history in common", delete the branch and recreate it from `dev` (branch dropdown → type the name → "Create branch from dev").
3. **Default branch:** Settings → General → Default branch → `dev`.
4. **Local clean-up and sync:**

```bash
git fetch --prune
git switch dev_hashini
git pull origin dev
git branch -a          # expect dev, dev_hashini, deployment_dev, deployment_qa (+ remotes); no main
```

5. **Collaborator:** `nirangadh` has a pending invitation. He must accept it. Copy the invite link (copy icon next to "Pending Invite") and send it to him. Screenshot the collaborator list after he accepts.
6. If your plan allows branch protection for a private repo, protect `dev` and `deployment_dev` (merge request required); otherwise it is discipline. If GitHub shows a `main` branch, leave it alone.

`ai-log.md` entry format:

```text
## YYYY-MM-DD — <step id>
Tool/model:
Prompt:
Accepted / changed / rejected:
```

### A4. `CLAUDE.md` + reference repos (local only, git-ignored)

Create `CLAUDE.md` from §1 above, then:

```bash
cd refs
git clone -b dev https://github.com/nirangadh/NB6007CEM-Web-API-Development.git lecturer
git clone https://github.com/PruthuviDe/WebAPIDev_Test.git classmate
git clone -b dev/05-07-2026 https://github.com/gimnakatugampala/WebAPIDev-Test.git classmate-2   # early snapshot, taxi domain
mkdir whitepaper rubric      # drop the white paper PDF and the rubric PDF here (OQ-01)
cd ..
git commit -am "docs: add CLAUDE.md" && git push
```

Also copy the white paper PDF into `refs/whitepaper/`. Both classmate repos are **understanding-only** references (taxi/police domain, different design choices, some traps: e.g. a global `/pings` route, base path `/v1/api/`). Never copy code. The lecturer repo holds lecture notes only — **the white paper is not in it**; use the uploaded PDF.

### A5. Add the lecturer as collaborator (do in Phase 1)

GitHub → repo → **Settings → Collaborators → Add people** → `nirangadh` (https://github.com/nirangadh). Screenshot it for the report. The lecturer sees the default branch first, so it must be `dev`.

---

## Part B — Decisions and requirements (Phase 0)

### B0. Write `docs/design/my-decisions.md` **by hand, in your own words** (~45 min, no AI)

Do this before you read my proposals in `PLAN.md`. Skeleton:

```text
# My decisions
1. Resources and hierarchy:
2. Why no Device entity:
3. Why readings are an append-only time series (and what breaks if not):
4. Who reads what (jurisdiction rule) and how it is enforced:
5. Who writes what (device rule) and how it is enforced:
6. Pagination / sort / filter parameters:
7. Envelope and error format:
8. Which resources are writable besides readings (OQ-03):
9. Jurisdiction filter — where it lives (OQ-04):
10. 401 vs 403 for a valid key on the wrong installation (OQ-10):
11. Anything I'm unsure about:
```

### B1. Requirements file

```text
Read PLAN.md §2 and docs/ (the brief). Create docs/requirements.md: keep the IDs, add a column
"brief page", and list any requirement in the brief that PLAN.md §2 misses under "Unclear".
Do not invent requirements. Do not write code.
```

### B2. Rubric gap table (rubric PDF in `refs/rubric/`: it is an **outdated** rubric for NIB304CEM 24.1P — supplementary only, see `PLAN.md` §17; brief §11 weights and requirements win)

```text
Using refs/rubric and docs/requirements.md, create docs/rubric-gaps.md: per rubric area, what the
rubric expects for top marks vs the evidence that exists in this repo (file paths). Mark missing
evidence clearly. Do not edit any code.
```

### B3. Check my decisions against the white paper (needs `refs/whitepaper/`)

```text
Compare docs/design/my-decisions.md with the white paper in refs/whitepaper. Also list every place
where the lecture notes in refs/lecturer contradict the white paper (PLAN.md §4a is a starting list).
Output a table: my decision | matches white paper? | section | conflict or gap. Do not rewrite my decisions
and do not suggest code. Only flag differences. If a section is missing from refs/, say so.
```

Exit Phase 0: OQ-01…OQ-05 answered, `my-decisions.md` committed.

---

## Part C — Design documents

### C1. Data model first (Phase 2 start)

```text
Read docs/design/my-decisions.md and PLAN.md §8. Produce docs/design/data-model.md: entities, fields
(snake_case), keys, relationships, scoping notes. No Device entity; meter_id on installation.
Readings are a separate append-only collection. Mermaid ER diagram. Flag anything that breaks
the brief §3 or a white paper rule. Do not write code.
```

### C2. OpenAPI grows with each phase `[PROPOSAL]`

Each Part D step that adds an endpoint also adds that path to `docs/design/openapi.yaml` (parameters, schemas, status codes, headers, security schemes). Phase 7 verifies spec = routes.

### C4. Diagrams (Phase 0b — done as sources)

Diagram sources live in `docs/design/diagrams/` (index in its README). Keep them in step with `my-decisions.md`: change a decision, update the diagram in the same commit. Export for the report on your Mac when needed: `npx @mermaid-js/mermaid-cli -i <file>.mmd -o <file>.svg`, and check the rendering by eye.

### C3. Architecture diagram (Phase 1 end)

```text
Create docs/design/architecture.md with the Mermaid diagram from PLAN.md §6 and one line per layer.
Match the folders that exist in src/ right now. Do not add layers.
```

---

## Part D — Build (one prompt per step, commit after each)

Use the §1 template footer on every prompt. Sonnet 5 unless marked.

### Phase 1 — Walking skeleton

**D1. Scaffold**

```text
Set up src/ as an Express app: app.js (exports app; mounts the API router under /solar/v1.0, GET / stays outside), server.js (listens on process.env.PORT),
config/env.js (dotenv), folders routes/controllers/services/repositories/models/middleware/utils.
GET / returns {status:"ok", environment: process.env.APP_ENV || "local"}. Scripts: start = node src/server.js, dev = node --watch src/server.js,
test = node --test test/. Add .env.example (PORT, APP_ENV, MONGODB_URI placeholder). Dependencies only: express dotenv cors. Show file list first.
```

**D2. Atlas connection**

```text
Add config/db.js using mongoose and MONGODB_URI from .env (mongodb+srv:// URI). Fail fast with a
clear message on connection failure; never print the URI. Start the server only after connect.
Update .env.example. Targeted diff.
```

Atlas: create free M0 cluster → Database Access user → Network Access allow `0.0.0.0/0` (coursework) → copy the **SRV** connection string into `.env`.

**D3. Deploy (do it now, not at the end)**

Atlas: one M0 cluster (you create it). Two databases, named by the URI: **`slsea_local`** for your local `.env` and **`slsea_dev`** for the deployed service. Use the `mongodb+srv://` string; Network Access allows Render.

```text
Render service - solar-api-dev:  New → Web Service → connect the GitHub repo → Branch: deployment_dev → Auto-Deploy: on
  Build: npm install   Start: npm start
  Env vars: MONGODB_URI (…/slsea_dev), JWT_SECRET (long random, unique), NODE_ENV=production, APP_ENV=dev
```

`deployment_dev` must contain the app first: finish D1 and D2 on `dev_hashini`, merge into `dev`, then do the first release merge `dev` → `deployment_dev` (see "Release routine"), and create the service after that.

This is the only deployment and the URL you submit. `deployment_qa` is a marker branch only: no service, no database.

```bash
curl -i https://<solar-api-dev>.onrender.com/     # 200, "environment":"dev"
```

Exit Phase 1: the deployed URL returns 200 over HTTPS, lecturer added and accepted, tag `p1` on `deployment_dev`.

### Phase 2 — Model, seed, hierarchy reads

**D4. Seed** (after C1)

```text
Write models for provinces, districts, substations, installations, generation_readings per
docs/design/data-model.md, then scripts/seed.js: idempotent, deterministic RNG, batch insertMany.
9 provinces, 25 districts, 40 substations, 240 installations, 7 days x 15-minute readings per
installation ending at run time, half-sine diurnal curve 06:00-18:00 Asia/Colombo stored in UTC,
cumulative non-decreasing energy_kwh. derive district_id/province_id from the substation chain (never hand-typed). Also seed demo users and per-installation device keys
(store only hashes; print the plain keys once to a git-ignored file). Log counts at the end. Print the target database name before it writes anything.
```

Then add `scripts/seed-top-up.js` (append readings from each installation's newest reading up to now; safe to re-run; never wipes). Run against Atlas: `node scripts/seed.js`, later `node scripts/seed-top-up.js` before submission and before the viva. Check counts in the Atlas UI and that the newest reading per installation is recent.

**D5. Error contract**

```text
Add utils/errors.js (AppError) and middleware/errorHandler.js. One JSON shape for every 4xx (white
paper section 11): {code: integer, message, description, moreInfo, error: [{code, message}]}.
Integer codes = HTTP status x 100 + n (e.g. 40001). Validation errors fill error[] per field.
404 for unknown routes too. No stack traces to clients. List every status code and where it is produced.
```

**D6. Hierarchy reads + pagination util**

```text
Implement GET collection and GET member for /provinces, /districts, /substations per
docs/design/openapi.yaml. Add utils/pagination.js: limit/offset (cap limit), collections return
{count, next, previous, data}; members are bare objects. Missing member -> 404; empty collection -> 200.
Add the paths to the OpenAPI file. Use the parameter names in my-decisions.md.
```

### Phase 3 — Installations and readings (read path)

**D7. Installations + composite**

```text
Implement GET /installations and GET /installations/{installation-id}. The member returns the
installation plus last_reading (one nested reading object, or null). Never embed the history.
Never expose api_key_hash. One helper finds the latest reading (index installation_id+timestamp desc).
```

**D8. Last-reading + history**

```text
Implement GET /installations/{installation-id}/last-reading (noun, hyphenated; 404 if none; reuse the
helper), GET /installations/{installation-id}/readings (scoped collection) and
GET /installations/{installation-id}/readings/{reading-id}. No global /readings route.
```

### Phase 4 — Device write path

**D9. Ingest**

```text
Implement POST /installations/{installation-id}/readings. installation_id comes from the path only.
Validate power_kw, energy_kwh, voltage, timestamp (400 with details). Unique (installation_id,
timestamp): duplicate -> 409. Success: 201 + Location (/installations/{id}/readings/{reading-id}) +
Content-Location (same URI, body repeats the resource) + ETag + Last-Modified + the created reading. Wrong Content-Type -> 415. No PUT/PATCH/DELETE on readings (405 + Allow).
```

**D10. Device auth (use Opus 5)**

```text
Add middleware/authApiKey.js for the POST above only. Missing key -> 401 + WWW-Authenticate. Unknown key (no matching hash) -> 401.
Key matches a DIFFERENT installation -> 403 (unique index on api_key_hash gives the lookup). Compare SHA-256 hashes with crypto.timingSafeEqual.
Never log keys. Explain each decision in one short comment.
```

Exit Phase 4: `Location` resolves via GET; wrong-installation key → 403; tag `p4`.

### Phase 5 — Users, JWT, jurisdiction (use Opus 5)

**D11**

```text
Implement POST /login (processing-function resource, 200 + token; credentials -> JWT with sub, scope
list e.g. solar:read / solar:write, role, jurisdiction_level, jurisdiction_id, short expiry). Add middleware/authJwt.js (401 + WWW-Authenticate) and middleware/scope.js: resolve the
path parent or target resource (province, district, substation, installation) to its province/district and
compare with the token (national: all; province: own province and below; district: own district and
below). Design it so the readings-under-a-parent routes added in D12 reuse it. Apply to ALL GET routes that exist at this point.
Out of scope -> 403. Collections are filtered to the caller's scope. JWT must not work on POST readings.
Hash passwords with bcryptjs. JWT_SECRET from env only, no fallback value. Return a 401/403 matrix.
```

### Phase 6 — Query surface

**D12. Filter, sort, paginate**

```text
Per my-decisions.md section 11 (path = which parent, query = how to read it):
1) Add GET /substations/{substation-id}/readings, /districts/{district-id}/readings and
/provinces/{province-id}/readings (GET only, no global /readings). One shared service: find the installation
ids under the path parent (derived ids on installations), then query their readings. Same query as the
installation history: from, to (ISO 8601, inclusive), sort=(timestamp DESC) / (timestamp ASC), offset, limit.
Always append installation_id as the sort tie-break so pages neither repeat nor skip rows. Do NOT copy
jurisdiction ids onto readings.
2) Catalogue filters as query parameters: /installations?province_id&district_id&substation_id,
/districts?province_id, /substations?district_id&province_id.
Validate every value; 400 with error[] on bad input; reject non-string query values (NoSQL operator
injection). Apply the D11 scope middleware to these new routes: the check runs on the PATH PARENT (missing parent -> 404 first; province route for a district user -> 403). Update OpenAPI.
```

**D13. Conditional GET**

```text
Add ETag + Last-Modified on all GET routes. If-None-Match takes precedence over If-Modified-Since
(white paper 10.4): unchanged -> 304, empty body.
Add Cache-Control. Show a curl pair that proves 200 then 304. Tell me whether you rely on Express's
built-in ETag or your own hash, and why.
```

**D14. Negotiation**

```text
Accept that excludes application/json -> 406 (even though only one media type exists, white paper 10.1). Request Content-Type not application/json on
POST/PUT -> 415. Use the standard error body.
```

### Phase 7 — Admin CRUD, summary, Swagger

**D15. Installation CRUD**

```text
Implement POST /installations (201 + Location), PUT /installations/{installation-id} (whole-document
replace, not merge; If-Match stale -> 412), DELETE (second call -> 404; readings are retained).
Roles: admin = JWT with scope solar:write (national); reader write attempt -> 403; a device key on these
routes -> 401. POST takes name, meter_id, substation_id, capacity_kw; the server sets installation_id,
created_at, updated_at and the derived district_id/province_id (recomputed on PUT if substation_id changes;
client-supplied derived ids are ignored). Duplicate meter_id -> 409; unknown substation_id -> 400.
No PATCH. Do not choose how a new installation gets its device key: that is OPEN (OQ-28), ask me. Update OpenAPI.
```

**D16. District generation summary (stretch)**

```text
Implement GET /districts/{district-id}/generation-summary: current total power_kw (latest reading per
installation) and today's total energy_kwh across installations in the district. Scope + conditional
GET apply. One aggregation query, no per-installation loop.
```

**D17. Swagger**

```text
Serve Swagger UI at /docs and the raw spec at /docs.json from docs/design/openapi.yaml
(swagger-ui-express + yaml). servers: the relative URL /solar/v1.0 only (one spec works on every environment; no localhost). Describe the two auth schemes and list demo
credentials as demo-only. Check every real route against the spec; list mismatches.
```

---

## Part E — Review (Phase 8)

**E1. Explain-back (per module)**

```text
Quiz me on <module>. One question at a time about what the code does and why it was designed that way.
Don't give the answer until I reply, then correct me briefly.
```

**E2. Security review (Opus 5)**

```text
Review the repo for: auth bypass, missing scope checks, key/password storage, NoSQL injection, input
validation, CORS, secrets in git history, error leakage, JWT settings. Table: issue | file:line |
severity | suggested fix. Do not apply fixes.
```

**E3. Audit against the brief (Opus 5)**

```text
Audit the repo against docs/requirements.md and PLAN.md §14. Table: requirement | met? | evidence
(file or endpoint) | gap. End with the top fixes ranked by marks gained.
```

Then: re-run `node scripts/seed.js` against Atlas, run `BASE_URL=https://<app>.onrender.com npm test`, tag `submission`.

---

## Part F — Report (I write it; Phase 9)

The AI never writes, rewrites or paraphrases my report text.

**F1. Evidence checklist (chat)** — use `PLAN.md` §11; ask the coach to fill gaps as a checklist only.

**F2. Contradiction check (chat)**

```text
Here is my draft section. Flag only: claims that contradict the code or OpenAPI spec, missing
evidence, and rubric gaps. Do not rewrite anything.
```

**F3. Final checks**
- Word count 2250–2750 (exclude declaration, AI appendix, diagrams, tables, code listings, references)
- All six sections present and identifiable
- Turnitin < 15% and AI score < 15% (screening only)
- Signed declaration attached; AI appendix built from `ai-log.md`
- No `localhost` in the report or spec

---

## Part G — Viva prep

**G1. Mock viva (chat)**

```text
Act as the lecturer running my viva on this API. One question at a time across design, security,
deployment and code. Follow up on weak answers. After 10 questions, give a table of strong and weak areas.
```

**G2. Final checklist**
- [ ] The deployed URL (the one submitted) is running the commit tagged `submission` on `deployment_dev`, works and `environment` says `dev` (warm it up 2 minutes before)
- [ ] The database was re-seeded and topped up shortly before submission and before the viva
- [ ] Nothing merged into `dev` or `deployment_dev` after the `submission` tag, and `dev` = `deployment_dev` (Compare shows no differences)
- [ ] `/docs` loads; demo credentials work
- [ ] Lecturer is a collaborator; `git log` shows incremental history
- [ ] I can explain every file in `src/`, `scripts/`, `test/`
- [ ] I can answer: why no Device entity · why append-only · why no global `/readings` · why 201 + `Location` · 401 vs 403 · why composite and `last-reading` both exist · how jurisdiction is enforced · why not Level 3

---

## Appendix — cheat sheet

```bash
BASE=https://<solar-api-dev>.onrender.com
curl -i $BASE/installations                                            # 401 (no token)
TOKEN=$(curl -s -X POST $BASE/login -H 'Content-Type: application/json' \
  -d '{"username":"<demo-user>","password":"<demo-pass>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/installations?limit=5"
curl -i -X POST $BASE/installations/INS-0001/readings -H "X-API-Key: <key>" \
  -H 'Content-Type: application/json' \
  -d '{"timestamp":"2026-09-19T10:00:00Z","power_kw":3.2,"energy_kwh":1234.5,"voltage":231.0}'
curl -i -H "If-None-Match: <etag>" -H "Authorization: Bearer $TOKEN" $BASE/installations/INS-0001   # 304
```

(The response field carrying the token is `[PROPOSAL]` — adjust `access_token` to whatever `my-decisions.md` says. Prefix every API path with `/solar/v1.0` (`/`, `/docs` excepted).)

| Problem | Check |
|---|---|
| Render service fails to start | Start command is `npm start`; server uses `process.env.PORT` |
| DB errors only on Render | Use the `mongodb+srv://` URI; Atlas Network Access allows Render |
| First request very slow | Free tier cold start (up to ~30 s); warm before viva |
| Seed looks stale ("last reading" is days old) | Re-run `node scripts/seed.js` against Atlas |
| 401 vs 403 confusion | 401 = credential missing or not accepted (+`WWW-Authenticate`) `[WP §9]`. 403 = understood but refused |
| `git push` rejected | `git pull --rebase`, resolve, push. Never force-push shared history |
