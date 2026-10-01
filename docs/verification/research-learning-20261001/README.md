# Offline research learning proof

Objective: build the approved shared research/outreach-outcome learning layer
with Firestore ownership, privacy-bounded agent snapshots, Sheets review exports
and Notion learning summaries.

Issue/run: delegated thread `01a0ef70-d046-74f6-9434-a19e5456b0ef`;
owning Paperclip/ADP issue and day gate are pending parent confirmation. The
missing linkage is explicitly tracked in PR787 review `discussion_r4158703082`;
no backlog item, issue closure or gate completion is inferred from these tests.
This owner-approved work supports partner research/learning and does not
promote scientific evidence.
Budget/timeout: not supplied; no paid provider/model calls made.
Stage reached: offline implementation, reconciliation fixture and independent
review. Release remains in progress; this validation record does not claim
program closeout. Live ingestion, publication and cutover require actual source
reconciliation and a separate parent-coordinated stage.

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
| `npx vitest run server/tests/research-learning.test.ts` | 52/52 passed after reproducing and fixing the PR787 copy-strata and later-thread reply findings. |
| `npm run test:coverage` | 633 files / 4,712 tests passed; lines 58.12%, branches 68.41%, functions 74.53%. This run included 36 learning tests; seven correction negative controls were subsequently added and passed in the final targeted run. |
| `npm run doctrine:verify` | All three locked shared blocks passed. |
| `npm run claims:guard` | 780 files scanned, zero findings. |
| `npm run audit:assets` | Passed. |
| Independent Sol review | Initial read-only review and separate 43/43 test run passed. Corrections from review covered chain append, delivery/maturity denominators, historical cohort metadata, exact ledger joins, original fact check dates, copy controls and immutable correction fields. Final exact-head review follows the additional PR findings and rebase onto PR786. |
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

## PR review reproductions

`discussion_r4158703070`: two real-shaped source bundles with identical approved
canonical subject/body and different recipient/job transport footers normalized
to different copy hashes before the fix. The source adapter now hashes canonical
envelope copy, checks its exact match to payload subject/body and preserves the
distinct full payload/receipt evidence digests. Changed canonical copy still
gets a different hash; canonical/payload mismatches quarantine the source.

`discussion_r4158703092`: a mature prospect's correlated reply to a later
accepted thread was excluded and counted as nonresponse before the fix. Replies
to any accepted matching thread/contract now count, retaining the first accepted
touch's maturity window and each matching touch's acceptance time boundary.
Negative controls cover unaccepted, early, unrelated, other-contract and
automatic replies. Both reproductions failed before the fixes and passed after.

`discussion_r4158703082`: confirmed missing ADP/day linkage in the supplied
delegation. Parent confirmation is requested; this record no longer claims
completed program closeout while that linkage is absent.

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
