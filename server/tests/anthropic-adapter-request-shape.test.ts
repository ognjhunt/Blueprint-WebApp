// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// A stub client: it records the constructor options and every request, and
// answers from `respond`. No request leaves the process.
const stub = vi.hoisted(() => ({
  constructed: [] as Array<Record<string, unknown>>,
  requests: [] as Array<{ params: Record<string, unknown>; options: Record<string, unknown> }>,
  respond: (() => { throw new Error("no response queued"); }) as (params: Record<string, unknown>) => unknown,
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class Anthropic {
    static APIError = real.default.APIError;
    beta = {
      messages: {
        stream: (params: Record<string, unknown>, options: Record<string, unknown>) => {
          stub.requests.push({ params: structuredClone(params), options });
          return { finalMessage: async () => stub.respond(params) };
        },
      },
    };
    constructor(options: Record<string, unknown>) {
      stub.constructed.push(options);
    }
  }
  return { ...real, default: Anthropic };
});

const historyRun = vi.hoisted(() => vi.fn(async () => ({ ok: true, rows: [] })));

const outputSchema = z.object({ answer: z.string(), requires_human_review: z.boolean() });

function task(model: string, kind = "preview_diagnosis", metadata: Record<string, unknown> = {}) {
  return {
    kind, input: { message: "status" }, metadata,
    provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk", model,
    tool_policy: { mode: "api" },
    definition: { build_prompt: () => "Return JSON.", output_schema: outputSchema },
  } as never;
}

const usage = { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const json = (answer = "ok") => ({ type: "text", text: JSON.stringify({ answer, requires_human_review: false }) });
const message = (content: unknown[], stop_reason = "end_turn", extra: Record<string, unknown> = {}) =>
  ({ id: `msg_${stub.requests.length}`, model: "claude-haiku-5-5", content, usage, stop_reason, stop_details: null, ...extra });

async function run(model: string, kind?: string, metadata?: Record<string, unknown>) {
  const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
  return runAnthropicAgentSdkTask(task(model, kind, metadata));
}

beforeEach(() => {
  vi.resetModules();
  stub.constructed.length = 0;
  stub.requests.length = 0;
  historyRun.mockClear();
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Anthropic adapter: client", () => {
  it.each([undefined, "https://api.anthropic.com", "https://api.anthropic.com/"])(
    "pins Anthropic's own host (ANTHROPIC_BASE_URL=%s)", async (baseUrl) => {
      if (baseUrl) vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
      vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "offline-token");
      stub.respond = () => message([json()]);
      await run("claude-opus-5-5");
      expect(stub.constructed).toHaveLength(1);
      expect(stub.constructed[0].baseURL).toBe("https://api.anthropic.com");
      // One credential, passed in code, so the environment's token is not read.
      expect(stub.constructed[0].apiKey).toBe("offline-fixture");
      expect(stub.constructed[0]).not.toHaveProperty("authToken");
    });

  it.each(["https://api.other-company.example/anthropic", "http://api.anthropic.com", "not a url"])(
    "is not configured, builds no client and sends nothing when ANTHROPIC_BASE_URL is %s", async (baseUrl) => {
      vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
      stub.respond = () => message([json()]);
      const result = await run("claude-opus-5-5");
      expect(stub.constructed).toHaveLength(0);
      expect(stub.requests).toHaveLength(0);
      expect(result).toMatchObject({ status: "failed", error: "anthropic_base_url_names_another_host" });
      expect(JSON.stringify(result)).not.toContain("other-company");
      const { isProviderConfigured, getAnthropicConfigurationIssue } = await import("../agents/provider-config");
      expect(isProviderConfigured("anthropic_agent_sdk")).toBe(false);
      expect(getAnthropicConfigurationIssue()).toBe("anthropic_base_url_names_another_host");
    });

  it("fixes the SDK's log level and tracing, and removes every header the environment would add", async () => {
    vi.stubEnv("ANTHROPIC_LOG", "debug");
    vi.stubEnv("ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE", "content");
    vi.stubEnv("ANTHROPIC_CUSTOM_HEADERS", "X-From-Env: one\nanthropic-beta: from-env");
    stub.respond = () => message([json()]);
    await run("claude-haiku-5-5");
    expect(stub.constructed[0]).toMatchObject({ logLevel: "warn", openTelemetry: { traces: false, propagation: false },
      defaultHeaders: { "X-From-Env": null, "anthropic-beta": null } });
  });
});

describe("Anthropic adapter: request shape", () => {

  it("turns the server-side refusal fallback on where the model has one", async () => {
    stub.respond = () => message([json()]);
    await run("claude-opus-5-5");
    // The fallback model is named so the cap can reserve its list price.
    expect(stub.requests[0].params).toMatchObject({ betas: ["server-side-fallback-2026-07-01"], fallbacks: [{ model: "claude-opus-4-8" }] });
  });

  it("sends no fallback for the small model, which has none", async () => {
    stub.respond = () => message([json()]);
    await run("claude-haiku-5-5");
    expect(stub.requests[0].params).not.toHaveProperty("fallbacks");
    expect(stub.requests[0].params).not.toHaveProperty("betas");
  });


  it("takes the output ceiling from config", async () => {
    vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "20000");
    stub.respond = () => message([json()]);
    await run("claude-opus-5-5");
    expect(stub.requests[0].params.max_tokens).toBe(20_000);
  });

  it.each(["claude-unknown-test", "claude-sonnet-4-5", "claude-opus-5-5-custom"])(
    "does not send a model without a request shape and a list price (%s)", async (model) => {
      stub.respond = () => message([json()]);
      const result = await run(model);
      expect(result).toMatchObject({ status: "failed", error: "anthropic_model_not_supported",
        artifacts: { inference_not_invoked: true } });
      expect(stub.requests).toHaveLength(0);
    });


  it("a correction is a user turn after the answer, never a prefilled assistant turn", async () => {
    let call = 0;
    stub.respond = () => (call++ === 0 ? message([{ type: "text", text: "not-json" }]) : message([json()]));
    const result = await run("claude-opus-5-5");
    expect(result.status).toBe("completed");
    const second = stub.requests[1].params.messages as Array<{ role: string }>;
    expect(second.map((entry) => entry.role)).toEqual(["user", "assistant", "user"]);
  });
});

describe("Anthropic adapter: stop reasons", () => {
  it.each([null, "stop_sequence", "something_new"])("a stop reason it does not accept (%s) is a typed failure, not success", async (stop) => {
    stub.respond = () => message([json()], stop as never);
    const result = await run("claude-haiku-5-5");
    expect(result).toMatchObject({ status: "failed", error: "anthropic_unexpected_stop_reason",
      artifacts: { provider_error: { error_class: "other", type: "unexpected_stop_reason" } } });
    expect(result.output).toBeUndefined();
  });

  it("joins the text on either side of a mid-output fallback: the fallback model continues the partial", async () => {
    stub.respond = () => message([
      { type: "text", text: '{"answer":"o' },
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-4-8" }, trigger: { type: "refusal", category: null } },
      { type: "text", text: 'k","requires_human_review":false}' },
    ]);
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "completed", output: { answer: "ok" } });
    expect(stub.requests).toHaveLength(1);
  });

  it("takes every attempt's output from the task's output room", async () => {
    vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "10000");
    let call = 0;
    stub.respond = () => call++ === 0
      ? message([{ type: "text", text: "not-json" }], "end_turn", { usage: { ...usage, output_tokens: 300, iterations: [
          { type: "message", model: "claude-opus-5-5", input_tokens: 20, output_tokens: 700, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 20, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        ] } })
      : message([json()]);
    await run("claude-opus-5-5");
    expect(stub.requests[1].params.max_tokens).toBe(9_000);
  });

  it("a refusal is a typed failure; its partial text is discarded and its tool calls never run", async () => {
    stub.respond = () => message([
      { type: "text", text: '{"answer":"partial' },
      { type: "tool_use", id: "t1", name: "search_company_history", input: { query: "x" } },
    ], "refusal", { stop_details: { type: "refusal", category: "cyber", explanation: null } });
    const result = await run("claude-opus-5-5", "preview_diagnosis", { with_history: true });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("anthropic_refused");
    expect(result.raw_output_text).toBe("");
    expect(result.artifacts).toMatchObject({ provider_error: { error_class: "refused", code: "cyber" } });
    expect(historyRun).not.toHaveBeenCalled();
    expect(stub.requests).toHaveLength(1);
  });

  it("max_tokens is a typed failure and is not run as a tool call", async () => {
    stub.respond = () => message([{ type: "tool_use", id: "t1", name: "search_company_history", input: {} }], "max_tokens");
    const result = await run("claude-opus-5-5", "preview_diagnosis", { with_history: true });
    expect(result).toMatchObject({ status: "failed", error: "anthropic_output_truncated" });
    expect(result.artifacts).toMatchObject({ provider_error: { error_class: "other", type: "max_tokens" } });
    expect(historyRun).not.toHaveBeenCalled();
  });


  it("counts every attempt's usage when the response reports them", async () => {
    stub.respond = () => message([json()], "end_turn", { usage: { ...usage, iterations: [
      { type: "message", input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      { type: "fallback_message", input_tokens: 100, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ] } });
    const result = await run("claude-opus-5-5");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: 200, completion_tokens: 30 });
  });
});

describe("Anthropic adapter: cost of a task with several requests", () => {
  const sized = (inputTokens: number, text: string) => ({ id: `msg_${stub.requests.length}`, model: "claude-haiku-5-5",
    content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null,
    usage: { input_tokens: inputTokens, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  const telemetryCost = async (result: Awaited<ReturnType<typeof run>>) => {
    const { extractAgentCostTelemetry } = await import("../utils/agentCostTelemetry");
    return extractAgentCostTelemetry({ id: "run", session_id: null, task_kind: "preview_diagnosis", provider: "anthropic_agent_sdk",
      model: "claude-haiku-5-5", metadata: {}, artifacts: result.artifacts, logs: result.logs, created_at: "2026-11-13T00:00:00.000Z" } as never);
  };

  it("two requests under the long-prompt threshold cost what two separate small requests cost", async () => {
    let call = 0;
    stub.respond = () => sized(60_000, call++ === 0 ? "not-json" : JSON.stringify({ answer: "ok", requires_human_review: false }));
    const result = await run("claude-haiku-5-5");
    expect(result.status).toBe("completed");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: 120_000, completion_tokens: 20 });
    // 2 x (60,000 x $0.10 + 10 x $0.50) per million; the sum crossing 100,000 changes nothing.
    expect((await telemetryCost(result)).cost_estimate_usd).toBeCloseTo(0.01201, 12);
  });

  it("one request over the threshold costs the higher rate", async () => {
    stub.respond = () => sized(120_000, JSON.stringify({ answer: "ok", requires_human_review: false }));
    const result = await run("claude-haiku-5-5");
    // 120,000 x $0.50 + 10 x $2.50 per million.
    expect((await telemetryCost(result)).cost_estimate_usd).toBeCloseTo(0.060025, 12);
  });
});

describe("Anthropic adapter: every request is priced, reserved and capped", () => {
  it("has a list price for every model it can send or be served by", async () => {
    const { anthropicRequestModels } = await import("../agents/adapters/anthropic-agent-sdk");
    const { anthropicPricingForModel } = await import("../utils/anthropicPricing");
    const models = anthropicRequestModels();
    expect(models).toEqual(expect.arrayContaining(["claude-opus-5-5", "claude-haiku-5-5", "claude-opus-4-8", "claude-fable-5-2", "claude-sonnet-5"]));
    expect(models.filter((model) => !anthropicPricingForModel(model))).toEqual([]);
  });

  it("prices a fallback-served attempt at the fallback model's own rate", async () => {
    stub.respond = () => message([json()], "end_turn", { model: "claude-opus-4-8", usage: { ...usage, iterations: [
      { type: "message", model: "claude-opus-5-5", input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 1_000, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ] } });
    const result = await run("claude-opus-5-5");
    // Declined attempt at $4/$20, served attempt at $5/$25, per million.
    const expected = (1_000 * 4 + 100 * 20 + 1_000 * 5 + 1_000 * 25) / 1_000_000;
    expect((result.artifacts?.usage as Record<string, number>).estimated_total_cost_usd).toBeCloseTo(expected, 12);
    expect(result.artifacts?.inference_reservation).toMatchObject({ reconciled_cost_status: "reported_usage_pricing_estimate" });
  });

  it("marks the run's cost unknown, never lower, when a served model has no price row", async () => {
    stub.respond = () => message([json()], "end_turn", { model: "claude-unpriced-test" });
    const result = await run("claude-haiku-5-5");
    expect(result.status).toBe("completed");
    expect(result.artifacts).toMatchObject({ usage: { estimated_total_cost_usd: null },
      inference_reservation: { reconciled_cost_status: "includes_worst_case_reservations" } });
    const { extractAgentCostTelemetry } = await import("../utils/agentCostTelemetry");
    const telemetry = extractAgentCostTelemetry({ id: "run", session_id: null, task_kind: "preview_diagnosis",
      provider: "anthropic_agent_sdk", model: "claude-haiku-5-5", metadata: {}, artifacts: result.artifacts,
      logs: result.logs, created_at: "2026-11-13T00:00:00.000Z" } as never);
    expect(telemetry.cost_estimate_usd).toBeNull();
    // The rolling spend counts the request at its full reservation.
    const { anthropicWorstCaseRequestUsd } = await import("../utils/anthropicPricing");
    expect(telemetry.conservative_spend_usd).toBeCloseTo(anthropicWorstCaseRequestUsd("claude-haiku-5-5", 100_000, 64_000)!, 12);
  });

  it("refuses a request whose worst case exceeds the per-run cap, before sending it", async () => {
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "1");
    stub.respond = () => message([json()]);
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "failed", error: "inference_cost_cap_refused" });
    expect(stub.requests).toHaveLength(0);
  });

  it("uses the same cap as the OpenAI lane, by default $5: one top-model request fits, the small model's many", async () => {
    const { anthropicWorstCaseRequestUsd } = await import("../utils/anthropicPricing");
    const opus = anthropicWorstCaseRequestUsd("claude-opus-5-5", 100_000, 64_000)! + anthropicWorstCaseRequestUsd("claude-opus-4-8", 100_000, 64_000)!;
    expect(opus).toBeLessThan(5);
    stub.respond = () => message([json()]);
    const result = await run("claude-opus-5-5");
    expect(result.status).toBe("completed");
    expect(result.logs?.[0]).toMatchObject({ hard_cost_cap_usd: 5, spending_gated: true });
  });

  it("refuses a correction round that the cap no longer covers", async () => {
    stub.respond = () => message([{ type: "text", text: "not-json" }], "end_turn", { model: "claude-opus-5-5",
      usage: { input_tokens: 600_000, output_tokens: 40_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
    // $3.20 spent, and the next round could cost $2.21 more: over $5.
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "failed", error: "inference_cost_cap_refused" });
    expect(stub.requests).toHaveLength(1);
  });


  it("refuses an input above the shared input ceiling", async () => {
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS", "10");
    stub.respond = () => message([json()]);
    const result = await run("claude-haiku-5-5");
    expect(result).toMatchObject({ status: "failed", error: "inference_input_ceiling_exceeded" });
    expect(stub.requests).toHaveLength(0);
  });
});

describe("Anthropic adapter: provider errors", () => {
  it("classifies an SDK error from the request without keeping its message", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    stub.respond = () => {
      throw Anthropic.APIError.generate(402, { type: "error", error: { type: "billing_error", message: "PRIVATE detail" } },
        undefined, new Headers());
    };
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "failed", error: "anthropic_provider_request_failed" });
    expect(result.artifacts).toMatchObject({ provider_error: { error_class: "no_funds", status: 402, type: "billing_error" } });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
});
