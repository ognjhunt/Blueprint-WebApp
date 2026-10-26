import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../../utils/crossRuntimeCanonical";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../../utils/websiteTaskContext";
import type { SiteTaskBriefRecord } from "../../utils/siteTaskBrief";
import type { BetaPolicyScreeningPublication } from "../../utils/betaPolicyScreeningContract";
export const screeningSha = (character: string) => `sha256:${character.repeat(64)}`;
export function sealScreening(value: any): BetaPolicyScreeningPublication {
  return { ...value, publication_digest: crossRuntimeArtifactDigest(value, "publication_digest") };
}
export function screeningFixture(proposed = false) {
  const brief = { requestId: "job-one", summary: "Move the rigid part to its tray", confirmedAtIso: proposed ? null : "2026-10-26T12:00:00Z",
    operatorAnswers: {}, unresolved: [] } as unknown as SiteTaskBriefRecord;
  const job: Record<string, any> = { request: { buyerType: "site_operator", consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-26T11:00:00Z" } } };
  const context = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(job), proposed ? { purpose: "scene_preparation" } : undefined);
  job.website_scene_sponsorship = { task_context_digest: context.context_digest, capture_id: context.capture_id,
    ...(proposed ? { purpose: "scene_preparation" } : {}),
    owner: { user_id: "blueprint", organization_id: "blueprint-operations" } };
  const request = { submission_id: context.capture_id, owner: job.website_scene_sponsorship.owner,
    task: { task_id: `website-${context.context_digest.slice(7, 27)}` } };
  const receipt = { schema_version: "task_evaluation_scene_intake_receipt.v1", status: "accepted",
    intent_id: "scene-one", intent_digest: screeningSha("a"), request_digest: crossRuntimeDigest(request),
    provider_mutation_performed_inside_http_request: false };
  const status = { schema_version: "task_evaluation_scene_intent_status.v1", status: "completed", phase: "scene_prepared",
    intent_id: receipt.intent_id, intent_digest: receipt.intent_digest, request_digest: receipt.request_digest,
    owner: request.owner, result_reference: { uri: "gs://fixture/revision/configured_scene_revision.v1.json", digest: screeningSha("e"), size_bytes: 300 } };
  const intake = { website_request_id: brief.requestId, source_session_id: context.capture_id, state: "completed", request, request_digest: crossRuntimeDigest(request),
    receipt: { ...receipt, receipt_digest: crossRuntimeDigest(receipt) }, pipeline_status: { ...status, status_digest: crossRuntimeDigest(status) } };
  const publication = sealScreening({ schema_version: "beta_policy_screening_publication.v1", campaign_id: "campaign-one",
    site_id: context.scene_id, revision: 1, plan_digest: screeningSha("b"), catalog_digest: screeningSha("c"), scenario_plan_digest: screeningSha("d"),
    source: { scene_intent_id: receipt.intent_id, scene_intent_digest: receipt.intent_digest, capture_id: context.capture_id,
      task_id: request.task.task_id, task_context_digest: context.context_digest, scene_revision_digest: screeningSha("e") },
    status: "queued", purpose: "screening", execution_operator: { kind: "blueprint" },
    claim_ceiling: "diagnostic_policy_execution", recommendation_eligible: false,
    candidates: Array.from({ length: 36 }, (_, index) => ({ candidate_id: `candidate-${index}`, display_name: `Candidate ${index}`,
      configuration_digest: screeningSha("f"), status: "pending", blockers: [], episodes_planned: 3, episodes_scored: 0,
      episodes_succeeded: 0, episodes_failed: 0, episodes_void: 0, success_rate: null, session_result_digest: null })),
    budget: { currency: "USD", limit_usd: "15.00", committed_upper_bound_usd: "0", spent_upper_bound_usd: "0", reserved_usd: "0" },
    generated_at: "2026-10-26T12:10:00Z" });
  return { publication, job, brief, context, intake };
}
