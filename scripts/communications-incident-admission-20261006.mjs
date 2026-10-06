/** Read-only actual Linux runtime proof; never edits flags or signals a process. */
import { readFileSync, readdirSync, readlinkSync, lstatSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha, refuse, canonical, privateWrite } from './communications-incident-20261006.mjs';
import { successfulRead } from './communications-incident-mcp-20261006.mjs';

export const ADMISSION_FLAGS = ['BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED', 'BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED'];
const OPS_FORWARD_ONLY = 'BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER';
const forwardOnly = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
// Bound startup options only; no unreviewed preloaded code before admission guards.
const safeNodeOptions = value => /^(?:\s*(?:--max[-_]old[-_]space[-_]size=[0-9]+|--max[-_]semi[-_]space[-_]size=[0-9]+|--enable-source-maps|--no-warnings))*\s*$/.test(value ?? '');
const BOOTSTRAP_INPUTS = ['NODE_ENV', 'VITEST', 'BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP', 'PAPERCLIP_ENV_FILE'];
const bootstrapSkipped = inputs => inputs.NODE_ENV === 'test' || inputs.VITEST === 'true' || forwardOnly(inputs.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP);
const overridingPaths = (cwd, inputs) => [inputs.PAPERCLIP_ENV_FILE, resolve(cwd, '../.paperclip-blueprint.env'), resolve(cwd, '.env.local')]
  .filter(value => typeof value === 'string' && value.trim()).map(value => resolve(cwd, value));
function bootstrapProtection(root, cwd, environment) {
  const inputs = Object.fromEntries(BOOTSTRAP_INPUTS.map(key => [key, environment[key] ?? null]));
  if (bootstrapSkipped(inputs)) return { mode: 'disabled', inputs, paths: [] };
  const paths = overridingPaths(cwd, inputs).map(path => {
    try { lstatSync(`${root}/root${path}`); refuse('runtime_env_override_present'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { path, absent: true };
  });
  return { mode: 'overrides_absent', inputs, paths };
}
function bootstrapProofValid(proof, cwd) {
  if (!proof?.inputs || BOOTSTRAP_INPUTS.some(key => proof.inputs[key] !== null && typeof proof.inputs[key] !== 'string')) return false;
  const expected = bootstrapSkipped(proof.inputs) ? { mode: 'disabled', paths: [] }
    : { mode: 'overrides_absent', paths: overridingPaths(cwd, proof.inputs).map(path => ({ path, absent: true })) };
  return proof.mode === expected.mode && canonical(proof.paths) === canonical(expected.paths);
}
function filesystemIdentity(root) {
  const metadata = statSync(`${root}/root`, { bigint: true });
  return { mountNamespace: readlinkSync(`${root}/ns/mnt`), rootDevice: String(metadata.dev), rootInode: String(metadata.ino) };
}
export const ADMISSION_SOURCE = 'c4db1d2f61970efda3a226c9715345718a2064f5';
// Independently reproducible: pinned esbuild, exact main source, external packages.
export const ADMISSION_ENTRY_SHA256 = '69c24029a5d1d087cc10ac6f834f3c22e74a3ef6e058b826f49c168c73f70f17';
const stat = bytes => {
  const fields = bytes.toString().slice(bytes.toString().lastIndexOf(')') + 2).trim().split(/\s+/);
  return { state: fields[0], parentPid: Number(fields[1]), startTicks: fields[19] };
};
const freshReceipt = (receipt, now) => {
  if (!Number.isSafeInteger(receipt?.observedAtMs) || receipt.observedAtMs > now + 5000
    || now - receipt.observedAtMs > 300000) refuse('admission_receipt_not_fresh');
};
export function readRuntime(pid) {
  const root = `/proc/${pid}`, before = stat(readFileSync(`${root}/stat`));
  const command = readFileSync(`${root}/cmdline`), args = command.toString().split('\0').filter(Boolean);
  const cwd = readlinkSync(`${root}/cwd`), executable = readlinkSync(`${root}/exe`);
  const filesystem = { target: filesystemIdentity(root), collector: filesystemIdentity('/proc/self') };
  if (canonical(filesystem.target) !== canonical(filesystem.collector)) refuse('runtime_filesystem_view_unbound');
  const environment = Object.fromEntries(readFileSync(`${root}/environ`).toString().split('\0').filter(Boolean).map(entry => {
    const equal = entry.indexOf('='); return [entry.slice(0, equal), entry.slice(equal + 1)];
  }));
  const entry = args.length === 2 ? resolve(cwd, args[1]) : null;
  if (!['node', 'nodejs'].includes(basename(args[0] ?? '')) || !entry?.endsWith('/dist/worker.js')) refuse('runtime_entrypoint_unbound');
  if (!safeNodeOptions(environment.NODE_OPTIONS)) refuse('runtime_startup_options_unbound');
  const protection = bootstrapProtection(root, cwd, environment);
  const entrySha256 = sha(readFileSync(`${root}/root${entry}`)), after = stat(readFileSync(`${root}/stat`));
  const selected = env => Object.fromEntries(['RENDER_SERVICE_ID', 'RENDER_INSTANCE_ID', 'RENDER_GIT_COMMIT', OPS_FORWARD_ONLY,
    ...ADMISSION_FLAGS, ...BOOTSTRAP_INPUTS, 'NODE_OPTIONS'].map(key => [key, env[key] ?? null]));
  const environmentAfter = Object.fromEntries(readFileSync(`${root}/environ`).toString().split('\0').filter(Boolean).map(entry => {
    const equal = entry.indexOf('='); return [entry.slice(0, equal), entry.slice(equal + 1)];
  }));
  if (before.startTicks !== after.startTicks || before.parentPid !== after.parentPid
    || sha(command) !== sha(readFileSync(`${root}/cmdline`)) || cwd !== readlinkSync(`${root}/cwd`)
    || executable !== readlinkSync(`${root}/exe`) || canonical(selected(environment)) !== canonical(selected(environmentAfter))
    || canonical(filesystem.target) !== canonical(filesystemIdentity(root))
    || canonical(protection) !== canonical(bootstrapProtection(root, cwd, environmentAfter))) refuse('runtime_identity_changed');
  return { schema: 'blueprint.disabled-worker-runtime.v1', observedAtMs: Date.now(), pid, ...after,
    bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), cwd, executable,
    entry, entrySha256, commandSha256: sha(command),
    serviceId: environment.RENDER_SERVICE_ID, instanceId: environment.RENDER_INSTANCE_ID,
    sourceCommit: environment.RENDER_GIT_COMMIT,
    opsForwardOnly: environment[OPS_FORWARD_ONLY] ?? null,
    nodeOptions: environment.NODE_OPTIONS ?? null,
    bootstrapProtection: protection,
    filesystem,
    flags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, environment[key] ?? null])) };
}
export function inspectRuntime(requireDisabledAdmission = true) {
  const collect = () => {
    const pids = readdirSync('/proc').filter(name => /^[0-9]+$/.test(name));
    if (pids.length > 10000) refuse('runtime_inventory_overflow');
    const candidates = [];
    for (const name of pids) {
      let args;
      try { args = readFileSync(`/proc/${name}/cmdline`).toString().split('\0').filter(Boolean); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'ESRCH') continue; throw error; }
      if (args.slice(1).some(arg => /(?:^|\/)dist\/worker\.js$/.test(arg))) candidates.push(Number(name));
    }
    return candidates.sort((a, b) => a - b);
  };
  const before = collect();
  if (before.length !== 1) refuse('runtime_root_inventory_unknown');
  const runtime = readRuntime(before[0]);
  if (canonical(before) !== canonical(collect())) refuse('runtime_inventory_changed');
  if (runtime.sourceCommit !== ADMISSION_SOURCE || runtime.entrySha256 !== ADMISSION_ENTRY_SHA256
    || !forwardOnly(runtime.opsForwardOnly)
    || (requireDisabledAdmission && ADMISSION_FLAGS.some(key => runtime.flags[key] !== 'false'))) refuse('runtime_admission_not_closed');
  return { ...runtime, rootInventoryComplete: true, runtimeRootCount: before.length };
}
// v2 retains the original complete-before-and-after inventory contract.
export function checkAdmissionFence(service, authority, now) {
  return checkWorkerAdmission(service, authority, now, false);
}
// v3 positively covers every actual current instance after the pinned retained
// baseline. It does not manufacture a missing pre-change inventory or timestamps.
export function checkCurrentAdmissionFence(service, authority, now) {
  return checkWorkerAdmission(service, authority, now, true);
}
// Keep the two reported namespaces unchanged. This comparison is an explicit,
// parent-pinned inference for known pairs, never a generic suffix/fuzzy join.
function renderInstanceKey(id, serviceId) {
  if (typeof id !== 'string' || !id.startsWith(`${serviceId}-`)) return null;
  const parts = id.slice(serviceId.length + 1).split('-'), suffix = parts.at(-1);
  return /^[a-z0-9]{5}$/.test(suffix ?? '') && (parts.length === 1
    || (parts.length === 2 && /^[a-f0-9]{8,16}$/.test(parts[0]))) ? `${serviceId}-${suffix}` : null;
}
function pinnedRuntimeIds(service, authority, currentOnly) {
  const aliases = authority.expectedWorkerInstanceAliases?.[service.serviceId];
  const nativeIds = Array.isArray(service.runtimes) ? service.runtimes.map(runtime => runtime.instanceId) : undefined;
  if (aliases === undefined) return nativeIds;
  if (!currentOnly || !Array.isArray(aliases) || !aliases.length || !Array.isArray(nativeIds) || !Array.isArray(service.instances.body)
    || aliases.some(alias => !alias || Object.keys(alias).some(key => !['restInstanceId', 'nativeInstanceId'].includes(key))
      || typeof alias.restInstanceId !== 'string' || typeof alias.nativeInstanceId !== 'string'
      || renderInstanceKey(alias.restInstanceId, service.serviceId) !== alias.restInstanceId
      || renderInstanceKey(alias.nativeInstanceId, service.serviceId) !== alias.restInstanceId)
    || new Set(aliases.map(alias => alias.restInstanceId)).size !== aliases.length
    || new Set(aliases.map(alias => alias.nativeInstanceId)).size !== aliases.length
    || canonical(aliases.map(alias => alias.restInstanceId).sort()) !== canonical(service.instances.body.map(row => row.id).sort())
    || canonical(aliases.map(alias => alias.nativeInstanceId).sort()) !== canonical([...nativeIds].sort())) refuse('admission_instance_alias_unverified');
  return nativeIds.map(id => aliases.find(alias => alias.nativeInstanceId === id).restInstanceId);
}
function checkWorkerAdmission(service, authority, now, currentOnly) {
  const base = `https://api.render.com/v1/services/${service.serviceId}`;
  const prior = service.priorInstances;
  const original = authority.expectedPriorWorkerInstanceIds?.[service.serviceId];
  const current = service.instances.body, runtimes = service.runtimes;
  const ids = list => list.map(row => row.id).sort();
  const baseline = service.baselineRuntime;
  const mappedRuntimeIds = pinnedRuntimeIds(service, authority, currentOnly);
  const baselineKey = renderInstanceKey(baseline?.instanceId, service.serviceId);
  const priorInvalid = currentOnly
    ? baseline?.schema !== 'blueprint.disabled-worker-runtime.v1' || baseline.serviceId !== service.serviceId
      || baseline.sourceCommit !== ADMISSION_SOURCE || baseline.entrySha256 !== ADMISSION_ENTRY_SHA256
      || baseline.rootInventoryComplete !== true || baseline.runtimeRootCount !== 1
      || !Number.isSafeInteger(baseline.observedAtMs) || baseline.observedAtMs >= service.instances.observedAtMs
      || !authority.expectedBaselineRuntimeDigests?.[service.serviceId]
      || sha(baseline) !== authority.expectedBaselineRuntimeDigests[service.serviceId]
      || (authority.expectedWorkerInstanceAliases?.[service.serviceId] !== undefined && !baselineKey)
      || typeof baseline.instanceId !== 'string' || !baseline.instanceId.startsWith(`${service.serviceId}-`)
      || !Array.isArray(current) || current.some(row => row.id === baseline.instanceId
        || (baselineKey && renderInstanceKey(row.id, service.serviceId) === baselineKey)
        || !Number.isFinite(Date.parse(row.createdAt)) || Date.parse(row.createdAt) <= baseline.observedAtMs)
    : prior?.method !== 'GET' || prior.url !== `${base}/instances` || prior.status !== 200
      || !Array.isArray(prior.body) || !prior.body.length || !Array.isArray(original) || !original.length
      || canonical(ids(prior.body)) !== canonical([...original].sort())
      || !Number.isSafeInteger(prior.observedAtMs) || prior.observedAtMs >= service.instances.observedAtMs
      || !Array.isArray(current) || current.some(row => original.includes(row.id)
        || !Number.isFinite(Date.parse(row.createdAt)) || Date.parse(row.createdAt) < prior.observedAtMs);
  for (const receipt of [service.service, service.instances, service.deployReceipt, ...ADMISSION_FLAGS.map(key => service.admissionFlags?.[key])]) freshReceipt(receipt, now);
  if (service.serviceId !== 'srv-d9t8gg1t0dsc73am9q70' || service.deployCommit !== ADMISSION_SOURCE
    || service.service.body.suspended !== 'not_suspended'
    || service.service.body.serviceDetails?.envSpecificDetails?.startCommand !== 'npm run start:worker'
    || priorInvalid
    || !Array.isArray(current) || !current.length || new Set(ids(current)).size !== current.length
    || service.deployReceipt?.method !== 'GET' || service.deployReceipt.url !== `${base}/deploys/${service.deploy.id}`
    || !successfulRead(service.deployReceipt, authority, now) || canonical(service.deployReceipt.body) !== canonical(service.deploy)
    || !Array.isArray(runtimes) || canonical([...mappedRuntimeIds].sort()) !== canonical(ids(current))) refuse('admission_instance_scope_unverified');
  for (const key of ADMISSION_FLAGS) {
    const receipt = service.admissionFlags?.[key];
    if (receipt?.method !== 'GET' || receipt.url !== `${base}/env-vars/${key}` || receipt.status !== 200
      || receipt.body?.key !== key || receipt.body?.value !== 'false') refuse('service_admission_flag_unverified');
  }
  for (const runtime of runtimes) {
    if (runtime.schema !== 'blueprint.disabled-worker-runtime.v1' || runtime.serviceId !== service.serviceId
      || runtime.sourceCommit !== ADMISSION_SOURCE || runtime.entrySha256 !== ADMISSION_ENTRY_SHA256
      || !Number.isSafeInteger(runtime.pid) || runtime.pid < 1 || !/^[0-9]+$/.test(runtime.startTicks ?? '')
      || !/^[0-9a-f-]{36}$/.test(runtime.bootId ?? '') || !/^[a-f0-9]{64}$/.test(runtime.commandSha256 ?? '')
      || !runtime.entry?.endsWith('/dist/worker.js') || !['node', 'nodejs'].includes(basename(runtime.executable ?? ''))
      || runtime.entry !== resolve(runtime.cwd, 'dist/worker.js') || !['R', 'S', 'I'].includes(runtime.state)
      || runtime.rootInventoryComplete !== true || runtime.runtimeRootCount !== 1
      || !forwardOnly(runtime.opsForwardOnly)
      || (runtime.nodeOptions !== null && typeof runtime.nodeOptions !== 'string') || !safeNodeOptions(runtime.nodeOptions)
      || !bootstrapProofValid(runtime.bootstrapProtection, runtime.cwd)
      || !runtime.filesystem?.target || canonical(runtime.filesystem.target) !== canonical(runtime.filesystem.collector)
      || !/^mnt:\[[0-9]+\]$/.test(runtime.filesystem.target.mountNamespace ?? '')
      || !/^[0-9]+$/.test(runtime.filesystem.target.rootDevice ?? '') || !/^[0-9]+$/.test(runtime.filesystem.target.rootInode ?? '')
      || !Number.isSafeInteger(runtime.observedAtMs) || runtime.observedAtMs > now + 5000 || now - runtime.observedAtMs > 300000
      || runtime.observedAtMs < Math.max(service.service.observedAtMs, service.instances.observedAtMs, service.deployReceipt.observedAtMs,
        ...ADMISSION_FLAGS.map(key => service.admissionFlags[key].observedAtMs))
      || ADMISSION_FLAGS.some(key => runtime.flags?.[key] !== 'false')) refuse('actual_runtime_admission_unverified');
  }
}
export function checkWebWriterFence(web, now, authority) {
  const id = 'srv-d4vnmk3e5dus73aiohk0', base = `https://api.render.com/v1/services/${id}`;
  const off = 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service';
  const flag = web?.opsFlag, service = web?.service, instances = web?.instances, logs = web?.startupLogs;
  const absent = flag?.status === 404 && flag.body === null;
  for (const receipt of [flag, service, instances, logs, web?.deployReceipt]) freshReceipt(receipt, now);
  let url; try { url = new URL(logs?.url); } catch { refuse('web_writer_fence_unverified'); }
  if (service?.method !== 'GET' || service.url !== base || !successfulRead(service, authority, now)
    || service.body?.id !== id || service.body.type !== 'web_service'
    || web.deploy?.status !== 'live' || web.deploy?.commit?.id !== ADMISSION_SOURCE
    || web.deployReceipt?.method !== 'GET' || web.deployReceipt.url !== `${base}/deploys/${web.deploy.id}`
    || !successfulRead(web.deployReceipt, authority, now) || canonical(web.deployReceipt.body) !== canonical(web.deploy)
    || flag?.method !== 'GET' || flag.url !== `${base}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB`
    || !(absent || (flag.status === 200 && flag.body?.key === 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB' && ['0', 'false'].includes(flag.body?.value)))
    || instances?.method !== 'GET' || instances.url !== `${base}/instances` || instances.status !== 200
    || !Array.isArray(instances.body) || !instances.body.length
    || new Set(instances.body.map(row => row.id)).size !== instances.body.length
    || logs.method !== 'GET' || url.origin !== 'https://api.render.com' || url.pathname !== '/v1/logs'
    || url.searchParams.get('ownerId') !== service.body.ownerId || url.searchParams.get('resource') !== id
    || !successfulRead(logs, authority, now) || logs.body?.hasMore !== false || !Array.isArray(logs.body.logs)) refuse('web_writer_fence_unverified');
  for (const instance of instances.body) {
    if (!Number.isFinite(Date.parse(instance.createdAt)) || !logs.body.logs.some(log => {
      const label = name => log.labels?.find(row => row.name === name)?.value;
      let message; if (absent) { try { message = JSON.parse(log.message); } catch { return false; } }
      return label('resource') === id && label('instance') === instance.id && typeof log.message === 'string'
        && (absent ? message?.service === 'blueprint-webapp' && message.route === 'ops-automation-scheduler'
          && message.msg === `${off} (set BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1 to opt this process in)`
          : log.message.includes(off)) && Date.parse(log.timestamp) >= Date.parse(instance.createdAt);
    })) refuse('web_runtime_ops_not_verified');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!['inspect', 'inspect-before-fence'].includes(process.argv[2]) || !process.argv[3]?.startsWith('/tmp/')) refuse('explicit_private_inspection_required');
    const proof = inspectRuntime(process.argv[2] === 'inspect'); privateWrite(process.argv[3], proof);
    console.log(JSON.stringify({ ok: true, readOnly: true, observation: process.argv[2], schema: proof.schema, proofSha256: sha(proof), rootCount: proof.runtimeRootCount }));
  } catch (error) { console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'runtime_inspection_unavailable' })); process.exitCode = 2; }
}
