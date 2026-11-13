import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { browserPendingDecisionKey, type BrowserPending } from "./websiteBrowserPending";
import { verifiedPendingManifest, verifiedPendingMarker, originalManifestConsent } from "./websiteBrowserUploadStatus";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { advisoryContextDigest, advisoryJobId } from "./siteAssessmentContext";
import { automationBatch } from "./automationBatch";
import { prepareAssessmentAbandonment, hasRecentAssessmentProgress } from "./captureCoverageInferenceBudget";
import { humanDecisionDigest } from "./human-reply-admission";
import { logger } from "../logger";
import type { SiteCustomerStatementRef } from "./siteCustomerStatements";
import type { ModelReviewHeadroom } from "./betaAbuseCaps";

export const SITE_ASSESSMENT_JOBS = "siteAssessmentJobs";
/** `retired`: a job never started when the per-job assessment ended (owner
 * decision 2026-11-11). Terminal; nothing claims, runs or retries it. */
type State = "queued" | "running" | "completed" | "needs_review" | "authority_ended" | "retired";
export type SiteAssessmentJob = {
  schema_version: "site_assessment_job.v1"; request_id: string; scene_id: string; capture_id: string;
  source_key: string; context_digest: string; state: State; run_id: string; claim_id: string | null;
  packet_sha256: string | null; correlation_id: string; started_at_ms?: number; retry_history?: import("./inferenceProgrammeAdmission").AssessmentRecovery[];
  /** Why a queued job was waiting without being claimed (historical; nothing claims now). */
  spend_blocker?: SiteAssessmentSpendBlocker | null;
  /** Set once, when a never-started job is closed at the end of the assessment. */
  retired?: SiteAssessmentRetirement;
};
export type SiteAssessmentRetirement = {
  schema_version: "site_assessment_retired.v1"; reason: "site_assessment_ended"; retired_at_iso: string;
};
export type SiteAssessmentSpendBlocker = {
  schema_version: "site_assessment_spend_blocker.v1";
  reason: Extract<ModelReviewHeadroom, { available: false }>["reason"];
  day: string; cap_usd: number; reserved_usd: number | null; recorded_at_iso: string;
};
const RUN_LEASE_MS = 30 * 60_000;
const sha = (packet: unknown) => createHash("sha256").update(JSON.stringify(packet)).digest("hex");
const pointer = (jobId: string, job: SiteAssessmentJob) => ({ job_id: jobId, capture_id: job.capture_id,
  source_key: job.source_key, context_digest: job.context_digest, state: job.state });
function currentAuthority(job: Pick<SiteAssessmentJob, "request_id" | "capture_id" | "source_key" | "context_digest">,
  raw: Record<string, any> | undefined, brief: Record<string, any> | null, session: Record<string, any> | undefined) {
  const pending = session?.browser_pending_delivery as BrowserPending | undefined;
  const privacy = raw?.capture_privacy_source_bound_decision;
  if (raw?.active_capture_id && raw.active_capture_id !== job.capture_id) return null;
  if (!raw || raw.request?.buyerType !== "site_operator" || !projectWebsiteCaptureRights(raw).derived_scene_generation_allowed
    || !pending || pending.request_id !== job.request_id || pending.capture_id !== job.capture_id
    || session?.browser_upload_reservation || session?.browser_stored_upload || pending.state !== "published"
    || privacy?.proceeded !== true || !["approved", "unscreened"].includes(privacy.eligibility)
    || privacy.capture_id !== job.capture_id || privacy.producer_source?.kind !== "browser_pending"
    || privacy.producer_source.key !== job.source_key
    || advisoryContextDigest(raw, brief) !== job.context_digest) return null;
  try { return browserPendingDecisionKey(pending) === job.source_key ? pending : null; } catch { return null; }
}

/** The per-job site assessment ended for new jobs (owner decision 2026-11-11):
 * a published video queues nothing. Kept as the publication seam's no-op. */
export async function enqueueNewPublishedSiteAssessment(_tx: FirebaseFirestore.Transaction, _pending: BrowserPending): Promise<void> {}

/** A saved brief correction queues no assessment now that it ended (owner
 * decision 2026-11-11). Existing jobs, runs and pointers are left as they are. */
export async function prepareBriefContextSiteAssessment(_tx: FirebaseFirestore.Transaction, _requestId: string,
  _record: Record<string, any>, _brief: Record<string, any>): Promise<(() => void) | null> {
  return null;
}

/** A verified email answer queues no assessment now that it ended (owner
 * decision 2026-11-11). The caller still records the statement itself. */
export async function prepareCustomerReplySiteAssessment(_store: FirebaseFirestore.Firestore,
  _tx: FirebaseFirestore.Transaction, _requestId: string, _record: Record<string, any>, _statements: SiteCustomerStatementRef[]):
  Promise<{ state: "disabled"; job_id?: undefined; commit: () => void }> {
  return { state: "disabled", commit: () => {} };
}

let activePass: Promise<void> | null = null;
/** The existing worker tick: it closes jobs left at cutover and starts none. */
export function tickSiteAssessments(limit = 2) {
  if (!activePass) activePass = reconcileSiteAssessments(limit)
    .catch(() => logger.warn("Site advisory reconciliation will resume on the next tick"))
    .finally(() => { activePass = null; });
  return activePass;
}

const millisOf = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return Date.parse(value);
  const toMillis = (value as { toMillis?: () => number } | null)?.toMillis;
  return typeof toMillis === "function" ? toMillis.call(value) : null;
};

/** The per-job assessment ended 2026-11-11 and its owner retry with it, so a run
 * left `running` at the switch would hold the capture's inference budget (its
 * pending call) against the video reading for ever. Whatever happened to its
 * job or its abandonment, once the run shows no activity for a lease it is
 * closed `cancelled`; the reading's next reservation then retires the pending
 * call itself, keeping its cost as unknown. Every pass tries again. */
export async function closeStaleSiteAssessmentRuns(limit = 10): Promise<number> {
  if (!db) return 0;
  const running = await db.collection("agentRuns").where("task_kind", "==", "site_assessment")
    .where("status", "==", "running").limit(limit).get();
  let closed = 0;
  for (const row of running.docs) {
    try {
      const run = row.data(), captureId = run.metadata?.capture_id;
      const jobId = run.metadata?.advisory_job_id ?? run.input?.input?.context?.advisory_job_id;
      const job = typeof jobId === "string" && /^advisory-[a-f0-9]{64}$/.test(jobId)
        ? (await db.collection(SITE_ASSESSMENT_JOBS).doc(jobId).get()).data() : undefined;
      const calls = typeof captureId === "string"
        ? (await db.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: captureId })}`)
          .collection("calls").where("run_id", "==", row.id).get()).docs.map(call => call.data()) : [];
      const activity = [millisOf(run.started_at), millisOf(run.created_at), job?.run_id === row.id ? millisOf(job.started_at_ms) : null,
        ...calls.flatMap(call => [millisOf(call.created_at_ms), millisOf(call.recorded_at_ms)])]
        .filter((time): time is number => time !== null && time <= Date.now());
      if (activity.length && Date.now() - Math.max(...activity) < RUN_LEASE_MS) continue;
      const done = await db.runTransaction(async tx => {
        const current = (await tx.get(row.ref)).data();
        if (current?.status !== "running" || current.task_kind !== "site_assessment") return false;
        tx.set(row.ref, { status: "cancelled", error: "site_assessment_retired", cancelled_at: new Date().toISOString(),
          site_assessment_retirement: { schema_version: "site_assessment_run_retired.v1", reason: "site_assessment_ended",
            last_activity_ms: activity.length ? Math.max(...activity) : null, lease_ms: RUN_LEASE_MS, closed_at_ms: Date.now() } },
          { merge: true });
        return true;
      });
      if (done) closed++;
    } catch {
      logger.warn("A stale site assessment run could not be closed; the next pass tries again");
    }
  }
  return closed;
}

export async function reconcileSiteAssessments(limit = 2) {
  // Nothing below calls a model or spends, so the jobs left at cutover close
  // even with video evidence switched off; none of them may read "processing".
  if (!db) return;
  try { await reconcileSiteAssessmentJobs(limit); }
  finally {
    // After the jobs' own paths (which record a proper abandonment when they
    // can), whatever is still running past its lease is closed.
    await closeStaleSiteAssessmentRuns().catch(() => logger.warn("Stale site assessment runs will be closed on the next pass"));
  }
}

async function reconcileSiteAssessmentJobs(limit: number) {
  if (!db) return;
  const pending = await automationBatch(db, db.collection(SITE_ASSESSMENT_JOBS)
    .where("state", "in", ["queued", "running", "needs_review"]), "site_assessments", limit);
  for (const row of pending.docs) {
    const job = row.data() as SiteAssessmentJob;
    if (job.schema_version !== "site_assessment_job.v1" || row.id !== advisoryJobId(job.request_id, job.source_key, job.context_digest)) continue;
    const requestRef = db.collection("inboundRequests").doc(job.request_id), briefRef = db.collection("siteTaskBriefs").doc(job.request_id);
    const sessionRef = db.collection("captureUploadSessions").doc(job.capture_id);
    const source = async () => {
      const [request, brief, session] = await Promise.all([requestRef.get(), briefRef.get(), sessionRef.get()]);
      return currentAuthority(job, request.data(), brief.exists ? brief.data()! : null, session.data());
    };
    const finish = async (state: State, claimId: string | null, packetSha: string | null = null, retire = false) => db!.runTransaction(async tx => {
      const [current, request, brief, session] = await Promise.all([tx.get(row.ref), tx.get(requestRef), tx.get(briefRef), tx.get(sessionRef)]);
      const latest = current.data() as SiteAssessmentJob | undefined;
      if (!latest || latest.state !== job.state || latest.claim_id !== claimId || latest.run_id !== job.run_id) return;
      const authority = currentAuthority(job, request.data(), brief.exists ? brief.data()! : null, session.data());
      let abandonment;
      if (retire && (latest.started_at_ms !== job.started_at_ms || latest.source_key !== job.source_key
        || latest.context_digest !== job.context_digest || latest.capture_id !== job.capture_id || latest.request_id !== job.request_id)) return;
      if (retire && Number.isFinite(latest.started_at_ms) && Date.now() - latest.started_at_ms! < RUN_LEASE_MS) return;
      if (retire && authority && await hasRecentAssessmentProgress(tx, { requestId: job.request_id, jobId: row.id,
        captureId: job.capture_id, previousRunId: job.run_id, previousClaimId: claimId, sourceKey: job.source_key,
        contextDigest: job.context_digest, startedAtMs: latest.started_at_ms!, request: request.data()!,
        brief: brief.exists ? brief.data()! : null })) return;
      if (retire && authority) {
        try { abandonment = await prepareAssessmentAbandonment(tx, { requestId: job.request_id, jobId: row.id, captureId: job.capture_id,
          previousRunId: job.run_id, previousClaimId: claimId, sourceKey: job.source_key, contextDigest: job.context_digest,
          startedAtMs: latest.started_at_ms!, request: request.data()!, brief: brief.exists ? brief.data()! : null }); }
        catch { /* Ambiguous ownership stays for review; never synthesize a checkpoint. */ }
        if (abandonment?.completed) return; // The next pass publishes the actual retained result.
      }
      const next = { ...latest, state: authority ? state : "authority_ended" as State, packet_sha256: authority ? packetSha : null };
      if (abandonment && !abandonment.completed) tx.set(abandonment.runRef, abandonment.runUpdate, { merge: true });
      tx.set(row.ref, { state: next.state, packet_sha256: next.packet_sha256, updated_at_ms: Date.now() }, { merge: true });
      if (request.data()?.site_advisory?.job_id === row.id) tx.set(requestRef, { site_advisory: pointer(row.id, next) }, { merge: true });
    });
    const retire = async () => db!.runTransaction(async tx => {
      const [current, request] = await Promise.all([tx.get(row.ref), tx.get(requestRef)]);
      const latest = current.data() as SiteAssessmentJob | undefined;
      if (!latest || latest.state !== "queued" || latest.claim_id !== null || latest.run_id !== job.run_id) return;
      if ((await tx.get(db!.collection("agentRuns").doc(job.run_id))).exists) return; // Started after all: leave it to the paths above.
      const retired: SiteAssessmentRetirement = { schema_version: "site_assessment_retired.v1", reason: "site_assessment_ended",
        retired_at_iso: new Date().toISOString() };
      tx.set(row.ref, { state: "retired", retired, updated_at_ms: Date.now() }, { merge: true });
      if (request.data()?.site_advisory?.job_id === row.id) tx.set(requestRef, { site_advisory: pointer(row.id, { ...latest, state: "retired" }) }, { merge: true });
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
      // Queued and never started: the assessment ended (owner decision
      // 2026-11-11), so close it instead of claiming it. No model call, no
      // spend, and the capture's budget stays free for its video reading.
      if (job.state === "queued" && job.claim_id === null
        && !(await db.collection("agentRuns").doc(job.run_id).get()).exists) { await retire(); continue; }
      const manifest = await verifiedPendingManifest(selected);
      if (!manifest || !originalManifestConsent(manifest) || !(await verifiedPendingMarker(selected))) {
        await finish("needs_review", job.claim_id); continue;
      }
      // A persisted result may predate the lost queue acknowledgement. Never
      // invoke the provider again merely to rebuild the publication pointer.
      const retained = await db.collection("agentRuns").doc(job.run_id).get();
      if (job.state === "needs_review") {
        // Only a fully retained completed response can take this free path.
        // Failed/in-flight/unknown provider work never reaches runAgentTask.
        if (!retained.exists) continue;
        const original = retained.data()!;
        const { hydrateAgentEvidence, projectAgentEvidence } = await import("../agents/private-evidence");
        const { recoverSiteAssessmentPostprocessing } = await import("../agents/site-assessment-postprocessing");
        const run = await hydrateAgentEvidence(original, { collection: "agentRuns", id: job.run_id });
        const recovered = recoverSiteAssessmentPostprocessing(run, { request_id: job.request_id,
          capture_id: job.capture_id, source_key: job.source_key, context_digest: job.context_digest, advisory_job_id: row.id });
        if (!recovered) continue;
        const packetSha = sha(recovered.packet);
        const projection = await projectAgentEvidence({ ...run, status: "completed", error: null,
          output: recovered.packet.assessment, artifacts: { ...run.artifacts,
            site_assessment_packet: recovered.packet, site_assessment_packet_sha256: packetSha,
            postprocessing_recovery: recovered.recovery },
          postprocessing_recovered_at_iso: new Date().toISOString(),
          postprocessing_code_commit: /^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT ?? "")
            ? process.env.RENDER_GIT_COMMIT : null }, { collection: "agentRuns", id: job.run_id });
        await db.runTransaction(async tx => {
          const runRef = db!.collection("agentRuns").doc(job.run_id);
          const [latestRun, latestJob, request, brief, session] = await Promise.all([
            tx.get(runRef), tx.get(row.ref), tx.get(requestRef), tx.get(briefRef), tx.get(sessionRef),
          ]);
          const latest = latestJob.data() as SiteAssessmentJob | undefined;
          if (!latest || humanDecisionDigest(latestRun.data()) !== humanDecisionDigest(original)
            || humanDecisionDigest(latest) !== humanDecisionDigest(job)
            || !currentAuthority(latest, request.data(), brief.exists ? brief.data()! : null, session.data())
            || request.data()?.site_advisory?.job_id !== row.id) return;
          tx.set(runRef, projection);
          tx.set(row.ref, { state: "completed", packet_sha256: packetSha, updated_at_ms: Date.now() }, { merge: true });
          tx.set(requestRef, { site_advisory: pointer(row.id, { ...latest, state: "completed" }) }, { merge: true });
        });
        continue;
      }
      if (retained.exists) {
        if (retained.data()?.status === "completed") {
          await publishRetained(retained.data()!); continue;
        }
        if (job.state === "running" && retained.data()?.status === "running"
          && Date.now() - (job.started_at_ms || 0) < RUN_LEASE_MS) continue;
        await finish("needs_review", job.claim_id, null, job.state === "running" && retained.data()?.status === "running"); continue;
      }
      if (job.state === "running") {
        if (Date.now() - (job.started_at_ms || 0) >= RUN_LEASE_MS) await finish("needs_review", job.claim_id);
        continue;
      }
      // Nothing claims or runs a queued job now; any other one goes to review.
      await finish("needs_review", job.claim_id);
    } catch {
      await finish("needs_review", job.claim_id).catch(() => undefined);
      logger.warn({ correlationId: job.correlation_id }, "Site advisory needs operator review");
    }
  }
}

type RetryAccess = (request: Record<string, any>) => void | boolean | Promise<void | boolean>;
/** The owner retry ended with the assessment (owner decision 2026-11-11):
 * nothing is ever available to retry. Read-only, and no queue wake. */
export async function describeSiteAssessmentRetry(_requestId: string, _assertAccess: RetryAccess) {
  return { available: false as const, job_id: null, run_id: null };
}
