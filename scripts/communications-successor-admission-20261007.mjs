/** Explicit successor admission. No flag writes, recovery, activation or deletion. */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, sha, refuse, privateWrite } from './communications-incident-20261006.mjs';
import { readRuntime, ADMISSION_FLAGS, ADMISSION_SOURCE, ADMISSION_ENTRY_SHA256 } from './communications-incident-admission-20261006.mjs';
import { fresh } from './communications-incident-recovery-20261006.mjs';
import { successfulRead, mcpReadScope } from './communications-incident-mcp-20261006.mjs';
import { checkWebSourceProof, WEB_SOURCE_POLICY_DIGEST, WEB_SOURCE_RECIPE } from './communications-successor-web-source-20261007.mjs';

export const WORKER = 'srv-d9t8gg1t0dsc73am9q70', WEB = 'srv-d4vnmk3e5dus73aiohk0';
export const ENTRY_SHA256 = '2d99eb8032d04d65d023ecdca8288e5b72ee3c67c593e80fa323eef498a5465b';
export const BASELINE_DIGEST = '6c7a7b4127d782968cfdd00907db6c750298fdb55307197117adf53f8db0882d';
export const AUDIT_DIGEST = '960807f5dfc5882718cb7d9088a9e13fb1b829a1705a999ed8f54eef8f15c6a9';
export const LAP_DIGEST = 'c742096f7c4b83fa9b616a8a668ecd7ec87a2c72f9442f1afdd262a5c9c8eb7d';
export const TARGET_DIGEST = '7694f82b7af5fd262529588673b1bfc279b36ecb760b5a4732cd1f1aca247840';
export const APPROVAL = Object.freeze({ request: 'Sentinel_fb7671ce6b0c8191bde5f9a9452deb2d',
  response: 'Sentinel_5273265ce2188191972d8720acac0864', responseAtUtc: '2026-10-06T14:43:47Z' });
export const PARENT = '01a0fe81-486b-7714-9e81-983a66bd80c4';
export const SCHEMA = 'blueprint.render-successor-fence.v1';
export const WRITERS = ['pipeline-release-owner', 'paused-mac-outreach-owner', 'authenticated-manual-and-cli-writers', 'github-configuration-writers'];
const forwardOnly = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const safeNodeOptions = value => /^(?:\s*(?:--max[-_]old[-_]space[-_]size=[0-9]+|--max[-_]semi[-_]space[-_]size=[0-9]+|--enable-source-maps|--no-warnings))*\s*$/.test(value ?? '');
const idKey = id => {
  if (typeof id !== 'string' || !id.startsWith(`${WORKER}-`)) return null;
  const parts = id.slice(WORKER.length + 1).split('-');
  return /^[a-z0-9]{5}$/.test(parts.at(-1) ?? '') && (parts.length === 1 || (parts.length === 2 && /^[a-f0-9]{8,16}$/.test(parts[0])))
    ? `${WORKER}-${parts.at(-1)}` : null;
};
export function authorityScope(a) {
  // Full immutable direction, including exact approval/source/target/MCP scope.
  // Only these five per-proof byte/digest fields rotate for new observations.
  const { expectedMcpReceiptDigests, processProofDigest, processProofFileSha256,
    canonicalFileSha256, providerFileSha256, ...immutable } = a;
  return immutable;
}
export function checkDirection(a) {
  if (a?.schema !== 'blueprint.successor-oct6-cleanup-authority.v1' || a.parentThread !== PARENT
    || a.incident !== 'lap259-20261006' || a.action !== 'archive_verify_delete_stopped_oct6'
    || typeof a.actor !== 'string' || a.actor.length < 3 || a.approvalReference !== APPROVAL.response
    || canonical(a.approvalTranscript) !== canonical(APPROVAL) || a.stoppedTargetDigest !== TARGET_DIGEST
    || !/^[a-f0-9]{40}$/.test(a.expectedReleaseCommit ?? '') || a.expectedWebCommit !== a.expectedReleaseCommit
    || a.expectedWorkerEntrySha256 !== ENTRY_SHA256 || a.expectedWebSourcePolicyDigest !== WEB_SOURCE_POLICY_DIGEST
    || a.expectedHistoricalAuditDigest !== AUDIT_DIGEST || a.expectedLapSha256 !== LAP_DIGEST
    || a.expectedBaselineRuntimeDigests?.[WORKER] !== BASELINE_DIGEST
    || canonical(a.expectedWorkerServiceIds) !== canonical([WORKER]) || !Array.isArray(a.expectedSourceFailures)
    || !Array.isArray(a.frozenWriters) || WRITERS.some(name => !a.frozenWriters.includes(name))
    || !a.writerFreezeEvidence || !a.expectedMcpReadScope) refuse('successor_owner_direction_unbound');
}
export function inspectRuntime(expectedCommit) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) refuse('exact_successor_source_required');
  const collect = () => {
    const names = readdirSync('/proc').filter(name => /^[0-9]+$/.test(name));
    if (names.length > 10000) refuse('runtime_inventory_overflow');
    return names.filter(pid => {
      let args; try { args = readFileSync(`/proc/${pid}/cmdline`).toString().split('\0').filter(Boolean); }
      catch (e) { if (['ENOENT', 'ESRCH'].includes(e.code)) return false; throw e; }
      return args.slice(1).some(arg => /(?:^|\/)dist\/worker\.js$/.test(arg));
    }).map(Number).sort((a, b) => a - b);
  };
  const before = collect();
  if (before.length !== 1) refuse('runtime_root_inventory_unknown');
  const runtime = readRuntime(before[0]);
  if (canonical(before) !== canonical(collect()) || runtime.serviceId !== WORKER
    || runtime.sourceCommit !== expectedCommit || runtime.entrySha256 !== ENTRY_SHA256
    || runtime.bootstrapProtection?.mode !== 'disabled' || runtime.bootstrapProtection.inputs.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP !== 'true'
    || !forwardOnly(runtime.opsForwardOnly) || ADMISSION_FLAGS.some(key => runtime.flags[key] !== 'false')) refuse('successor_runtime_admission_not_closed');
  return { ...runtime, rootInventoryComplete: true, runtimeRootCount: 1 };
}
export function checkWorker(service, authority, now) {
  const base = `https://api.render.com/v1/services/${WORKER}`, baseline = service?.baselineRuntime;
  const current = service?.instances?.body, runtimes = service?.runtimes, aliases = authority.expectedWorkerInstanceAliases?.[WORKER];
  const ids = rows => rows.map(row => row.id).sort();
  for (const receipt of [service?.service, service?.instances, service?.deployReceipt, ...ADMISSION_FLAGS.map(key => service?.admissionFlags?.[key])]) fresh(receipt?.observedAtMs, now);
  if (service?.serviceId !== WORKER || service.deployCommit !== authority.expectedReleaseCommit
    || service.service.method !== 'GET' || service.service.url !== base || !successfulRead(service.service, authority, now)
    || service.service.body?.id !== WORKER || service.service.body.type !== 'background_worker'
    || service.service.body.suspended !== 'not_suspended'
    || service.service.body.serviceDetails?.envSpecificDetails?.startCommand !== 'npm run start:worker'
    || service.deploy?.status !== 'live' || service.deploy.commit?.id !== authority.expectedReleaseCommit
    || service.deployReceipt.method !== 'GET' || service.deployReceipt.url !== `${base}/deploys/${service.deploy.id}`
    || !successfulRead(service.deployReceipt, authority, now) || canonical(service.deployReceipt.body) !== canonical(service.deploy)
    || baseline?.schema !== 'blueprint.disabled-worker-runtime.v1' || baseline.serviceId !== WORKER
    || baseline.sourceCommit !== ADMISSION_SOURCE || baseline.entrySha256 !== ADMISSION_ENTRY_SHA256
    || sha(baseline) !== BASELINE_DIGEST || baseline.rootInventoryComplete !== true || baseline.runtimeRootCount !== 1
    || !idKey(baseline.instanceId) || !Number.isSafeInteger(baseline.observedAtMs) || baseline.observedAtMs >= service.instances.observedAtMs
    || service.instances.method !== 'GET' || service.instances.url !== `${base}/instances` || service.instances.status !== 200
    || !Array.isArray(current) || !current.length || new Set(ids(current)).size !== current.length
    || current.some(row => idKey(row.id) === idKey(baseline.instanceId) || !Number.isFinite(Date.parse(row.createdAt)) || Date.parse(row.createdAt) <= baseline.observedAtMs || Date.parse(row.createdAt) > now + 5000)
    || !Array.isArray(runtimes) || !runtimes.length || !Array.isArray(aliases) || aliases.length !== current.length
    || aliases.some(a => !a || Object.keys(a).some(k => !['restInstanceId', 'nativeInstanceId'].includes(k)) || typeof a.restInstanceId !== 'string' || typeof a.nativeInstanceId !== 'string' || idKey(a.restInstanceId) !== a.restInstanceId || idKey(a.nativeInstanceId) !== a.restInstanceId)
    || new Set(aliases.map(a => a.restInstanceId)).size !== aliases.length || new Set(aliases.map(a => a.nativeInstanceId)).size !== aliases.length
    || canonical(aliases.map(a => a.restInstanceId).sort()) !== canonical(ids(current))
    || canonical(aliases.map(a => a.nativeInstanceId).sort()) !== canonical(runtimes.map(r => r.instanceId).sort())) refuse('successor_instance_scope_unverified');
  for (const key of ADMISSION_FLAGS) {
    const receipt = service.admissionFlags[key];
    if (receipt.method !== 'GET' || receipt.url !== `${base}/env-vars/${key}` || receipt.status !== 200 || receipt.body?.key !== key || receipt.body.value !== 'false') refuse('service_admission_flag_unverified');
  }
  for (const runtime of runtimes) {
    const protection = runtime.bootstrapProtection;
    if (runtime.schema !== 'blueprint.disabled-worker-runtime.v1' || runtime.serviceId !== WORKER || runtime.sourceCommit !== authority.expectedReleaseCommit || runtime.entrySha256 !== ENTRY_SHA256
      || !Number.isSafeInteger(runtime.pid) || runtime.pid < 1 || !/^[0-9]+$/.test(runtime.startTicks ?? '') || !/^[0-9a-f-]{36}$/.test(runtime.bootId ?? '')
      || !/^[a-f0-9]{64}$/.test(runtime.commandSha256 ?? '') || !['node','nodejs'].includes(basename(runtime.executable ?? ''))
      || runtime.entry !== resolve(runtime.cwd, 'dist/worker.js') || !['R','S','I'].includes(runtime.state) || runtime.rootInventoryComplete !== true || runtime.runtimeRootCount !== 1
      || !forwardOnly(runtime.opsForwardOnly) || (runtime.nodeOptions !== null && typeof runtime.nodeOptions !== 'string') || !safeNodeOptions(runtime.nodeOptions)
      || protection?.mode !== 'disabled' || protection.inputs?.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP !== 'true' || canonical(protection.paths) !== '[]'
      || ['NODE_ENV','VITEST','BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP','PAPERCLIP_ENV_FILE'].some(k => protection.inputs[k] !== null && typeof protection.inputs[k] !== 'string')
      || !runtime.filesystem?.target || canonical(runtime.filesystem.target) !== canonical(runtime.filesystem.collector)
      || !/^mnt:\[[0-9]+\]$/.test(runtime.filesystem.target.mountNamespace ?? '') || !/^[0-9]+$/.test(runtime.filesystem.target.rootDevice ?? '') || !/^[0-9]+$/.test(runtime.filesystem.target.rootInode ?? '')
      || !Number.isSafeInteger(runtime.observedAtMs) || runtime.observedAtMs > now + 5000 || now - runtime.observedAtMs > 300000
      || runtime.observedAtMs < Math.max(service.service.observedAtMs, service.instances.observedAtMs, service.deployReceipt.observedAtMs, ...ADMISSION_FLAGS.map(k => service.admissionFlags[k].observedAtMs))
      || ADMISSION_FLAGS.some(k => runtime.flags?.[k] !== 'false')) refuse('actual_runtime_admission_unverified');
  }
}
export function checkWeb(web, authority, now) {
  checkWebSourceProof(web?.sourceProof, authority);
  const base = `https://api.render.com/v1/services/${WEB}`, service = web?.service, instances = web?.instances, logs = web?.startupLogs, flag = web?.opsFlag;
  for (const receipt of [service, instances, logs, flag, web?.deployReceipt]) fresh(receipt?.observedAtMs, now);
  let url; try { url = new URL(logs?.url); } catch { refuse('web_writer_fence_unverified'); }
  const details = service?.body?.serviceDetails;
  const absent = flag?.status === 404 && flag.body === null;
  if (service?.method !== 'GET' || service.url !== base || !successfulRead(service, authority, now) || service.body?.id !== WEB || service.body.type !== 'web_service'
    || service.body.suspended !== 'not_suspended'
    || canonical({repo:service.body.repo,branch:service.body.branch,env:details?.env,runtime:details?.runtime,buildCommand:details?.envSpecificDetails?.buildCommand,startCommand:details?.envSpecificDetails?.startCommand}) !== canonical(WEB_SOURCE_RECIPE)
    || web.deploy?.status !== 'live' || web.deploy.commit?.id !== authority.expectedReleaseCommit || web.deploy.commit.id !== web.sourceProof.commit
    || web.deployReceipt?.method !== 'GET' || web.deployReceipt.url !== `${base}/deploys/${web.deploy.id}` || !successfulRead(web.deployReceipt, authority, now) || canonical(web.deployReceipt.body) !== canonical(web.deploy)
    || flag?.method !== 'GET' || flag.url !== `${base}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB` || !(absent || (flag.status === 200 && flag.body?.key === 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB' && ['0','false'].includes(flag.body.value)))
    || instances?.method !== 'GET' || instances.url !== `${base}/instances` || instances.status !== 200 || !Array.isArray(instances.body) || !instances.body.length || new Set(instances.body.map(r => r.id)).size !== instances.body.length
    || logs.method !== 'GET' || url.origin !== 'https://api.render.com' || url.pathname !== '/v1/logs' || url.searchParams.get('ownerId') !== service.body.ownerId || url.searchParams.get('resource') !== WEB
    || !successfulRead(logs, authority, now) || logs.body?.hasMore !== false || !Array.isArray(logs.body.logs)) refuse('web_writer_fence_unverified');
  const off = 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service';
  for (const instance of instances.body) {
    if (!Number.isFinite(Date.parse(instance.createdAt)) || !logs.body.logs.some(log => {
      const label = name => log.labels?.find(r => r.name === name)?.value;
      let message; if (absent) { try { message = JSON.parse(log.message); } catch { return false; } }
      return label('resource') === WEB && label('instance') === instance.id && typeof log.message === 'string'
        && (absent ? message?.service === 'blueprint-webapp' && message.route === 'ops-automation-scheduler' && message.msg === `${off} (set BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1 to opt this process in)` : log.message.includes(off))
        && Date.parse(log.timestamp) >= Date.parse(instance.createdAt);
    })) refuse('web_runtime_ops_not_verified');
  }
}
export function checkFence(proof, authority, now) {
  checkDirection(authority);
  if (proof?.schema !== SCHEMA || proof.lane !== 'complete_successor_disabled_admission' || proof.parentThread !== PARENT || proof.incident !== authority.incident
    || sha(proof) !== authority.processProofDigest || !Array.isArray(proof.services) || proof.services.length !== 1 || canonical(proof.frozenWriters) !== canonical(authority.frozenWriters)
    || canonical(proof.writerFreezeEvidence) !== canonical(authority.writerFreezeEvidence)) refuse('successor_process_fence_unbound');
  fresh(proof.observedAtMs, now);
  checkWeb(proof.web, authority, now); checkWorker(proof.services[0], authority, now);
  const s = proof.services[0];
  const receipts = [s.service,s.instances,s.deployReceipt,...Object.values(s.admissionFlags),...s.runtimes,proof.web.service,proof.web.instances,proof.web.deployReceipt,proof.web.opsFlag,proof.web.startupLogs];
  if (receipts.some(r => r.observedAtMs > proof.observedAtMs)) refuse('process_fence_observation_incomplete');
  const mcp = receipts.filter(r => r.transport === 'render_mcp');
  if (mcp.length !== 5 || canonical(Object.fromEntries(mcp.map(r => [r.url,mcpReadScope(r)]))) !== canonical(authority.expectedMcpReadScope)) refuse('successor_mcp_scope_changed');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, commit, output] = process.argv.slice(2);
    if (mode !== 'inspect' || !output?.startsWith('/tmp/')) refuse('explicit_private_inspection_required');
    const runtime = inspectRuntime(commit); const digest = privateWrite(output, runtime);
    console.log(JSON.stringify({ok:true,readOnly:true,fileSha256:digest,source:runtime.sourceCommit}));
  } catch(e) { console.error(JSON.stringify({ok:false,code:/^[a-z_]+$/.test(e.message)?e.message:'successor_runtime_inspection_unavailable'}));process.exitCode=2; }
}
