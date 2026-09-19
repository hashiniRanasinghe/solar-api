# CLAUDE.md — SLSEA Solar Generation API (NB6007CEM CW1)

## Sources and rules
- Read PLAN.md and docs/design/my-decisions.md before any task. The brief and white paper outrank them.
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
- Work ONLY on branch dev_hashini. Never commit, merge, rebase or push on dev; I open the pull requests.
- NEVER create, use, merge into or touch main. The qa branch is kept but never deployed and never used: do not touch it.
- Never force-push, squash or rewrite pushed history.
- One deployment: Dev (Render tracks dev, auto-deploys, database slsea_dev). It is the submitted URL. No QA service or database. GET / also returns environment from APP_ENV.

**## Local course reference library**

* The complete course reference library is available locally on this development machine at:
  `/Users/hashiniranasinghe/NIBM/NIBM 4/Web API/Ended with a pass/Ended with a pass/referances`
* This folder contains the current coursework brief, lecture materials, student notes, demonstrations, REST API design guidance, and reference Git repository information.
* **The WSO2 REST API Design Guidelines v1 white paper is a key reference for this coursework.** Before making REST/API design decisions, consult:
  `wso2_rest_api_design_guidelines-v1.pdf`
* Use the white paper particularly when deciding URI/resource design, collection and member resources, HTTP methods, status codes, pagination, filtering, sorting, conditional requests, headers, content negotiation, error responses, authentication/authorization, and other REST API conventions covered by the coursework.
* The coursework brief defines what the assignment requires. The white paper and relevant lecture materials provide the technical/design guidance for implementing those requirements.
* Use the S1–S8 lecture PDFs and student notes to understand the concepts and approaches taught in the module.
* `ref gits.rtf` contains information about the provided reference Git repositories. Use those repositories for learning and comparison where relevant.
* Do **not** copy code, report text, diagrams, documentation, or other submitted content directly from the reference repositories or course materials.
* Do **not** copy a reference implementation simply because it uses a particular approach. Adapt the concepts to this project's requirements and documented decisions.
* If the coursework brief, white paper, lecture material, and project decisions appear to conflict, identify the conflict and follow the priority defined in the **Sources and rules** section. Do not silently make a major design decision.
* The reference library is read-only. Do not modify, rename, delete, or generate files inside this folder.
* If the reference library cannot be accessed, clearly report that before proceeding with a task that depends on it.
