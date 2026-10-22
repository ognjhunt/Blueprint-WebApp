/** Explicit, source-bound Atlas beta disclosure and allowance. ADP-040 / Day 28. */
import { z } from "zod";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const authorization = z.object({
  schema_version: z.literal("website_atlas_authorization.v1"),
  request_id: z.string().min(1), capture_id: z.string().min(1),
  task_context_digest: sha, source_video_digest: sha,
  provider_terms_reference: sha,
  accepted_by: z.string().min(1), approval_reference: z.string().min(1),
  private_processing_authorized: z.literal(true),
  provider_training_authorized: z.boolean(),
  provider_retention: z.enum(["account_does_not_retain", "project_library_retention_approved"]),
  maximum_cost_usd: z.number().finite().positive().max(1000),
  maximum_requests: z.number().int().min(1).max(32),
  expires_at_epoch: z.number().finite().positive(),
  claim_scope: z.literal("development_only"),
  planner: z.object({
    provider: z.literal("openai"), provider_terms_reference: sha,
    private_processing_authorized: z.literal(true), provider_training_authorized: z.literal(false),
    approval_reference: z.string().min(1),
  }).strict().optional(),
}).strict();

export function websiteAtlasAuthorization(input: {
  requestId: string; captureId: string; taskContextDigest: string;
  sourceVideoDigest?: string; termsDigest?: string; now: number;
  plannerTermsDigest?: string; planning?: boolean;
}) {
  let values: z.infer<typeof authorization>[];
  try {
    values = z.array(authorization).parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON || "[]"));
  } catch { throw new Error("website_atlas_authorization_invalid"); }
  const rows = values.filter(v => v.request_id === input.requestId && v.capture_id === input.captureId
    && v.task_context_digest === input.taskContextDigest && v.source_video_digest === input.sourceVideoDigest);
  if (rows.length !== 1) throw new Error("website_atlas_source_consent_required");
  const value = rows[0];
  if (value.expires_at_epoch <= input.now) throw new Error("website_atlas_consent_expired");
  if (!input.termsDigest || input.termsDigest !== value.provider_terms_reference)
    throw new Error("provider_terms_not_configured_or_changed");
  if (input.planning && (!value.planner || !input.plannerTermsDigest
    || value.planner.provider_terms_reference !== input.plannerTermsDigest))
    throw new Error("website_atlas_planner_consent_required");
  return { ...value, authorization_digest: digest(value) };
}

const runtimePolicy = z.object({
  schema_version: z.literal("website_atlas_runtime_policy.v1"),
  model: z.string().min(1), maximum_review_cost_usd: z.number().finite().positive().max(5),
  pose_input_cost_usd: z.number().finite().positive(), rgbd_view_cost_usd: z.number().finite().positive(),
  mesh_export_cost_usd: z.number().finite().positive().optional(),
  rate_card_reference: z.string().url().startsWith("https://"), reviewed_by: z.string().min(1),
  reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export function websiteAtlasRuntimePolicy() {
  try { return runtimePolicy.parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON || "null")); }
  catch { throw new Error("website_atlas_runtime_policy_required"); }
}

export function atlasAllowanceUsage(reservations: Record<string, any>) {
  // Old Atlas rows remain held after adding planner consent to the same grant.
  const rows = Object.values(reservations).filter(row => row.admission.provider === "world_labs_atlas"
    || Boolean(row.admission.atlas_authorization_digest));
  return { cost: rows.reduce((sum, row) => sum + Math.ceil((row.settlement?.actual_cost_usd
    ?? row.admission.maximum_cost_usd) * 1_000_000), 0) / 1_000_000,
    requests: rows.reduce((sum, row) => sum + row.admission.request_count, 0) };
}
