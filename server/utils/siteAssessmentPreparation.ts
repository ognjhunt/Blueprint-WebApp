/** Internal proposal admission for the existing website scene-preparation producer. */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { advisoryContextDigest, advisoryJobId } from "./siteAssessmentContext";
import { browserPendingDecisionKey } from "./websiteBrowserPending";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unavailable = () => new Error("website_assessment_preparation_pending");
function browserAssessmentRequired(request: Record<string, any> | null, session: Record<string, any> | null,
  requestId: string, captureId: string) {
  return Boolean(session?.browser_pending_delivery || session?.browser_stored_upload || session?.browser_upload_reservation
    || captureId === `walkthrough-${requestId}` && (request?.site_advisory
      || request?.capture_privacy_source_bound_decision?.producer_source?.kind === "browser_pending"
      || request?.website_scene_sponsorship?.assessment_preparation_proposal));
}
export type AssessmentPreparationProposal = {
  schema_version: "site_assessment_preparation_proposal.v1";
  request_id: string; capture_id: string; job_id: string; run_id: string;
  source_key: string; context_digest: string; packet_sha256: string;
  questions_pending: boolean;
  scope: "scene_preparation_only";
  robot_suitability_verified: false; physical_trial_authorized: false;
};

/** A plausible proposal allows construction work, never a feasibility verdict or physical launch. */
export async function assessmentProposesPreparation(packet: Record<string, any>, duration: number): Promise<boolean> {
  if (packet.schema_version !== "site_assessment.v2" || !Array.isArray(packet.sources)
    || packet.sources.length > 100 || Buffer.byteLength(JSON.stringify(packet)) > 1_000_000) throw unavailable();
  const { renderSourceBoundAssessment, siteAssessmentSchema } = await import("../agents/site-assessment");
  const raw = siteAssessmentSchema.parse(packet.raw_model_assessment);
  const rendered = renderSourceBoundAssessment(raw, new Map(packet.sources.map((s: any) => [s.source_id, s])), duration);
  return rendered.verification.unverified_claims === 0
    && !["no_robot", "process_change"].includes(raw.next_action.kind)
    && raw.approaches.some(approach => approach.disposition === "plausible");
}

type Read = { collection: string; id: string; value: Record<string, any> | null };
export type PreparedAssessmentProposal = { proposal: AssessmentPreparationProposal; reads: Read[] };

/** No models, sends, writes or dispatch. Reuse the current published assessment reader's full admission. */
export async function loadAssessmentPreparationProposal(requestId: string, captureId: string): Promise<PreparedAssessmentProposal | null> {
  if (!db) throw unavailable();
  const store = db;
  const read = async (collection: string, id: string): Promise<Read> => ({ collection, id,
    value: (await store.collection(collection).doc(id).get()).data() ?? null });
  const session = await read("captureUploadSessions", captureId);
  // Native/legacy captures retain their existing producer, not a manufactured browser assessment.
  if (!session.value?.browser_pending_delivery) {
    const request = await read("inboundRequests", requestId);
    if (browserAssessmentRequired(request.value, session.value, requestId, captureId)) throw unavailable();
    return null;
  }
  if (captureId !== `walkthrough-${requestId}`) throw unavailable();
  const { loadCurrentSiteAdvisory } = await import("./siteAssessmentPublic");
  const admitted = await loadCurrentSiteAdvisory(requestId, captureId);
  if (admitted?.state !== "ready") throw unavailable();
  const [request, brief] = await Promise.all([read("inboundRequests", requestId), read("siteTaskBriefs", requestId)]);
  const pending = session.value.browser_pending_delivery, pointer = request.value?.site_advisory;
  const sourceKey = browserPendingDecisionKey(pending), contextDigest = advisoryContextDigest(request.value ?? {}, brief.value);
  const jobId = advisoryJobId(requestId, sourceKey, contextDigest);
  if (!pointer || pointer.job_id !== jobId || pointer.state !== "completed"
    || pointer.source_key !== sourceKey || pointer.context_digest !== contextDigest
    || admitted.correlationId !== `bp-advisory-${jobId.slice("advisory-".length, "advisory-".length + 16)}`) throw unavailable();
  const job = await read("siteAssessmentJobs", jobId);
  if (job.value?.state !== "completed" || job.value.request_id !== requestId || job.value.capture_id !== captureId
    || job.value.source_key !== sourceKey || job.value.context_digest !== contextDigest
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(job.value.run_id ?? "")) throw unavailable();
  const storedRun = await read("agentRuns", job.value.run_id);
  if (storedRun.value?.status !== "completed" || storedRun.value.task_kind !== "site_assessment") throw unavailable();
  const { hydrateAgentEvidence } = await import("../agents/private-evidence");
  const run = await hydrateAgentEvidence(storedRun.value, { collection: "agentRuns", id: job.value.run_id });
  const packet = run.artifacts?.site_assessment_packet, source = run.artifacts?.source_admission;
  if (!packet || packet.request_id !== requestId || hash(packet) !== job.value.packet_sha256
    || run.artifacts?.site_assessment_packet_sha256 !== job.value.packet_sha256
    || source?.advisory_job_id !== jobId || source.context_digest !== contextDigest || source.source_key !== sourceKey
    || source.capture_id !== captureId || source.request_id !== requestId
    || !await assessmentProposesPreparation(packet, source.duration_seconds)) throw unavailable();
  const { siteAssessmentSchema } = await import("../agents/site-assessment");
  const raw = siteAssessmentSchema.parse(packet.raw_model_assessment);
  return { proposal: { schema_version: "site_assessment_preparation_proposal.v1", request_id: requestId, capture_id: captureId,
    job_id: jobId, run_id: job.value.run_id, source_key: sourceKey, context_digest: contextDigest, packet_sha256: job.value.packet_sha256,
    questions_pending: raw.status === "needs_operator_input" || raw.questions.length > 0 || raw.missing.length > 0,
    scope: "scene_preparation_only", robot_suitability_verified: false, physical_trial_authorized: false },
    reads: [session, request, brief, job, storedRun] };
}

/** All reads precede the existing grant/reservation write. A concurrent reply, withdrawal or retry wins. */
export async function assertAssessmentPreparationCurrent(transaction: FirebaseFirestore.Transaction,
  prepared: PreparedAssessmentProposal | null, request: Record<string, any>, binding: {requestId: string; captureId: string}) {
  if (!db) throw unavailable();
  const store = db;
  if (!prepared) {
    const session = (await transaction.get(store.collection("captureUploadSessions").doc(binding.captureId))).data() ?? null;
    if (browserAssessmentRequired(request, session, binding.requestId, binding.captureId)) throw unavailable();
    return;
  }
  if (!projectWebsiteCaptureRights(request).derived_scene_generation_allowed
    || prepared.proposal.request_id !== binding.requestId || prepared.proposal.capture_id !== binding.captureId) throw unavailable();
  for (const read of prepared.reads) {
    const current = (await transaction.get(store.collection(read.collection).doc(read.id))).data() ?? null;
    if (hash(current) !== hash(read.value)) throw unavailable();
  }
}
