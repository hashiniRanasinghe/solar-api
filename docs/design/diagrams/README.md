# Diagrams — index

Canonical sources are the `.mmd` files (Mermaid). They are version controlled with the code. Every file starts with `%%` comments giving its **basis** (brief / white paper / lecture section), the **decisions** it follows, and any **OPEN** dependency. Rule: if `my-decisions.md` changes, update the affected diagram in the same commit.

Conventions: dashed node/edge = not built, out of scope, or refused; a note containing **OPEN** = undecided, not hidden; **DECIDED** = closed by you; `PROPOSAL` = technical choice not fixed by the coursework.

| File | Represents | Report section it can support | Decision status / dependency |
|---|---|---|---|
| `01-context.mmd` | System context: devices (write), users (read), national admin, marker, Azure App Service, Atlas; dashboards out of scope | R1, R4 | None open |
| `02-resource-model.mmd` | Resources by kind, URI scoping, the four readings parents, query placement, what is NOT built | R1, R2 | OQ-04, 05, 21 **DECIDED**; none open |
| `03-er-model.mmd` | Entities, keys, stored derived ids, cumulative energy, no Device entity, no jurisdiction ids on readings | R1 | Extra fields are proposals |
| `04a-auth-device-write.mmd` | Device API-key flow: 401 vs 403 | R3 | OQ-10 decided; hash lookup is a proposal |
| `04b-auth-user-read.mmd` | Login, JWT, jurisdiction-scoped read incl. path-parent scope check | R3 | Narrowing rules are proposals |
| `04c-request-pipeline.mmd` | Order of checks and the origin of every status code | R2, R3 | Order of checks is a proposal; **OQ-26 open** |
| `05-flow-ingest-reading.mmd` | Device pushes a reading: 415 / 400 / 409 / 201 + headers | R2 | **OPEN:** OQ-26, OQ-27 |
| `06-flow-readings-history.mmd` | Readings history under installation / substation / district / province: 404, 403, 400, 304, 200 | R2 | OQ-04 **DECIDED**; **OPEN:** ETag build (OQ-29) |
| `07-flow-operational-reads.mmd` | Composite, last-reading, district summary (stretch) | R2 | Summary shape and midnight baseline are proposals |
| `08-deployment.mmd` | Local-first setup: local development against `slsea_local`, then the Azure smoke deploy (deleted afterwards) and the final deploy via one GitHub Actions workflow, Atlas databases `slsea_dev` / `slsea_local`, app settings, cost guard; `deployment_qa` shown as not deployed | R4 | Hosting and local-first **DECIDED**; authentication method OQ-32 and region OQ-33 **open until validated**; Basic plan is a proposal |
| `09-layered-architecture.mmd` | routes → middleware → controllers → services → repositories → MongoDB | R1 | Layering is a proposal |
| `10-roles-and-permissions.mmd` | Device / reader / admin: allowed, refused (401, 403, 405) | R3 | OQ-03 **DECIDED** |
| `12-roadmap.mmd` | Start-to-submission roadmap (local-first plan) with a "you are here" marker; update the `now` / `done` classes as steps finish | all | Dates are targets; viva date unknown (OQ-25) |
| `11-branching-and-environments.mmd` | `dev_hashini` → `dev` → `deployment_dev`, tags on `dev`, release merges only at the smoke and final deploys, freeze; `deployment_qa` undeployed marker; `main` unused | R4 | Branches and local-first **DECIDED**; gates are proposals |

## Additional diagrams considered

| Diagram | Status | Reason |
|---|---|---|
| ER with cardinality and User→jurisdiction link | **Included (03)** | Explicit in LEC S1 activity; brief §8 Architecture and data model |
| Richardson ladder with evidence per level | **Not created yet** | Required as a report *section* (brief §8), not as a diagram. It is a claim you make; draw it after Phase 8 from real evidence |
| Design-process pipeline (WP Figure 1) | Not needed | Already in the white paper; cite it, don't redraw |
| Coverage map (brief App. A) | Not a diagram | It is a table; `PLAN.md` §14 traceability serves as the self-check |

## Preview and export

- VS Code: open a `.mmd` file with a Mermaid preview extension, or paste into any Mermaid renderer.
- Export for the report (needs the Mermaid CLI, run on your Mac when needed):
  `npx @mermaid-js/mermaid-cli -i 03-er-model.mmd -o 03-er-model.svg`
- These sources were checked with the Mermaid parser for syntax only. Layout has not been viewed. Check each rendering before it goes in the report.
