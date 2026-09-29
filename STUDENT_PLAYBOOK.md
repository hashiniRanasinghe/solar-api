# STUDENT_PLAYBOOK.md — practical workflow (Mac · VS Code · Claude Code · Git)

> Companion to `PLAN.md`. If they disagree, `PLAN.md` wins. **One step = one commit on `dev_hashini` = one `ai-log.md` entry.** Branches: `dev_hashini` (mine) → `dev` (central) → `deployment_dev` (deploy branch, updated only by release merges: 29 Sep and the final release Thu 1 Oct). `deployment_qa` is a marker, never deployed. **`main` is never used.** **Local-first:** everything is developed and tested on the Mac; Azure hosts one app, `solar-api-dev-hr`, deployed 29 Sep and kept as the submitted app (the Mon 28 Sep smoke deploy did not happen).
> **Where I am (2026-09-29):** build steps A–D are done (table below); phase tags fixed; Atlas password rotated; Part E security review, fixes and audit done; production-mode rehearsal passed; deploy workflow (H2) merged into `dev`; **deployed 29 Sep** (H3–H4 done, `docs/evidence/azure-deploy-2026-09-29.md`). Code freeze done 27 Sep (tag `p8` on `dev`, `050be73`). Next: explain-back, scale F1 → B1 and the final release (H6), Parts F–G (report and viva).
> Tags: `[YOU]` my decision · `[PROPOSAL]` a suggestion until I confirm it in `docs/design/my-decisions.md` · `[WP §n]` white paper.

---

## 0. Ground rules

| Rule | Why |
|---|---|
| Code is generated with Claude Code **under my direction**: I set the scope, approve or reject each plan, read every diff and run the checks. I write **every word of the report** | Brief §10 (generation permitted, disclosure mandatory) + integrity policy |
| Log every Claude Code prompt in `ai-log.md`; list any other AI help (chat planning, reviews) in the report's AI-disclosure appendix | Disclosure is mandatory (brief §10) |
| Small diffs, targeted edits, no full-file rewrites unless I ask | Easier to review and explain |
| I explain each change in my own words before the next step | An unexplained artefact forfeits its marks at the viva |
| Never copy code from the classmate repos | Reference repos are for understanding only |
| No secrets in git. Ever | `.env` ignored, `.env.example` committed; demo passwords are generated at seed time |
| Never keep credential files in the repo folder, and never paste a password, key, token or connection string into a chat or a prompt | A password was exposed this way once. Rotate anything exposed |
| Never share a ZIP that contains `.env` or `scripts/seed-keys.txt`, and never upload one to a chat | The Atlas password had to be rotated after that happened |
| Close `scripts/seed-keys.txt` in VS Code before prompting | An open selection is sent with the prompt |
| Local-first: no Azure resources during development except the one deployed app (29 Sep, kept as the submitted app) | Limits Azure credit use (`PLAN.md` §12a) |
| Brief > white paper > lecture notes > `PLAN.md` | If a prompt result contradicts them, the prompt result is wrong |

---

## 1. The loop for every step

```text
1. git switch dev_hashini && git pull origin dev     (always work here; never on dev directly, never touch main)
2. In the VS Code terminal:  claude   then /clear    (fresh context per step)
3. Plan mode first (Shift+Tab): paste the step prompt. Read the plan.
   Reject anything outside PLAN.md (extra libraries, endpoints, files).
4. Approve → Claude edits. Read the diff:   git diff
5. Run it + the tests:   npm run dev   /   npm test
6. I explain the change in my own words. If I can't, I don't commit.
7. The factual ai-log.md entry is added (CLAUDE.md rule). I check it and add my review in its Contents row
8. git status (no .env, no seed-keys.txt) → git add <files> → git commit -m "type(scope): summary"
9. git push origin dev_hashini → pull request into dev ("Create a merge commit"). Nothing deploys
```

**Step prompt template** (fill the brackets, keep the footer):

```text
Task: [one sentence]. Read CLAUDE.md and PLAN.md first.
Scope: only [files/folders]. Output a file list and a plan first; wait for my OK.
Constraints: small targeted diff; no new dependencies beyond PLAN.md §5; snake_case JSON;
hyphenated lowercase URIs; res.json() only. Do not read .env or scripts/seed-keys.txt.
Done when: [check].
```

`CLAUDE.md` at the repo root is the only copy of Claude Code's rules. Change it there.

**ai-log entry format:** see "## Entry format" at the top of `ai-log.md`.

---

## 2. Tagging and deployment routine

```text
dev_hashini  →(pull request after each step)→  dev            everything runs locally against slsea_local
dev          →(release pull request)→  deployment_dev  →  GitHub Actions  →  Azure    ONLY at releases (29 Sep, final 1 Oct; Part H)
deployment_qa   kept as a best-practice marker, never deployed
main            never used
```

**After a step:** push `dev_hashini`, open a pull request (base `dev`, compare `dev_hashini`), "Create a merge commit" (no squash), merge, then `git switch dev_hashini && git pull origin dev`. Run the tests **before** the pull request.

**Phase tags:** when the full local `npm test` passes at the end of a phase:

```bash
git fetch origin
git tag p8 origin/dev
git push origin p8
```

Never move or delete a pushed tag; to redo, tag again (`p8b`). Exception (`DECIDED · YOU`, 2026-09-27): `p2` and `p3` were created by mistake on the same commit as `p1` (`135e7e8`) and marked no phase, so I deleted them and added annotated tags `p4` = `5f4b246` (phases 2–4) and `p7` = `f77d772` (phases 5–7). The rule applies from now on (see `PLAN.md` §12).

**Freeze:** after the final deploy and its live check, tag `submission` on `deployment_dev` and merge nothing more into `deployment_dev` **or** `dev` until marking and the viva are done. Before submitting, check `dev` and `deployment_dev` are identical (GitHub → Compare `dev...deployment_dev`). No squash, no rebase of pushed history, no force-push.

---

## 3. Completed steps (19–26 Sep)

Prompts, checks and outcomes for each step are in `ai-log.md`.

| Step | What | Commit(s) |
|---|---|---|
| A1–A5 | Tools, accounts, repo and branches, `CLAUDE.md`, reference repos in `refs/`, lecturer invited | 19–20 Sep |
| B0–B3 | `my-decisions.md`; requirements, rubric and white-paper checks kept in `PLAN.md` §2, §4 and §17 (no separate files) | 19 Sep |
| D1–D2 | Express skeleton, Atlas connection (fail fast, no secret in logs) | `aafa4df`, `aefd50f` |
| — | Repo hygiene (`.gitignore`, docs folder move) | `64e5d99`, `caf6a1f` |
| D3 | Production-mode rehearsal, Azure zero-cost validation (India South Central) | 21 Sep, `3454155` |
| C1 | `docs/design/data-model.md` | `eba11c3` |
| D4 | Mongoose models and indexes | `16f4590` |
| D5 | Error contract (`AppError`, one error body, 404 catch-all) | `837f186` |
| D4a | Seed part 1: hierarchy, demo users, device keys | `1d622b5` |
| D4b | Seed part 2: 161,280 readings, integrity checks, `scripts/topup.js` | `db8f673` |
| D6 | Hierarchy reads with paging, sorting, filters | `3a6a20c` |
| D7–D8 | Composite, `last-reading`, readings history; readings under substation, district, province | `4436231`, `8abd826` |
| D11 | Login, JWT, jurisdiction-scoped reads; device write path | `aae7476`, `bdb48f5` |
| A8 | District generation summary (stretch) | `4fef776` |
| D12–D14 | Conditional GET (strong ETag, 304), 406, private cache headers | `3c475ca` |
| D11 revision | Device JWT replaces X-API-Key; scopes enforced on every route | `bdde540` |
| D15 | Admin CRUD on installations, key issuance, `If-Match`/412, 405 on every read-only URI | `e8c691d` |
| D17 | OpenAPI 3.0.3 at `/docs` and `/docs.json`, spec-parity tests | `00a8dfc` |
| Fix | Demo passwords generated at seed time; `--rotate-credentials` (rotation run and proven 26 Sep) | `dd7882d` |
| README | `README.md` without credentials | `60e8b07` |
| Merge | All of the above into `dev` | `f77d772` |

---

## Part E — Review and freeze (Phase 8, all local)

**E1. Security review**

Security review of the repo by Claude Code (read-only); the prompt, findings and fixes are in `ai-log.md` entries 21 (review) and 22 (fixes).

**E2. Audit against the brief**

Audit against `PLAN.md` §2, §14 and the final rubric by Claude Code (read-only); the prompt and result are in `ai-log.md` entry 23.

Then: freeze the code, run the production-mode rehearsal (below), tag `p8` on `dev`.

**Production-mode rehearsal** (proves the app runs from repo contents only, as on Azure). Use a git-ignored env file (for example `.env.rehearsal`, covered by `.env.*`):

```bash
rm -rf /tmp/rehearsal
git clone --branch dev --single-branch https://github.com/hashiniRanasinghe/solar-api.git /tmp/rehearsal
cd /tmp/rehearsal
npm ci --omit=dev
TZ=UTC NODE_ENV=production PORT=8080 node --env-file=/path/to/.env.rehearsal src/server.js
```

In another terminal: `curl -i http://localhost:8080/` → 200 and `"environment"` as set. Also open `http://localhost:8080/docs`. Stop the server. Never let Claude Code open the env file.

---

## Part F — Report (I write it; 30 Sep – 3 Oct)

The AI never writes, rewrites or paraphrases my report text.

**F1. Evidence checklist** — `PLAN.md` §11: every claim in each section has a screenshot, `curl -i` output, test or file behind it. Screenshots and `curl -i` output are captured on the deployed HTTPS URL, not on localhost.

**F2. Contradiction check** — every status code, header, field name and rule in the report matches the code, `docs/openapi.yaml` and `my-decisions.md`. Any AI help used for this check is disclosed in the appendix.

**F3. Final checks**
- Word count 2250–2750 (excluding declaration, AI appendix, diagrams, tables, code listings, references)
- All six sections present and identifiable
- Turnitin < 15% and AI score < 15% (screening only)
- Signed declaration attached; AI appendix built from `ai-log.md`; demo passwords and one device key in the appendix
- No `localhost` in the report or spec; tokens cropped out of screenshots

---

## Part G — Final checks

**G1. Final checklist**
- [ ] The submitted Azure URL runs the commit tagged `submission` on `deployment_dev`, works, and `environment` says `dev` (warm it up 2 minutes before)
- [ ] The Azure app `solar-api-dev-hr` and its plan are still running, scaled to Basic B1 (no smoke-deploy resources exist: the 29 Sep app is kept)
- [ ] `slsea_dev` was topped up shortly before submission and before the viva
- [ ] Nothing merged into `dev` or `deployment_dev` after the `submission` tag, and `dev` = `deployment_dev`
- [ ] `/docs` loads; demo logins from the report appendix work
- [ ] Lecturer is a collaborator; `git log` shows incremental history
- [ ] I can explain every file in `src/`, `scripts/`, `test/`

---

## Part H — Azure deployment (deployed Tue 29 Sep; final release Thu 1 Oct)

Azure is used only here. Read `PLAN.md` §12a (readiness) and §12b (runbook) first.

**H0. Zero-cost validation — done 21 Sep** (India South Central, `docs/evidence/azure-validation.md`).

### H1. Pre-flight (day before each deploy)

- [x] Production-mode rehearsal passes (Part E): fresh clone of `dev`, 27 Sep
- [x] Local suite green (`npm test`): 142 passed, 27 Sep
- [x] `package.json` has `start` and `engines`; `package-lock.json` in sync (fresh-clone `npm ci` passed in the rehearsal, 27 Sep)
- [x] The deploy workflow (H2) is on `dev`: merged 27 Sep
- [x] Atlas storage checked (M0 512 MB): 27 Sep, `sample_mflix` dropped, `slsea_local` 22.28 MB; no trim needed before seeding `slsea_dev`
- [x] A git-ignored `.env.deploy` exists with the `slsea_dev` connection string (never opened by Claude Code); 27 Sep, the seed dry run printed `slsea_dev`

### H2. The deploy workflow (Claude Code, plan mode, branch `dev_hashini`)

Written by Claude Code in plan mode on `dev_hashini`; the prompt is quoted verbatim in `ai-log.md` entry 25.

Review, log, commit on `dev_hashini`, pull request into `dev`. Azure's Deployment Center must not commit its own workflow.

### H3. Create the web app (Azure portal, ~20 min) — done 29 Sep

Created as `solar-api-dev-hr` (Free F1, Linux, Node 22 LTS, India South Central, resource group `rg-solar-api-dev`; HTTPS Only on; basic authentication on; Application Insights off). App settings, the GitHub secret and variable are set; the downloaded publish profile was deleted. Details: `docs/evidence/azure-deploy-2026-09-29.md`.

```text
Create a resource → Web App: Azure for Students, new resource group, name solar-api-dev (suffix if taken),
Publish: Code, Runtime: Node 22 LTS, OS: Linux, Region: India South Central.
Plan: Free (F1) (created 29 Sep); scale up to Basic B1 before submission (H6).
Deployment tab: continuous deployment OFF.   Basic authentication: Enable (for the publish-profile method).
After creation:
Settings → Environment variables: MONGODB_URI (…/slsea_dev), JWT_SECRET (a NEW value: openssl rand -hex 32), NODE_ENV=production, APP_ENV=dev,
  SCM_DO_BUILD_DURING_DEPLOYMENT=false (the workflow already runs npm ci, so Azure must not build again)
Settings → Configuration → General settings: HTTPS Only = On.   Always on = On (Basic plan).
Overview → Download publish profile (keep it OUT of the repo folder; delete it after the next step)
GitHub repo → Settings → Secrets and variables → Actions:
  new secret   AZURE_WEBAPP_PUBLISH_PROFILE   (paste the whole file content)
  new variable AZURE_WEBAPP_NAME              (the web app name)
Cost Management + Billing → Budgets: create a budget alert (for example US$20)
```

### H4. Release, seed, verify — done 29 Sep

Release PR #8 `dev` → `deployment_dev`; Actions run #1 green in 34 s (commit `c30ad47`). `slsea_dev` seeded: 9/25/40/240, 4 users, 161,280 readings, both integrity checks PASS. Live checks: `GET /` 200 `environment: dev`; http → 301 → https; HSTS, nosniff, X-Frame-Options present; login right password 200, wrong password 401.

```bash
# GitHub: pull request  base: deployment_dev  ←  compare: dev  → "Create a merge commit" → merge
# GitHub → Actions: wait for green; Azure → Log stream: look for "Connected to database: slsea_dev"
node --env-file=.env.deploy scripts/seed.js --dry-run     # check it prints slsea_dev
node --env-file=.env.deploy scripts/seed.js               # new passwords and keys go to scripts/seed-keys.txt
curl -i https://<app-name>.azurewebsites.net/
```

Copy the real hostname from the portal. Then run the **live smoke checklist** in `PLAN.md` §10 (the automated suite runs in-process and cannot target a URL). Save the `curl -i` output in `docs/evidence/live/`.

### H5. Record — done 29 Sep; no delete

1. Findings written to `docs/evidence/azure-deploy-2026-09-29.md`; OQ-32 closed (publish profile works).
2. **No delete** (`DECIDED · YOU`, 29 Sep): the app is kept as the submitted app, so the resource group and the GitHub secret `AZURE_WEBAPP_PUBLISH_PROFILE` stay.

### H6. Final release (Thu 1 Oct), same app

No new app (no delete-and-recreate). **Before submission, scale the plan F1 → Basic B1** (Azure portal → the app → Scale up) and turn Always On on. Then the release merge `dev` → `deployment_dev` (as H4) and wait for a green Actions run. After the release merge, tag `submission` on `deployment_dev`:

```bash
git fetch origin
git tag submission origin/deployment_dev
git push origin submission
```

Top up the seed (`node --env-file=.env.deploy scripts/topup.js`), take the report screenshots and `curl -i` output on the deployed HTTPS URL, not localhost (values and tokens hidden; saved in `docs/evidence/live/`), confirm the budget alert, and **keep the app and plan running** until marking and the viva are done. Then delete the resource group and reset the publish profile.

### H7. Fallback if the workflow cannot authenticate

```bash
brew install azure-cli
az login
az webapp config appsettings set --resource-group <rg> --name <app-name> --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
git archive --format=zip -o /tmp/solar-api.zip origin/deployment_dev
az webapp deploy --resource-group <rg> --name <app-name> --src-path /tmp/solar-api.zip --type zip
```

Check the Azure CLI docs for current option names before relying on this.

---

## Appendix — cheat sheet

Secrets are typed with `read -s`, never on the command line. Full examples in `README.md`.

```bash
BASE=http://localhost:3000/solar/v1.0        # after a deploy: https://<app-name>.azurewebsites.net/solar/v1.0
curl -i $BASE/installations                                   # 401 (no token)

read -r -p 'username: ' U; read -rs -p 'password: ' P; echo
TOKEN=$(printf '{"username":"%s","password":"%s"}' "$U" "$P" | curl -s -X POST $BASE/login \
  -H 'Content-Type: application/json' --data @- | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token'); unset P
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/installations?limit=5"
curl -i -H "If-None-Match: <etag>" -H "Authorization: Bearer $TOKEN" $BASE/installations/INS-0001   # 304

read -r -p 'installation_id: ' I; read -rs -p 'device_key: ' K; echo
DTOKEN=$(printf '{"installation_id":"%s","device_key":"%s"}' "$I" "$K" | curl -s -X POST $BASE/login \
  -H 'Content-Type: application/json' --data @- | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token'); unset K
curl -i -X POST $BASE/installations/$I/readings -H "Authorization: Bearer $DTOKEN" -H 'Content-Type: application/json' \
  -d '{"timestamp":"<UTC on a 15-minute boundary, newer than the last reading>","power_kw":3.2,"energy_kwh":<not lower than the last>,"voltage":231.0}'
```

| Problem | Check |
|---|---|
| `curl` gives `000` | The server is not running: `npm start` (or a stale one is: stop it and restart) |
| Azure app fails to start | Log stream. `start` script present, server uses `process.env.PORT`, Node version matches, `JWT_SECRET` set |
| DB errors only on Azure | `MONGODB_URI` app setting; Atlas Network Access `0.0.0.0/0`; `mongodb+srv://` URI |
| First request very slow (deployed) | Free F1 sleeps; Basic with Always On does not. Warm the app before the viva |
| Works on the Mac, fails on Azure | File-name case in `require` paths, timezone (Azure is UTC), missing env var, wrong Node version. Re-run the rehearsal |
| "Last reading" is days old | Run `scripts/topup.js` against the right database (check the name it prints) |
| 401 vs 403 confusion | 401 = credential missing or not accepted (+`WWW-Authenticate`). 403 = understood but refused (scope, jurisdiction, another installation) |
| `git push` rejected | `git pull`, resolve, push. Never force-push shared history |