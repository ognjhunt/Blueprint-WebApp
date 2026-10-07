# Local recovery from a retained platform packet

Execution source: `fc05c16d22a9123c6aae14eb4eb8d989bae68068`. This companion extends the reviewed
PR878 incident utilities with a narrow Render MCP read adapter and a local
operator sequence. PR878 outreach and intake code is unchanged. Publishing this
source grants no live recovery, deletion, resume, model-call or Gmail authority.

The synthetic protocol and supported CAS path are independently reviewed. The
approved retained MCP bundle exposed three actual tool names that the original
adapter did not recognize. The alias-only repair recognizes those exact names
while preserving each original tool, arguments, response and timestamp. The old
fixture is structural evidence only; its October 6 20:40 timestamps remain old.
Do not dispatch a live operator command until the adopted source hashes and
actual fixture check pass and the parent dispatches the exact fresh platform
packet and recovery scope.

Prepare the exact source in a private directory from the deployed WebApp root,
without deploying it, changing credentials, or installing dependencies:

```bash
incident_src=/tmp/blueprint-outreach-local-fc05c16d2
mkdir -m 700 "$incident_src" &&
curl -fsSL https://codeload.github.com/ognjhunt/Blueprint-WebApp/tar.gz/fc05c16d22a9123c6aae14eb4eb8d989bae68068 |
  tar -xz --strip-components=1 -C "$incident_src" &&
ln -s "$PWD/node_modules" "$incident_src/node_modules"
```

Verify all nine file hashes below before either operator mode. The source
verifier and its policy must come from this separately reviewed execution pin,
never from the candidate deployed Web revision.

## Prepare the platform packet

The platform producer runs only after the diagnostic transfer/retention scope is
approved. It retains original captured input bytes and uses their parsed values
without rereading the inputs. The owner-direction file must contain the actual
actor/reference, exact existing recovery scope, original baseline digest, pinned
instance aliases, and authentic startup-spanning writer-freeze evidence. Writer
names alone are not acknowledgements.

For a Web deployment at `3c66debc04b0586a4358d59fa380f76d5016fb02` or the
PR889 revision `85a010acd6ee6235ca8ddc487da290f52c94b310`, the owner-direction
file must explicitly pin `expectedWebCommit` to the actual deployed revision.
The legacy absent-pin contract still accepts only worker-source c4. Those three
legacy reviewed revisions remain supported. The source-proof lane below admits
an actual revision only when its complete runtime content and service recipe
equal the fixed reviewed policy. The actual Web pin is retained
in the durable recovery authority and cannot change when renewing or releasing
the owned fence. The worker source and compiled-artifact checks remain c4.

The source basis is exact Git blob equality between c4, 3c66 and PR889:
`server/index.ts` is `9d7c3de1a4611d0b0d50533f0f32680164e81ef4` and
`server/config/bootstrap-env.ts` is `25905c583f050ae842e3027e8fb82d8f7597f4d8`;
`server/utils/opsAutomationScheduler.ts` is `f87b6eaf0075b38d82101491bdb033d4c4273ed9`.
PR889 changes frontend, copy and tests; it does not change these runtime files.
Web starts the ops scheduler only when its environment flag equals `1` and emits
the existing exact JSON startup-off message otherwise. Source equality does not
prove a live process: collect fresh authenticated Web service/deploy reads,
complete current instances, the actual flag receipt and startup logs for every
current instance after it was created. Older Web receipts cannot prove a new
deployment. No deployed actor identity is inferred.

### Immutable source proof before the timed capture

For the reviewed ce8 deployment and subsequent incident-only source merges,
prepare `blueprint.web-runtime-source-proof.v1` from an existing authorized Git
checkout before collecting fresh platform receipts:

```bash
node "$incident_src/scripts/communications-incident-web-source-20261007.mjs" \
  create "$existing_repository_directory" "$actual_web_commit" "$new_private_source_proof_file"
```

The command reads raw commit and recursive tree objects without checking out,
loading or executing candidate code. If an exact object is absent, fetch that
commit through the checkout's existing authorized company remote; do not reset
or overwrite a branch. A created proof has already passed the fixed policy.
The output reports both the canonical `sourceProofDigest` and the distinct raw
JSON `fileSha256`. Retain its original bytes in the existing private company
storage with generation, size, hash and download verification before the timed
attempt.

The verifier hashes each supplied commit/tree object with its raw byte length, binds the
complete root tree to the exact commit bytes and owner-pinned deployed SHA, and
walks every tree. Missing, duplicate, unused, misordered, unsafe-path and
nonregular excluded objects are rejected. It compares all tracked source,
assets, dependency locks, build/start recipes, configuration and file-loaded
inputs against baseline `ce8c9d065351ca51b0b4b56e011aaee46d331e5a`.
Only the thirteen exact nonruntime incident utility/test/runbook paths named in
the reviewed verifier are omitted from the content inventory; their leaf object
IDs remain bound by the complete tree proof. Every tree object present in the
candidate is required. Nothing outside those paths is
exempt. Their absence from the Web bundle and build/start references is reviewed.
Tree directory names and modes remain in the inventory.

The fixed inventory SHA256 is
`230ecb3ff7243610f9ddd1af9bdddda1c8ef68b1aef54e8beeff88a1a170a5df`.
The reviewed policy digest is
`aca4563b39e74e6d5f51f686a1095140237938b9e9cd51069105a005f9b9dc40`.
The policy also checks the fresh authenticated Web service's exact existing
repository `https://github.com/ognjhunt/Blueprint-WebApp`, branch `main`, Node
environment/runtime, build command `npm install; npm run build` and start
command `npm run start`. These are the actual service settings observed at
2026-10-07 02:32:42 UTC; the verifier does not change them or substitute the
different build command declared in `render.yaml`.

Preserve the actual owner-direction file's actor, reference, recovery scope,
baseline and acknowledgements. Set its `expectedWebCommit` to the actual
revision, `expectedWebSourcePolicyDigest` to the reviewed policy above, and
`expectedWebSourceProofDigest` to the producer's canonical digest. Add the parsed
proof unchanged as `webSourceProof` in the MCP packet. The platform producer
checks it and retains it in `web.sourceProof`, the original MCP packet and the
company archive. The durable authority retains the policy identity and actual
Web commit; proof byte pins may rotate during owned-fence operations without
changing those identities.

Incident-only merges, including the verifier's own publication, can now prove
identical runtime content without predicting their eventual merge SHA. Other
repository changes fail closed pending a new source review. This proof is
immutable source evidence; it supplies no actor freeze, runtime, effect, consent,
spending, sending or recovery authority. Manual deployment actors remain unknown
unless authenticated separately; never infer that all actors are held.

Before the next capture, prepare this exact execution source, all nine hashes,
the source proof and actual owner pins. Older inspections remain historical;
their observation times cannot supply a new five-minute window. Execute one
held inspection through ZIP download, verification and private archive in one
continuous turn. Return all actual bindings once; parent then starts the prepared
MCP collector and browser operator with complete inputs. A failure stops without
redispatch. No receipt or source revision is relabelled.

The MCP input schema is `blueprint.render-mcp-reads.v1`, with the existing parent
thread and incident and `receipts` arrays named `workerService`, `workerDeploy`,
`webService`, `webDeploy`, and `webLogs`. Every captured call preserves its exact
`tool`, `arguments`, `requestedAtUtc`, `respondedAtUtc`, and full `result` envelope.
Only `get_service`, `get_deploy`, and `list_logs` for the two existing services
are supported. Their actual tool names
`mcp__codex_apps__render_get_service`, `mcp__codex_apps__render_get_deploy`, and
`mcp__codex_apps__render_list_logs` are recognized without renaming the captured
tool. Preserve an original source envelope as additional provenance
when a lossless structural adapter is required; never invent missing fields.

The retained fixture uses `schemaVersion:render-mcp-readonly-receipts-v1`.
Its exact field mapping is `requestAt` to `requestedAtUtc`, `receivedAt` to
`respondedAtUtc`, `args` to `arguments`, and `response` to `result`; `tool` is
unchanged. Map `worker_service`, `worker_deploy`, `web_service`, `web_deploy`, and
the complete `web_logs_alltypes1` page to the five groups above, retaining the
complete original object as `sourceEnvelope` and its original bytes/hash
separately. The list-deploys receipts and narrower app-only log page remain
provenance, not replacements for exact deployment reads or complete logs. A fresh
capture must retain its own actual call times and bytes.

MCP success requires an absent or literal `false` error marker and one JSON text
block. A supported single service/deploy wrapper can be unwrapped while its
original text remains retained. Derived reads use `status:null`,
`httpStatusObserved:false`, and `transport:render_mcp`; their URL is explicitly a
documented read equivalent. No HTTP status or headers are fabricated. Every log
nonfinal page must retain valid actual continuation times and exact next-call
arguments. The final page requires `hasMore:false`. Parent pins exact call-envelope digests for each proof;
the durable recovery audit retains stable tool/workspace/resource scope while
fresh proof digests may rotate.

The CI input remains the five-receipt
`blueprint.render-incident-ci-receipts.v1` from the separately coordinated held
inspection workflow. Parent verifies its exact reviewed source, actual run and
attempt, inspection job success, skipped configuration job, and original artifact.
Its two instance inventories and three flag receipts retain real HTTP status,
complete bodies and actual observation times. The original pre-fence runtime
remains unchanged.

From the deployed WebApp root, using existing dependencies:

```bash
node --import tsx "$incident_src/scripts/communications-incident-operator-20261006.mjs" \
  prepare-platform "$mcp_file" "$ci_file" "$baseline_file" "$owner_direction_file" \
  "$new_private_platform_directory"
```

The output directory must be a new absolute path under `/tmp`. Files use mode
0600 and the directory mode 0700. The command writes only retained evidence in
existing private company storage, using generation-zero creation, then checks
each object's generation, size, SHA256 and downloaded bytes. Its success frame
reports the full platform URI, generation, raw SHA256, size and latest actual
platform observation. It reports `archiveWritten:true` and `noDbMutation:true`.
The packet alone grants no action authority.

## One native operator command

The installed Python interpreter is
`dist/daily-research/venv/bin/python`, with the existing
`PYTHONPATH=dist/daily-research/release` binding. Source collection requires the
existing deployed Admin SDK and provider bindings; do not copy credentials or
add paid calls. Parent dispatches the following only for its exact separately
authorized lap recovery:

```bash
node --import tsx "$incident_src/scripts/communications-incident-operator-20261006.mjs" \
  recover-from-platform "$platform_uri" "$platform_generation" "$platform_sha256" \
  "$new_private_recovery_directory"
```

The command verifies and downloads the exact retained GCS generation, then runs
the existing runtime collector, assembles and validates the completed v3 proof
barrier, collects canonical records, collects provider state and executes the
supported scoped recovery utility sequentially in that same environment. This
lane covers exactly one current worker instance; broader inventory refuses.
Runtime must follow every platform observation, and canonical/provider packets
must follow the completed proof. The five-minute freshness guard remains
300000ms throughout, including inside CAS. No timestamp is relabelled. Stale
proofs require a newly coordinated capture.

Original baseline/source/artifact/bootstrap/filesystem checks, exact current
instance coverage, startup logs, opt-outs, complete effect inventories and
transactional guards remain in force. Public intake need not be quiet. A
successful readback is `reconciled_and_release_fenced` or `already_reconciled`,
with no sending, paid admission or worker resume authorized. The original
cleanup utility remains separate and requires its exact deletion approval.

Any child failure retains its stdout/stderr privately and stops. There is no
automatic retry after an ambiguous recovery acknowledgement. Parent checks the
durable audit and current guarded state before deciding whether to collect a
new packet. No cleanup, deletion or activation is part of this command.

## Source hashes and offline checks

| File under `scripts/` | SHA256 |
|---|---|
| `communications-incident-20261006.mjs` | `5a0801e9b3402821f5e1a650663b6128874c147fd151a49455590f25b36027d9` |
| `communications-incident-provider-20261006.py` | `98a51b3fe56cd248cdd5b9cbcd74a8bfa8698ba2c29fcb94a2f40dff396a0cc2` |
| `communications-incident-summary-20261006.mjs` | `82613479a8950a27cdf3af4f110b810001cd1a4d66371ad024069e2f7776398c` |
| `communications-incident-admission-20261006.mjs` | `44aac8ed6a05aaf33b98b8167e88616f2337bd9a4d026ac8a5d9e457acbaf53e` |
| `communications-incident-recovery-20261006.mjs` | `b3382b26d27fcb6486cda10523074afbf8aa98cb85e84d8e08f56ffbecf674d8` |
| `communications-incident-cleanup-20261006.py` | `278d7d8ddb42260bd6b84cc1b0c8432fdbd46d635023d7bf768b056df3eea1b1` |
| `communications-incident-mcp-20261006.mjs` | `040a9e6a7f3660447c264577a32cd317f6fb95312bd48404e9e216d31e859aeb` |
| `communications-incident-operator-20261006.mjs` | `0053c94e5b6dd59c09ed0dd1586b81295c85c89e2e52ffa005aafea123f55178` |
| `communications-incident-web-source-20261007.mjs` | `0d596a22ae29269d8defd5184c2ad2d1a67c5b6ac898b6bcd3111edcd448fe55` |

Focused suites cover successful MCP consumption by actual recovery CAS,
both legacy and actual tool names with raw scope retained, zero-write refusal
for actual-name operation/target/timestamp changes even with fresh byte pins,
zero-write refusal for altered/error/unpinned/stale/unsupported envelopes,
complete pagination, durable scope across fresh receipts, original HTTP lanes,
the explicit 3c66 and PR889 Web source pins through CAS/replay/fence release,
zero-write refusal when changing between those pins during an owned fence, both
flag-present and exact-JSON flag-absent lanes, and runtime-to-provider sequence
ordering. These are synthetic/offline tests,
with zero provider/Gmail/model requests. Runtime imports may initialize the
existing Admin SDK; the test CAS is in memory. Actual fixture validation and
installed live readback remain separate proof obligations.

Source suites additionally use actual Git objects and isolated offline candidate
commits to prove merge stability and rejection of executable/import, dependency,
recipe, mode, symlink, addition and deletion changes. Forged/incomplete/ambiguous
objects, missing owner pins and altered authenticated service recipes fail
before recovery writes. The real operator sequence consumes the complete source
proof; CAS/replay/release retain the policy and actual Web source identity.
