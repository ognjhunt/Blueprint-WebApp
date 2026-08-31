import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const finiteNonNegative = z.number().finite().nonnegative();

export const openAIInferenceUsageCallSchema = z.object({
  schema_version: z.literal("openai_prompt_cache_usage.v1"),
  call_id: digest,
  capability: identifier,
  provider: z.literal("openai"),
  model: z.string().trim().min(1).max(80),
  cache_family: z.string().regex(/^[a-z][a-z0-9_]{2,79}$/),
  cache_policy_status: z.enum(["enabled", "disabled"]),
  cache_decision_reason: z.string().trim().min(1).max(160),
  cache_key_digest: digest.nullable(),
  prompt_contract_version: z.string().trim().min(1).max(120),
  stable_prefix_digest: digest,
  breakpoint_digests: z.array(digest).min(0).max(4),
  policy_digest: digest,
  privacy_scope: z.string().trim().min(1).max(120),
  processing_region: z.string().trim().min(1).max(80),
  reusable_prefix_tokens: z.number().int().nonnegative(),
  dynamic_suffix_tokens: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  cached_tokens: z.number().int().nonnegative(),
  cache_write_tokens: z.number().int().nonnegative(),
  uncached_input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  reasoning_tokens: z.number().int().nonnegative(),
  cache_hit_ratio: z.number().finite().min(0).max(1),
  uncached_input_cost_usd: finiteNonNegative.nullable(),
  cache_write_cost_usd: finiteNonNegative.nullable(),
  cached_read_cost_usd: finiteNonNegative.nullable(),
  output_cost_usd: finiteNonNegative.nullable(),
  estimated_total_cost_usd: finiteNonNegative.nullable(),
  estimated_cost_without_caching_usd: finiteNonNegative.nullable(),
  estimated_savings_usd: z.number().finite().nullable(),
  cost_status: z.enum([
    "model_pricing_estimate_not_official_billing",
    "model_pricing_unknown",
    "official_billing_reconciled",
  ]),
  provider_response_id: z.string().trim().min(1).max(160).nullable(),
  provider_request_id: z.string().trim().min(1).max(160).nullable().optional(),
  usage_detail_status: z.literal("complete"),
  dynamic_content_before_breakpoint: z.literal(false),
  raw_prompt_recorded: z.literal(false),
  raw_secret_values_recorded: z.literal(false),
  usage_receipt_digest: digest,
}).strict().superRefine((call, context) => {
  if (
    call.cached_tokens + call.cache_write_tokens + call.uncached_input_tokens
    !== call.input_tokens
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "openai_inference_usage_partition_invalid",
    });
  }
  if (call.cache_policy_status === "enabled" && call.cache_key_digest === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "openai_inference_usage_cache_key_digest_missing",
    });
  }
  if (call.cache_policy_status === "disabled" && call.cache_key_digest !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "openai_inference_usage_disabled_key_forbidden",
    });
  }
  if (
    (call.cache_policy_status === "enabled" && call.breakpoint_digests.length === 0)
    || (call.cache_policy_status === "disabled" && call.breakpoint_digests.length !== 0)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "openai_inference_usage_breakpoint_digest_mismatch",
    });
  }
});

export const openAIInferenceUsagePacketSchema = z.object({
  schema_version: z.literal("blueprint_openai_inference_usage_packet.v1"),
  run_id: identifier,
  launch_id: identifier.nullable(),
  source_commit: z.string().regex(/^[0-9a-f]{40}$/),
  source_receipt_digest: digest,
  generated_at_utc: z.string().datetime(),
  calls: z.array(openAIInferenceUsageCallSchema).min(1).max(64),
  raw_prompts_recorded: z.literal(false),
  raw_secret_values_recorded: z.literal(false),
  packet_digest: digest,
}).strict();

export type OpenAIInferenceUsagePacket = z.infer<typeof openAIInferenceUsagePacketSchema>;

export function parseOpenAIInferenceUsagePacket(value: unknown) {
  const parsed = openAIInferenceUsagePacketSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["openai_inference_usage_packet_schema_invalid"],
  };
  const packet = parsed.data;
  const blockers: string[] = [];
  for (const call of packet.calls) {
    if (
      canonicalArtifactDigest(
        call as unknown as Record<string, unknown>,
        "usage_receipt_digest",
      ) !== call.usage_receipt_digest
    ) blockers.push(`openai_inference_usage_digest_invalid:${call.call_id}`);
  }
  if (
    canonicalArtifactDigest(
      packet as unknown as Record<string, unknown>,
      "packet_digest",
    ) !== packet.packet_digest
  ) blockers.push("openai_inference_usage_packet_digest_invalid");
  return blockers.length > 0
    ? { ok: false as const, blockers }
    : { ok: true as const, packet };
}
