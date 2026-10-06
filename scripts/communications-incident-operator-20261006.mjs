/** Thin operator sequence over existing incident utilities. No automatic resume,
 * deletion or broader action authority. Prepare is local/private archive only;
 * recover-from-platform is executed only by the parent's separate exact dispatch.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sha, refuse, privateWrite, existingAdmin } from './communications-incident-20261006.mjs';
import { mcpReceipt, mcpReadScope } from './communications-incident-mcp-20261006.mjs';
import { inspectRuntime } from './communications-incident-admission-20261006.mjs';
import { checkFence, archiveFiles, verifyArchive } from './communications-incident-recovery-20261006.mjs';

const PARENT = '01a0fe81-486b-7714-9e81-983a66bd80c4', INCIDENT = 'lap259-20261006';
const WORKER = 'srv-d9t8gg1t0dsc73am9q70', WEB = 'srv-d4vnmk3e5dus73aiohk0';
const BASE = 'https://api.render.com/v1/services/';
const WRITERS = ['pipeline-release-owner', 'paused-mac-outreach-owner', 'authenticated-manual-and-cli-writers'];
export const PLATFORM = 'blueprint.render-incident-platform.v1';
function privateDirectory(directory) {
  if (!directory?.startsWith('/tmp/') || resolve(directory) !== directory) refuse('private_new_operator_directory_required');
  mkdirSync(directory, { mode: 0o700 });
}
function ownerDirection(owner) {
  if (owner?.parentThread !== PARENT || owner.incident !== INCIDENT || owner.action !== 'reconcile_lap259_with_release_fence'
    || typeof owner.actor !== 'string' || owner.actor.length < 3 || !owner.approvalReference
    || !Array.isArray(owner.frozenWriters) || WRITERS.some(name => !owner.frozenWriters.includes(name))
    || !owner.writerFreezeEvidence) refuse('actual_owner_and_freeze_direction_required');
}
export function preparePlatform(mcp, ci, baseline, owner) {
  ownerDirection(owner);
  if (mcp?.schema !== 'blueprint.render-mcp-reads.v1' || mcp.parentThread !== PARENT || mcp.incident !== INCIDENT
    || ci?.schema !== 'blueprint.render-incident-ci-receipts.v1' || ci.parentThread !== PARENT || ci.incident !== INCIDENT
    || ci.readOnly !== true || !Array.isArray(ci.receipts) || ci.receipts.length !== 5) refuse('platform_source_packet_unbound');
  const one = name => {
    const rows = ci.receipts.filter(r => r.name === name);
    if (rows.length !== 1) refuse('platform_receipt_inventory_incomplete');
    return rows[0];
  };
  const reads = mcp.receipts;
  const workerService = mcpReceipt(reads.workerService, BASE + WORKER), webService = mcpReceipt(reads.webService, BASE + WEB);
  const deploy = (calls, id) => {
    const arg = calls?.[0]?.arguments;
    if (!arg?.deployId) refuse('actual_deploy_id_required');
    return mcpReceipt(calls, `${BASE}${id}/deploys/${arg.deployId}`);
  };
  const workerDeploy = deploy(reads.workerDeploy, WORKER), webDeploy = deploy(reads.webDeploy, WEB);
  const logs = mcpReceipt(reads.webLogs, `https://api.render.com/v1/logs?ownerId=${encodeURIComponent(webService.body.ownerId)}&resource=${WEB}`);
  const mcpReceipts = [workerService, workerDeploy, webService, webDeploy, logs];
  const authorityTemplate = { ...owner,
    expectedMcpReadScope: Object.fromEntries(mcpReceipts.map(r => [r.url, mcpReadScope(r)])),
    expectedMcpReceiptDigests: Object.fromEntries(mcpReceipts.map(r => [r.url, sha(r.mcp)])) };
  if (owner.expectedBaselineRuntimeDigests?.[WORKER] !== sha(baseline)) refuse('original_baseline_authority_changed');
  const worker = { serviceId: WORKER, service: workerService, deploy: workerDeploy.body, deployCommit: workerDeploy.body?.commit?.id,
    deployReceipt: workerDeploy, instances: one('worker-instances'), baselineRuntime: baseline,
    admissionFlags: { BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED: one('daily-enabled'), BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED: one('communications-enabled') } };
  const web = { service: webService, deploy: webDeploy.body, deployReceipt: webDeploy,
    instances: one('web-instances'), opsFlag: one('web-ops-enabled'), startupLogs: logs };
  const observations = [worker.service, worker.deployReceipt, worker.instances, ...Object.values(worker.admissionFlags),
    web.service, web.deployReceipt, web.instances, web.opsFlag, web.startupLogs];
  if (observations.some(r => !Number.isSafeInteger(r.observedAtMs))) refuse('actual_platform_times_required');
  return { schema: PLATFORM, parentThread: PARENT, incident: INCIDENT, readOnly: true,
    observedAtMs: Math.max(...observations.map(r => r.observedAtMs)), worker, web, authorityTemplate,
    originalMcp: mcp, originalCi: ci, originalBaseline: baseline };
}
export function assembleProof(platform, runtime, now = Date.now) {
  if (platform?.schema !== PLATFORM || platform.parentThread !== PARENT || platform.incident !== INCIDENT || platform.readOnly !== true) refuse('platform_packet_unbound');
  ownerDirection(platform.authorityTemplate);
  // The current native operator covers exactly its one owning instance. A new
  // multi-instance inventory requires coordinated coverage, never a partial proof.
  if (platform.worker?.instances?.body?.length !== 1 || runtime.observedAtMs < platform.observedAtMs) refuse('runtime_after_complete_platform_required');
  const proof = { schema: 'blueprint.render-incident-fence.v3', lane: 'complete_current_disabled_admission',
    parentThread: PARENT, incident: INCIDENT, observedAtMs: now(),
    frozenWriters: platform.authorityTemplate.frozenWriters, writerFreezeEvidence: platform.authorityTemplate.writerFreezeEvidence,
    services: [{ ...platform.worker, runtimes: [runtime] }], web: platform.web };
  const authority = { ...platform.authorityTemplate, processProofDigest: sha(proof) };
  checkFence(proof, authority, now());
  return { proof, authority };
}
export async function sequence(platformBytes, directory, steps) {
  const platform = JSON.parse(platformBytes);
  steps.write(`${directory}/platform.json`, platform);
  const runtime = await steps.runtime();
  steps.write(`${directory}/runtime.json`, runtime);
  const { proof, authority } = assembleProof(platform, runtime, steps.now);
  steps.write(`${directory}/process-proof.json`, proof);
  // All timing/barrier checks use original collection times. The next two
  // existing collectors run locally in order, without cross-thread handoffs.
  await steps.collectCanonical(`${directory}/canonical.json`);
  await steps.collectProvider(`${directory}/canonical.json`, `${directory}/provider.json`);
  const bound = { ...authority, canonicalFileSha256: sha(steps.read(`${directory}/canonical.json`)),
    providerFileSha256: sha(steps.read(`${directory}/provider.json`)), processProofFileSha256: sha(steps.read(`${directory}/process-proof.json`)) };
  steps.write(`${directory}/authority.json`, bound);
  const recovery = await steps.recover(directory);
  if (recovery?.ok !== true || !['reconciled_and_release_fenced', 'already_reconciled'].includes(recovery.state)) refuse('supported_recovery_readback_missing');
  return { ...recovery, sendsAuthorized: false, paidAdmissionAuthorized: false, workerResumeAuthorized: false };
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'prepare-platform') {
    const [mcpFile, ciFile, baselineFile, directionFile, directory] = args;
    privateDirectory(directory);
    const files = Object.fromEntries([['mcp-original.json', mcpFile], ['ci-original.json', ciFile], ['baseline-original.json', baselineFile], ['owner-direction.json', directionFile]]
      .map(([name, path]) => [name, readFileSync(path)]));
    const packet = preparePlatform(...['mcp-original.json', 'ci-original.json', 'baseline-original.json', 'owner-direction.json']
      .map(name => JSON.parse(files[name].toString('utf8'))));
    const packetPath = `${directory}/platform.json`, packetSha256 = privateWrite(packetPath, packet);
    files['platform.json'] = readFileSync(packetPath);
    const { app, bucket } = existingAdmin();
    try {
      const archive = await archiveFiles(bucket, files); await verifyArchive(bucket, archive);
      privateWrite(`${directory}/platform-retention.json`, archive);
      const object = archive.objects.find(o => o.name.endsWith('/platform.json'));
      console.log(JSON.stringify({ ok: true, evidenceReadsOnly: true, archiveWritten: true, noDbMutation: true,
        platformUri: `gs://${archive.bucket}/${object.name}`, generation: object.generation,
        platformSha256: packetSha256, platformObservedAtMs: packet.observedAtMs, bytes: object.bytes }));
    } finally { await app.delete(); }
    return;
  }
  if (mode !== 'recover-from-platform') refuse('explicit_exact_operator_mode_required');
  const [uri, generation, expectedHash, directory] = args;
  const prefix = 'gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/';
  if (!uri?.startsWith(prefix) || !/^[0-9]+$/.test(generation ?? '') || !/^[a-f0-9]{64}$/.test(expectedHash ?? '')) refuse('generation_pinned_platform_required');
  privateDirectory(directory);
  const { app, bucket } = existingAdmin();
  let bytes;
  try {
    const name = uri.slice('gs://blueprint-8c1ca.appspot.com/'.length), file = bucket.file(name, { generation });
    const [metadata] = await file.getMetadata(); [bytes] = await file.download();
    if (String(metadata.generation) !== generation || Number(metadata.size) !== bytes.length || bytes.length > 20_000_000
      || sha(bytes) !== expectedHash) refuse('platform_download_binding_changed');
  } finally { await app.delete(); }
  const here = new URL('.', import.meta.url);
  const run = (stage, name, args, env = process.env) => {
    let stdout;
    try { stdout = execFileSync(name, args, { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }); }
    catch (error) {
      // Preserve an ambiguous child ACK privately; never retry automatically.
      writeFileSync(`${directory}/${stage}-stdout.txt`, error.stdout ?? '', { mode: 0o600, flag: 'wx' });
      writeFileSync(`${directory}/${stage}-stderr.txt`, error.stderr ?? '', { mode: 0o600, flag: 'wx' });
      refuse(`${stage}_command_unavailable`);
    }
    writeFileSync(`${directory}/${stage}-stdout.txt`, stdout, { mode: 0o600, flag: 'wx' });
    return stdout;
  };
  const result = await sequence(bytes, directory, {
    now: Date.now, write: privateWrite, read: readFileSync, runtime: () => inspectRuntime(),
    collectCanonical: output => run('canonical', process.execPath, [new URL('communications-incident-20261006.mjs', here).pathname, 'inspect', output]),
    collectProvider: (canonical, output) => run('provider', resolve('dist/daily-research/venv/bin/python'), [new URL('communications-incident-provider-20261006.py', here).pathname,
      '--canonical', canonical, '--output', output], { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONPATH: resolve('dist/daily-research/release') }),
    recover: dir => {
      const bytes = run('recover', process.execPath, ['--import', 'tsx', new URL('communications-incident-recovery-20261006.mjs', here).pathname, 'recover', dir]);
      const frames = bytes.toString().split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      return frames.findLast(frame => frame?.ok === true);
    },
  });
  privateWrite(`${directory}/operator-readback.json`, result);
  console.log(JSON.stringify({ ok: true, ...result }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'operator_sequence_unavailable' })); process.exitCode = 2;
});
