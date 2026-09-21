# AI usage log

Every prompt (Claude Code and chat) is logged here, in the same commit as the change it produced.
It becomes the AI-disclosure appendix of the report.

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
What I accepted / changed / rejected: (fill in after my review)

---

## 2026-09-19 - D1/D2 (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Prompt: build D1+D2 as one small diff: package.json (dependencies only: express, dotenv, cors, mongoose; start/dev/test scripts), src/app.js (exports app; GET / outside the base path returns {status, environment}; empty router mounted at /solar/v1.0), src/server.js (listens on PORT, starts only after connectDB succeeds), src/config/env.js, src/config/db.js (mongoose connect on MONGODB_URI; on failure print a clear message with no URI or credential and exit non-zero; on success log only the database name), .env.example (placeholders only). Follow-up prompt: add "engines": {"node": ">=18"} to package.json; add serverSelectionTimeoutMS: 10000 to the mongoose.connect options; make sure the catch block never logs err, err.message, or any connection detail (rejected one corrupted diff draft; asked for and applied a corrected one that logs err.name plus a generic hint only).
What I accepted / changed / rejected: accepted the initial D1/D2 skeleton as-is. On the follow-up, rejected the first diff draft (asked to redo it), then accepted the corrected version: added "engines": {"node": ">=18"} to package.json; added serverSelectionTimeoutMS: 10000 to mongoose.connect in src/config/db.js; changed the catch block to log only err.name plus "check MONGODB_URI, the database user password and Atlas Network Access" (never err, err.message, or connection details). Verified locally: GET / returns 200, missing MONGODB_URI exits with a clear no-secret message.

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
Prompt: change hosting from Render to Azure App Service; develop and test everything locally with a smoke deploy and a final deploy; update CLAUDE.md, PLAN.md, STUDENT_PLAYBOOK.md, docs/design/my-decisions.md and the diagrams (draft summary, edit to match my own prompts)
Files: CLAUDE.md, PLAN.md, STUDENT_PLAYBOOK.md, docs/design/my-decisions.md, docs/design/diagrams/*, .claude/settings.json, .gitignore
Checks: Mermaid parser passed for all 14 diagrams (syntax only); a clean "npm ci --omit=dev" and both start-up failure paths were run on the committed files with dummy credentials
Requirement IDs: G1, G3 (deployment planning)
Outcome: done - committed in 5e3bd12 and beb5070
Reviewed by me: (student to fill)
Accepted / changed / rejected: (student to fill)

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