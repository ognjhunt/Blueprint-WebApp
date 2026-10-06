/** Read-only actual Linux runtime proof; never edits flags or signals a process. */
import { readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha, refuse, canonical, privateWrite } from './communications-incident-20261006.mjs';

export const ADMISSION_FLAGS = ['BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED', 'BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED'];
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
  const environment = Object.fromEntries(readFileSync(`${root}/environ`).toString().split('\0').filter(Boolean).map(entry => {
    const equal = entry.indexOf('='); return [entry.slice(0, equal), entry.slice(equal + 1)];
  }));
  const entry = args.length === 2 ? resolve(cwd, args[1]) : null;
  if (!['node', 'nodejs'].includes(basename(args[0] ?? '')) || !entry?.endsWith('/dist/worker.js')) refuse('runtime_entrypoint_unbound');
  const entrySha256 = sha(readFileSync(entry)), after = stat(readFileSync(`${root}/stat`));
  const selected = env => Object.fromEntries(['RENDER_SERVICE_ID', 'RENDER_INSTANCE_ID', 'RENDER_GIT_COMMIT', ...ADMISSION_FLAGS].map(key => [key, env[key] ?? null]));
  const environmentAfter = Object.fromEntries(readFileSync(`${root}/environ`).toString().split('\0').filter(Boolean).map(entry => {
    const equal = entry.indexOf('='); return [entry.slice(0, equal), entry.slice(equal + 1)];
  }));
  if (before.startTicks !== after.startTicks || before.parentPid !== after.parentPid
    || sha(command) !== sha(readFileSync(`${root}/cmdline`)) || cwd !== readlinkSync(`${root}/cwd`)
    || executable !== readlinkSync(`${root}/exe`) || canonical(selected(environment)) !== canonical(selected(environmentAfter))) refuse('runtime_identity_changed');
  return { schema: 'blueprint.disabled-worker-runtime.v1', observedAtMs: Date.now(), pid, ...after,
    bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), cwd, executable,
    entry, entrySha256, commandSha256: sha(command),
    serviceId: environment.RENDER_SERVICE_ID, instanceId: environment.RENDER_INSTANCE_ID,
    sourceCommit: environment.RENDER_GIT_COMMIT,
    flags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, environment[key] ?? null])) };
}
export function inspectRuntime() {
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
    || ADMISSION_FLAGS.some(key => runtime.flags[key] !== 'false')) refuse('runtime_admission_not_closed');
  return { ...runtime, rootInventoryComplete: true, runtimeRootCount: before.length };
}
export function checkAdmissionFence(service, authority, now) {
  const base = `https://api.render.com/v1/services/${service.serviceId}`;
  const prior = service.priorInstances;
  const original = authority.expectedPriorWorkerInstanceIds?.[service.serviceId];
  const current = service.instances.body, runtimes = service.runtimes;
  const ids = list => list.map(row => row.id).sort();
  for (const receipt of [service.service, service.instances, service.deployReceipt, ...ADMISSION_FLAGS.map(key => service.admissionFlags?.[key])]) freshReceipt(receipt, now);
  if (service.serviceId !== 'srv-d9t8gg1t0dsc73am9q70' || service.deployCommit !== ADMISSION_SOURCE
    || service.service.body.suspended !== 'not_suspended'
    || service.service.body.serviceDetails?.envSpecificDetails?.startCommand !== 'npm run start:worker'
    || prior?.method !== 'GET' || prior.url !== `${base}/instances` || prior.status !== 200
    || !Array.isArray(prior.body) || !prior.body.length || !Array.isArray(original) || !original.length
    || canonical(ids(prior.body)) !== canonical([...original].sort())
    || !Array.isArray(current) || !current.length || new Set(ids(current)).size !== current.length
    || !Number.isSafeInteger(prior.observedAtMs) || prior.observedAtMs >= service.instances.observedAtMs
    || current.some(row => original.includes(row.id) || !Number.isFinite(Date.parse(row.createdAt)) || Date.parse(row.createdAt) < prior.observedAtMs)
    || service.deployReceipt?.method !== 'GET' || service.deployReceipt.url !== `${base}/deploys/${service.deploy.id}`
    || service.deployReceipt.status !== 200 || canonical(service.deployReceipt.body) !== canonical(service.deploy)
    || !Array.isArray(runtimes) || canonical(runtimes.map(r => r.instanceId).sort()) !== canonical(ids(current))) refuse('admission_instance_scope_unverified');
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
      || !Number.isSafeInteger(runtime.observedAtMs) || runtime.observedAtMs > now + 5000 || now - runtime.observedAtMs > 300000
      || runtime.observedAtMs < Math.max(service.service.observedAtMs, service.instances.observedAtMs, service.deployReceipt.observedAtMs,
        ...ADMISSION_FLAGS.map(key => service.admissionFlags[key].observedAtMs))
      || ADMISSION_FLAGS.some(key => runtime.flags?.[key] !== 'false')) refuse('actual_runtime_admission_unverified');
  }
}
export function checkWebWriterFence(web, now) {
  const id = 'srv-d4vnmk3e5dus73aiohk0', base = `https://api.render.com/v1/services/${id}`;
  const off = 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service';
  const flag = web?.opsFlag, service = web?.service, instances = web?.instances, logs = web?.startupLogs;
  for (const receipt of [flag, service, instances, logs, web?.deployReceipt]) freshReceipt(receipt, now);
  let url; try { url = new URL(logs?.url); } catch { refuse('web_writer_fence_unverified'); }
  if (service?.method !== 'GET' || service.url !== base || service.status !== 200
    || service.body?.id !== id || service.body.type !== 'web_service'
    || web.deploy?.status !== 'live' || web.deploy?.commit?.id !== ADMISSION_SOURCE
    || web.deployReceipt?.method !== 'GET' || web.deployReceipt.url !== `${base}/deploys/${web.deploy.id}`
    || web.deployReceipt.status !== 200 || canonical(web.deployReceipt.body) !== canonical(web.deploy)
    || flag?.method !== 'GET' || flag.url !== `${base}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB`
    || flag.status !== 200 || flag.body?.key !== 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB' || !['0', 'false'].includes(flag.body?.value)
    || instances?.method !== 'GET' || instances.url !== `${base}/instances` || instances.status !== 200
    || !Array.isArray(instances.body) || !instances.body.length
    || new Set(instances.body.map(row => row.id)).size !== instances.body.length
    || logs.method !== 'GET' || url.origin !== 'https://api.render.com' || url.pathname !== '/v1/logs'
    || url.searchParams.get('ownerId') !== service.body.ownerId || url.searchParams.get('resource') !== id
    || logs.status !== 200 || logs.body?.hasMore !== false || !Array.isArray(logs.body.logs)) refuse('web_writer_fence_unverified');
  for (const instance of instances.body) {
    if (!Number.isFinite(Date.parse(instance.createdAt)) || !logs.body.logs.some(log => {
      const label = name => log.labels?.find(row => row.name === name)?.value;
      return label('resource') === id && label('instance') === instance.id && typeof log.message === 'string'
        && log.message.includes(off) && Date.parse(log.timestamp) >= Date.parse(instance.createdAt);
    })) refuse('web_runtime_ops_not_verified');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== 'inspect' || !process.argv[3]?.startsWith('/tmp/')) refuse('explicit_private_inspection_required');
    const proof = inspectRuntime(); privateWrite(process.argv[3], proof);
    console.log(JSON.stringify({ ok: true, readOnly: true, schema: proof.schema, proofSha256: sha(proof), rootCount: proof.runtimeRootCount }));
  } catch (error) { console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'runtime_inspection_unavailable' })); process.exitCode = 2; }
}
