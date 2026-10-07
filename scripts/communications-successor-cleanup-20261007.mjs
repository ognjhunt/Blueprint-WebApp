/** Supported successor cleanup journal. No recovery/reconcile or activation mode. */
import { readFileSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CONTROL, LAP, STOPPED_SOURCE, canonical, sha, refuse, row, readSource, inventory, existingAdmin, privateWrite } from './communications-incident-20261006.mjs';
import { AUDIT, CLEANUP, checkEffects, fresh, archiveFiles, verifyArchive } from './communications-incident-recovery-20261006.mjs';
import { checkFence, authorityScope } from './communications-successor-admission-20261007.mjs';
const HOLD_MS = 120000;
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
    checkFence(proof, authority, now()); // Revalidate freshness on every CAS retry.
    const journal = await tx.get(db.doc(CLEANUP)), current = await tx.get(db.doc(source.path)), audit = await tx.get(db.doc(AUDIT));
    const control = await tx.get(db.doc(CONTROL)), lap = await tx.get(db.doc(LAP));
    const audited = audit.data();
    if (sha(audited) !== authority.expectedHistoricalAuditDigest || sha(lap.data()) !== authority.expectedLapSha256) refuse('historical_recovery_changed');
    const actualSource = await readSource(db, tx, row(current));
    if (canonical(actualSource) !== canonical(source)) refuse('cleanup_exact_source_changed');
    if (current.data()?.blob !== STOPPED_SOURCE || !audited || lap.data()?.phase !== 'complete' || lap.data()?.recoveryRef !== AUDIT
      || lap.data()?.lease?.owner !== audited.originalLap.value.lease.owner || lap.data()?.lease?.generation !== 259
      || lap.data()?.lease?.until !== 0 || lap.data()?.completedAt !== audited.atMs) refuse('cleanup_source_or_lap_changed');
    const j = journal.data(), lease = control.data()?.lease;
    if (j && (j.schema !== 'blueprint.stopped-oct6-successor-cleanup.v1' || sha(authorityScope(j.authority)) !== sha(authorityScope(authority)) || sha(j.target) !== sha(target))) refuse('cleanup_claim_scope_changed');
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
      tx.create(db.doc(CLEANUP), { schema: 'blueprint.stopped-oct6-successor-cleanup.v1', state: 'archived', target, authority, archive,
        cleanupReadbackDigest: sha(cleanupReadback), atMs: now(), accountingReconciled: false, standingAuthority: false });
      return { state: 'archive_retained', submitDelete: false, archive };
    }
    if (j?.state !== 'archived' || sha(j.archive) !== sha(archive) || j.cleanupReadbackDigest !== sha(cleanupReadback)) refuse('cleanup_archive_claim_missing');
    if (!Number.isSafeInteger(lease.generation + 1)) refuse('cleanup_generation_overflow');
    const releaseFence = { owner: `research-release:successor-cleanup-oct6-${sha(authorityScope(authority)).slice(0, 16)}`,
      generation: lease.generation + 1, expires_at_ms: now() + HOLD_MS };
    // A durable claim BEFORE the HTTP DELETE. Any lost ACK becomes observe-only.
    tx.set(db.doc(CLEANUP), { ...j, state: 'delete_submitted', deleteClaimedAtMs: now(), releaseFence });
    tx.set(db.doc(CONTROL), { lease: releaseFence }, { merge: true });
    return { state: 'delete_claimed_once', submitDelete: true, target, archive, journalRef: CLEANUP };
  });
}
async function main() {
  const [mode, directory] = process.argv.slice(2);
  if (!['cleanup-archive', 'cleanup-submit', 'release-cleanup-fence'].includes(mode) || !directory?.startsWith('/tmp/') || resolve(directory) !== directory) refuse('explicit_successor_cleanup_action_required');
  const files = Object.fromEntries(['canonical','provider','process-proof','authority'].map(name => [name,readFileSync(`${directory}/${name}.json`)]));
  const [packet,provider,proof,authority] = ['canonical','provider','process-proof','authority'].map(name => JSON.parse(files[name]));
  // The execution checkout is separately exact and clean; no copied mutable helper.
  if (realpathSync(new URL('.',import.meta.url).pathname) !== realpathSync(resolve('scripts')) || execFileSync('git',['rev-parse','HEAD']).toString().trim() !== authority.expectedReleaseCommit
    || execFileSync('git',['status','--porcelain','--untracked-files=no']).toString().trim()) refuse('successor_execution_source_changed');
  if (sha(files.canonical) !== provider.canonicalFileSha256 || sha(files.canonical) !== authority.canonicalFileSha256 || sha(files.provider) !== authority.providerFileSha256 || sha(files['process-proof']) !== authority.processProofFileSha256) refuse('owner_packet_file_binding_changed');
  const readbackBytes=readFileSync(`${directory}/cleanup-readback.json`), readback=JSON.parse(readbackBytes);
  if (sha(readbackBytes) !== authority.cleanupReadbackFileSha256) refuse('cleanup_readback_file_unbound');
  checkFence(proof,authority,Date.now());
  const { CommunicationsAgentsAPI }=await import('../server/agents/communications-api.ts');
  const validator=new CommunicationsAgentsAPI({allowPaidInference:false,fetch:()=>{refuse('operator_network_forbidden');}});
  const verifier=(checkpoint,jobId)=>validator.verifyRetainedRecoveryEvidence(checkpoint,jobId);
  const {app,db,bucket}=existingAdmin();
  try {
    let archive;
    if(mode==='cleanup-archive') {
      checkEffects(packet,provider,authority,Date.now(),true,verifier);
      const retained={...Object.fromEntries(Object.entries(files).map(([name,bytes])=>[`${name}.json`,bytes])),'cleanup-readback.json':readbackBytes};
      if(!Array.isArray(readback.files)||!readback.files.length||new Set(readback.files.map(f=>f.name)).size!==readback.files.length) refuse('cleanup_export_inventory_invalid');
      for(const file of readback.files) {
        if(!/^[a-zA-Z0-9_.-]+$/.test(file.name)||Object.hasOwn(retained,file.name)) refuse('cleanup_export_name_invalid');
        const bytes=readFileSync(`${directory}/export/${file.name}`);
        if(bytes.length!==file.bytes||sha(bytes)!==file.sha256) refuse('cleanup_export_digest_changed');
        retained[file.name]=bytes;
      }
      archive=await archiveFiles(bucket,retained);
    } else archive=(await db.doc(CLEANUP).get()).data()?.archive;
    await verifyArchive(bucket,archive);
    const result=await cleanupPhase(db,mode,packet,provider,proof,authority,archive,readback,Date.now,verifier);
    const journal={schema:'blueprint.stopped-oct6-cleanup-journal-readback.v1',journalRef:CLEANUP,targetDigest:readback.targetDigest,archive};
    const path=`${directory}/cleanup-journal.json`;
    try { if(sha(JSON.parse(readFileSync(path)))!==sha(journal)) refuse('local_cleanup_journal_changed'); }
    catch(e) { if(e.code!=='ENOENT') throw e; privateWrite(path,journal); }
    privateWrite(`${directory}/${mode}-${randomUUID()}.json`,result);
    console.log(JSON.stringify({ok:true,state:result.state,submitDelete:result.submitDelete===true,recoveryReplayed:false,sendsAuthorized:false,workerResumeAuthorized:false,accountingReconciled:false}));
  } finally {await app.delete();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(e=>{
  console.error(JSON.stringify({ok:false,code:/^[a-z_]+$/.test(e.message)?e.message:'successor_cleanup_unavailable'}));process.exitCode=2;
});
