import { createHash } from "node:crypto";

import { z } from "zod";

export const TASK_CANDIDATE_DISCOVERY_SCHEMA_VERSION =
  "task_candidate_discovery.v1" as const;
export const TASK_DECISION_COMMAND_SCHEMA_VERSION =
  "task_candidate_decision_command.v1" as const;

const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const nonEmpty = z.string().trim().min(1);

const groundedRowSchema = z
  .object({
    description: nonEmpty,
    confidence: z.number().min(0).max(1),
    supporting_frames: z.array(nonEmpty),
    supporting_3d_regions: z.array(nonEmpty),
    observation_status: z.enum(["directly_observed", "inferred"]),
    row_digest: sha256,
  })
  .passthrough();

const proposalMethodSchema = z
  .object({
    method_id: nonEmpty,
    version: nonEmpty,
    implementation_digest: sha256,
    proposer_identity: nonEmpty,
    origin: z.enum(["local_rule", "model", "provider", "model_provider"]),
  })
  .passthrough();

const successConditionSchema = z
  .object({
    metric: nonEmpty,
    operator: nonEmpty,
    threshold: z.unknown(),
    units: nonEmpty,
  })
  .passthrough();

const taskCandidateSchema = z
  .object({
    task_candidate_id: identifier,
    candidate_digest: sha256,
    description: nonEmpty,
    observed_objects: z.array(z.record(z.string(), z.unknown())).min(1),
    target_regions: z.array(z.record(z.string(), z.unknown())).min(1),
    required_robot_capabilities: z.array(nonEmpty).min(1),
    likely_task_family: nonEmpty,
    proposed_measurable_success_condition: successConditionSchema,
    required_site_reset: nonEmpty,
    supporting_frames: z.array(nonEmpty),
    supporting_3d_regions: z.array(nonEmpty),
    confidence: z.number().min(0).max(1),
    coverage: z.record(z.string(), z.unknown()),
    assumptions: z.array(nonEmpty),
    missing_evidence: z.array(nonEmpty),
    prohibited_claims: z.array(nonEmpty),
    estimated_evaluation_cost_usd: z.number().nonnegative(),
    expected_customer_value: z.unknown(),
    proposal_method: proposalMethodSchema,
    approval_status: z.literal("approval_required"),
  })
  .passthrough();

export const taskCandidateDiscoverySchema = z
  .object({
    schema_version: z.literal(TASK_CANDIDATE_DISCOVERY_SCHEMA_VERSION),
    discovery_id: identifier,
    source_capture: z
      .object({
        intake_id: identifier,
        capture_digest: sha256,
        capture_authority_profile: nonEmpty,
      })
      .passthrough(),
    capture_qa_report_digest: sha256,
    scene_analysis: z
      .object({
        observed_site_facts: z.array(groundedRowSchema),
        inferred_objects_and_affordances: z.array(groundedRowSchema),
        unsupported_or_occluded_regions: z.array(groundedRowSchema),
        hazards: z.array(groundedRowSchema),
        privacy_sensitive_areas: z.array(groundedRowSchema),
      })
      .strict(),
    proposal_method: proposalMethodSchema,
    task_candidates: z.array(taskCandidateSchema),
    approval_state: z.enum(["task_approval_required", "no_candidates"]),
    claim_boundaries: z
      .object({
        candidate_is_customer_intent: z.literal(false),
        candidate_is_task_success_evidence: z.literal(false),
        generated_or_inferred_content_upgrades_capture_authority: z.literal(false),
      })
      .strict(),
    discovery_digest: sha256,
  })
  .strict();

const measurableTaskSchema = z
  .object({
    description: nonEmpty,
    task_family: nonEmpty,
    measurable_success_conditions: z.array(successConditionSchema).min(1),
    reset_contract: z.record(z.string(), z.unknown()).refine(
      (value) => Object.keys(value).length > 0,
      "reset_contract must not be empty",
    ),
    task_objects: z.array(z.record(z.string(), z.unknown())).optional(),
    target_regions: z.array(z.record(z.string(), z.unknown())).optional(),
    required_robot_capabilities: z.array(nonEmpty).optional(),
  })
  .strict();

export const taskDecisionCommandSchema = z
  .object({
    schema_version: z.literal(TASK_DECISION_COMMAND_SCHEMA_VERSION),
    discovery_digest: sha256,
    task_candidate_id: identifier,
    candidate_digest: sha256,
    action: z.enum(["approve", "edit_and_approve", "reject", "request_more_capture"]),
    idempotency_key: nonEmpty.max(256),
    rationale: nonEmpty.max(2_000),
    edited_task: measurableTaskSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "edit_and_approve" && !value.edited_task) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edited_task"],
        message: "edited_task is required for edit_and_approve",
      });
    }
    if (value.action !== "edit_and_approve" && value.edited_task) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edited_task"],
        message: "edited_task is only permitted for edit_and_approve",
      });
    }
  });

export const pipelineTaskDiscoveryPublicationSchema = z
  .object({
    schema_version: z.literal("task_candidate_discovery_publication.v1"),
    capture_session_id: identifier,
    intake_id: identifier,
    discovery_digest: sha256,
    pipeline_task_discovery: taskCandidateDiscoverySchema,
    proof_boundary: z
      .object({
        candidate_is_customer_intent: z.literal(false),
        decision_evidence_request_compiled: z.literal(false),
        task_success_established: z.literal(false),
      })
      .strict(),
  })
  .strict();

const taskCandidateDecisionSchema = z
  .object({
    schema_version: z.literal("task_candidate_decision.v1"),
    discovery_id: identifier,
    discovery_digest: sha256,
    task_candidate_id: identifier,
    candidate_digest: sha256,
    action: z.enum(["approve", "edit_and_approve", "reject", "request_more_capture"]),
    actor: z
      .object({ role: z.enum(["customer", "operator"]), identity: nonEmpty })
      .passthrough(),
    idempotency_key: nonEmpty,
    rationale: nonEmpty,
    edited_task: measurableTaskSchema.nullable(),
    decision_id: identifier,
    decision_digest: sha256,
  })
  .strict();

const approvedTaskDefinitionSchema = z
  .object({
    schema_version: z.literal("approved_task_definition.v1"),
    approved_task_id: identifier,
    source_capture: z
      .object({
        intake_id: identifier,
        capture_digest: sha256,
        capture_authority_profile: nonEmpty,
      })
      .passthrough(),
    discovery_id: identifier.nullable(),
    discovery_digest: sha256.nullable(),
    task_candidate_id: identifier.nullable(),
    candidate_digest: sha256.nullable(),
    approval_decision_id: identifier,
    approval_decision_digest: sha256,
    approval_actor: z
      .object({ role: z.enum(["customer", "operator"]), identity: nonEmpty })
      .passthrough(),
    intent_source: z.enum([
      "customer_approved_candidate",
      "customer_edited_candidate",
      "customer_supplied",
    ]),
    task: measurableTaskSchema,
    proposer_identity: z.string(),
    prohibited_evaluator_identities: z.array(nonEmpty),
    approval_status: z.literal("approved"),
    approved_task_digest: sha256,
  })
  .strict();

export const pipelineTaskDecisionProcessingResultSchema = z
  .object({
    schema_version: z.literal("task_candidate_decision_processing_result.v1"),
    status: z.literal("processed"),
    accepted: z.literal(true),
    already_exists: z.boolean(),
    capture_session_id: identifier,
    intake_id: identifier,
    command_request_id: identifier,
    submission_fingerprint_sha256: sha256,
    pipeline_approval_status: z.enum(["approved", "rejected", "recapture_requested"]),
    pipeline_task_decision: taskCandidateDecisionSchema,
    approved_task_definition: approvedTaskDefinitionSchema.nullable(),
    decision_evidence_request: z.null(),
    processed_at_iso: nonEmpty,
    proof_boundary: z
      .object({
        webapp_command_is_pipeline_approval: z.literal(false),
        pipeline_decision_recorded: z.literal(true),
        approved_task_exists: z.boolean(),
        decision_evidence_request_compiled: z.literal(false),
        testbed_required_before_request_compilation: z.literal(true),
        task_success_established: z.literal(false),
        physical_success_established: z.literal(false),
        comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
      })
      .strict(),
  })
  .strict();

export type TaskCandidateDiscovery = z.infer<typeof taskCandidateDiscoverySchema>;
export type TaskDecisionCommand = z.infer<typeof taskDecisionCommandSchema>;
export type PipelineTaskDiscoveryPublication = z.infer<
  typeof pipelineTaskDiscoveryPublicationSchema
>;
export type PipelineTaskDecisionProcessingResult = z.infer<
  typeof pipelineTaskDecisionProcessingResultSchema
>;

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalArtifactDigest(
  value: Record<string, unknown>,
  digestField: string,
) {
  const normalized = structuredClone(value);
  delete normalized[digestField];
  return `sha256:${createHash("sha256").update(stableJson(normalized)).digest("hex")}`;
}

export function parseVerifiedTaskDiscovery(value: unknown) {
  const parsed = taskCandidateDiscoverySchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, blockers: ["task_discovery_schema_invalid"] };
  }
  const blockers: string[] = [];
  const discovery = parsed.data;
  if (
    canonicalArtifactDigest(
      discovery as unknown as Record<string, unknown>,
      "discovery_digest",
    ) !== discovery.discovery_digest
  ) {
    blockers.push("task_discovery_digest_mismatch");
  }
  for (const candidate of discovery.task_candidates) {
    if (
      canonicalArtifactDigest(
        candidate as unknown as Record<string, unknown>,
        "candidate_digest",
      ) !== candidate.candidate_digest
    ) {
      blockers.push(`task_candidate_digest_mismatch:${candidate.task_candidate_id}`);
    }
  }
  if (blockers.length) {
    return { ok: false as const, blockers: [...new Set(blockers)].sort() };
  }
  return { ok: true as const, discovery };
}

export function parseVerifiedPipelineTaskDecisionResult(value: unknown) {
  const parsed = pipelineTaskDecisionProcessingResultSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, blockers: ["pipeline_task_decision_result_schema_invalid"] };
  }
  const result = parsed.data;
  const blockers: string[] = [];
  if (
    canonicalArtifactDigest(
      result.pipeline_task_decision as unknown as Record<string, unknown>,
      "decision_digest",
    ) !== result.pipeline_task_decision.decision_digest
  ) {
    blockers.push("pipeline_task_decision_digest_mismatch");
  }
  if (
    result.approved_task_definition &&
    canonicalArtifactDigest(
      result.approved_task_definition as unknown as Record<string, unknown>,
      "approved_task_digest",
    ) !== result.approved_task_definition.approved_task_digest
  ) {
    blockers.push("approved_task_definition_digest_mismatch");
  }
  const approved = result.approved_task_definition;
  const decision = result.pipeline_task_decision;
  if (
    approved &&
    (
      approved.discovery_id !== decision.discovery_id ||
      approved.discovery_digest !== decision.discovery_digest ||
      approved.task_candidate_id !== decision.task_candidate_id ||
      approved.candidate_digest !== decision.candidate_digest ||
      approved.approval_decision_id !== decision.decision_id ||
      approved.approval_decision_digest !== decision.decision_digest ||
      stableJson(approved.approval_actor) !== stableJson(decision.actor)
    )
  ) {
    blockers.push("approved_task_decision_binding_mismatch");
  }
  if (
    approved &&
    approved.proposer_identity &&
    !approved.prohibited_evaluator_identities.includes(approved.proposer_identity)
  ) {
    blockers.push("approved_task_proposer_self_grading_boundary_missing");
  }
  if (
    result.proof_boundary.approved_task_exists !==
    Boolean(result.approved_task_definition)
  ) {
    blockers.push("approved_task_presence_boundary_mismatch");
  }
  if (
    ["approved"].includes(result.pipeline_approval_status) !==
    Boolean(result.approved_task_definition)
  ) {
    blockers.push("pipeline_approval_status_artifact_mismatch");
  }
  if (blockers.length) {
    return { ok: false as const, blockers: [...new Set(blockers)].sort() };
  }
  return { ok: true as const, result };
}
