/** Explicit owner incident operation. No worker import, automatic recovery or future authority. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, CONTROL, LAP, INCIDENT, STOPPED_SOURCE, canonical, sha, refuse, row,
  inventory, existingAdmin, privateWrite } from './communications-incident-20261006.mjs';
import { checkAdmissionFence, checkCurrentAdmissionFence, checkWebWriterFence } from './communications-incident-admission-20261006.mjs';
import { successfulRead } from './communications-incident-mcp-20261006.mjs';

export const RECOVERY = 'blueprint.communications-lap259-recovery.v1';
export const AUDIT = `${ROOT}/incidentRecoveries/lap259-20261006`;
export const CLEANUP = `${CONTROL}/incidentCleanup/2026-10-06`;
const PARENT = '01a0fe81-486b-7714-9e81-983a66bd80c4';
const MAX_AGE_MS = 300_000, HOLD_MS = 120_000;
const terminal = value => ['completed', 'failed', 'cancelled'].includes(value);
function authorityScope(a) {
  return { parentThread: a.parentThread, incident: a.incident, action: a.action, actor: a.actor,
    approvalReference: a.approvalReference, expectedWorkerServiceIds: a.expectedWorkerServiceIds,
    expectedLapSha256: a.expectedLapSha256, expectedSourceFailures: a.expectedSourceFailures,
    expectedPriorWorkerInstanceIds: a.expectedPriorWorkerInstanceIds ?? null,
    ...(a.expectedWorkerInstanceAliases !== undefined ? { expectedWorkerInstanceAliases: a.expectedWorkerInstanceAliases } : {}),
    ...(a.expectedWebCommit !== undefined ? { expectedWebCommit: a.expectedWebCommit } : {}),
    ...(a.expectedWebSourcePolicyDigest !== undefined ? { expectedWebSourcePolicyDigest: a.expectedWebSourcePolicyDigest } : {}),
    // Fresh per-proof MCP digests rotate like the existing file/proof digests;
    // exact authenticated operation/workspace/resource scope remains durable.
    ...(a.expectedMcpReadScope !== undefined ? { expectedMcpReadScope: a.expectedMcpReadScope } : {}),
    expectedBaselineRuntimeDigests: a.expectedBaselineRuntimeDigests ?? null };
}
export function fresh(at, now) {
  if (!Number.isSafeInteger(at) || at > now + 5_000 || now - at > MAX_AGE_MS) refuse('evidence_not_fresh');
}
export function refs(value, names, found = new Set()) {
  if (Array.isArray(value)) value.forEach(child => refs(child, names, found));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (names.includes(key) && typeof child === 'string' && child) found.add(child);
    refs(child, names, found);
  }
  return found;
}
function saved(packet, name) {
  const q = packet.queries?.find(q => q.name === name);
  if (!q || q.complete !== true || !Array.isArray(q.rows)) refuse('canonical_inventory_incomplete');
  return q.rows;
}
export function checkFence(proof, authority, now) {
  if (authority.parentThread !== PARENT || authority.incident !== 'lap259-20261006'
    || !['reconcile_lap259_with_release_fence', 'archive_verify_delete_stopped_oct6'].includes(authority.action)
    || typeof authority.actor !== 'string' || authority.actor.length < 3
    || !authority.approvalReference || sha(proof) !== authority.processProofDigest) refuse('owner_direction_unbound');
  if (!['blueprint.render-incident-fence.v1', 'blueprint.render-incident-fence.v2', 'blueprint.render-incident-fence.v3'].includes(proof.schema) || proof.parentThread !== PARENT
    || proof.incident !== authority.incident || !Array.isArray(proof.services) || proof.services.length < 1
    || !Array.isArray(proof.frozenWriters) || !proof.frozenWriters.includes('pipeline-release-owner')
    || !proof.frozenWriters.includes('paused-mac-outreach-owner')) refuse('process_fence_scope_incomplete');
  fresh(proof.observedAtMs, now);
  if (!Array.isArray(authority.expectedWorkerServiceIds) || !authority.expectedWorkerServiceIds.length
    || canonical(proof.services.map(s => s.serviceId).sort()) !== canonical([...authority.expectedWorkerServiceIds].sort())) refuse('process_service_scope_changed');
  for (const service of proof.services) {
    const base = `https://api.render.com/v1/services/${service.serviceId}`;
    if (!/^srv-[a-zA-Z0-9]+$/.test(service.serviceId) || !/^[a-f0-9]{40}$/.test(service.deployCommit ?? '')
      || service.service?.method !== 'GET' || service.service.url !== base || !successfulRead(service.service, authority, now)
      || service.service.body?.id !== service.serviceId || service.service.body?.type !== 'background_worker'
      || service.instances?.method !== 'GET' || service.instances.url !== `${base}/instances`
      || service.instances.status !== 200 || !Array.isArray(service.instances.body)
      || service.deploy?.commit?.id !== service.deployCommit || service.deploy?.status !== 'live') refuse('process_stopped_instances_unverified');
    if (proof.schema !== 'blueprint.render-incident-fence.v1') {
      const currentOnly = proof.schema === 'blueprint.render-incident-fence.v3';
      if (proof.lane !== (currentOnly ? 'complete_current_disabled_admission' : 'disabled_worker_admission')) refuse('process_fence_lane_unknown');
      (currentOnly ? checkCurrentAdmissionFence : checkAdmissionFence)(service, authority, now);
    } else if (service.service.body.suspended !== 'suspended' || service.instances.body.length !== 0) refuse('process_stopped_instances_unverified');
  }
  // This source serves HTTP in index.ts; communications/research loops are in
  // worker.ts. Parent also fences authenticated manual/CLI writers during CAS.
  if (!proof.frozenWriters.includes('authenticated-manual-and-cli-writers')) refuse('manual_writer_fence_missing');
  if (proof.schema !== 'blueprint.render-incident-fence.v1') {
    checkWebWriterFence(proof.web, now, authority);
    const observations = proof.services.flatMap(s => [s.service, s.instances, s.deployReceipt,
      ...Object.values(s.admissionFlags), ...s.runtimes]);
    observations.push(proof.web.service, proof.web.instances, proof.web.deployReceipt, proof.web.opsFlag, proof.web.startupLogs);
    if (observations.some(receipt => receipt.observedAtMs > proof.observedAtMs)) refuse('process_fence_observation_incomplete');
  }
}
export function checkEffects(packet, provider, authority, now, recovered = false, verifyRetainedRecovery) {
  if (packet.schema !== INCIDENT || packet.project !== 'blueprint-8c1ca') refuse('canonical_binding_invalid');
  fresh(packet.observedAtMs, now); fresh(provider.observedAtMs, now);
  if (provider.schema !== 'blueprint.communications-incident-provider-20261006.v1' || provider.readOnly !== true
    || !Array.isArray(provider.sessions)) refuse('provider_packet_invalid');
  for (const record of [...packet.docs, ...packet.queries.flatMap(q => q.rows)]) {
    if (record.sha256 !== sha(record.value)) refuse('canonical_record_digest_invalid');
  }
  const lap = saved(packet, 'scanners').find(r => r.path === LAP);
  if (!lap || lap.sha256 !== authority.expectedLapSha256 || lap.value.schema_version !== 'blueprint.communications-worker-lap.v1'
    || lap.value.phase !== (recovered ? 'complete' : 'active') || lap.value.lease?.generation !== 259 || lap.value.startedAt !== 1791299385642
    || lap.value.renewedAt !== 1791299385642 || (recovered ? lap.value.lease.until !== 0 || !Number.isSafeInteger(lap.value.completedAt)
      || lap.value.recoveryRef !== AUDIT : lap.value.lease.until !== 1791299565642 || lap.value.completedAt !== null)
    || !/^communications-worker-lap:[a-zA-Z0-9-]{1,80}$/.test(lap.value.lease.owner)) refuse('incident_lap_identity_changed');
  for (const name of ['draftWriters', 'sendWriters']) if (saved(packet, name).length) refuse('external_writer_unsettled');
  for (const record of saved(packet, 'scanners').filter(r => r.path !== LAP)) {
    if ((record.value.lease?.until ?? 0) > now) refuse('scanner_active');
  }
  for (const record of saved(packet, 'jobs')) {
    const v = record.value;
    if (!['pending_approval', 'completed', 'cancelled', 'failed', 'discarded'].includes(v.state) || (v.lease?.until ?? 0) > now) refuse('job_unsettled');
    const c = v.checkpoint;
    if (c?.createClaimedAt && !c.sessionId) {
      if (!verifyRetainedRecovery || !c.rejectedCreateRecovery?.checkpoint?.sessionId) refuse('create_outcome_unmapped');
      verifyRetainedRecovery(c, v.jobId);
    }
  }
  const sourceFailures = [];
  for (const record of saved(packet, 'refresh')) {
    const v = record.value;
    if ((v.leaseUntil ?? v.lease?.until ?? 0) > now) refuse('refresh_active');
    if (['resolved', 'terminal'].includes(v.state)) continue;
    if (v.state !== 'unresolved' || v.kind !== 'research_owner_refresh' || v.reason !== 'source_refresh_unavailable'
      || canonical(v.reasons) !== canonical(['communications_intake_accepted_candidates_missing_or_overflow'])
      || v.leaseUntil !== 0 || v.sendsAuthorized !== false || v.observerReceiptRequired !== false
      // Retain the original null/empty-array absence representation. The exact
      // parent-pinned row digest still rejects changed or nonempty evidence.
      || (v.evidence !== null && (!Array.isArray(v.evidence) || v.evidence.length !== 0))) refuse('refresh_outcome_unmapped');
    if (refs(v, ['jobId', 'sessionId', 'session_id', 'environment_id', 'createClaimedAt']).size) refuse('refresh_effect_unmapped');
    sourceFailures.push({ path: record.path, sha256: record.sha256 });
  }
  if (canonical(sourceFailures) !== canonical(authority.expectedSourceFailures)) refuse('source_failure_scope_changed');
  for (const record of saved(packet, 'workItems')) if (record.value.stage !== 'completed') refuse('research_work_item_active');
  for (const record of saved(packet, 'research')) if (!terminal(record.value.state)) refuse('research_active');
  const ids = [...refs(packet, ['sessionId', 'session_id'])].sort();
  if (!ids.length || canonical(provider.sessions.map(s => s.sessionId).sort()) !== canonical(ids)) refuse('provider_session_scope_incomplete');
  const stopped = packet.sources?.find(s => s.path === `${CONTROL}/runs/2026-10-06`);
  if (stopped?.blobSha256 !== STOPPED_SOURCE || stopped.value.state !== 'cancelled'
    || stopped.value.turn_status !== 'cancelled' || !stopped.value.session_id || !stopped.value.environment_id
    || !stopped.value.evidence_digest) refuse('stopped_oct6_source_changed');
  const expected = new Map();
  const addTurns = (session, values) => {
    if (!session) return;
    const found = expected.get(session) ?? new Set();
    for (const id of values) if (typeof id === 'string' && id) found.add(id);
    expected.set(session, found);
  };
  for (const { value: source } of packet.sources) {
    addTurns(source.session_id, [source.turn_id, source.qa?.turn_id, source.publication?.turn_id,
      ...(source.validation_repairs ?? []).map(r => r.turn_id),
      ...(source.qa?.corrections ?? []).flatMap(r => [r.turn_id, r.previous_review?.turn_id])]);
  }
  for (const { value: job } of saved(packet, 'jobs')) {
    for (const c of [job.checkpoint, job.checkpoint?.rejectedCreateRecovery?.checkpoint, job.cancelledContinuation?.checkpoint]) {
      if (c?.sessionId) addTurns(c.sessionId, refs(c, ['turnId', 'initialTurnId']));
    }
  }
  for (const remote of provider.sessions) {
    if (!expected.has(remote.sessionId)) refuse('provider_session_unmapped');
    if (remote.absent === true && remote.statusCode === 404) {
      const environmentIds = packet.sources.filter(s => s.value.session_id === remote.sessionId).map(s => s.value.environment_id).filter(Boolean);
      if (!environmentIds.length || !Array.isArray(remote.environments)
        || canonical(remote.environments.map(e => e.environmentId).sort()) !== canonical([...new Set(environmentIds)].sort())
        || remote.environments.some(e => e.absent !== true || e.statusCode !== 404)) refuse('provider_environment_absence_unverified');
      continue;
    }
    const session = remote.session;
    if (remote.complete !== true || session?.id !== remote.sessionId || session.status !== 'idle'
      || session.required_actions?.length || !Array.isArray(remote.turns) || !Array.isArray(remote.items)
      || !Array.isArray(remote.artifacts) || !remote.turns.length) refuse('provider_execution_not_terminal');
    const turns = new Set(remote.turns.map(t => t.id));
    if (turns.size !== remote.turns.length || canonical([...turns].sort()) !== canonical([...expected.get(remote.sessionId)].sort())
      || remote.turns.some(t => !terminal(t.status) || t.subagent_id)
      || remote.items.some(item => item.turn_id && !turns.has(item.turn_id)
        || (item.status !== undefined && !terminal(item.status)) || item.subagent_id
        || (item.status === undefined && !['message', 'function_call', 'function_call_output', 'mcp_call', 'mcp_list_tools', 'reasoning'].includes(item.type)))
      || remote.artifacts.some(a => !a.id || a.turn_id && !turns.has(a.turn_id))) refuse('provider_child_or_turn_unmapped');
    const children = refs(remote, ['sessionId', 'session_id', 'child_session_id', 'subsession_id']);
    if ([...children].some(id => !ids.includes(id))) refuse('provider_child_session_unmapped');
    const source = packet.sources.find(s => s.value.session_id === remote.sessionId)?.value;
    if (source && (canonical(session.metadata) !== canonical(source.metadata)
      || remote.environment?.id !== source.environment_id)) refuse('provider_research_binding_changed');
    for (const record of saved(packet, 'jobs')) {
      const checkpoints = [record.value.checkpoint, record.value.checkpoint?.rejectedCreateRecovery?.checkpoint, record.value.cancelledContinuation?.checkpoint];
      for (const c of checkpoints.filter(c => c?.sessionId === remote.sessionId)) {
        if (session.metadata?.blueprint_communications_job !== record.value.jobId
          || session.metadata?.blueprint_communications_request_digest !== c.requestDigest) refuse('provider_communications_binding_changed');
      }
    }
  }
  const childIds = [];
  for (const { value: source } of packet.sources) {
    for (const child of Object.values(source.parallel_findall_submissions ?? {})) {
      if (!child.findall_id) refuse('child_create_outcome_unmapped');
      childIds.push(child.findall_id);
    }
  }
  if (!Array.isArray(provider.findall) || canonical(provider.findall.map(c => c.findallId).sort()) !== canonical([...new Set(childIds)].sort())
    || provider.findall.some(c => c.absent === true ? c.statusCode !== 404
      : c.receipt?.findall_id !== c.findallId || c.receipt?.status?.is_active !== false)) refuse('findall_execution_unverified');
  return lap;
}
export async function archiveFiles(bucket, files) {
  const binding = sha(Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha(bytes)])));
  const prefix = `operations/communications/incident-20261006/${binding}`;
  const objects = [];
  for (const [name, bytes] of Object.entries(files)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || bytes.length > 20_000_000) refuse('archive_file_invalid');
    const object = bucket.file(`${prefix}/${name}`);
    try { await object.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'application/octet-stream' } }); }
    catch (error) { if (![409, 412].includes(error.code)) throw error; }
    const [metadata] = await object.getMetadata();
    const [retained] = await bucket.file(object.name, { generation: metadata.generation }).download();
    if (sha(retained) !== sha(bytes) || retained.length !== bytes.length || Number(metadata.size) !== bytes.length
      || !/^[0-9]+$/.test(String(metadata.generation))) refuse('archive_readback_mismatch');
    objects.push({ name: object.name, generation: String(metadata.generation), bytes: bytes.length, sha256: sha(bytes) });
  }
  return { schema: 'blueprint.incident-portable-archive.v1', bucket: bucket.name, bindingDigest: binding, objects };
}
export async function verifyArchive(bucket, archive) {
  if (archive.bucket !== 'blueprint-8c1ca.appspot.com' || bucket.name !== archive.bucket || !archive.objects?.length) refuse('archive_binding_invalid');
  for (const object of archive.objects) {
    if (!object.name.startsWith(`operations/communications/incident-20261006/${archive.bindingDigest}/`) || !/^[0-9]+$/.test(object.generation)) refuse('archive_object_invalid');
    const file = bucket.file(object.name, { generation: object.generation });
    const [metadata] = await file.getMetadata(), [bytes] = await file.download();
    if (String(metadata.generation) !== object.generation || Number(metadata.size) !== object.bytes
      || sha(bytes) !== object.sha256 || bytes.length !== object.bytes) refuse('archive_readback_mismatch');
  }
}
export async function recover(db, packet, provider, proof, authority, archive, now = Date.now, verifyRetainedRecovery) {
  const at = now(); checkFence(proof, authority, at);
  if (authority.action !== 'reconcile_lap259_with_release_fence') refuse('wrong_action_scope');
  const original = checkEffects(packet, provider, authority, at, false, verifyRetainedRecovery);
  if (packet.observedAtMs < proof.observedAtMs || provider.observedAtMs < proof.observedAtMs) refuse('evidence_predates_process_fence');
  const owner = `research-release:incident-20261006-${sha(authority).slice(0, 16)}`;
  return db.runTransaction(async tx => {
    const audit = await tx.get(db.doc(AUDIT)), current = row(await tx.get(db.doc(LAP)));
    const control = await tx.get(db.doc(CONTROL));
    if (audit.exists) {
      if (audit.data().originalLapSha256 !== original.sha256 || current.value?.phase !== 'complete'
        || current.value.recoveryRef !== AUDIT || current.value.lease.owner !== original.value.lease.owner
        || current.value.lease.generation !== 259 || current.value.lease.until !== 0
        || current.value.startedAt !== original.value.startedAt || current.value.renewedAt !== original.value.renewedAt
        || current.value.completedAt !== audit.data().atMs) refuse('recovery_successor_changed');
      return { state: 'already_reconciled', auditRef: AUDIT, lease: control.data()?.lease };
    }
    const currentPacket = await inventory(db, tx);
    if (canonical(currentPacket) !== canonical({ docs: packet.docs, queries: packet.queries })) refuse('canonical_evidence_changed');
    const lease = control.data()?.lease;
    if (!lease || !Number.isSafeInteger(lease.generation) || !Number.isSafeInteger(lease.expires_at_ms)
      || lease.expires_at_ms > now()) refuse('foreign_research_lease_held');
    fresh(proof.observedAtMs, now()); fresh(provider.observedAtMs, now());
    const next = { owner, generation: lease.generation + 1, expires_at_ms: now() + HOLD_MS };
    const receipt = { schema: RECOVERY, disposition: 'operator_reconciled_after_process_fence', originalLap: original,
      originalLapSha256: original.sha256, actor: authority.actor, authority, archive,
      canonicalDigest: sha(packet), providerDigest: sha(provider), processProofDigest: sha(proof), atMs: now(), releaseFence: next,
      accountingReconciled: false, sendsAuthorized: false, paidAdmissionAuthorized: false };
    tx.create(db.doc(AUDIT), receipt);
    tx.set(db.doc(LAP), { ...current.value, phase: 'complete', lease: { ...current.value.lease, until: 0 }, completedAt: receipt.atMs, recoveryRef: AUDIT });
    tx.set(db.doc(CONTROL), { lease: next }, { merge: true });
    return { state: 'reconciled_and_release_fenced', auditRef: AUDIT, lease: next };
  });
}
export async function fenceLease(db, mode, authority, proof, now = Date.now) {
  checkFence(proof, authority, now());
  if (authority.action !== 'reconcile_lap259_with_release_fence') refuse('wrong_action_scope');
  return db.runTransaction(async tx => {
    const audit = await tx.get(db.doc(AUDIT)), control = await tx.get(db.doc(CONTROL)), lap = await tx.get(db.doc(LAP));
    const expected = audit.data()?.releaseFence, lease = control.data()?.lease;
    if (!expected || sha(authorityScope(audit.data().authority)) !== sha(authorityScope(authority))
      || lease?.owner !== expected.owner || lease.generation !== expected.generation
      || lap.data()?.recoveryRef !== AUDIT || lap.data()?.phase !== 'complete'
      || lap.data()?.lease?.owner !== audit.data().originalLap.value.lease.owner || lap.data()?.lease?.generation !== 259
      || lap.data()?.lease?.until !== 0 || lap.data()?.completedAt !== audit.data().atMs) refuse('release_fence_ownership_changed');
    if (!['renew-fence', 'release-fence'].includes(mode)) refuse('fence_mode_invalid');
    if (mode === 'renew-fence' && lease.expires_at_ms <= now()) refuse('release_fence_expired');
    const next = { ...lease, expires_at_ms: mode === 'renew-fence' ? now() + HOLD_MS : 0 };
    tx.set(db.doc(CONTROL), { lease: next }, { merge: true });
    return { state: mode, lease: next, workerResumeAuthorized: false };
  });
}
export async function cleanupPhase(db, mode, packet, provider, proof, authority, archive, cleanupReadback, now = Date.now, verifier) {
  checkFence(proof, authority, now());
  if (authority.action !== 'archive_verify_delete_stopped_oct6') refuse('wrong_action_scope');
  if (!['cleanup-archive', 'cleanup-submit', 'release-cleanup-fence'].includes(mode)) refuse('cleanup_mode_invalid');
  const source = packet.sources.find(s => s.path === `${CONTROL}/runs/2026-10-06`);
  if (source?.blobSha256 !== STOPPED_SOURCE || source.value.state !== 'cancelled' || source.value.turn_status !== 'cancelled'
    || source.value.qa || source.value.publication || !source.value.evidence_digest || !source.value.cleanup_required) refuse('stopped_oct6_source_changed');
  const target = { sourceBlobSha256: STOPPED_SOURCE, sessionId: source.value.session_id, environmentId: source.value.environment_id };
  if (sha(target) !== authority.stoppedTargetDigest || cleanupReadback?.targetDigest !== sha(target)
    || cleanupReadback.sourceBlobSha256 !== STOPPED_SOURCE || !Array.isArray(cleanupReadback.files)) refuse('cleanup_target_unbound');
  if (mode !== 'release-cleanup-fence') fresh(cleanupReadback.observedAtMs, now());
  return db.runTransaction(async tx => {
    const journal = await tx.get(db.doc(CLEANUP)), current = await tx.get(db.doc(source.path)), audit = await tx.get(db.doc(AUDIT));
    const control = await tx.get(db.doc(CONTROL)), lap = await tx.get(db.doc(LAP));
    const audited = audit.data();
    if (current.data()?.blob !== STOPPED_SOURCE || !audited || lap.data()?.phase !== 'complete' || lap.data()?.recoveryRef !== AUDIT
      || lap.data()?.lease?.owner !== audited.originalLap.value.lease.owner || lap.data()?.lease?.generation !== 259
      || lap.data()?.lease?.until !== 0 || lap.data()?.completedAt !== audited.atMs) refuse('cleanup_source_or_lap_changed');
    const j = journal.data(), lease = control.data()?.lease;
    if (j && (sha(authorityScope(j.authority)) !== sha(authorityScope(authority)) || sha(j.target) !== sha(target))) refuse('cleanup_claim_scope_changed');
    if (mode === 'release-cleanup-fence') {
      if (j?.state === 'delete_submitted' && Number.isSafeInteger(j.fenceReleasedAtMs)) return { state: 'cleanup_fence_already_released', submitDelete: false };
      if (j?.state !== 'delete_submitted' || lease?.owner !== j.releaseFence.owner || lease.generation !== j.releaseFence.generation) refuse('cleanup_fence_ownership_changed');
      tx.set(db.doc(CONTROL), { lease: { ...lease, expires_at_ms: 0 } }, { merge: true });
      tx.set(db.doc(CLEANUP), { ...j, fenceReleasedAtMs: now(), releaseDisposition: 'released_for_native_record_cleanup' });
      return { state: 'cleanup_fence_released', submitDelete: false };
    }
    if (mode === 'cleanup-submit' && j?.state === 'delete_submitted') return { state: 'delete_already_claimed_observe_only', submitDelete: false };
    checkEffects(packet, provider, authority, now(), true, verifier);
    if (packet.observedAtMs < proof.observedAtMs || provider.observedAtMs < proof.observedAtMs) refuse('evidence_predates_process_fence');
    const currentPacket = await inventory(db, tx);
    if (canonical(currentPacket) !== canonical({ docs: packet.docs, queries: packet.queries })) refuse('canonical_evidence_changed');
    if (!lease || !Number.isSafeInteger(lease.generation) || !Number.isSafeInteger(lease.expires_at_ms) || lease.expires_at_ms > now()) refuse('foreign_research_lease_held');
    if (mode === 'cleanup-archive') {
      if (j) return { state: 'archive_already_retained', submitDelete: false, archive: j.archive };
      tx.create(db.doc(CLEANUP), { schema: 'blueprint.stopped-oct6-cleanup.v1', state: 'archived', target, authority, archive,
        cleanupReadbackDigest: sha(cleanupReadback), atMs: now(), accountingReconciled: false, standingAuthority: false });
      return { state: 'archive_retained', submitDelete: false, archive };
    }
    if (j?.state !== 'archived' || sha(j.archive) !== sha(archive) || j.cleanupReadbackDigest !== sha(cleanupReadback)) refuse('cleanup_archive_claim_missing');
    const releaseFence = { owner: `research-release:cleanup-oct6-${sha(authorityScope(authority)).slice(0, 16)}`,
      generation: lease.generation + 1, expires_at_ms: now() + HOLD_MS };
    // A durable claim BEFORE the HTTP DELETE. Any lost ACK becomes observe-only.
    tx.set(db.doc(CLEANUP), { ...j, state: 'delete_submitted', deleteClaimedAtMs: now(), releaseFence });
    tx.set(db.doc(CONTROL), { lease: releaseFence }, { merge: true });
    return { state: 'delete_claimed_once', submitDelete: true, target, archive, journalRef: CLEANUP };
  });
}
async function main() {
  const [mode, directory] = process.argv.slice(2);
  if (!['recover', 'renew-fence', 'release-fence', 'cleanup-archive', 'cleanup-submit', 'release-cleanup-fence'].includes(mode)
    || !directory?.startsWith('/tmp/')) refuse('explicit_incident_action_required');
  const files = Object.fromEntries(['canonical', 'provider', 'process-proof', 'authority'].map(name => [name, readFileSync(`${directory}/${name}.json`)]));
  const [packet, provider, proof, authority] = ['canonical', 'provider', 'process-proof', 'authority'].map(name => JSON.parse(files[name]));
  if (sha(files.canonical) !== provider.canonicalFileSha256 || sha(files['process-proof']) !== authority.processProofFileSha256
    || sha(files.provider) !== authority.providerFileSha256 || sha(files.canonical) !== authority.canonicalFileSha256) refuse('owner_packet_file_binding_changed');
  const { app, db, bucket } = existingAdmin();
  try {
    let result;
    if (mode === 'recover' || mode.startsWith('cleanup-') || mode === 'release-cleanup-fence') {
      const { CommunicationsAgentsAPI } = await import('../server/agents/communications-api.ts');
      const runtime = new CommunicationsAgentsAPI({ allowPaidInference: false, fetch: () => { refuse('operator_network_forbidden'); } });
      const verifier = (checkpoint, jobId) => runtime.verifyRetainedRecoveryEvidence(checkpoint, jobId);
      if (mode === 'recover') {
        checkFence(proof, authority, Date.now()); checkEffects(packet, provider, authority, Date.now(), false, verifier);
        const archive = await archiveFiles(bucket, Object.fromEntries(Object.entries(files).map(([name, bytes]) => [`${name}.json`, bytes])));
        result = await recover(db, packet, provider, proof, authority, archive, Date.now, verifier);
      } else {
        const readbackBytes = readFileSync(`${directory}/cleanup-readback.json`), readback = JSON.parse(readbackBytes);
        if (sha(readbackBytes) !== authority.cleanupReadbackFileSha256) refuse('cleanup_readback_file_unbound');
        let archive;
        if (mode === 'cleanup-archive') {
          checkFence(proof, authority, Date.now()); checkEffects(packet, provider, authority, Date.now(), true, verifier);
          const retained = { ...Object.fromEntries(Object.entries(files).map(([name, bytes]) => [`${name}.json`, bytes])), 'cleanup-readback.json': readbackBytes };
          for (const file of readback.files) {
            if (!/^[a-zA-Z0-9_.-]+$/.test(file.name)) refuse('cleanup_export_name_invalid');
            const bytes = readFileSync(`${directory}/export/${file.name}`);
            if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) refuse('cleanup_export_digest_changed');
            retained[file.name] = bytes;
          }
          archive = await archiveFiles(bucket, retained);
        } else archive = (await db.doc(CLEANUP).get()).data()?.archive;
        await verifyArchive(bucket, archive);
        result = await cleanupPhase(db, mode, packet, provider, proof, authority, archive, readback, Date.now, verifier);
        const journalBytes = JSON.stringify({ schema: 'blueprint.stopped-oct6-cleanup-journal-readback.v1',
          journalRef: CLEANUP, targetDigest: readback.targetDigest, archive });
        const journalPath = `${directory}/cleanup-journal.json`;
        try {
          if (sha(JSON.parse(readFileSync(journalPath, 'utf8'))) !== sha(JSON.parse(journalBytes))) refuse('local_cleanup_journal_changed');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          privateWrite(journalPath, JSON.parse(journalBytes));
        }
      }
    } else result = await fenceLease(db, mode, authority, proof);
    privateWrite(`${directory}/${mode}-${randomUUID()}.json`, result);
    // Python owner wrapper needs only the one-time permission, never raw IDs.
    console.log(JSON.stringify({ ok: true, state: result.state, submitDelete: result.submitDelete === true, auditRef: AUDIT, leaseUntilMs: result.lease?.expires_at_ms,
      accountingReconciled: false, sendsAuthorized: false, workerResumeAuthorized: false }));
  } finally { await app.delete(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'incident_recovery_unavailable' })); process.exitCode = 2;
});
