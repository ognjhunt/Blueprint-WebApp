# Local recovery from a retained platform packet

Execution source: `857ac80459846efd086c842f9124f25136e79b71`. This companion extends the reviewed
PR878 incident utilities with a narrow Render MCP read adapter and a local
operator sequence. PR878 outreach and intake code is unchanged. Publishing this
source grants no live recovery, deletion, resume, model-call or Gmail authority.

The synthetic protocol and supported CAS path are independently reviewed. The
actual retained MCP bundle is awaiting its separately requested transfer approval;
its outer schema and transport compatibility have not been verified here. Do not
dispatch a live operator command until the approved original bundle has been
checked losslessly against this adapter and parent has approved the exact fresh
platform packet and recovery scope.

Prepare the exact source in a private directory from the deployed WebApp root,
without deploying it, changing credentials, or installing dependencies:

```bash
incident_src=/tmp/blueprint-outreach-local-857ac8045
mkdir -m 700 "$incident_src" &&
curl -fsSL https://codeload.github.com/ognjhunt/Blueprint-WebApp/tar.gz/857ac80459846efd086c842f9124f25136e79b71 |
  tar -xz --strip-components=1 -C "$incident_src" &&
ln -s "$PWD/node_modules" "$incident_src/node_modules"
```

Verify the eight file hashes below before either operator mode.

## Prepare the platform packet

The platform producer runs only after the diagnostic transfer/retention scope is
approved. It retains original captured input bytes and uses their parsed values
without rereading the inputs. The owner-direction file must contain the actual
actor/reference, exact existing recovery scope, original baseline digest, pinned
instance aliases, and authentic startup-spanning writer-freeze evidence. Writer
names alone are not acknowledgements.

The MCP input schema is `blueprint.render-mcp-reads.v1`, with the existing parent
thread and incident and `receipts` arrays named `workerService`, `workerDeploy`,
`webService`, `webDeploy`, and `webLogs`. Every captured call preserves its exact
`tool`, `arguments`, `requestedAtUtc`, `respondedAtUtc`, and full `result` envelope.
Only `get_service`, `get_deploy`, and `list_logs` for the two existing services
are supported. Preserve an original source envelope as additional provenance
when a lossless structural adapter is required; never invent missing fields.

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
| `communications-incident-admission-20261006.mjs` | `c44ab1173e85bd622c8c0209e11647b3316a58a994806f3696583b7ec205ea39` |
| `communications-incident-recovery-20261006.mjs` | `be83a277ac6c2eb1b0020c78c2b10c467e1d6eca72dde336878af0da47ea7b32` |
| `communications-incident-cleanup-20261006.py` | `278d7d8ddb42260bd6b84cc1b0c8432fdbd46d635023d7bf768b056df3eea1b1` |
| `communications-incident-mcp-20261006.mjs` | `5221c60399f9bee443bcdd45e8418b0dd6b0fc99accde82231aaae6f4ed1adc4` |
| `communications-incident-operator-20261006.mjs` | `adc60b1ed8ed1fa136ced55ba9c33a9ed002b796d129cc3ed2a8813b31bb51d4` |

Focused suites cover successful MCP consumption by actual recovery CAS,
zero-write refusal for altered/error/unpinned/stale/unsupported envelopes,
complete pagination, durable scope across fresh receipts, original HTTP lanes,
and runtime-to-provider sequence ordering. These are synthetic/offline tests,
with zero provider/Gmail/model requests. Runtime imports may initialize the
existing Admin SDK; the test CAS is in memory. Actual fixture validation and
installed live readback remain separate proof obligations.
