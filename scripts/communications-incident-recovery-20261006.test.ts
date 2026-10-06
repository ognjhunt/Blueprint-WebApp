import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { CommunicationsAgentsAPI } from '../server/agents/communications-api';
import { INCIDENT, ROOT, CONTROL, LAP, sha, QUERIES, STOPPED_SOURCE } from './communications-incident-20261006.mjs';
import { AUDIT, CLEANUP, checkFence, checkEffects, recover, fenceLease, cleanupPhase, archiveFiles, verifyArchive } from './communications-incident-recovery-20261006.mjs';
import { ADMISSION_SOURCE, ADMISSION_ENTRY_SHA256, ADMISSION_FLAGS } from './communications-incident-admission-20261006.mjs';

const NOW = 1791307000000;
const saved = (path: string, value: any) => ({ path, value, sha256: sha(value), updateTime: { seconds: 1, nanoseconds: 2 } });
function fixture() {
  const lap = saved(LAP, { schema_version: 'blueprint.communications-worker-lap.v1', phase: 'active',
    lease: { owner: 'communications-worker-lap:synthetic-owner', generation: 259, until: 1791299565642 },
    startedAt: 1791299385642, renewedAt: 1791299385642, completedAt: null });
  const source = { date: '2026-10-06', state: 'cancelled', session_id: 'sess_synthetic', environment_id: 'env_synthetic',
    metadata: { purpose: 'synthetic-only' }, turn_status: 'cancelled', turn_id: 'turn_synthetic', evidence_digest: 'a'.repeat(64), cleanup_required: true };
  const packet: any = { schema: INCIDENT, project: 'blueprint-8c1ca', observedAtMs: NOW,
    docs: [saved(CONTROL, { lease: { owner: null, generation: 7, expires_at_ms: 0 }, enabled: true, unknownAccounting: 'preserved' }),
      saved(`${ROOT}/draftBudgetState/current`, { activeAdmissionId: 'synthetic-hold' }),
      saved(`${ROOT}/draftBudgetAdmissions/synthetic-hold`, { state: 'usage_unknown', knownTotalIsComplete: false })],
    queries: QUERIES.map(([name]) => ({ name, complete: true, rows: name === 'scanners' ? [lap]
      : name === 'research' ? [saved(`${CONTROL}/runs/2026-10-06`, { state: 'cancelled', blob: STOPPED_SOURCE })] : [] })),
    sources: [{ path: `${CONTROL}/runs/2026-10-06`, blobSha256: STOPPED_SOURCE, value: source }] };
  const provider: any = { schema: 'blueprint.communications-incident-provider-20261006.v1', readOnly: true, observedAtMs: NOW,
    findall: [], sessions: [{ sessionId: 'sess_synthetic', complete: true,
      session: { id: 'sess_synthetic', status: 'idle', metadata: source.metadata, required_actions: [] },
      turns: [{ id: 'turn_synthetic', status: 'cancelled' }], items: [], artifacts: [], environment: { id: 'env_synthetic', status: 'disconnected' } }] };
  const proof: any = { schema: 'blueprint.render-incident-fence.v1', parentThread: '01a0fe81-486b-7714-9e81-983a66bd80c4',
    incident: 'lap259-20261006', observedAtMs: NOW - 1, frozenWriters: ['pipeline-release-owner', 'paused-mac-outreach-owner', 'authenticated-manual-and-cli-writers'],
    services: [{ serviceId: 'srv-synthetic', deployCommit: 'a'.repeat(40), deploy: { commit: { id: 'a'.repeat(40) }, status: 'live' },
      service: { method: 'GET', url: 'https://api.render.com/v1/services/srv-synthetic', status: 200,
        body: { id: 'srv-synthetic', type: 'background_worker', suspended: 'suspended' } },
      instances: { method: 'GET', url: 'https://api.render.com/v1/services/srv-synthetic/instances', status: 200, body: [] } }] };
  const authority: any = { parentThread: proof.parentThread, incident: proof.incident, action: 'reconcile_lap259_with_release_fence',
    actor: 'synthetic-owner', approvalReference: 'synthetic-exact-owner-direction', expectedWorkerServiceIds: ['srv-synthetic'],
    processProofDigest: sha(proof), expectedLapSha256: lap.sha256, expectedSourceFailures: [] };
  const values = new Map<string, any>([...packet.docs, ...packet.queries.flatMap((q: any) => q.rows)].map((r: any) => [r.path, r.value]));
  const writes: any[] = [];
  const snapshot = (path: string) => ({ ref: { path }, exists: values.has(path), data: () => values.get(path), updateTime: { seconds: 1, nanoseconds: 2 } });
  const db: any = { doc: (path: string) => ({ path }), collection: (path: string) => ({ path, where() { return this; }, limit(cap: number) { return { path, cap }; } }),
    runTransaction: async (fn: any) => {
      const staged: any[] = [];
      const result = await fn({ get: async (ref: any) => ref.cap ? { size: [...values.keys()].filter(k => k.startsWith(ref.path + '/') && !k.slice(ref.path.length + 1).includes('/')).length,
        docs: [...values.keys()].filter(k => k.startsWith(ref.path + '/') && !k.slice(ref.path.length + 1).includes('/')).map(snapshot) } : snapshot(ref.path),
      create: (ref: any, value: any) => staged.push({ path: ref.path, value, create: true }),
      set: (ref: any, value: any, opts?: any) => staged.push({ path: ref.path, value, merge: opts?.merge }) });
      staged.forEach(w => { values.set(w.path, w.merge ? { ...values.get(w.path), ...w.value } : w.value); writes.push(w); });
      return result;
    } };
  return { packet, provider, proof, authority, db, values, writes, archive: { synthetic: true }, now: () => NOW };
}
function disabledAdmissionFixture() {
  const f = fixture(), id = 'srv-d9t8gg1t0dsc73am9q70', webId = 'srv-d4vnmk3e5dus73aiohk0';
  const base = `https://api.render.com/v1/services/${id}`, webBase = `https://api.render.com/v1/services/${webId}`;
  const get = (url: string, body: any, at = NOW - 3) => ({ method: 'GET', url, body, status: 200, observedAtMs: at });
  const deploy = { id: 'dep-synthetic', commit: { id: ADMISSION_SOURCE }, status: 'live' };
  f.proof.schema = 'blueprint.render-incident-fence.v2'; f.proof.lane = 'disabled_worker_admission';
  f.proof.services = [{ serviceId: id, deployCommit: ADMISSION_SOURCE, deploy, deployReceipt: get(`${base}/deploys/${deploy.id}`, deploy),
    service: get(base, { id, type: 'background_worker', suspended: 'not_suspended', serviceDetails: { envSpecificDetails: { startCommand: 'npm run start:worker' } } }),
    priorInstances: get(`${base}/instances`, [{ id: 'old', createdAt: new Date(NOW - 20000).toISOString() }], NOW - 10000),
    instances: get(`${base}/instances`, [{ id: 'new', createdAt: new Date(NOW - 1000).toISOString() }]),
    admissionFlags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, get(`${base}/env-vars/${key}`, { key, value: 'false' })])),
    runtimes: [{ schema: 'blueprint.disabled-worker-runtime.v1', observedAtMs: NOW - 2, pid: 7, parentPid: 1, state: 'S', startTicks: '100',
      bootId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', cwd: '/opt/render/project/src', executable: '/opt/node/bin/node',
      entry: '/opt/render/project/src/dist/worker.js', entrySha256: ADMISSION_ENTRY_SHA256, commandSha256: 'b'.repeat(64),
      serviceId: id, instanceId: 'new', sourceCommit: ADMISSION_SOURCE, rootInventoryComplete: true, runtimeRootCount: 1,
      opsForwardOnly: 'true',
      nodeOptions: null,
      bootstrapProtection: { mode: 'disabled', inputs: { NODE_ENV: 'production', VITEST: null,
        BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: 'true', PAPERCLIP_ENV_FILE: null }, paths: [] },
      filesystem: { target: { mountNamespace: 'mnt:[77]', rootDevice: '1', rootInode: '2' },
        collector: { mountNamespace: 'mnt:[77]', rootDevice: '1', rootInode: '2' } },
      flags: Object.fromEntries(ADMISSION_FLAGS.map(key => [key, 'false'])) }] }];
  f.proof.web = { service: get(webBase, { id: webId, type: 'web_service', ownerId: 'owner-synthetic' }),
    deploy, deployReceipt: get(`${webBase}/deploys/${deploy.id}`, deploy),
    opsFlag: get(`${webBase}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB`, { key: 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB', value: '0' }),
    instances: get(`${webBase}/instances`, [{ id: 'web', createdAt: new Date(NOW - 20000).toISOString() }]),
    startupLogs: get(`https://api.render.com/v1/logs?ownerId=owner-synthetic&resource=${webId}`, { hasMore: false, logs: [{
      timestamp: new Date(NOW - 10000).toISOString(), labels: [{ name: 'resource', value: webId }, { name: 'instance', value: 'web' }],
      message: 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service' }] }) };
  f.authority.expectedWorkerServiceIds = [id]; f.authority.expectedPriorWorkerInstanceIds = { [id]: ['old'] };
  f.authority.processProofDigest = sha(f.proof);
  return f;
}
describe('owner-scoped lap259 recovery', () => {
  it('uses pinned v3 namespace pairs and authenticated web absence without blocking unrelated public intake', async () => {
    const f = disabledAdmissionFixture(), service = f.proof.services[0], id = service.serviceId;
    f.proof.schema = 'blueprint.render-incident-fence.v3'; f.proof.lane = 'complete_current_disabled_admission';
    delete service.priorInstances; delete f.authority.expectedPriorWorkerInstanceIds;
    service.baselineRuntime = { ...structuredClone(service.runtimes[0]), instanceId: `${id}-aaaaaaaaaa-ab123`, observedAtMs: NOW - 20000 };
    service.instances.body[0].id = `${id}-cd456`; service.runtimes[0].instanceId = `${id}-bbbbbbbbbb-cd456`;
    f.authority.expectedBaselineRuntimeDigests = { [id]: sha(service.baselineRuntime) };
    f.authority.expectedWorkerInstanceAliases = { [id]: [{ restInstanceId: `${id}-cd456`, nativeInstanceId: `${id}-bbbbbbbbbb-cd456` }] };
    f.proof.web.opsFlag.status = 404; f.proof.web.opsFlag.body = null;
    f.proof.web.startupLogs.body.logs[0].message = JSON.stringify({ service: 'blueprint-webapp', route: 'ops-automation-scheduler',
      msg: 'Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service (set BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1 to opt this process in)' });
    f.authority.processProofDigest = sha(f.proof);
    const publicPath = 'inboundRequests/synthetic-public-request'; f.values.set(publicPath, { state: 'received' });
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).resolves.toMatchObject({ state: 'reconciled_and_release_fenced' });
    expect(f.values.get(AUDIT).authority.expectedWorkerInstanceAliases).toEqual(f.authority.expectedWorkerInstanceAliases);
    expect(f.values.get(publicPath)).toEqual({ state: 'received' }); expect(f.writes).toHaveLength(3);
    f.values.set(publicPath, { state: 'public-intake-continued' });
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).resolves.toMatchObject({ state: 'already_reconciled' });
    expect(f.writes).toHaveLength(3); expect(f.values.get(publicPath)).toEqual({ state: 'public-intake-continued' });
    // Firestore retains serialized receipt bytes, not the caller's object reference.
    f.values.set(AUDIT, structuredClone(f.values.get(AUDIT)));
    service.runtimes[0].instanceId = `${id}-cccccccccc-cd456`;
    f.authority.expectedWorkerInstanceAliases[id][0].nativeInstanceId = service.runtimes[0].instanceId;
    f.authority.processProofDigest = sha(f.proof);
    await expect(fenceLease(f.db, 'release-fence', f.authority, f.proof, f.now)).rejects.toThrow('release_fence_ownership_changed');
    expect(f.writes).toHaveLength(3);
  });
  it('consumes v2 runtime and Web evidence in the actual recovery transaction', async () => {
    const f = disabledAdmissionFixture();
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).resolves.toMatchObject({ state: 'reconciled_and_release_fenced' });
    expect(f.values.get(AUDIT).authority.expectedPriorWorkerInstanceIds).toEqual(f.authority.expectedPriorWorkerInstanceIds);
    expect(f.values.get(`${ROOT}/draftBudgetAdmissions/synthetic-hold`)).toMatchObject({ state: 'usage_unknown' });
    expect(f.writes).toHaveLength(3);
    const missing = disabledAdmissionFixture(); delete missing.proof.web; missing.authority.processProofDigest = sha(missing.proof);
    await expect(recover(missing.db, missing.packet, missing.provider, missing.proof, missing.authority, missing.archive, missing.now)).rejects.toThrow();
    expect(missing.writes).toHaveLength(0);
  });
  it('rejects assembled v2 proof predating receipts and canonical evidence predating its completed fence', async () => {
    const f = disabledAdmissionFixture(); f.proof.observedAtMs = NOW - 4; f.authority.processProofDigest = sha(f.proof);
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).rejects.toThrow('process_fence_observation_incomplete');
    expect(f.writes).toHaveLength(0);
    const old = disabledAdmissionFixture(); old.packet.observedAtMs = NOW - 2;
    await expect(recover(old.db, old.packet, old.provider, old.proof, old.authority, old.archive, old.now)).rejects.toThrow('evidence_predates_process_fence');
    expect(old.writes).toHaveLength(0);
  });
  it('requires stopped actual instances beyond suspended desired state', () => {
    const f = fixture(); f.proof.services[0].instances.body = [{ id: 'synthetic-alive' }]; f.authority.processProofDigest = sha(f.proof);
    expect(() => checkFence(f.proof, f.authority, NOW)).toThrow('process_stopped_instances_unverified');
  });
  it('rejects stale fence, opaque assertion and changed incident', () => {
    const f = fixture(); f.proof.observedAtMs = NOW - 300001; f.authority.processProofDigest = sha(f.proof);
    expect(() => checkFence(f.proof, f.authority, NOW)).toThrow('evidence_not_fresh');
    expect(() => checkFence('process ended', f.authority, NOW)).toThrow();
    f.authority.incident = 'future-lap'; expect(() => checkFence(f.proof, f.authority, NOW)).toThrow('owner_direction_unbound');
  });
  it('atomically preserves accounting and flags while completing the exact lap and acquiring release fence', async () => {
    const f = fixture(); await recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now);
    expect(f.writes.map(w => w.path).sort()).toEqual([AUDIT, LAP, CONTROL].sort());
    expect(f.values.get(LAP)).toMatchObject({ phase: 'complete', lease: { generation: 259, owner: 'communications-worker-lap:synthetic-owner', until: 0 }, recoveryRef: AUDIT });
    expect(f.values.get(CONTROL)).toMatchObject({ enabled: true, unknownAccounting: 'preserved', lease: { generation: 8, expires_at_ms: NOW + 120000 } });
    expect(f.values.get(`${ROOT}/draftBudgetAdmissions/synthetic-hold`)).toEqual({ state: 'usage_unknown', knownTotalIsComplete: false });
    expect(f.values.get(AUDIT)).toMatchObject({ accountingReconciled: false, sendsAuthorized: false, paidAdmissionAuthorized: false });
  });
  it.each([null, []])('retains parent-pinned source failure with absent evidence %j in actual recovery', async evidence => {
    const f = fixture();
    const failure = saved(`${ROOT}/refreshRequests/synthetic-source-failure`, {
      state: 'unresolved', kind: 'research_owner_refresh', reason: 'source_refresh_unavailable',
      reasons: ['communications_intake_accepted_candidates_missing_or_overflow'],
      leaseUntil: 0, sendsAuthorized: false, observerReceiptRequired: false, evidence,
    });
    f.packet.queries.find((q: any) => q.name === 'refresh').rows = [failure];
    f.authority.expectedSourceFailures = [{ path: failure.path, sha256: failure.sha256 }];
    f.values.set(failure.path, structuredClone(failure.value));
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now))
      .resolves.toMatchObject({ state: 'reconciled_and_release_fenced' });
    expect(f.values.get(failure.path)).toEqual(failure.value);
    expect(f.writes.map(w => w.path).sort()).toEqual([AUDIT, LAP, CONTROL].sort());
    for (const invalid of [undefined, {}, false, '', ['unknown-evidence']]) {
      const changed = saved(failure.path, { ...failure.value, evidence: invalid });
      f.packet.queries.find((q: any) => q.name === 'refresh').rows = [changed];
      f.authority.expectedSourceFailures = [{ path: changed.path, sha256: changed.sha256 }];
      expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('refresh_outcome_unmapped');
    }
    f.packet.queries.find((q: any) => q.name === 'refresh').rows = [failure];
    f.authority.expectedSourceFailures = [];
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('source_failure_scope_changed');
  });
  it('replay reads matching audit without writing and protects a successor', async () => {
    const f = fixture(); await recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now);
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).resolves.toMatchObject({ state: 'already_reconciled' });
    expect(f.writes).toHaveLength(3);
    f.values.set(LAP, { ...f.values.get(LAP), lease: { ...f.values.get(LAP).lease, generation: 260 } });
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).rejects.toThrow('recovery_successor_changed');
  });
  it('rejects changed effect-bearing record and newly inserted effects before mutation', async () => {
    const f = fixture(); f.values.set(`${ROOT}/draftBudgetAdmissions/synthetic-hold`, { state: 'resolved' });
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).rejects.toThrow('canonical_evidence_changed');
    expect(f.writes).toHaveLength(0);
    const next = fixture(); next.values.set(`${ROOT}/jobs/new`, { state: 'running' });
    await expect(recover(next.db, next.packet, next.provider, next.proof, next.authority, next.archive, next.now)).rejects.toThrow('canonical_evidence_changed');
  });
  it('refuses foreign live ordinary/release leases', async () => {
    const f = fixture(); const control = f.packet.docs[0]; control.value.lease = { owner: 'ordinary-owner', generation: 7, expires_at_ms: NOW + 1 }; control.sha256 = sha(control.value);
    await expect(recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now)).rejects.toThrow('foreign_research_lease_held'); expect(f.writes).toHaveLength(0);
  });
  it('requires paired environment404 instead of inferring cleanup from session404', () => {
    const f = fixture(); f.provider.sessions[0] = { sessionId: 'sess_synthetic', absent: true, statusCode: 404 };
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('provider_environment_absence_unverified');
    f.provider.sessions[0].environments = [{ environmentId: 'env_synthetic', absent: true, statusCode: 404 }];
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).not.toThrow();
  });
  it('requires exact per-session turn inventory and rejects active, child or unknown work', () => {
    const f = fixture(); f.provider.sessions[0].turns.push({ id: 'turn_other_session', status: 'completed' });
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('provider_child_or_turn_unmapped');
    f.provider.sessions[0].turns = [{ id: 'turn_synthetic', status: 'in_progress' }];
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('provider_child_or_turn_unmapped');
  });
  it('pins source and requires complete fresh child status coverage', () => {
    const f = fixture(); f.packet.sources[0].blobSha256 = 'b'.repeat(64);
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('stopped_oct6_source_changed');
    f.packet.sources[0].blobSha256 = STOPPED_SOURCE;
    f.packet.sources[0].value.parallel_findall_submissions = { child: { findall_id: 'findall_synthetic' } };
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).toThrow('findall_execution_unverified');
    f.provider.findall = [{ findallId: 'findall_synthetic', receipt: { findall_id: 'findall_synthetic', status: { is_active: false } } }];
    expect(() => checkEffects(f.packet, f.provider, f.authority, NOW)).not.toThrow();
  });
  it('scope of stopped cleanup cannot renew/release recovery fence', async () => {
    const f = fixture(); f.authority.action = 'archive_verify_delete_stopped_oct6';
    await expect(fenceLease(f.db, 'release-fence', f.authority, f.proof, f.now)).rejects.toThrow('wrong_action_scope');
  });
  it('retained-create verification shares runtime validator without a network request', () => {
    let calls = 0; const api = new CommunicationsAgentsAPI({ allowPaidInference: false, fetch: async () => { calls++; throw Error('unexpected'); } });
    expect(() => api.verifyRetainedRecoveryEvidence({ sessionId: null, turnId: null, createClaimedAt: null }, 'synthetic')).toThrow('communications_rejected_create_binding_invalid');
    expect(calls).toBe(0);
  });
  it('archive bytes and generations are verified before any claim', async () => {
    const objects = new Map<string, Buffer>();
    const bucket: any = { name: 'blueprint-8c1ca.appspot.com', file: (name: string) => ({ name,
      save: async (bytes: Buffer, opts: any) => { expect(opts.preconditionOpts.ifGenerationMatch).toBe(0); objects.set(name, bytes); },
      getMetadata: async () => [{ generation: '7', size: objects.get(name)!.length }],
      download: async () => [objects.get(name)] }) };
    const archive = await archiveFiles(bucket, { 'source-row.json': Buffer.from('synthetic complete evidence') });
    await expect(verifyArchive(bucket, archive)).resolves.toBeUndefined();
    objects.set(archive.objects[0].name, Buffer.from('corrupted'));
    await expect(verifyArchive(bucket, archive)).rejects.toThrow('archive_readback_mismatch');
  });
  it('archived cleanup claims DELETE once, lost ACK becomes observe-only and successor cannot release fence', async () => {
    const f = fixture();
    await recover(f.db, f.packet, f.provider, f.proof, f.authority, f.archive, f.now);
    await fenceLease(f.db, 'release-fence', f.authority, f.proof, f.now);
    f.packet.docs[0] = saved(CONTROL, f.values.get(CONTROL));
    f.packet.queries.find((q: any) => q.name === 'scanners').rows = [saved(LAP, f.values.get(LAP))];
    const target = { sourceBlobSha256: STOPPED_SOURCE, sessionId: 'sess_synthetic', environmentId: 'env_synthetic' };
    const authority = { ...f.authority, action: 'archive_verify_delete_stopped_oct6', expectedLapSha256: sha(f.values.get(LAP)), stoppedTargetDigest: sha(target) };
    const readback = { targetDigest: sha(target), sourceBlobSha256: STOPPED_SOURCE, observedAtMs: NOW, files: [] };
    await cleanupPhase(f.db, 'cleanup-archive', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now);
    const claim = await cleanupPhase(f.db, 'cleanup-submit', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now);
    expect(claim.submitDelete).toBe(true);
    expect(f.values.get(CLEANUP)).toMatchObject({ state: 'delete_submitted', standingAuthority: false, accountingReconciled: false });
    const replay = await cleanupPhase(f.db, 'cleanup-submit', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now);
    expect(replay).toMatchObject({ submitDelete: false, state: 'delete_already_claimed_observe_only' });
    await cleanupPhase(f.db, 'release-cleanup-fence', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now);
    const successor = { owner: 'ordinary-native-receipt-owner', generation: 10, expires_at_ms: NOW + 200 };
    f.values.set(CONTROL, { ...f.values.get(CONTROL), lease: successor });
    const before = f.writes.length;
    await expect(cleanupPhase(f.db, 'release-cleanup-fence', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now))
      .resolves.toMatchObject({ state: 'cleanup_fence_already_released', submitDelete: false });
    expect(f.writes).toHaveLength(before); expect(f.values.get(CONTROL).lease).toEqual(successor);
    f.values.set(LAP, { ...f.values.get(LAP), lease: { ...f.values.get(LAP).lease, generation: 260 } });
    await expect(cleanupPhase(f.db, 'release-cleanup-fence', f.packet, f.provider, f.proof, authority, f.archive, readback, f.now)).rejects.toThrow('cleanup_source_or_lap_changed');
  });
  it('cleanup export, late active item, stable journal and unchanged native record-cleanup are exercised offline', () => {
    const script = String.raw`
import ast, importlib.util, json, pathlib, sys, tarfile, tempfile, types, unittest
from contextlib import contextmanager
spec=importlib.util.spec_from_file_location('cleanup',pathlib.Path('scripts/communications-incident-cleanup-20261006.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Absent(Exception):status_code=404
class API:
 def __init__(self):self.active=False;self.absent=False;self.calls=[]
 def get(self,kind,id):
  self.calls.append((kind,id))
  if self.absent:raise Absent()
  return {'id':id,'status':'idle','metadata':{},'required_actions':[]}
 def listing(self,kind,id):
  if kind=='turns':return [{'id':'turn_synthetic','status':'cancelled'}]
  if kind=='items':return [{'type':'function_call','status':'in_progress' if self.active else 'completed','turn_id':'turn_synthetic'}]
  return []
class Bridge:
 def __init__(self):self.row={'date':m.DAY,'state':'cancelled','turn_status':'cancelled','turn_id':'turn_synthetic','session_id':'sess_synthetic','environment_id':'env_synthetic','metadata':{},'evidence_digest':'a'*64,'cleanup_required':True,'cost_status':'unknown_pending_billing_reconciliation'};self.writes=[]
 def call(self,op,**kwargs):
  if op=='get':return self.row
  if op=='control':return {}
  if op=='put':self.row=kwargs['row'];self.writes.append(op);return self.row
  return {}
class Ledger:
 def __init__(self,bridge):self.bridge=bridge
 @contextmanager
 def lock(self):yield
 def get(self,day):return self.bridge.call('get',day=day)
 def put(self,row):return self.bridge.call('put',row=row)
def export_snapshot(bridge,day,destination):
 destination.mkdir(mode=0o700,exist_ok=False);(destination/'status.json').write_text(json.dumps(bridge.row));return {'missing_files':['artifact','output','review']}
fake_render=types.ModuleType('tools.daily_research.render');fake_render.export_snapshot=export_snapshot
sys.modules['tools.daily_research.render']=fake_render
fake_store=types.ModuleType('tools.daily_research.firestore');fake_store.FirestoreLedger=Ledger;fake_store.control_configuration=lambda x:{};sys.modules['tools.daily_research.firestore']=fake_store
# Execute the actual retained native record_cleanup AST, not a reimplementation.
with tarfile.open('vendor/daily-research/blueprint-research.tar') as package:tree=ast.parse(package.extractfile('tools/daily_research/runner.py').read())
cls=next(x for x in tree.body if isinstance(x,ast.ClassDef) and x.name=='Runner');method=next(x for x in cls.body if isinstance(x,ast.FunctionDef) and x.name=='record_cleanup')
native=ast.ClassDef(name='Runner',bases=[],keywords=[],body=[method],decorator_list=[]);module=ast.fix_missing_locations(ast.Module(body=[native],type_ignores=[]))
space={'TERMINAL':{'completed','failed','cancelled'},'Refusal':ValueError,'digest':m.digest,'hashlib':__import__('hashlib'),'json':json};exec(compile(module,'native-retained-record-cleanup','exec'),space)
Runner=space['Runner']
def init(self,ledger,cfg,api):self.ledger=ledger;self.api=api
Runner.__init__=init
fake_runner=types.ModuleType('tools.daily_research.runner');fake_runner.Runner=Runner;sys.modules['tools.daily_research.runner']=fake_runner
class Tests(unittest.TestCase):
 def test_export_directory_owned_by_native(self):
  with tempfile.TemporaryDirectory() as tmp:
   b=Bridge();api=API();old=m.source;m.source=lambda bridge:(bridge.row,b'original synthetic source')
   try:self.assertEqual(m.inspect(api,b,pathlib.Path(tmp))['state'],'export_retained_locally');self.assertTrue((pathlib.Path(tmp)/'export'/'source-row.json').is_file())
   finally:m.source=old
 def test_late_active_or_unknown_item(self):
  api=API();api.active=True
  with self.assertRaisesRegex(ValueError,'inventory_changed'):m.terminal_inventory(api,Bridge().row)
 def test_journal_before_release_and_actual_native_record(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=pathlib.Path(tmp);b=Bridge();api=API();api.absent=True;target=m.target(b.row);(d/'cleanup-readback.json').write_text(json.dumps({'targetDigest':m.digest(target)}));ops=[];old=m.operator;m.operator=lambda mode,path:ops.append(mode) or {'ok':True}
   try:
    with self.assertRaises(FileNotFoundError):m.observe(api,b,d)
    self.assertEqual(ops,[]);self.assertTrue(b.row['cleanup_required'])
    journal={'schema':'blueprint.stopped-oct6-cleanup-journal-readback.v1','journalRef':'blueprintDailyResearch/sites-first/incidentCleanup/2026-10-06','targetDigest':m.digest(target),'archive':{'objects':[{'name':'synthetic','generation':'7','sha256':'a'*64}]}}
    (d/'cleanup-journal.json').write_text(json.dumps(journal));(d/'authority.json').write_text(json.dumps({'approvalReference':'synthetic-exact-owner-direction'}))
    result=m.observe(api,b,d);self.assertEqual(result['state'],'exact_stopped_cleanup_recorded');self.assertFalse(b.row['cleanup_required']);self.assertFalse(b.row['billing_stop_verified']);self.assertEqual(b.row['cost_status'],'unknown_pending_billing_reconciliation');self.assertEqual(b.writes,['put']);self.assertEqual(ops,['release-cleanup-fence'])
    again=m.observe(api,b,d);self.assertEqual(again['state'],'exact_stopped_cleanup_already_recorded');self.assertEqual(b.writes,['put'])
   finally:m.operator=old
unittest.main()
`;
    expect(() => execFileSync('python3', ['-B', '-c', script], { cwd: process.cwd(), stdio: 'pipe' })).not.toThrow();
  });
});
