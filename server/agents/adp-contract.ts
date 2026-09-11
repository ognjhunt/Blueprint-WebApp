import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const adpRuntimeSchema = z.enum(["openai_agents_api", "openai_agents_sdk"]);

// This record is issued by Pipeline's trusted task controller. Neither a
// browser nor a model can use it to change the admitted input or authority.
export const adpTaskAdmissionSchema = z.object({
  schema_version: z.literal("blueprint_webapp_agent_admission.v1"),
  task_id: id,
  task_digest: digest,
  run_id: id,
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  runtime: adpRuntimeSchema,
  model: z.string().min(1).max(192),
  title: z.string().min(1).max(200),
  owner_client_id: z.literal("blueprint-webapp"),
  expires_at: z.number().finite().positive(),
  enabled: z.boolean(),
  autostart: z.boolean(),
  proof_effect: z.literal("none"),
}).strict();

export const adpDiagnosisSchema = z.object({
  disposition: z.enum(["no_action", "investigate", "recover", "awaiting_input", "abstain"]),
  summary: z.string().max(20_000),
  evidence_references: z.array(z.string().max(1024)).max(100),
  next_actions: z.array(z.string().max(4000)).max(100),
  uncertainty: z.array(z.string().max(4000)).max(100),
}).strict();

const tokenCount = z.number().finite().int().nonnegative().optional();
const episodeRef = z.object({
  artifact_role: z.enum(["task_success_contract", "deterministic_score", "state_trace", "contact_force_trace", "frame_manifest", "lossless_frame", "review_video"]),
  artifact_digest: digest, step_index: z.number().int().nonnegative().nullable(),
  timestamp_seconds: z.number().finite().nonnegative().nullable(), note: z.string().max(500).nullable(),
}).strict();
export const adpEpisodeOutputSchema = z.object({
  episode_outcome: z.enum(["appears_complete", "appears_incomplete", "unclear"]),
  summary: z.string().max(8000), confidence: z.number().finite().min(0).max(1),
  events: z.array(z.object({ event_type: z.string().max(100),
    start_step: z.number().int().nonnegative().nullable(), end_step: z.number().int().nonnegative().nullable(),
    start_time_seconds: z.number().finite().nonnegative(), end_time_seconds: z.number().finite().nonnegative().nullable(),
    description: z.string().max(2000), evidence_refs: z.array(episodeRef).max(20),
    confidence: z.number().finite().min(0).max(1),
  }).strict()).max(200),
  possible_missed_events: z.array(z.object({ description: z.string().max(1000), reason: z.string().max(500),
    evidence_refs: z.array(episodeRef).max(20) }).strict()).max(100),
  contract_considerations: z.array(z.string()).max(100),
}).strict();
const visualOutputSchema = z.object({ status: z.enum(["inspected", "insufficient_evidence"]),
  summary: z.string().max(8000), evidence_gaps: z.array(z.string()).max(100), final_acceptance_granted: z.literal(false),
  findings: z.array(z.object({ view_id: id, source_sha256: digest, finding: z.string().max(2000),
    related_view_ids: z.array(id).max(32) }).strict()).max(100),
}).strict();
const usageSchema = z.object({
  input_tokens: tokenCount, output_tokens: tokenCount, total_tokens: tokenCount,
  cached_tokens: tokenCount, cache_write_tokens: tokenCount, reasoning_tokens: tokenCount,
  requests: tokenCount, request_count: tokenCount,
  input_tokens_details: z.object({ cached_tokens: tokenCount, cache_write_tokens: tokenCount }).strip().optional(),
  output_tokens_details: z.object({ reasoning_tokens: tokenCount }).strip().optional(),
  estimated_total_cost_usd: z.number().finite().nonnegative().optional(),
}).strip();

const resultSchema = z.object({
  schema_version: z.literal("blueprint_agent_task_result.v1"),
  task_id: id,
  task_digest: digest,
  run_id: id,
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  runtime: adpRuntimeSchema,
  runtime_version: z.string().max(192).optional(),
  session_id: id.nullable().optional(), turn_id: id.optional(),
  usage: usageSchema.nullable().optional(),
  cost_usd: z.number().finite().nonnegative().nullable().optional(),
  cost_status: z.enum(["official_reconciliation_required", "model_pricing_estimate_not_official_billing", "unavailable", "unknown"]).optional(),
  model: z.string(),
  output: z.union([adpDiagnosisSchema, adpEpisodeOutputSchema, visualOutputSchema]),
  output_digest: digest,
  result_digest: digest,
  scientific_acceptance_granted: z.literal(false),
}).strip();

export const adpTaskStatusSchema = z.object({
  schema_version: z.literal("blueprint_agent_task_status.v1"),
  task_id: id,
  task_digest: digest,
  run_id: id,
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  runtime: adpRuntimeSchema,
  state: z.enum(["queued", "creating", "creation_unresolved", "continuing", "running", "reconciling", "cancelling", "completed", "failed", "cancelled"]),
  error_code: z.string().nullable(),
  cancel_requested: z.boolean(),
  cleanup_state: z.enum(["not_requested", "pending", "deleted", "failed"]),
  updated_at: z.number().finite(),
  result: resultSchema.nullable(),
  usage: usageSchema.nullable(),
  resource_closeout: z.literal("not_established_by_agent_completion"),
  proof_effect: z.literal("none"),
  output_cross_runtime_digest: digest.nullable().optional(),
  interpretation: z.object({
    status: z.enum(["pending_validation", "completed", "abstained", "refused"]),
    task_id: id.optional(), task_digest: digest.optional(), receipt_digest: digest.optional(),
    input_bundle_digest: digest.optional(), error_code: z.string().max(192).optional(),
    proof_effect: z.literal("none").optional(),
  }).strict().optional(),
  visual_review: z.object({ status: z.enum(["pending_validation", "inspected", "insufficient_evidence", "refused"]),
    task_id: id.optional(), receipt_digest: digest.optional(), error_code: z.string().max(192).optional(),
    independent_final_review_required: z.literal(true).optional(), proof_effect: z.literal("none").optional(),
  }).strict().optional(),
}).strict();

export type AdpTaskAdmission = z.infer<typeof adpTaskAdmissionSchema>;
export type AdpTaskStatus = z.infer<typeof adpTaskStatusSchema>;
export type AdpDiagnosis = z.infer<typeof adpDiagnosisSchema>;
export type AdpTaskAction = "inspect" | "enqueue" | "cancel" | "cleanup";

export function assertAdpTaskIdentity(admission: AdpTaskAdmission, status: AdpTaskStatus) {
  for (const field of ["task_id", "task_digest", "run_id", "source_commit", "runtime"] as const) {
    if (admission[field] !== status[field]) throw new Error("adp_agent_task_identity_mismatch");
    if (status.result && admission[field] !== status.result[field]) {
      throw new Error("adp_agent_result_identity_mismatch");
    }
  }
  if (status.result && status.result.model !== admission.model) throw new Error("adp_agent_model_mismatch");
  if (status.state === "completed" && !status.result) throw new Error("adp_agent_completed_result_missing");
}
