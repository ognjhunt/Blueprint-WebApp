// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HAIKU_MODEL, haikuUsageCost } from "../utils/anthropicHaikuPricing";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
vi.mock("../agents/operator-tools", () => ({ getCompanyHistoryAccess: async () => null, openAiResponsesHistoryTools: [], runOperatorTool: vi.fn() }));
const task = () => ({ kind: "inbound_qualification", input: {}, provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk",
  model: HAIKU_MODEL, tool_policy: { mode: "api" }, definition: { build_prompt: () => "Original evidence; return answer JSON.", output_schema: z.object({ answer: z.string() }) } });
const response = (overrides = {}) => ({ id: "offline-response", model: HAIKU_MODEL, stop_reason: "end_turn",
  content: [{ type: "text", text: '{"answer":"known evidence"}' }], usage: { input_tokens: 1000, output_tokens: 200, inference_geo: "global" }, ...overrides });
beforeEach(() => { vi.resetModules(); create.mockReset(); vi.stubEnv("ANTHROPIC_API_KEY", "offline-key"); vi.stubEnv("ANTHROPIC_BASE_URL", ""); });
afterEach(() => vi.unstubAllEnvs());

describe("Luna native Haiku migration", () => {
  it("routes only Luna, preserving Sol and hosted/session-bound providers", async () => {
    const { migrateDirectLunaSelection } = await import("../agents/provider-config");
    expect(migrateDirectLunaSelection("inbound_qualification", "openai_responses", "gpt-6-luna")).toEqual({ provider: "anthropic_agent_sdk", model: HAIKU_MODEL });
    for (const model of ["gpt-6-sol", "gpt-6-astra", "gpt-5.6-luna"]) {
      expect(migrateDirectLunaSelection("inbound_qualification", "openai_responses", model)).toEqual({ provider: "openai_responses", model });
    }
    expect(migrateDirectLunaSelection("operator_thread", "openai_responses", "gpt-6-luna").provider).toBe("openai_responses");
    expect(migrateDirectLunaSelection("inbound_qualification", "openai_agents_api", "gpt-6-luna").provider).toBe("openai_agents_api");
  });
  it("prices native cache partitions and the 100k threshold", () => {
    const usage = { inference_geo: "global", input_tokens: 90_000, output_tokens: 1000, cache_read_input_tokens: 5000,
      cache_creation_input_tokens: 5000, cache_creation: { ephemeral_5m_input_tokens: 3000, ephemeral_1h_input_tokens: 2000 } };
    expect(haikuUsageCost(usage)?.totalCost).toBeCloseTo(0.010325);
    expect(haikuUsageCost({ ...usage, input_tokens: 90_001 })?.totalCost).toBeCloseTo(0.0516255);
    expect(haikuUsageCost({ input_tokens: 1, output_tokens: 0.5 })).toBeNull();
    expect(haikuUsageCost({ ...usage, cache_creation_input_tokens: 20 })).toBeNull();
  });
  it("uses native request controls and validates the output locally", async () => {
    create.mockResolvedValue(response());
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ answer: "known evidence" });
    expect(create.mock.calls[0][0]).toMatchObject({ model: HAIKU_MODEL, max_tokens: 16_000, output_config: { effort: "max" } });
    expect(create.mock.calls[0][0]).not.toHaveProperty("temperature");
    expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning");
    expect(create.mock.calls[0][1].maxRetries).toBe(0);
    expect(result.artifacts?.usage).toMatchObject({ estimated_total_cost_usd: 0.0002, cost_status: "model_pricing_estimate_not_official_billing" });
  });
  it.each([{ stop_reason: "max_tokens" }, { stop_reason: "refusal" }, { model: "claude-opus-5-5" }, { usage: {} },
    { usage: { input_tokens: 1, output_tokens: 16_001 } }])("holds an incomplete or unaccounted response: %j", async bad => {
    create.mockResolvedValue(response(bad));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.status).toBe("failed"); expect(result.requires_human_review).toBe(true);
    expect(result.artifacts?.provider_responses).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("retains an unknown transport outcome without reporting zero spend", async () => {
    create.mockRejectedValue(new Error("private-provider-body"));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.error).toBe("anthropic_provider_request_failed");
    expect(result.artifacts?.usage).toMatchObject({ estimated_total_cost_usd: null });
    expect(result.artifacts?.inference_budget).toMatchObject({ maximum_cost_usd: 5 });
    const { extractAgentCostTelemetry } = await import("../utils/agentCostTelemetry");
    const telemetry = extractAgentCostTelemetry({ ...result, artifacts: result.artifacts } as never);
    expect(telemetry.spend_accounting_status).toBe("reserved_unknown");
    expect(telemetry.conservative_spend_usd).toBeGreaterThan(0);
  });
  it("holds Anthropic-compatible proxy credentials before a native Haiku call", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic");
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.status).toBe("failed"); expect(create).not.toHaveBeenCalled();
  });
  it("keeps essential follow-up topics and rejects invented model topics", async () => {
    create.mockResolvedValue(response({ content: [{ type: "text", text: '{"question_ids":["invented","item_make_model"]}' }] }));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps({ taskStatement: "Move boxes", briefSummary: "Fixture", itemLabels: ["Boxes"],
      eligible: ["success_target", "item_photos", "item_weight", "item_make_model"] })).toEqual(["success_target", "item_photos", "item_make_model"]);
    expect(create.mock.calls[0][0]).toMatchObject({ model: HAIKU_MODEL, max_tokens: 600, output_config: { effort: "low" } });
  });
});
