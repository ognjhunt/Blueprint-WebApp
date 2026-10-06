import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADMISSION_SOURCE, ADMISSION_ENTRY_SHA256, ADMISSION_FLAGS, checkAdmissionFence, checkWebWriterFence, readRuntime } from './communications-incident-admission-20261006.mjs';

const NOW = 1791310200000, ID = 'srv-d9t8gg1t0dsc73am9q70', BASE = `https://api.render.com/v1/services/${ID}`;
const get = (url: string, body: any, at = NOW - 2) => ({ method: 'GET', url, body, status: 200, observedAtMs: at });
function fixture() {
  const deploy = { id: 'dep-synthetic', commit: { id: ADMISSION_SOURCE }, status: 'live' };
  const service: any = { serviceId: ID, deployCommit: ADMISSION_SOURCE, deploy, deployReceipt: get(`${BASE}/deploys/${deploy.id}`, deploy),
    service: get(BASE, { id: ID, type: 'background_worker', suspended: 'not_suspended', serviceDetails: { envSpecificDetails: { startCommand: 'npm run start:worker' } } }),
    priorInstances: get(`${BASE}/instances`, [{ id: 'instance-old', createdAt: new Date(NOW - 20000).toISOString() }], NOW - 10000),
    instances: get(`${BASE}/instances`, [{ id: 'instance-new', createdAt: new Date(NOW - 1000).toISOString() }]),
    admissionFlags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, get(`${BASE}/env-vars/${key}`, { key, value: 'false' })])),
    runtimes: [{ schema: 'blueprint.disabled-worker-runtime.v1', observedAtMs: NOW - 1, pid: 7, parentPid: 1, state: 'S', startTicks: '100',
      bootId: 'a'.repeat(8)+'-'+ 'a'.repeat(4)+'-'+ 'a'.repeat(4)+'-'+ 'a'.repeat(4)+'-'+ 'a'.repeat(12),
      cwd: '/opt/render/project/src', executable: '/opt/node/bin/node', entry: '/opt/render/project/src/dist/worker.js',
      entrySha256: ADMISSION_ENTRY_SHA256, commandSha256: 'b'.repeat(64), serviceId: ID, instanceId: 'instance-new',
      sourceCommit: ADMISSION_SOURCE, rootInventoryComplete: true, runtimeRootCount: 1,
      opsForwardOnly: 'true',
      flags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, 'false'])) }] };
  const authority = { expectedPriorWorkerInstanceIds: { [ID]: ['instance-old'] } };
  const webId = 'srv-d4vnmk3e5dus73aiohk0', webBase = `https://api.render.com/v1/services/${webId}`;
  const web: any = { service: get(webBase, { id: webId, type: 'web_service', ownerId: 'owner-synthetic' }),
    deploy, deployReceipt: get(`${webBase}/deploys/${deploy.id}`, deploy),
    opsFlag: get(`${webBase}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB`, { key: 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB', value: '0' }),
    instances: get(`${webBase}/instances`, [{ id: 'web-new', createdAt: new Date(NOW - 20000).toISOString() }]),
    startupLogs: get(`https://api.render.com/v1/logs?ownerId=owner-synthetic&resource=${webId}`, { hasMore: false, logs: [
      { id: 'log-synthetic', timestamp: new Date(NOW - 10000).toISOString(), labels: [{ name: 'resource', value: webId }, { name: 'instance', value: 'web-new' }],
        message: 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service' }] }) };
  return { service, authority, web };
}
describe('exact disabled worker admission evidence', () => {
  it('accepts replaced instances with persisted and actual-runtime false flags', () => {
    const f = fixture(); expect(() => checkAdmissionFence(f.service, f.authority, NOW)).not.toThrow();
    expect(() => checkWebWriterFence(f.web, NOW)).not.toThrow();
  });
  it('rejects original, missing, extra and duplicate current instance coverage', () => {
    for (const change of [(s: any) => s.instances.body[0].id = 'instance-old', (s: any) => s.runtimes = [],
      (s: any) => s.runtimes.push({ ...s.runtimes[0], instanceId: 'uncovered' }), (s: any) => s.instances.body.push(s.instances.body[0])]) {
      const f = fixture(); change(f.service); expect(() => checkAdmissionFence(f.service, f.authority, NOW)).toThrow('admission_instance_scope_unverified');
    }
  });
  it('rejects false shell assertions, live flags, wrong source or compiled artifact', () => {
    for (const change of [(s: any) => s.runtimes[0].flags[ADMISSION_FLAGS[0]] = 'true',
      (s: any) => s.runtimes[0].entrySha256 = 'a'.repeat(64), (s: any) => s.runtimes[0].sourceCommit = 'c'.repeat(40),
      (s: any) => s.runtimes[0].rootInventoryComplete = false, (s: any) => s.runtimes[0].serviceId = 'srv-other',
      (s: any) => s.runtimes[0].opsForwardOnly = 'false', (s: any) => delete s.runtimes[0].opsForwardOnly]) {
      const f = fixture(); change(f.service); expect(() => checkAdmissionFence(f.service, f.authority, NOW)).toThrow('actual_runtime_admission_unverified');
    }
    const f = fixture(); f.service.admissionFlags[ADMISSION_FLAGS[0]].body.value = 'true';
    expect(() => checkAdmissionFence(f.service, f.authority, NOW)).toThrow('service_admission_flag_unverified');
  });
  it('does not relabel stale receipts or runtime observations made before replacement/config readback', () => {
    const f = fixture(); f.service.admissionFlags[ADMISSION_FLAGS[1]].observedAtMs = NOW - 300001;
    expect(() => checkAdmissionFence(f.service, f.authority, NOW)).toThrow('admission_receipt_not_fresh');
    const g = fixture(); g.service.runtimes[0].observedAtMs = NOW - 3;
    expect(() => checkAdmissionFence(g.service, g.authority, NOW)).toThrow('actual_runtime_admission_unverified');
  });
  it('requires the same web instance startup logs and persisted off flag, including complete log receipt', () => {
    for (const change of [(w: any) => w.opsFlag.body.value = '1', (w: any) => w.startupLogs.body.hasMore = true,
      (w: any) => w.startupLogs.body.logs[0].labels[1].value = 'old-web', (w: any) => w.startupLogs.body.logs[0].message = 'claimed off']) {
      const f = fixture(); change(f.web); expect(() => checkWebWriterFence(f.web, NOW)).toThrow();
    }
  });
  it('reads actual child-process env independently of operator env and retains no secret fields', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'incident-runtime-proof-')); mkdirSync(join(directory, 'dist'));
    writeFileSync(join(directory, 'dist/worker.js'), 'process.stdout.write("ready\\n");setInterval(()=>{},1000);');
    const child = spawn(process.execPath, ['dist/worker.js'], { cwd: directory, env: { ...process.env,
      RENDER_SERVICE_ID: ID, RENDER_INSTANCE_ID: 'instance-synthetic', RENDER_GIT_COMMIT: ADMISSION_SOURCE,
      BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED: 'false', BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED: 'false',
      BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER: 'true',
      OPENAI_API_KEY: 'synthetic-secret-never-retained' }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => { child.stdout!.once('data', () => resolve()); child.once('error', reject); });
      const proof = readRuntime(child.pid); expect(proof.flags[ADMISSION_FLAGS[0]]).toBe('false');
      expect(proof.instanceId).toBe('instance-synthetic'); expect(proof.pid).toBe(child.pid);
      expect(proof.opsForwardOnly).toBe('true');
      expect(JSON.stringify(proof)).not.toContain('synthetic-secret-never-retained');
      expect(proof.entrySha256).not.toBe(ADMISSION_ENTRY_SHA256);
    } finally { child.kill(); await new Promise<void>(r => child.once('exit', () => r())); rmSync(directory, { recursive: true }); }
  });
});
