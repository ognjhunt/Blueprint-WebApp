import { z } from "zod";

// Pipeline-owned evidence. A robot team's policy or skill trace cannot write it.
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const controlledNativeResultSchema = z.object({
  schema_version: z.literal("blueprint.controlled_native_private_result.v1"),
  evidence_scope: z.literal("development_only"),
  native_simulator: z.literal("isaac"),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  execution_receipt_digest: digest,
  outcome_receipt_digest: digest,
  task_spec_digest: digest,
  samples_digest: digest,
  policy_queries: z.number().int().positive().max(10000),
  executed_motor_steps: z.number().int().positive().max(100000),
  task_success: z.boolean(),
  outcome: z.string().min(1).max(200),
  scene_files_exported: z.literal(false),
  scoring_harness_exported: z.literal(false),
  physical_success_proven: z.literal(false),
  qualification_eligible: z.literal(false),
  provider_zero_verified: z.literal(true),
  provider_cost_status: z.enum(["observed", "pending_official_reconciliation"]),
  observed_provider_cost_usd: z.number().finite().nonnegative().nullable(),
}).strict().refine(row => row.provider_cost_status === "observed"
  ? row.observed_provider_cost_usd !== null : row.observed_provider_cost_usd === null,
  {message: "Provider cost status must match its retained amount"});

export type ControlledNativePrivateResult = z.infer<typeof controlledNativeResultSchema>;
