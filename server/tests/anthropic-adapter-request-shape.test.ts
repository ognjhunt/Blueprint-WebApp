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
vi.mock("../agents/operator-tools", async (importOriginal) => ({
  ...await importOriginal<typeof import("../agents/operator-tools")>(),
  getCompanyHistoryAccess: async (task: { metadata?: Record<string, unknown> }) =>
    task.metadata?.with_history ? { companyWide: true } : null,
  runOperatorTool: historyRun,
}));

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
  ({ id: `msg_${stub.requests.length}`, model: "served-model", content, usage, stop_reason, stop_details: null, ...extra });

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
  it("pins Anthropic's own host even when ANTHROPIC_BASE_URL names another", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://api.other-company.example/anthropic");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "offline-token");
    stub.respond = () => message([json()]);
    await run("claude-opus-5-5");
    expect(stub.constructed).toHaveLength(1);
    expect(stub.constructed[0].baseURL).toBe("https://api.anthropic.com");
    // One credential, passed in code, so the environment's token is not read.
    expect(stub.constructed[0].apiKey).toBe("offline-fixture");
    expect(stub.constructed[0]).not.toHaveProperty("authToken");
  });
});

describe("Anthropic adapter: request shape", () => {
  it.each(["claude-opus-5-5", "claude-haiku-5-5"])("%s: no sampling, no prefill, no forced tool, thinking on", async (model) => {
    stub.respond = () => message([json()]);
    const result = await run(model, "preview_diagnosis", { with_history: true });
    expect(result.status).toBe("completed");
    const { params, options } = stub.requests[0];
    for (const key of ["temperature", "top_p", "top_k", "tool_choice", "stop_sequences"]) {
      expect(params).not.toHaveProperty(key);
    }
    const messages = params.messages as Array<{ role: string }>;
    expect(messages.at(-1)?.role).toBe("user");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.max_tokens).toBe(64_000);
    expect(params.tools).toBeDefined();
    expect(options).toMatchObject({ maxRetries: 0 });
    const outputConfig = params.output_config as { effort: string; format: { type: string; schema: Record<string, unknown> } };
    expect(outputConfig.effort).toBe("medium");
    expect(outputConfig.format.type).toBe("json_schema");
    expect(outputConfig.format.schema).toMatchObject({ type: "object", required: ["answer", "requires_human_review"] });
    expect(outputConfig.format).not.toHaveProperty("parse");
  });

  it("turns the server-side refusal fallback on where the model has one", async () => {
    stub.respond = () => message([json()]);
    await run("claude-opus-5-5");
    expect(stub.requests[0].params).toMatchObject({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });

  it("sends no fallback for the small model, which has none", async () => {
    stub.respond = () => message([json()]);
    await run("claude-haiku-5-5");
    expect(stub.requests[0].params).not.toHaveProperty("fallbacks");
    expect(stub.requests[0].params).not.toHaveProperty("betas");
  });

  it("sets effort per lane and lets the environment override it", async () => {
    stub.respond = () => message([json()]);
    await run("claude-haiku-5-5", "inbound_qualification");
    expect((stub.requests[0].params.output_config as { effort: string }).effort).toBe("max");
    vi.stubEnv("ANTHROPIC_INBOUND_QUALIFICATION_EFFORT", "high");
    await run("claude-haiku-5-5", "inbound_qualification");
    expect((stub.requests[1].params.output_config as { effort: string }).effort).toBe("high");
  });

  it("takes the output ceiling from config", async () => {
    vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "20000");
    stub.respond = () => message([json()]);
    await run("claude-opus-5-5");
    expect(stub.requests[0].params.max_tokens).toBe(20_000);
  });

  it("sends neither thinking, effort nor format to a model it does not know", async () => {
    stub.respond = () => message([json()]);
    const result = await run("claude-unknown-test");
    expect(result.status).toBe("completed");
    for (const key of ["thinking", "output_config", "fallbacks", "betas"]) {
      expect(stub.requests[0].params).not.toHaveProperty(key);
    }
    expect(result.logs?.[0]).toMatchObject({ request_shape: "model_not_in_request_table", structured_output: "not_sent" });
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

  it("after a fallback inside the response, runs only the serving model's tool calls and drops the declined part", async () => {
    let call = 0;
    stub.respond = () => (call++ === 0
      ? message([
          { type: "thinking", thinking: "", signature: "s0" },
          { type: "tool_use", id: "declined", name: "search_company_history", input: { query: "a" } },
          { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
          { type: "tool_use", id: "served", name: "search_company_history", input: { query: "b" } },
        ], "tool_use")
      : message([json()]));
    const result = await run("claude-opus-5-5", "preview_diagnosis", { with_history: true });
    expect(result.status).toBe("completed");
    expect(historyRun).toHaveBeenCalledTimes(1);
    const second = stub.requests[1].params.messages as Array<{ role: string; content: Array<{ type: string; id?: string; tool_use_id?: string }> }>;
    expect(second[1].content.map((block) => block.type)).toEqual(["fallback", "tool_use"]);
    expect(second[1].content[1].id).toBe("served");
    expect(second[2].content.map((block) => block.tool_use_id)).toEqual(["served"]);
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
