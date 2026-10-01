# Offline research learning proof

Objective: build the approved shared research/outreach-outcome learning layer
with Firestore ownership, privacy-bounded agent snapshots, Sheets review exports
and Notion learning summaries.

Issue/run: delegated thread `01a0ef70-d046-74f6-9434-a19e5456b0ef`;
Paperclip/ADP issue and day gate were not supplied. This owner-approved work
supports partner research/learning and does not promote scientific evidence.
Budget/timeout: not supplied; no paid provider/model calls made.
Stage reached: offline implementation, reconciliation fixture and independent
review. State claimed: `done` for this offline slice. Live ingestion, publication
and cutover remain a separate parent-coordinated stage.

## Supporting artifacts

- `offline-input.json`: eight **synthetic** prospects and 26 evidence events;
  fake scoped research grant, cutoff, expected manifests and comparison focus.
- `offline-dry-run.json`: exact CLI output; no reconciliation errors, 26 staged
  append candidates, eight prospects, no live cutover. Snapshot/content hash:
  `e0694453bc60cf66e47534cf75f9057e84d84aaaec7316625b198a947b92f132`.
- `../../architecture/research-outreach-learning-layer.md`: field ownership,
  normalized schema/read contract, denominators, privacy and migration steps.
- `../../../server/research-learning/`: strict event contract, immutable history,
  scoped/hash-checked snapshots, read-only source adapter, descriptive planner,
  private Firestore library, offline migration and review/export contracts.
- `../../../server/tests/research-learning.test.ts`: negative controls and
  regression tests; fixtures are under `server/tests/fixtures/research-learning.ts`.

The fixture focus (Sacramento laundromats) has four researched prospects,
three accepted touches, two mature accepted prospects, one observed reply,
one mature nonresponse and one pending prospect. The mature reply denominator
is 1/2; delivery is unknown, and curiosity is not a pilot. These are **synthetic
contract assertions**, not findings about Blueprint's current outreach.

## Observed validation

| Command/check | Observed result |
| --- | --- |
| `npm run check` | Passed after final code changes. |
| `npx vitest run server/tests/research-learning.test.ts` | Final 43/43 passed. |
| `npm run test:coverage` | 633 files / 4,712 tests passed; lines 58.12%, branches 68.41%, functions 74.53%. This run included 36 learning tests; seven correction negative controls were subsequently added and passed in the final targeted run. |
| `npm run doctrine:verify` | All three locked shared blocks passed. |
| `npm run claims:guard` | 780 files scanned, zero findings. |
| `npm run audit:assets` | Passed. |
| Independent Sol review | Read-only review and separate 43/43 test run passed. Corrections from review covered chain append, delivery/maturity denominators, historical cohort metadata, exact ledger joins, original fact check dates, copy controls and immutable correction fields. No unresolved offline correctness/privacy blocker. |
| Graphify AST refresh | Passed using `BLUEPRINT_GRAPHIFY_PYTHON=/tmp/blueprint-learning-graphify/bin/python bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`: 83 code files, 1,330 nodes, 2,247 edges, 52 communities; canonical root outputs published. The initial missing-dependency failure was resolved with an isolated temporary `graphifyy==0.9.73` tooling environment. No global/runtime dependency, model call or credential change. |
| Offline dry-run CLI | Exit 0, `readyForStagedAppend:true`, `readyForCutover:false`, errors empty, 26 events / eight prospects. |

Reproduce without overwriting the committed artifact:

```bash
npx tsx scripts/research-learning/dry-run.ts \
  docs/verification/research-learning-20261001/offline-input.json \
  /tmp/research-learning-recheck.json
```

Replay with these same events listed under `existingEvents` proposes zero
additional events (covered by regression tests). No test or command writes CRM,
communications sources, Sheets, Notion, Gmail, approval authorities, production
flags or provider/model state.

## Requirement coverage and next action

Field ownership/exact IDs: ownership table, schemas and complete source/ledger
join tests. Append-only history and human correction: create-only transactions,
hash identities and chain/conflict/immutable-field tests. Relevant authorized
snapshots: explicit principal/prospect/section grants, expiry/cutoff checks and
privacy/readback tests. Outcome distinctions and learning: accepted-versus-
delivery evidence, uncertainty, interest/objection fields, milestone histories,
cohort counts/denominators/strata and unconfirmed hypotheses. Export roles:
derived Sheets rows and aggregate Notion summary contracts. Migration safety:
pure dry-run manifests, replay, quarantine and always-disabled cutover.

Next owner: parent engineering/release lane. Coordinate the scoped PR with PR786
and Pipeline PR2518, then obtain an actual authorized source export with an
independent manifest. Reconcile historical CRM/contact/case/site/task joins,
legacy receipts, unknown structured city/industry/campaign/timing metadata and
exact counts; verify staged append/readback before selecting a live consumer.
Pipeline owns the optional `learning.py` loader/configuration follow-up. Sheets
and Notion publishing require the coordinated export/readback stage.

The repo-approved runner uses deterministic code AST extraction; docs/media
semantic extraction and model calls are not enabled. Package provenance:
[official graphifyy metadata](https://pypi.org/project/graphifyy/0.9.73/).
The existing pilot manifest now includes the seven learning modules as explicit
file paths. Root graph outputs remain ignored, derived navigation artifacts.

Retry/resume: the parent supplies reconciled source scope/manifest and release
coordination before live activation. No source data was migrated or deleted.
Residual risk: no live binding/export/cutover proof; Gmail has no delivery-proof
field, so live delivery remains unknown. No paid classifier activation is
approved or implemented.
