# AI usage log

Every prompt (Claude Code and chat) is logged here, in the same commit as the change it produced.
It becomes the AI-disclosure appendix of the report.

Entry format:

## YYYY-MM-DD - <step id>
Tool/model:
Prompt:
What I accepted / changed / rejected:

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
