import { createHash, randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { browserPendingDecisionKey, type BrowserPending } from "./websiteBrowserPending";
import { verifiedPendingManifest, verifiedPendingMarker, originalManifestConsent } from "./websiteBrowserUploadStatus";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { advisoryContextDigest, advisoryJobId } from "./siteAssessmentContext";
import { automationBatch } from "./automationBatch";
import { prepareAssessmentRecovery, assertAssessmentRecoveryReplay } from "./captureCoverageInferenceBudget";
import { humanDecisionDigest } from "./human-reply-admission";
import { logger } from "../logger";

export const SITE_ASSESSMENT_JOBS = "siteAssessmentJobs";
type State = "queued" | "running" | "completed" | "needs_review" | "authority_ended";
export type SiteAssessmentJob = {
  schema_version: "site_assessment_job.v1"; request_id: string; scene_id: string; capture_id: string;
  source_key: string; context_digest: string; state: State; run_id: string; claim_id: string | null;
  packet_sha256: string | null; correlation_id: string; started_at_ms?: number; retry_history?: import("./inferenceProgrammeAdmission").AssessmentRecovery[];
};
const RUN_LEASE_MS = 30 * 60_000;
const sha = (packet: unknown) => createHash("sha256").update(JSON.stringify(packet)).digest("hex");
const pointer = (jobId: string, job: SiteAssessmentJob) => ({ job_id: jobId,
  source_key: job.source_key, context_digest: job.context_digest, state: job.state });

function currentAuthority(job: Pick<SiteAssessmentJob, "request_id" | "capture_id" | "source_key" | "context_digest">,
  raw: Record<string, any> | undefined, brief: Record<string, any> | null, session: Record<string, any> | undefined) {
  const pending = session?.browser_pending_delivery as BrowserPending | undefined;
  const privacy = raw?.capture_privacy_source_bound_decision;
  if (!raw || raw.request?.buyerType !== "site_operator" || !projectWebsiteCaptureRights(raw).derived_scene_generation_allowed
    || !pending || pending.request_id !== job.request_id || pending.capture_id !== job.capture_id
    || session?.browser_upload_reservation || session?.browser_stored_upload || pending.state !== "published"
    || privacy?.proceeded !== true || !["approved", "unscreened"].includes(privacy.eligibility)
    || privacy.capture_id !== job.capture_id || privacy.producer_source?.kind !== "browser_pending"
    || privacy.producer_source.key !== job.source_key
    || advisoryContextDigest(raw, brief) !== job.context_digest) return null;
  try { return browserPendingDecisionKey(pending) === job.source_key ? pending : null; } catch { return null; }
}

/** Called only inside the first actual held→published transaction. No backfill. */
export async function enqueueNewPublishedSiteAssessment(tx: FirebaseFirestore.Transaction, pending: BrowserPending) {
  if (!db || !isSiteVideoEvidenceEnabled() || pending.capture_id !== `walkthrough-${pending.request_id}`) return;
  const requestRef = db.collection("inboundRequests").doc(pending.request_id);
  const [request, brief] = await Promise.all([tx.get(requestRef), tx.get(db.collection("siteTaskBriefs").doc(pending.request_id))]);
  const raw = request.data(), ownerContext = brief.exists ? brief.data()! : null;
  const sourceKey = browserPendingDecisionKey(pending), contextDigest = advisoryContextDigest(raw || {}, ownerContext);
  const candidate = { request_id: pending.request_id, capture_id: pending.capture_id, source_key: sourceKey, context_digest: contextDigest };
  if (!currentAuthority(candidate, raw, ownerContext, { browser_pending_delivery: { ...pending, state: "published" } })) return;
  const id = advisoryJobId(pending.request_id, sourceKey, contextDigest);
  const ref = db.collection(SITE_ASSESSMENT_JOBS).doc(id), prior = await tx.get(ref);
  const job: SiteAssessmentJob = prior.exists ? prior.data() as SiteAssessmentJob : {
    schema_version: "site_assessment_job.v1", ...candidate, scene_id: pending.scene_id, state: "queued",
    run_id: `site-assessment-${id.slice("advisory-".length)}`, claim_id: null, packet_sha256: null,
    correlation_id: `bp-advisory-${id.slice("advisory-".length, "advisory-".length + 16)}`,
  };
  if (!prior.exists) tx.set(ref, { ...job, created_at_ms: Date.now() });
  tx.set(requestRef, { site_advisory: pointer(id, job) }, { merge: true });
}

let activePass: Promise<void> | null = null;
/** Reuse the existing worker tick; a lease never authorizes uncertain paid replay. */
export function tickSiteAssessments(limit = 2) {
  if (!activePass) activePass = reconcileSiteAssessments(limit)
    .catch(() => logger.warn("Site advisory reconciliation will resume on the next tick"))
    .finally(() => { activePass = null; });
  return activePass;
}

export async function reconcileSiteAssessments(limit = 2) {
  if (!db || !isSiteVideoEvidenceEnabled()) return;
  const pending = await automationBatch(db, db.collection(SITE_ASSESSMENT_JOBS)
    .where("state", "in", ["queued", "running"]), "site_assessments", limit);
  for (const row of pending.docs) {
    const job = row.data() as SiteAssessmentJob;
    if (job.schema_version !== "site_assessment_job.v1" || row.id !== advisoryJobId(job.request_id, job.source_key, job.context_digest)) continue;
    const requestRef = db.collection("inboundRequests").doc(job.request_id), briefRef = db.collection("siteTaskBriefs").doc(job.request_id);
    const sessionRef = db.collection("captureUploadSessions").doc(job.capture_id);
    const source = async () => {
      const [request, brief, session] = await Promise.all([requestRef.get(), briefRef.get(), sessionRef.get()]);
      return currentAuthority(job, request.data(), brief.exists ? brief.data()! : null, session.data());
    };
    const finish = async (state: State, claimId: string | null, packetSha: string | null = null) => db!.runTransaction(async tx => {
      const [current, request, brief, session] = await Promise.all([tx.get(row.ref), tx.get(requestRef), tx.get(briefRef), tx.get(sessionRef)]);
      const latest = current.data() as SiteAssessmentJob | undefined;
      if (!latest || latest.state !== job.state || latest.claim_id !== claimId || latest.run_id !== job.run_id) return;
      const authority = currentAuthority(job, request.data(), brief.exists ? brief.data()! : null, session.data());
      const next = { ...latest, state: authority ? state : "authority_ended" as State, packet_sha256: authority ? packetSha : null };
      tx.set(row.ref, { state: next.state, packet_sha256: next.packet_sha256, updated_at_ms: Date.now() }, { merge: true });
      if (request.data()?.site_advisory?.job_id === row.id) tx.set(requestRef, { site_advisory: pointer(row.id, next) }, { merge: true });
    });
    const publishRetained = async (raw: Record<string, any>) => {
      const { hydrateAgentEvidence } = await import("../agents/private-evidence");
      const run: any = await hydrateAgentEvidence(raw, { collection: "agentRuns", id: job.run_id });
      const packet = run.artifacts?.site_assessment_packet, bound = run.artifacts?.source_admission;
      const packetSha = packet ? sha(packet) : null;
      if (run.status !== "completed" || run.task_kind !== "site_assessment" || !packet || packet.schema_version !== "site_assessment.v2"
        || packet.request_id !== job.request_id || bound?.source_key !== job.source_key
        || bound?.advisory_job_id !== row.id || bound?.context_digest !== job.context_digest
        || bound?.capture_id !== job.capture_id || bound?.request_id !== job.request_id
        || run.artifacts.site_assessment_packet_sha256 !== packetSha) {
        await finish("needs_review", job.claim_id); return;
      }
      const selected = await source();
      if (!selected) { await finish("authority_ended", job.claim_id); return; }
      const manifest = await verifiedPendingManifest(selected);
      if (!manifest || !originalManifestConsent(manifest) || !(await verifiedPendingMarker(selected))) {
        await finish("needs_review", job.claim_id); return;
      }
      await finish("completed", job.claim_id, packetSha);
    };
    try {
      const selected = await source();
      if (!selected) { await finish("authority_ended", job.claim_id); continue; }
      const manifest = await verifiedPendingManifest(selected);
      if (!manifest || !originalManifestConsent(manifest) || !(await verifiedPendingMarker(selected))) {
        await finish("needs_review", job.claim_id); continue;
      }
      // A persisted result may predate the lost queue acknowledgement. Never
      // invoke the provider again merely to rebuild the publication pointer.
      const retained = await db.collection("agentRuns").doc(job.run_id).get();
      if (retained.exists) {
        if (retained.data()?.status === "completed") {
          await publishRetained(retained.data()!); continue;
        }
        if (job.state === "running" && retained.data()?.status === "running"
          && Date.now() - (job.started_at_ms || 0) < RUN_LEASE_MS) continue;
        await finish("needs_review", job.claim_id); continue;
      }
      if (job.state === "running") {
        if (Date.now() - (job.started_at_ms || 0) >= RUN_LEASE_MS) await finish("needs_review", job.claim_id);
        continue;
      }
      // Coverage and advisory share the existing capture allowance. Wait for
      // this worker's active coverage pass, without making its verdict a gate.
      const { isCoverageReviewActive } = await import("./captureCoverageQueue");
      if (isCoverageReviewActive()) continue;
      const claimId = randomUUID();
      const claimed = await db.runTransaction(async tx => {
        const [current, request, brief, session] = await Promise.all([tx.get(row.ref), tx.get(requestRef), tx.get(briefRef), tx.get(sessionRef)]);
        if (current.data()?.state !== "queued" || current.data()?.run_id !== job.run_id
          || !currentAuthority(job, request.data(), brief.exists ? brief.data()! : null, session.data())) return false;
        tx.set(row.ref, { state: "running", claim_id: claimId, started_at_ms: Date.now() }, { merge: true });
        if (request.data()?.site_advisory?.job_id === row.id) tx.set(requestRef, { site_advisory: { ...pointer(row.id, job), state: "running" } }, { merge: true });
        return true;
      });
      if (!claimed) continue;
      job.state = "running"; job.claim_id = claimId;
      // The canonical claim/run is committed before the SDK admission checks.
      // Its source and context are reread by the adapter before every model call.
      const { runAgentTask } = await import("../agents/runtime");
      await runAgentTask({ kind: "site_assessment", session_key: `site_advisory:${row.id}`,
        metadata: { capture_id: job.capture_id, advisory_job_id: row.id }, input: {
          message: "Assess this uploaded recurring job using the admitted video and owner statements. Preserve uncertainty and ask for missing evidence. This is an advisory assessment.",
          context: { request_id: job.request_id, advisory_job_id: row.id, advisory_claim_id: claimId },
        } }, { runId: job.run_id, dispatchQueuedOnFinish: false });
      // Returning an in-memory model answer is never proof that private
      // persistence succeeded. Reopen and verify the canonical record.
      const completed = await db.collection("agentRuns").doc(job.run_id).get();
      if (completed.exists) await publishRetained(completed.data()!);
      else await finish("needs_review", claimId);
    } catch {
      await finish("needs_review", job.claim_id).catch(() => undefined);
      logger.warn({ correlationId: job.correlation_id }, "Site advisory needs operator review");
    }
  }
}

type RetryAccess = (request: Record<string, any>) => void | boolean | Promise<void | boolean>;
async function selectRetryJob(tx: FirebaseFirestore.Transaction, requestId: string, assertAccess: RetryAccess) {
  const requestRef = db!.collection("inboundRequests").doc(requestId), briefRef = db!.collection("siteTaskBriefs").doc(requestId);
  const [request, brief] = await Promise.all([tx.get(requestRef), tx.get(briefRef)]);
  const raw = request.data();
  if (!raw) throw new Error("advisory_retry_unavailable");
  try { if (await assertAccess(raw) === false) throw new Error(); } catch { throw new Error("advisory_retry_not_authorized"); }
  const id = raw.site_advisory?.job_id;
  if (typeof id !== "string" || !/^advisory-[a-f0-9]{64}$/.test(id)) throw new Error("advisory_retry_unavailable");
  const ref = db!.collection(SITE_ASSESSMENT_JOBS).doc(id), snap = await tx.get(ref), job = snap.data() as SiteAssessmentJob;
  if (!job || job.schema_version !== "site_assessment_job.v1" || job.request_id !== requestId
    || job.capture_id !== `walkthrough-${requestId}` || id !== advisoryJobId(requestId, job.source_key, job.context_digest)
    || raw.site_advisory.source_key !== job.source_key || raw.site_advisory.context_digest !== job.context_digest)
    throw new Error("advisory_retry_unavailable");
  const session = await tx.get(db!.collection("captureUploadSessions").doc(job.capture_id));
  if (!currentAuthority(job, raw, brief.data() ?? null, session.data())) throw new Error("advisory_retry_unavailable");
  return { id, ref, job, requestRef, raw, brief: brief.data() ?? null };
}
export async function retrySiteAssessment(input: { requestId: string; expectedJobId: string; expectedRunId: string;
  retryIdentity: string; assertAccess: RetryAccess }) {
  if (!db || !isSiteVideoEvidenceEnabled() || !/^[A-Za-z0-9._-]{1,120}$/.test(input.retryIdentity)) throw new Error("advisory_retry_unavailable");
  return db.runTransaction(async tx => {
    const selected = await selectRetryJob(tx, input.requestId, input.assertAccess), { id, job, raw } = selected;
    if (id !== input.expectedJobId) throw new Error("advisory_retry_conflict");
    const prior = job.retry_history?.find(row => row.retry_identity === input.retryIdentity);
    if (prior) {
      if (prior.previous_run_id !== input.expectedRunId || prior.new_run_id !== job.run_id) throw new Error("advisory_retry_conflict");
      await assertAssessmentRecoveryReplay(tx, { requestId: input.requestId, captureId: job.capture_id, jobId: id,
        runId: job.run_id, sourceKey: job.source_key, contextDigest: job.context_digest, request: raw, brief: selected.brief, receipt: prior });
      return { state: job.state, job_id: id, run_id: job.run_id };
    }
    if (job.state !== "needs_review" || job.run_id !== input.expectedRunId) throw new Error("advisory_retry_conflict");
    const runId = `site-assessment-retry-${humanDecisionDigest({ jobId: id, previousRunId: job.run_id, retryIdentity: input.retryIdentity })}`;
    const archive = await prepareAssessmentRecovery(tx, { requestId: input.requestId, jobId: id, captureId: job.capture_id,
      previousRunId: job.run_id, previousClaimId: job.claim_id, newRunId: runId, retryIdentity: input.retryIdentity, sourceKey: job.source_key,
      contextDigest: job.context_digest, request: raw, brief: selected.brief });
    if (humanDecisionDigest(job.retry_history ?? []) !== humanDecisionDigest(archive.budgetUpdate.assessment_recoveries.slice(0, -1)))
      throw new Error("advisory_retry_unavailable");
    const next: SiteAssessmentJob = { ...job, state: "queued", run_id: runId, claim_id: null, packet_sha256: null,
      retry_history: archive.budgetUpdate.assessment_recoveries };
    if (archive.callRef) tx.set(archive.callRef, archive.callUpdate, { merge: true });
    tx.set(archive.budgetRef, archive.budgetUpdate, { merge: true });
    tx.set(selected.ref, { state: next.state, run_id: runId, claim_id: null, packet_sha256: null,
      retry_history: next.retry_history, updated_at_ms: Date.now() }, { merge: true });
    tx.set(selected.requestRef, { site_advisory: pointer(id, next) }, { merge: true });
    return { state: next.state, job_id: id, run_id: runId };
  }).catch(error => { throw new Error(error instanceof Error && ["advisory_retry_conflict", "advisory_retry_not_authorized"].includes(error.message)
    ? error.message : "advisory_retry_unavailable"); });
}
/** Read-only availability; no archive, wakeup, dispatch or customer mutation. */
export async function describeSiteAssessmentRetry(requestId: string, assertAccess: RetryAccess) {
  if (!db || !isSiteVideoEvidenceEnabled()) return { available: false, job_id: null, run_id: null };
  try {
    return await db.runTransaction(async tx => {
      const selected = await selectRetryJob(tx, requestId, assertAccess), { id, job, raw } = selected;
      if (job.state !== "needs_review") throw new Error("advisory_retry_unavailable");
      const archive = await prepareAssessmentRecovery(tx, { requestId, jobId: id, captureId: job.capture_id,
        previousRunId: job.run_id, previousClaimId: job.claim_id, newRunId: "read-only-validation", retryIdentity: "read-only-validation",
        sourceKey: job.source_key, contextDigest: job.context_digest, request: raw, brief: selected.brief });
      if (humanDecisionDigest(job.retry_history ?? []) !== humanDecisionDigest(archive.budgetUpdate.assessment_recoveries.slice(0, -1)))
        throw new Error("advisory_retry_unavailable");
      return { available: true, job_id: id, run_id: job.run_id };
    });
  } catch { return { available: false, job_id: null, run_id: null }; }
}
