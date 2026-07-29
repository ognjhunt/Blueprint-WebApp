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

export type TaskCandidateDiscovery = z.infer<typeof taskCandidateDiscoverySchema>;
export type TaskDecisionCommand = z.infer<typeof taskDecisionCommandSchema>;

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
