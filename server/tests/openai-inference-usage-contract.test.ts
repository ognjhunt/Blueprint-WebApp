// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseOpenAIInferenceUsagePacket } from "../utils/openaiInferenceUsageContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

function packetFixture() {
  const call: Record<string, unknown> = {
    schema_version: "openai_prompt_cache_usage.v1",
    call_id: `sha256:${"1".repeat(64)}`,
    capability: "task_aware_robot_placement_proposal",
    provider: "openai",
    model: "gpt-5.6-sol",
    cache_family: "task_aware_robot_placement_proposal",
    cache_policy_status: "enabled",
    cache_decision_reason: "expected_cached_cost_lower",
    cache_key_digest: `sha256:${"2".repeat(64)}`,
    prompt_contract_version: "robot-placement-proposal-v2",
    stable_prefix_digest: `sha256:${"3".repeat(64)}`,
    breakpoint_digests: [
      `sha256:${"3".repeat(64)}`,
      `sha256:${"6".repeat(64)}`,
    ],
    policy_digest: `sha256:${"4".repeat(64)}`,
    privacy_scope: "task_evaluation_rights_admitted",
    processing_region: "default",
    reusable_prefix_tokens: 1_200,
    dynamic_suffix_tokens: 800,
    input_tokens: 2_000,
    cached_tokens: 0,
    cache_write_tokens: 1_200,
    uncached_input_tokens: 800,
    output_tokens: 20,
    reasoning_tokens: 5,
    cache_hit_ratio: 0,
    uncached_input_cost_usd: 0.0032,
    cache_write_cost_usd: 0.006,
    cached_read_cost_usd: 0,
    output_cost_usd: 0.0004,
    estimated_total_cost_usd: 0.0096,
    estimated_cost_without_caching_usd: 0.0084,
    estimated_savings_usd: -0.0012,
    cost_status: "model_pricing_estimate_not_official_billing",
    provider_response_id: "resp_fixture",
    provider_request_id: "req_fixture",
    usage_detail_status: "complete",
    dynamic_content_before_breakpoint: false,
    raw_prompt_recorded: false,
    raw_secret_values_recorded: false,
    usage_receipt_digest: "",
  };
  call.usage_receipt_digest = canonicalArtifactDigest(call, "usage_receipt_digest");
  const packet: Record<string, unknown> = {
    schema_version: "blueprint_openai_inference_usage_packet.v1",
    run_id: "run-cache-proof",
    launch_id: null,
    source_commit: "a".repeat(40),
    source_receipt_digest: `sha256:${"5".repeat(64)}`,
    generated_at_utc: "2026-08-31T13:00:00Z",
    calls: [call],
    raw_prompts_recorded: false,
    raw_secret_values_recorded: false,
    packet_digest: "",
  };
  packet.packet_digest = canonicalArtifactDigest(packet, "packet_digest");
  return packet;
}

describe("signed Pipeline OpenAI usage contract", () => {
  it("accepts a digest-bound secret-clean call partition", () => {
    const parsed = parseOpenAIInferenceUsagePacket(packetFixture());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.packet.calls[0]).toMatchObject({
        input_tokens: 2_000,
        cache_write_tokens: 1_200,
        cached_tokens: 0,
        raw_prompt_recorded: false,
      });
    }
  });

  it("rejects inconsistent usage and any raw prompt field", () => {
    const invalidPartition = packetFixture();
    (invalidPartition.calls as Array<Record<string, unknown>>)[0].uncached_input_tokens = 799;
    const rawPrompt = packetFixture();
    (rawPrompt.calls as Array<Record<string, unknown>>)[0].raw_prompt = "sensitive prompt";

    expect(parseOpenAIInferenceUsagePacket(invalidPartition).ok).toBe(false);
    expect(parseOpenAIInferenceUsagePacket(rawPrompt).ok).toBe(false);
  });
});
