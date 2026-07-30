import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const nonEmpty = z.string().trim().min(1);

export const nativeEvidencePlanSchema = z.object({
  schema_version: z.literal("evidence_plan.v1"),
  plan_id: identifier,
  request_id: identifier,
  decision_id: identifier,
  request_digest: digest,
  testbed_id: identifier,
  testbed_version: identifier,
  testbed_digest: digest,
  claim_plans: z.array(z.record(z.string(), z.unknown())).min(1),
  execution_order: z.array(nonEmpty),
  physical_evidence_requests: z.array(z.record(z.string(), z.unknown())),
  budget_status: z.record(z.string(), z.unknown()),
  router_policy: z.object({
    deterministic: z.literal(true),
    provider_identity_is_qualification: z.literal(false),
    visual_realism_is_qualification: z.literal(false),
    agreement_is_independence: z.literal(false),
    uncalibrated_methods_are_debug_only: z.literal(true),
    cross_domain_transfer_enabled: z.literal(false),
    policy_ranking_thesis_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
  plan_digest: digest,
}).passthrough();

export const nativeDecisionEnvelopeSchema = z.object({
  schema_version: z.literal("decision_envelope.v1"),
  decision_id: identifier,
  request_id: identifier,
  request_digest: digest,
  plan_digest: digest,
  testbed_digest: digest,
  decision_question: nonEmpty,
  overall_outcome: z.enum(["decision", "partial_decision", "abstention"]),
  per_claim_verdicts: z.array(z.object({
    claim_id: identifier,
    claim_type: nonEmpty,
    verdict: z.enum(["supported", "not_supported", "abstention"]),
    rationale: nonEmpty,
    accepted_result_digests: z.array(digest),
    claim_ceiling: z.object({
      physical_success: z.boolean(),
      deployment_readiness: z.literal(false),
      safety_certification: z.literal(false),
    }).passthrough(),
  }).passthrough()).min(1),
  evidence_accepted: z.array(digest),
  evidence_rejected: z.array(z.record(z.string(), z.unknown())),
  validation_envelope: z.record(z.string(), z.unknown()),
  unsupported_conditions: z.array(nonEmpty),
  uncertainty: z.object({
    maximum: z.number().min(0).max(1),
    ranking_science_boundary: z.literal("thesis_not_supported"),
  }).strict(),
  cross_method_disagreements: z.array(z.record(z.string(), z.unknown())),
  shared_dependency_warnings: z.array(z.record(z.string(), z.unknown())),
  claim_ceiling: z.object({
    deployment_readiness: z.literal(false),
    safety_certification: z.literal(false),
    generated_artifact_upgrades_raw_or_physical_claim: z.literal(false),
  }).passthrough(),
  next_cheapest_experiment: nonEmpty,
  physical_evidence_still_required: z.array(z.record(z.string(), z.unknown())),
  deployment_approval: z.literal(false),
  safety_certification: z.literal(false),
  raw_policy_values_persisted: z.literal(false),
  raw_secret_values_persisted: z.literal(false),
  decision_envelope_digest: digest,
}).passthrough();

export const taskEvaluationRunPublicationSchema = z.object({
  schema_version: z.literal("task_evaluation_run_publication.v1"),
  capture_session_id: identifier,
  intake_id: identifier,
  run_id: identifier,
  testbed_digest: digest,
  request_digest: digest,
  plan_digest: digest,
  state: z.enum(["decided", "partially_decided", "abstained"]),
  evidence_plan: nativeEvidencePlanSchema,
  decision_envelope: nativeDecisionEnvelopeSchema,
  proof_boundary: z.object({
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
}).strict();

function sensitivePaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => sensitivePaths(child, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const lowered = key.toLowerCase();
    const sensitive = /(^|_)(secret|token|password|private_key|api_key|credential)($|_)/i.test(lowered)
      && child !== null && child !== "" && child !== false;
    return [...(sensitive ? [path] : []), ...sensitivePaths(child, path)];
  });
}

export function parseVerifiedTaskEvaluationRunPublication(value: unknown) {
  const parsed = taskEvaluationRunPublicationSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, blockers: ["run_publication_schema_invalid"] };
  const publication = parsed.data;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(publication.evidence_plan, "plan_digest") !== publication.evidence_plan.plan_digest) {
    blockers.push("evidence_plan_digest_mismatch");
  }
  if (canonicalArtifactDigest(publication.decision_envelope, "decision_envelope_digest") !== publication.decision_envelope.decision_envelope_digest) {
    blockers.push("decision_envelope_digest_mismatch");
  }
  if (
    publication.plan_digest !== publication.evidence_plan.plan_digest ||
    publication.plan_digest !== publication.decision_envelope.plan_digest ||
    publication.request_digest !== publication.evidence_plan.request_digest ||
    publication.request_digest !== publication.decision_envelope.request_digest ||
    publication.testbed_digest !== publication.evidence_plan.testbed_digest ||
    publication.testbed_digest !== publication.decision_envelope.testbed_digest
  ) blockers.push("run_publication_binding_mismatch");
  const expectedState = publication.decision_envelope.overall_outcome === "decision"
    ? "decided"
    : publication.decision_envelope.overall_outcome === "partial_decision"
      ? "partially_decided"
      : "abstained";
  if (publication.state !== expectedState) blockers.push("run_publication_state_mismatch");
  if (sensitivePaths(publication).length) blockers.push("run_publication_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, publication };
}
