# AI usage log

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

## 2026-09-19 - D1/D2 (Claude Code)
Tool/model: Claude Code (Sonnet 5)
Prompt: build D1+D2 as one small diff: package.json (dependencies only: express, dotenv, cors, mongoose; start/dev/test scripts), src/app.js (exports app; GET / outside the base path returns {status, environment}; empty router mounted at /solar/v1.0), src/server.js (listens on PORT, starts only after connectDB succeeds), src/config/env.js, src/config/db.js (mongoose connect on MONGODB_URI; on failure print a clear message with no URI or credential and exit non-zero; on success log only the database name), .env.example (placeholders only). Follow-up prompt: add "engines": {"node": ">=18"} to package.json; add serverSelectionTimeoutMS: 10000 to the mongoose.connect options; make sure the catch block never logs err, err.message, or any connection detail (rejected one corrupted diff draft; asked for and applied a corrected one that logs err.name plus a generic hint only).
What I accepted / changed / rejected: accepted the initial D1/D2 skeleton as-is. On the follow-up, rejected the first diff draft (asked to redo it), then accepted the corrected version: added "engines": {"node": ">=18"} to package.json; added serverSelectionTimeoutMS: 10000 to mongoose.connect in src/config/db.js; changed the catch block to log only err.name plus "check MONGODB_URI, the database user password and Atlas Network Access" (never err, err.message, or connection details). Verified locally: GET / returns 200, missing MONGODB_URI exits with a clear no-secret message.
