# Owner-operated Oct6 recovery and cleanup

Execution source: `42689320a674422adc36641d78c5c8ccc85b1982`, draft PR878.
This retains the original reviewed `4ecd5ed59bbc8c20c59ceb093907792f5204cdec`
recovery/cleanup behavior and adds the reviewed v2 admission-fence lane. No live
recovery, archive, deletion, model request, Gmail draft/send or activation has
been executed by the source author. Parent owns native execution and release.

## Exact files and environment

| File under `scripts/` | SHA256 |
|---|---|
| `communications-incident-20261006.mjs` | `5a0801e9b3402821f5e1a650663b6128874c147fd151a49455590f25b36027d9` |
| `communications-incident-provider-20261006.py` | `98a51b3fe56cd248cdd5b9cbcd74a8bfa8698ba2c29fcb94a2f40dff396a0cc2` |
| `communications-incident-summary-20261006.mjs` | `82613479a8950a27cdf3af4f110b810001cd1a4d66371ad024069e2f7776398c` |
| `communications-incident-admission-20261006.mjs` | `490fd6e7bebc20708656ab205ffc18e6ddcf819239ff8b0d238c2f8744b82849` |
| `communications-incident-recovery-20261006.mjs` | `fdcd211684cafdcaa86bff3ae4ad4cea696819b79522fab87a32b0d4287a0863` |
| `communications-incident-cleanup-20261006.py` | `278d7d8ddb42260bd6b84cc1b0c8432fdbd46d635023d7bf768b056df3eea1b1` |

Run from the deployed WebApp root using existing dependencies and SDK bindings.
The recovery helper imports the exact runtime retained-create verifier, so it
needs the existing `tsx` loader and full reviewed source. Prepare a private
checkout without deploying it or copying credentials:

```bash
incident_src=/tmp/blueprint-outreach-42689320a
mkdir -m 700 "$incident_src" &&
curl -fsSL https://codeload.github.com/ognjhunt/Blueprint-WebApp/tar.gz/42689320a674422adc36641d78c5c8ccc85b1982 |
  tar -xz --strip-components=1 -C "$incident_src" &&
ln -s "$PWD/node_modules" "$incident_src/node_modules"
```

Verify the hashes above. Do not install dependencies, import env files, create
credentials, run native `run`/`reconcile`, or change access. Python uses the
installed SDK venv and `PYTHONPATH=dist/daily-research/release`; SDK retries and
redirects are disabled. Inspection uses only GET/read-only transactions and
private create-only local files. The summary reads local JSON only.

## Process fence and fresh evidence

Parent first retains an authentic fence covering every possible owning worker
service and manual/CLI writer. Follow the exact existing-service procedure and
acknowledgement provenance in
[process fence and coordinated resume](communications-incident-process-stop-20261006.md).
V2 changes only the existing two worker-enable flags to `false`, using Render's
**Save and deploy** of the existing c4 build, preserving its existing operator
Shell and bindings. It verifies fresh persisted controls, full original/current
instance inventories, every old instance gone and the actual Linux Node process
environment/source/compiled entry for every replacement. It also requires the
actual existing OPS-forward-only mode to remain truthy, skipping the entire
worker OPS scheduler without changing any third control, and requires the
web's existing persisted OPS-off control and same-instance startup-off logs.
The original v1 alternative still accepts authenticated service `suspended`
plus complete empty instances for every scoped worker when an existing provider
operator environment remains available. Desired state, metrics, old logs or a
selected Shell's environment alone are insufficient for either lane.
The actual Pipeline/manual-writer freeze acknowledgements must be
retained independently; the proof's writer-name list declares their scope and
does not itself prove drainage. The paused Mac owner stays stopped.

After fencing, collect fresh private canonical/provider packets:

```bash
node "$incident_src/scripts/communications-incident-20261006.mjs" inspect /tmp/lap259-canonical-after-fence.json &&
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=dist/daily-research/release \
  dist/daily-research/venv/bin/python "$incident_src/scripts/communications-incident-provider-20261006.py" \
  --canonical /tmp/lap259-canonical-after-fence.json --output /tmp/lap259-provider-after-fence.json
```

Both observations must follow the completed process proof observation and be
within five minutes. In v2, the assembled proof timestamp must also follow all
its current GET/runtime observations; old receipts cannot be relabelled fresh.
If suspension removes the worker Shell, use a remaining existing authenticated
web/operator environment or the saved cloud with private retained packets and
existing Admin SDK. Never resume the worker to inspect. If authenticated Render
receipts or provider GET access are unavailable, report that exact capability
gap; do not replace evidence with asserted strings or bootstrap a key.

The collector covers complete capped canonical inventories, digest-verified
research blobs and versioned canonical rows, exact recorded sessions, paired environments for
session404, full turn/item/artifact lists and recorded FindAll children. Missing,
unknown, unmapped or truncated effects block mutation. The known accounting
hold remains unresolved; it is neither reset nor counted as zero.

## Recovery packet and command

Parent prepares `/tmp/lap259-recovery` containing `canonical.json`,
`provider.json`, `process-proof.json`, and `authority.json`. Keep these raw
records private. Authority identifies actual actor/owner-direction reference,
parent thread `01a0fe81-486b-7714-9e81-983a66bd80c4`, incident
`lap259-20261006`, and action `reconcile_lap259_with_release_fence`. It pins:

- `expectedWorkerServiceIds`, `expectedLapSha256`, and the exact approved two
  source-failure refresh paths/hashes in `expectedSourceFailures`;
- for v2, `expectedPriorWorkerInstanceIds` keyed by service, retaining every
  complete original instance ID from the authentic pre-change inventory;
- `canonicalFileSha256`, `providerFileSha256`, `processProofFileSha256` for raw
  bytes, and `processProofDigest` using the collector's exported `sha` on JSON.

Process proof schema is `blueprint.render-incident-fence.v2`, lane
`disabled_worker_admission` (or the original suspension-only v1), with matching
parent/incident, `observedAtMs`, `frozenWriters` and `services`. Required writer
names are `pipeline-release-owner`, `paused-mac-outreach-owner`, and
`authenticated-manual-and-cli-writers`. Each service includes `serviceId`,
`deployCommit`, actual deployment JSON in `deploy`, and `service`/`instances`
receipts with GET `method`, exact official URL, HTTP `status` and full parsed
`body`. V2 adds actual `observedAtMs` to each current receipt plus immutable
`priorInstances`, `admissionFlags`, `deployReceipt` and complete `runtimes`
as specified in the process-fence document. It includes the separately bound
`web` service/deploy/current-instance/OPS-off/startup-log receipts. The parent
authenticates and pins these receipts and actual writer acknowledgements before
execution. Keep raw message/proof/provider data in approved private storage.

```bash
node --import tsx "$incident_src/scripts/communications-incident-recovery-20261006.mjs" recover /tmp/lap259-recovery
```

Recovery verifies the exact known lap/source, per-session turn inventories,
child work, and the same full rejected-create binding validator used by the
runtime. It archives proof bytes create-only to existing private company GCS,
verifies generation/size/digest, and atomically rereads all effect-bearing
records/queries and versions before writing matching completion, private audit
and a 120-second `research-release:` fence. Foreign live leases, changed effects
and successors reject mutation. Replay reads the audited receipt without
rewriting completion. Its explicit disposition is
`operator_reconciled_after_process_fence`, not a claim that the old worker
completed normally. Accounting, history, flags and send/spend authority remain
unchanged.

`renew-fence`/`release-fence` use the same recovery direction, exact audited lap
and owned lease, plus fresh parent-pinned fence proof. Renewal cannot revive
expiry or replace a successor. Lease release does not authorize worker resume.
Keep the external process fence through cleanup and parent-coordinated native
publication/normal release.

## Separately approved exact stopped Oct6 cleanup

Standing native `cleanup_completed` gates remain unchanged. This action is
bound to the user's already approved stopped Oct6 session/environment and
immutable source `cdc97c4c6852a815b71910ece823c7179d9fbb445879e78f06a15dd587efb2b6`;
it grants no future cleanup authority. Release the recovery-owned lease while
retaining the external process fence, then recollect canonical/provider packets.

Create `/tmp/oct6-cleanup` as a private directory. Inspection reuses installed
full `export_snapshot`, retaining the original row, every available canonical
tool/FindAll file and provider artifact byte, with fresh terminal/root/child
readback. A cancelled root may lack final artifact/output/review; missing other
retained evidence blocks cleanup. No evidence digest, QA or output is fabricated.

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=dist/daily-research/release \
  dist/daily-research/venv/bin/python "$incident_src/scripts/communications-incident-cleanup-20261006.py" \
  inspect --directory /tmp/oct6-cleanup
```

Bind this directory's `canonical.json`, `provider.json`, `process-proof.json`
with separate `authority.json`: action `archive_verify_delete_stopped_oct6`,
exact actor/owner direction, current completed-lap hash, refresh allowlist,
raw-file hashes, `cleanupReadbackFileSha256`, and `stoppedTargetDigest` of the
exact source/session/environment JSON binding. Workers remain externally fenced.

```bash
node --import tsx "$incident_src/scripts/communications-incident-recovery-20261006.mjs" cleanup-archive /tmp/oct6-cleanup &&
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=dist/daily-research/release \
  dist/daily-research/venv/bin/python "$incident_src/scripts/communications-incident-cleanup-20261006.py" \
  delete --directory /tmp/oct6-cleanup
```

Verified archive generation/digests precede a durable one-time DELETE claim and
short owned fence. Fresh provider GETs must match the retained inventory. The
existing SDK `Provider.delete_session` submits only the exact session DELETE;
its HTTP hook rejects all other mutations. Lost claim/DELETE acknowledgement
permits observation only, never another DELETE.

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=dist/daily-research/release \
  dist/daily-research/venv/bin/python "$incident_src/scripts/communications-incident-cleanup-20261006.py" \
  observe --directory /tmp/oct6-cleanup
```

Only authenticated404 for both resources is accepted. Observation validates the
durable journal/archive, releases only its owned fence, and invokes unchanged
native `Runner.record_cleanup` under the ordinary research lease. That action
repeats authenticated absence checks and writes linked approval/archive evidence
with `billing_stop_verified:false`. A durable fence-release receipt supports
GET/native-record retries without modifying a successor or repeating DELETE.
Present/unknown resources remain retained and blocked. The tool does not invent
an environment-delete API or claim historical cleanup.

## Validation and operational validity

Independent review covers the original recovery/cleanup lane and the added v2
actual-runtime/instance fence. Three affected suites pass 25 offline tests and
TypeScript check; separate review exercises 16 v2 rejection/acceptance cases,
actual Linux `/proc` reads and independent c4 compiled-worker reproduction.
Tests include the actual v2 recovery transaction, receipt/proof/snapshot
chronology, changed-evidence CAS, exact source/turn/child scope,
unmapped create/refresh states, archive corruption, replay, successor leases,
late active items, native export creation, durable handoff and the actual
retained native `record_cleanup` method. AST Graphify refreshed its fixed corpus;
these communications files are outside that corpus and are not claimed as graph
coverage. Existing real draft-path tests prove framing/reply preparation and
no paid call when inference/budget authority is off.

Parent owns final required CI on the exact final head, independent source
review, normal merge/deploy/readback, native source publication through its
unchanged guards, final activation and exact contact/budget authority. Changed
instances, admissions, controls, source rows, unknown effects or expired proof
invalidate operational clearance. Green CI and source approval alone do not
prove runtime recovery.
