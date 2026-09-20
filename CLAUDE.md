# CLAUDE.md — SLSEA Solar Generation API (NB6007CEM CW1)

## Sources and rules
- Read PLAN.md and docs/design/my-decisions.md before any task.
- Priority when sources conflict: (1) the current coursework brief; (2) entries marked DECIDED in docs/design/my-decisions.md, including my recorded deliberate deviations from the white paper (for example OQ-21); (3) the WSO2 white paper; (4) lecture notes S1-S8; (5) PLAN.md and any PROPOSAL. Never "fix" a DECIDED item to match the white paper. Name the conflict and stop.
- NEVER write, rewrite or paraphrase report text. NEVER copy code from refs/.
- OPEN decisions (PLAN.md section 15: OQ-26 to OQ-29 and the validation limits): do NOT choose silently. Stop and ask.
- SECRETS: NEVER open, read, print, create, edit or copy .env, any *.env file, atlas-credentials* or any file that may hold a password, key or connection string. Not with Read, cat, awk, grep or any shell command. I create .env myself. To check that a variable is set, use a command that does not print it. If a secret was printed anywhere, say so immediately.
- Small diffs. Show a plan and file list first. No secrets in code; no hard-coded fallback secrets.
- After each change: state which requirement ID (PLAN.md section 2) it serves and how to test it.

## Stack and model
- Node/Express, Mongoose, MongoDB Atlas, OpenAPI at /docs. Final hosting: Azure App Service (Linux, Node 22 LTS), used only at the end. Exactly one GitHub Actions workflow (deploy only) is allowed, and only when I ask for it. Nothing else without asking.
- Model: Province > District > Substation > Installation > Reading, plus User. NO Device entity (meter_id is an installation attribute).
- Installation stores substation_id; district_id/province_id are server-derived, stored read-only, never taken from the client.
- energy_kwh is CUMULATIVE (running total). String IDs (INS-0001); Mongo _id hidden.
- No timestamp tolerance or future-time rule. Do not add one.
- Seed: 9 provinces, 25 districts, 40 substations, 240 installations, 15-minute readings for 7 days, ending at run time; a top-up script appends up to now.

## Local-first development and Azure readiness
- Do ALL development, database work and testing locally: Node 22 on my Mac, Atlas database slsea_local, tests against the local server with TZ=UTC. Do not deploy, create Azure resources or run az commands unless I ask for that task.
- Keep Azure App Service (Linux, Node 22 LTS) in mind so the final deployment has no surprises:
  - Listen only on process.env.PORT. All config comes from environment variables; there is no .env in production and dotenv must not override existing variables.
  - "npm ci --omit=dev && npm start" must work from a clean clone using only env vars. Keep package-lock.json in sync; runtime dependencies belong in dependencies.
  - File names and require paths must match exact case (Mac is case-insensitive, Linux is not).
  - Write nothing to local disk. Log to stdout, never secrets.
  - Never depend on the server timezone (Azure runs in UTC). Compute Asia/Colombo day boundaries explicitly.
  - Do aggregation and paging in the database. Never load large collections into memory.
  - Keep links and Location headers relative; do not assume http. Serve Swagger UI from the package (no CDN); OpenAPI servers is the relative /solar/v1.0.
  - Malformed JSON fails inside express.json() before auth: the error handler must return the standard error body for it.

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
- Flow: dev_hashini -> MR -> dev. deployment_dev is updated only by a release MR at the planned smoke deploy (about 25-27 Sep) and at the final freeze (1 Oct). Azure deploys from it through a GitHub Actions workflow.
- NEVER create, use, merge into or touch main. deployment_qa is a marker branch, never deployed and never used: do not touch it.
- Never force-push, squash or rewrite pushed history.
- No deployment during development. Planned: a short throwaway smoke deploy (deleted afterwards) and the final deployment, both Azure App Service via GitHub Actions on push to deployment_dev, database slsea_dev (the final one is the submitted URL). No QA service or database. My local .env uses database slsea_local. GET / also returns environment from APP_ENV.
- Do not create or edit .github/workflows, Azure or deployment files, and never handle publish profiles or deployment credentials, unless I ask for that specific task.

## AI log (ai-log.md)
- When a task finishes (the step's done-when check has run), append ONE entry to ai-log.md before I commit. Write nothing to it during the task. Do not commit.
- Entry fields: date and time; step id (for example D2); tool and model; branch; Prompt (my prompt(s) for the task, verbatim, secrets redacted); files created or changed (paths); checks run with the result (command and pass/fail, no secrets); requirement IDs served; Outcome (done / partial / failed) with one factual line on anything that failed or was corrected during the task.
- End every entry with these two lines exactly, for me to fill: `Reviewed by me: (student to fill)` and `Accepted / changed / rejected: (student to fill)`. Never fill them and never invent my review.
- Facts only. No claims about tests that were not run. Never include passwords, URIs, keys or anything from .env.
- Append only. Never edit or delete earlier entries. Log a prompt from another tool or the Claude chat only when I ask.

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