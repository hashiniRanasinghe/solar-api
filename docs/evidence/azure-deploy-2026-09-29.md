# Azure deploy, 2026-09-29

Facts recorded by me on Tue 29 Sep 2026. Names only: no values, no secrets, no subscription ID. The planned Mon 28 Sep smoke deploy did not happen; this is the first deploy, and this app is kept as the submitted app.

## Web app

| Item | Value |
|---|---|
| Name | `solar-api-dev-hr` |
| Resource group | `rg-solar-api-dev` |
| Plan | Free F1 (to be scaled to Basic B1 before submission) |
| OS / runtime | Linux, Node 22 LTS |
| Region | India South Central |
| URL | https://solar-api-dev-hr-e0ctb9b8eqd7bqa4.indiasouthcentral-01.azurewebsites.net |
| HTTPS Only | on |
| Basic authentication | on (needed for the publish-profile method) |
| Application Insights | off |

## App settings (names only)

- `MONGODB_URI` (database `slsea_dev`)
- `JWT_SECRET` (a new value, not the local one)
- `NODE_ENV=production`
- `APP_ENV=dev`
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false`

## GitHub

- Secret `AZURE_WEBAPP_PUBLISH_PROFILE` and variable `AZURE_WEBAPP_NAME` set.
- The downloaded publish profile was deleted.
- Release PR #8 `dev` → `deployment_dev`; Actions run #1 green in 34 s (commit `c30ad47`).

## Database `slsea_dev` (seeded 29 Sep)

- 9 provinces, 25 districts, 40 substations, 240 installations, 4 users, 161,280 readings.
- Both seed integrity checks PASS.

## Live checks (29 Sep)

| Check | Result |
|---|---|
| `GET /` | 200, `"environment":"dev"` |
| `http://` request | 301 → `https://` |
| Security headers | HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options` present |
| `POST /login`, right password | 200 |
| `POST /login`, wrong password | 401 |

Report evidence is captured on the live URL and saved in `docs/evidence/live/` (`http/` for `curl -i` output, `swagger/` for screenshots).

## Decisions

- **OQ-32 closed:** the publish-profile method works.
- `DECIDED · YOU (2026-09-29)` This app is kept as the submitted app (no delete-and-recreate); scale F1 → B1 before submission.
