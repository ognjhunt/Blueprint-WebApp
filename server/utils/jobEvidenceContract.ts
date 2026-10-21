/** Job projection around Pipeline-owned artifacts. It neither plans methods nor selects a supplier. */
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { maintainedSiteTaskTestbedSchema, nativeDecisionEvidenceRequestSchema, parseVerifiedMaintainedSiteTaskTestbed } from "./siteTaskTestbedContract";
import { nativeDecisionEnvelopeSchema, nativeEvidencePlanSchema, sensitivePaths } from "./taskEvaluationRunContract";
import { verifyProducerArtifact } from "./producerCanonicalArtifact";
import { projectWebsiteTaskContext, projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import type { JobEvidenceSummary } from "../../client/src/types/jobMarketplace";

export const jobEvidenceId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
export const jobEvidenceDigest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const jobEvidenceQuestionSchema = z.object({ question: z.string().trim().min(1).max(2000) }).strict();
export const jobEvidenceRequestSchema = z.object({
  schema_version: z.literal("job_evidence_request.v1"), request_id: jobEvidenceId, job_id: jobEvidenceId,
  brief_digest: jobEvidenceDigest, approved_task_digest: jobEvidenceDigest.nullable(), question: z.string().min(1).max(2000),
  decision_evidence_request: nativeDecisionEvidenceRequestSchema.nullable(), testbed: maintainedSiteTaskTestbedSchema.nullable(),
  testbed_canonical_json: z.string().max(1_500_000).nullable(), decision_request_canonical_json: z.string().max(1_000_000).nullable(),
  compiled_card_canonical_json: z.record(z.string(), z.string().max(1_000_000)).nullable().optional(),
  capture_session_id: jobEvidenceId.nullable(), intake_id: jobEvidenceId.nullable(),
  requested_by: z.object({ uid: jobEvidenceId }).strict(), idempotency_key: jobEvidenceId,
  context_limitations: z.array(z.string().min(1).max(1000)).max(20).optional(), request_digest: jobEvidenceDigest,
}).strict();
// Canonical v1 handoff examples predate the capture-run-only generated-content field.
// Accept its absence without adding a value or changing an existing native envelope digest.
export const jobDecisionEnvelopeSchema = nativeDecisionEnvelopeSchema.extend({
  claim_ceiling: nativeDecisionEnvelopeSchema.shape.claim_ceiling.extend({
    generated_artifact_upgrades_raw_or_physical_claim: z.literal(false).optional(),
  }),
});
export const jobEvidencePublicationSchema = z.object({
  schema_version: z.literal("job_evidence_publication.v1"), request_id: jobEvidenceId, job_id: jobEvidenceId,
  brief_digest: jobEvidenceDigest, request_digest: jobEvidenceDigest, approved_task_digest: jobEvidenceDigest.nullable(),
  decision_request_digest: jobEvidenceDigest.nullable(), plan_digest: jobEvidenceDigest.nullable(), testbed_digest: jobEvidenceDigest.nullable(),
  sequence: z.number().int().nonnegative(),
  state: z.enum(["information_required", "planned", "blocked", "decision", "partial_decision", "abstention", "failed", "cancelled", "unavailable"]),
  question: z.string().min(1).max(2000), summary: z.string().min(1).max(10000), next_action: z.string().min(1).max(10000),
  limitations: z.array(z.string().min(1).max(2000)).max(100), run_id: jobEvidenceId.nullable(),
  decision_envelope: jobDecisionEnvelopeSchema.nullable(), evidence_plan: nativeEvidencePlanSchema.nullable(),
  evidence_plan_canonical_json: z.string().max(1_500_000).nullable(), decision_envelope_canonical_json: z.string().max(1_500_000).nullable(),
  authorization_candidates: z.array(z.record(z.string(), z.unknown())).max(100).default([]), publication_digest: jobEvidenceDigest,
}).strict();
export type JobEvidenceRequest = z.infer<typeof jobEvidenceRequestSchema>;
export type JobEvidencePublication = z.infer<typeof jobEvidencePublicationSchema>;

/** Scientific applicability deliberately excludes buying requirements and quote prices. */
export const scientificBriefDigest = (brief: Record<string, any>) => crossRuntimeDigest({
  requestId: brief.requestId ?? null, summary: brief.summary ?? "", captureMode: brief.captureMode ?? null,
  operatorAnswers: brief.operatorAnswers ?? {}, operatorUnknown: [...(brief.operatorUnknown ?? [])].sort(),
  operatorTaskDetails: brief.operatorTaskDetails ?? null, successCriteria: brief.successCriteria ?? null,
  unresolved: [...(brief.unresolved ?? [])].sort(),
});

/** Only admitted task-item context affects this source binding; quote and confirmation metadata do not. */
export const jobEvidenceTaskInventoryDigest = (brief: Record<string, any>, inventory?: TaskItemInventoryRecord | null) =>
  crossRuntimeDigest(projectWebsiteTaskContext(brief as SiteTaskBriefRecord, undefined, { inventory }).task_items ?? []);

export const jobEvidenceSourceBindingSchema = z.object({
  schema_version: z.literal("job_evidence_source_binding.v1"), job_id: jobEvidenceId,
  capture_session_id: jobEvidenceId, intake_id: jobEvidenceId, source_capture_digest: jobEvidenceDigest,
  brief_digest: jobEvidenceDigest, task_inventory_digest: jobEvidenceDigest, command_request_id: jobEvidenceId, approved_task_digest: jobEvidenceDigest,
}).passthrough();

/** A real retained native session is selected by the accepted task action, never invented from a job ID. */
export function jobEvidenceCaptureSessionId(jobId: string, record: Record<string, any>) {
  const source = jobEvidenceSourceBindingSchema.safeParse(record.job_evidence_source);
  if (source.success && source.data.job_id === jobId) return source.data.capture_session_id;
  // Read the legacy document only if one exists. It still needs its explicit,
  // current signed task binding before scientificContext will admit it.
  return `walkthrough-${jobId}`;
}

export function scientificContext(session: Record<string, any> | null, binding?: {
  brief: Record<string, any>; record: Record<string, any>; inventory?: TaskItemInventoryRecord | null;
}) {
  const source = session?.pipeline_site_task_testbed;
  if (!binding || !source || !projectWebsiteCaptureRights(binding.record).derived_scene_generation_allowed
    || session?.capture_access?.future_processing_allowed === false || session?.completed_capture_lifecycle) return null;
  if (binding.record.job_evidence_source) {
    const pointer = jobEvidenceSourceBindingSchema.safeParse(binding.record.job_evidence_source);
    const retained = jobEvidenceSourceBindingSchema.safeParse(session?.job_evidence_source_binding);
    if (!pointer.success || !retained.success || pointer.data.job_id !== binding.brief.requestId
      || pointer.data.brief_digest !== scientificBriefDigest(binding.brief)
      || pointer.data.task_inventory_digest !== jobEvidenceTaskInventoryDigest(binding.brief, binding.inventory)
      || pointer.data.capture_session_id !== session?.session_id || pointer.data.intake_id !== session?.request?.intake_id
      || pointer.data.approved_task_digest !== session?.approved_task_definition?.approved_task_digest
      || ["job_id", "capture_session_id", "intake_id", "source_capture_digest", "brief_digest", "task_inventory_digest", "command_request_id", "approved_task_digest"]
        .some(key => pointer.data[key] !== retained.data[key])) return null;
  }
  const explicitBrief = source.job_id === binding.brief.requestId && source.brief_digest === scientificBriefDigest(binding.brief);
  let contextMatches = false;
  if (source.website_task_context_digest) {
    const context = projectWebsiteTaskContext(binding.brief as SiteTaskBriefRecord, projectWebsiteCaptureRights(binding.record), { inventory: binding.inventory,
      ...(binding.record.website_scene_sponsorship?.purpose ? { purpose: binding.record.website_scene_sponsorship.purpose } : {}) });
    contextMatches = source.website_task_context_digest === context.context_digest;
  }
  if (!explicitBrief && !contextMatches) return null;
  const testbed = source?.testbed && parseVerifiedMaintainedSiteTaskTestbed(source.testbed, source.testbed_canonical_json, source.compiled_card_canonical_json);
  const request = nativeDecisionEvidenceRequestSchema.safeParse(source?.decision_evidence_request);
  const valid = testbed?.ok && request.success
    && verifyProducerArtifact(request.data, "request_digest", source.decision_request_canonical_json)
    && request.data.testbed_digest === testbed.testbed.testbed_digest
    && source.approved_task_digest === testbed.testbed.approved_task_definition.digest
    && session?.approved_task_definition?.approved_task_digest === source.approved_task_digest;
  return valid ? { testbed: testbed.testbed, decisionRequest: request.data,
    testbedCanonicalJson: source.testbed_canonical_json ?? null, decisionRequestCanonicalJson: source.decision_request_canonical_json ?? null,
    compiledCardCanonicalJson: source.compiled_card_canonical_json ?? null } : null;
}

export function buildJobEvidenceRequest(args: { jobId: string; idempotencyKey: string; uid: string; question: string; brief: Record<string, unknown>; session: Record<string, any> | null; record?: Record<string, any>; inventory?: TaskItemInventoryRecord | null }): JobEvidenceRequest {
  const context = scientificContext(args.session, args.record ? { brief: args.brief, record: args.record, inventory: args.inventory } : undefined);
  const usable = context && context.decisionRequest.decision_question === args.question;
  const content = {
    schema_version: "job_evidence_request.v1" as const,
    request_id: `job-evidence-${crossRuntimeDigest({ job: args.jobId, key: args.idempotencyKey }).slice(7, 47)}`,
    job_id: args.jobId, brief_digest: scientificBriefDigest(args.brief), question: args.question,
    approved_task_digest: usable ? context.testbed.approved_task_definition.digest : null,
    decision_evidence_request: usable ? context.decisionRequest : null, testbed: usable ? context.testbed : null,
    testbed_canonical_json: usable ? context.testbedCanonicalJson : null, decision_request_canonical_json: usable ? context.decisionRequestCanonicalJson : null,
    compiled_card_canonical_json: usable ? context.compiledCardCanonicalJson : null,
    capture_session_id: usable ? args.session!.session_id : null, intake_id: usable ? args.session!.request.intake_id : null,
    requested_by: { uid: args.uid }, idempotency_key: args.idempotencyKey,
    context_limitations: usable ? [] : [context ? "The existing scientific request answers a different question. Prepare the task-specific request before running new evidence." : "No current task-specific scientific request and source-bound testbed is available. Identify only the observations needed to answer this question."],
  };
  return jobEvidenceRequestSchema.parse({ ...content, request_digest: crossRuntimeArtifactDigest(content, "request_digest") });
}

export function verifyJobEvidencePublication(value: unknown): JobEvidencePublication {
  const publication = jobEvidencePublicationSchema.parse(value);
  if (sensitivePaths(publication).length) throw new Error("secret_values_forbidden");
  if (crossRuntimeArtifactDigest(publication, "publication_digest") !== publication.publication_digest) throw new Error("publication_digest_mismatch");
  const envelope = publication.decision_envelope;
  const plan = publication.evidence_plan;
  if (envelope && (!verifyProducerArtifact(envelope, "decision_envelope_digest", publication.decision_envelope_canonical_json)
    || envelope.request_digest !== publication.decision_request_digest || envelope.plan_digest !== publication.plan_digest
    || envelope.testbed_digest !== publication.testbed_digest || envelope.decision_question !== publication.question
    || envelope.overall_outcome !== publication.state)) throw new Error("decision_envelope_binding_mismatch");
  if (plan && (!verifyProducerArtifact(plan, "plan_digest", publication.evidence_plan_canonical_json) || plan.plan_digest !== publication.plan_digest
    || plan.request_digest !== publication.decision_request_digest || plan.testbed_digest !== publication.testbed_digest)) throw new Error("evidence_plan_binding_mismatch");
  if (["decision", "partial_decision", "abstention"].includes(publication.state) && !envelope) throw new Error("decision_envelope_required");
  return publication;
}

export function jobEvidenceSummary(publication: JobEvidencePublication, currentBriefDigest: string): JobEvidenceSummary {
  return { requestId: publication.request_id, publicationDigest: publication.publication_digest,
    briefDigest: publication.brief_digest, current: publication.brief_digest === currentBriefDigest,
    state: publication.state, question: publication.question, summary: publication.summary, nextAction: publication.next_action,
    limitations: publication.limitations, runId: publication.run_id, decisionDigest: publication.decision_envelope?.decision_envelope_digest ?? null,
    planDigest: publication.plan_digest, testbedDigest: publication.testbed_digest, approvedTaskDigest: publication.approved_task_digest,
    claims: publication.decision_envelope?.per_claim_verdicts.map(claim => ({ claimId: claim.claim_id, verdict: claim.verdict, rationale: claim.rationale })) ?? [],
  };
}

function pipelineUrl() {
  const explicit = process.env.JOB_EVIDENCE_PIPELINE_URL?.trim();
  if (explicit) return explicit;
  const existing = process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL?.trim() || process.env.TASK_EVALUATION_RUN_PLAN_URL?.trim();
  return existing ? new URL("/api/live-pipeline/job-evidence-requests", existing).toString() : "";
}
export async function forwardJobEvidence(payload: Record<string, unknown>, suffix = "", method = "POST") {
  const endpoint = pipelineUrl();
  const token = process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN?.trim() || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN?.trim();
  if (!endpoint || !token) return { ok: false as const, reason: "Pipeline evidence service is not configured. The question is saved; Blueprint can continue the options assessment using available evidence." };
  const body = method === "GET" ? "" : JSON.stringify(payload);
  const timestamp = new Date().toISOString(); const nonce = randomUUID(); const clientId = process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID?.trim() || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID?.trim() || "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${clientId}.${nonce}.${body}`).digest("hex");
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}${suffix}`, { method,
      headers: { "Content-Type": "application/json", "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-client-id": clientId,
        "x-blueprint-pipeline-nonce": nonce, "x-blueprint-pipeline-signature": `sha256=${signature}` },
      ...(method === "GET" ? {} : { body }), signal: AbortSignal.timeout(20_000) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, reason: "Pipeline could not accept this action. The saved question remains available; refresh before retrying.", status: response.status };
    return { ok: true as const, publication: verifyJobEvidencePublication(result?.publication ?? result) };
  } catch { return { ok: false as const, reason: "Pipeline evidence response could not be confirmed. Refresh before retrying; the same request identity will be reused." }; }
}
