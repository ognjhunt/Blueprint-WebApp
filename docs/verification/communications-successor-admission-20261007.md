# Successor admission and exact Oct6 cleanup

The observed launch blocker is that the historical incident admission accepts
only the original c4 worker and ce8 Web runtime contents. It correctly refuses
the reviewed outreach release. This companion accepts the eadd runtime contents
through a separate versioned policy and supplies the source-compatible cleanup
wrapper. Historical helpers, their nine byte pins, the original audit and lap
stay unchanged. This supports the existing owner-approved launch and exact Oct6
cleanup; it grants no activation, inference, mailbox write or sending authority.

## Source and evidence contracts

- Runtime content baseline: `eadd0bf38364fd3c8dca968ea0c6690d25e18270`.
- Worker bundle: `2d99eb8032d04d65d023ecdca8288e5b72ee3c67c593e80fa323eef498a5465b`.
- Complete runtime Git inventory: `1a3ce581af92617b45930d57c29f83372be3a453ee9205a1fa4407855244648c`.
- Web source policy v2: `64a890acb36e1c70c13b94dec7458cd5397b5ae38524c00f3c0668078762410b`.

The exact release commit is an immutable owner-direction pin. It must have the
complete Git inventory above, except the individually enumerated reviewed
operational helpers/tests/documentation. Both actual live deploys and native
worker source must equal that commit. Supplying a SHA or using current main
alone does not satisfy admission. Commit/tree bytes and all reachable tree
objects are verified without loading candidate code.

The successor authority schema is
`blueprint.successor-oct6-cleanup-authority.v1`. Its approval transcript, target,
historical audit/lap/baseline, release commit/worker bundle/Web policy/source
proof, source-failure inventory, explicit instance aliases, writer hold and MCP
read scope are immutable. Only MCP receipt digests and the process-proof,
canonical and provider file byte pins rotate for fresh evidence. The exact
archived cleanup readback remains bound. No observation can be restamped.

Native proofs cover complete current Render instance inventories, every native
worker process, flags from the actual process environment, command/source/bundle,
bootstrap protection, mount/root identity, startup options and fresh startup
logs for each Web instance. All observations have a five-minute validity window;
the native process must be observed after the complete platform packet. The
known REST/native instance namespace pairs must be explicitly pinned. A partial
inventory, unknown namespace, changed source or expired packet stops the action.

## Executable owner sequence

After normal merge and all five required main CI checks, retain the exact merge
SHA and independently reviewed helper hashes in company storage. The cloud
release owner continues using the existing settlement-bound release controller.
The predeployment proof still uses the unchanged historical native proof helper
against the actual held old worker/Web. Once the existing authenticated shell
returns, the owner recollects fresh MCP/CI/admission receipts, invokes that helper
with the new generation-pinned platform, then performs the exact-source release.
The controller repairs only the absent bootstrap-protection key on each service,
reads both back, keeps admissions off, verifies the exact deploy and settles its
own ordinary generation. No old packet or expired receiver is reused.

After actual deployment, run from the deployed checkout:

```bash
node --import tsx scripts/communications-successor-operator-20261007.mjs \
  verify-adoption EXACT_APPROVED_RELEASE_SHA /tmp/NEW_ADOPTION_READBACK.json
node scripts/communications-successor-admission-20261007.mjs \
  inspect EXACT_APPROVED_RELEASE_SHA /tmp/NEW_NATIVE_IDENTITY.json
```

Adoption checks current provider saved-definition/Vault metadata through GETs
only, frames v3, fixed founder digest and the actual installed screen-reader
method. It checks process identity before and after the GETs. This proves no
live model session, paid usage, Gmail draft or installed-package byte integrity.
The separate existing `communications-preflight.mjs` verifies the runtime's
founder OAuth profile/sender through read-only GETs.

The cloud owner obtains five fresh authenticated MCP envelopes (worker/Web
service and live deploy, complete Web startup logs) and five GET-only CI receipts
(both complete instance inventories, research/comms false and Web ops off).
Use the existing reviewed inspection workflow; its configure job stays skipped.
Bind the actual new deploy URLs in the successor MCP scope and the observed
native/REST instance pair. Preserve the original baseline and freeze evidence.
Create the new complete Git proof from the exact published release:

```bash
node scripts/communications-successor-web-source-20261007.mjs \
  create REPOSITORY_DIRECTORY EXACT_APPROVED_RELEASE_SHA /tmp/NEW_SOURCE_PROOF.json
node scripts/communications-successor-operator-20261007.mjs prepare-platform \
  /tmp/NEW_MCP_ORIGINAL.json /tmp/NEW_CI_ORIGINAL.json \
  /tmp/ORIGINAL_BASELINE.json /tmp/EXACT_SUCCESSOR_OWNER_DIRECTION.json \
  /tmp/NEW_SUCCESSOR_PLATFORM
```

`mcp-original.json.webSourceProof` contains that proof, and the owner direction
pins its logical digest. The prepared packet is retained in existing company
storage with exact generation/size/hash. With that fresh receipt, execute in the
authenticated native shell from the deployed checkout:

```bash
node --import tsx scripts/communications-successor-operator-20261007.mjs \
  inspect-from-platform PLATFORM_GS_URI GENERATION SHA256 /tmp/NEW_CLEANUP_PROOF
```

This is read-only application/provider work: current native admission proof,
canonical snapshot, complete provider/FindAll inventory and the real SDK export.
It writes private files only. The source wrapper reconstructs UTF-8 JSON only
when `source_row_json` is absent, verifies the exact approved source hash, and
rejects raw/parsed-row disagreement. The full original cancelled-root state
checks remain. No journal, DELETE or worker flag is changed by inspection.

Only after actual live proof, complete export and independent operational review
of that fresh packet, run the already approved exact cleanup sequence:

```bash
node --import tsx scripts/communications-successor-cleanup-20261007.mjs \
  cleanup-archive /tmp/NEW_CLEANUP_PROOF
PYTHONPATH=dist/daily-research/release PYTHONDONTWRITEBYTECODE=1 \
  dist/daily-research/venv/bin/python scripts/communications-successor-cleanup-20261007.py \
  delete --directory /tmp/NEW_CLEANUP_PROOF
PYTHONPATH=dist/daily-research/release PYTHONDONTWRITEBYTECODE=1 \
  dist/daily-research/venv/bin/python scripts/communications-successor-cleanup-20261007.py \
  observe --directory /tmp/NEW_CLEANUP_PROOF
```

The accepting journal consumer supports cleanup-only modes. It verifies every
retained file/generation before the journal, rechecks the native fence on each
transaction retry, decodes the exact source inside the transaction, compares
complete current inventory, preserves the historical audit/lap, and claims one
DELETE durably before effect. The next lease generation belongs only to that
claim; release requires its exact owner and generation. Unknown DELETE ACKs and
replays are observe-only. Authenticated absence of both original resources is
required before the unchanged packaged native `record_cleanup` path. Cleanup
does not reconcile unknown charges or prove billing stopped. Preserve all other
sessions/environments, video, CRM and accounting.

If a DELETE acknowledgement is unknown and the process proof expires, do not
repeat `delete` or re-export the deleted resources. Recollect platform receipts
through `prepare-platform`, using the same immutable direction, deploy/instance
scope and original readback pin. Refresh only native/process/MCP evidence, while
retaining the exact original canonical, provider, cleanup-readback and journal
bytes. The existing exported consumers support this read-only refresh recipe:

```bash
node --input-type=module - PLATFORM_GS_URI GENERATION SHA256 \
  /tmp/ORIGINAL_CLEANUP_PROOF /tmp/NEW_OBSERVATION_PROOF <<'NODE'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {existingAdmin,sha,privateWrite} from './scripts/communications-incident-20261006.mjs';
import {inspectRuntime,checkFence,authorityScope} from './scripts/communications-successor-admission-20261007.mjs';
import {assembleProof} from './scripts/communications-successor-operator-20261007.mjs';
const [uri,generation,digest,original,output]=process.argv.slice(2);
const prefix='gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/';
if(!uri.startsWith(prefix)||!/^\d+$/.test(generation)||!/^[a-f0-9]{64}$/.test(digest)
  ||!original.startsWith('/tmp/')||!output.startsWith('/tmp/'))throw Error('exact_private_refresh_required');
const old=JSON.parse(readFileSync(`${original}/authority.json`));
if(execFileSync('git',['rev-parse','HEAD']).toString().trim()!==old.expectedReleaseCommit
  ||execFileSync('git',['status','--porcelain','--untracked-files=no']).toString().trim())throw Error('execution_source_changed');
const {app,bucket}=existingAdmin();let bytes;
try{const file=bucket.file(uri.slice('gs://blueprint-8c1ca.appspot.com/'.length),{generation});
  const [metadata]=await file.getMetadata();[bytes]=await file.download();
  if(String(metadata.generation)!==generation||Number(metadata.size)!==bytes.length
    ||bytes.length>20000000||sha(bytes)!==digest)throw Error('platform_bytes_changed');
}finally{await app.delete();}
const {proof,authority}=assembleProof(JSON.parse(bytes),inspectRuntime(old.expectedReleaseCommit));
if(sha(authorityScope({...authority,cleanupReadbackFileSha256:old.cleanupReadbackFileSha256}))
  !==sha(authorityScope(old)))throw Error('immutable_cleanup_scope_changed');
mkdirSync(output,{mode:0o700});
for(const name of ['canonical','provider','cleanup-readback','cleanup-journal'])
  writeFileSync(`${output}/${name}.json`,readFileSync(`${original}/${name}.json`),{mode:0o600,flag:'wx'});
privateWrite(`${output}/process-proof.json`,proof);
const bound={...old,expectedMcpReceiptDigests:authority.expectedMcpReceiptDigests,
  processProofDigest:sha(proof),processProofFileSha256:sha(readFileSync(`${output}/process-proof.json`))};
checkFence(proof,bound,Date.now());privateWrite(`${output}/authority.json`,bound);
console.log(JSON.stringify({ok:true,readOnly:true,newDeleteClaim:false,output}));
NODE
PYTHONPATH=dist/daily-research/release PYTHONDONTWRITEBYTECODE=1 \
  dist/daily-research/venv/bin/python scripts/communications-successor-cleanup-20261007.py \
  observe --directory /tmp/NEW_OBSERVATION_PROOF
```

The fresh observation uses authenticated target GETs before releasing the exact
own journal fence or invoking native `record_cleanup`. If instances, immutable
scope or canonical target changed, stop and retain the evidence; the old DELETE
claim never authorizes another submission. Original provider observations remain
historical and receive no replacement timestamp.

No further coding prerequisite is expected after this companion's review/merge.
The remaining gate is actual restored native access and fresh runtime/provider
evidence. Parent owns final activation and exact contact/paid batch. Keep sends
and automatic first contact off. Existing budget/dedupe receipts still apply:
remaining spend is unknown, the original $1 communications liability remains,
all nine drafts are preserved, and seven known drafts are excluded from new
batches. The scheduled boundary is 07:00 America/Chicago (12:00 UTC on Oct7);
config.enabled does not authorize catch-up or worker activation.

## Validation

Run the successor admission/cleanup suites plus the historical admission,
recovery and Web source suites. They use synthetic provider/ledger data and
public Git/process evidence, with no live DELETEs, mailbox copies or paid model
calls. Admission uses the real accepting source/runtime validator; ledger CAS
tests isolate admission/source decoding at their separately tested boundaries.
Also run typecheck, portability audit, Graphify and all required PR/main CI.
