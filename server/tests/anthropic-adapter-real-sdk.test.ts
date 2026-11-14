// @vitest-environment node
// The real SDK and the real adapter; only globalThis.fetch is replaced, so
// nothing leaves the process. Ported from the independent review's probes.
import { propagation } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";


type Seen = { url: string; headers: Record<string, string>; body: Record<string, unknown> | null };
const seen: Seen[] = [];
let script: () => string[] = () => [];

function sse(events: Array<[string, unknown]>) {
  return events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** A response whose final usage carries per-attempt entries, after an optional fallback block. */
function fallbackEvents(opts: { startModel: string; iterations: unknown[]; usage: Record<string, number>; text: string }) {
  return sse([
    ["message_start", { type: "message_start", message: { id: "msg_fallback", type: "message", role: "assistant", model: opts.startModel,
      content: [], stop_reason: null, stop_sequence: null, stop_details: null, usage: { ...opts.usage, output_tokens: 1 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "fallback",
      from: { model: "requested" }, to: { model: "served" }, trigger: { type: "refusal", category: null } } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: opts.text } }],
    ["content_block_stop", { type: "content_block_stop", index: 1 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null, stop_details: null },
      usage: { ...opts.usage, iterations: opts.iterations } }],
    ["message_stop", { type: "message_stop" }],
  ]);
}

function messageEvents(opts: { text: string; stop: string | null; model?: string }) {
  const model = opts.model ?? "claude-opus-5-5";
  return sse([
    ["message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model, content: [],
      stop_reason: null, stop_sequence: null, stop_details: null,
      usage: { input_tokens: 11, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: opts.text } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: opts.stop, stop_sequence: null, stop_details: null },
      usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }],
    ["message_stop", { type: "message_stop" }],
  ]);
}

const answer = JSON.stringify({ answer: "ok", requires_human_review: false });

beforeEach(() => {
  vi.resetModules();
  seen.length = 0;
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture-not-a-key");
  // Every environment route that could move the host, the credential or the headers.
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "offline-token-not-a-key");
  vi.stubEnv("ANTHROPIC_PROFILE", "a-profile-that-does-not-exist");
  vi.stubEnv("ANTHROPIC_CUSTOM_HEADERS", "X-From-Env: from-env\nanthropic-beta: beta-from-env");
  vi.stubGlobal("fetch", async (input: unknown, init: RequestInit | undefined) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => { headers[key] = key === "authorization" ? "<redacted>" : value; });
    seen.push({ url, headers, body: init?.body ? JSON.parse(String(init.body)) : null });
    const chunks = script();
    const stream = new ReadableStream({ start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    } });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream", "request-id": "req_test" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); propagation.disable(); });

const schema = z.object({ answer: z.string(), requires_human_review: z.boolean() });
async function run(model: string, prompt = "Return JSON.", kind = "preview_diagnosis") {
  const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
  return runAnthropicAgentSdkTask({ kind, input: {}, metadata: {}, provider: "anthropic_agent_sdk",
    runtime: "anthropic_agent_sdk", model, tool_policy: { mode: "api" },
    definition: { build_prompt: () => prompt, output_schema: schema } } as never);
}

describe("Anthropic adapter with the real SDK", () => {
  it.each([undefined, "https://api.anthropic.com"])("sends to Anthropic's own host only (ANTHROPIC_BASE_URL=%s)", async (baseUrl) => {
    if (baseUrl) vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
    script = () => messageEvents({ text: answer, stop: "end_turn" });
    const result = await run("claude-opus-5-5");
    expect(result.status).toBe("completed");
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://api.anthropic.com/v1/messages");
    // Headers from ANTHROPIC_CUSTOM_HEADERS never leave; the request's own beta does.
    expect(seen[0].headers).not.toHaveProperty("x-from-env");
    expect(seen[0].headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
  });

  it("adds no beta header from the environment to a request that sends none", async () => {
    script = () => messageEvents({ text: answer, stop: "end_turn", model: "claude-haiku-5-5" });
    await run("claude-haiku-5-5");
    expect(seen[0].headers).not.toHaveProperty("anthropic-beta");
    expect(seen[0].headers).not.toHaveProperty("x-from-env");
  });

  it("makes no request at all when ANTHROPIC_BASE_URL names another company's host", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://api.other-company.example/anthropic");
    script = () => messageEvents({ text: answer, stop: "end_turn" });
    const result = await run("claude-opus-5-5");
    expect(seen).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", error: "anthropic_base_url_names_another_host" });
  });

  it("does not log the request when ANTHROPIC_LOG asks it to", async () => {
    vi.stubEnv("ANTHROPIC_LOG", "debug");
    const lines: string[] = [];
    for (const method of ["debug", "info", "log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { lines.push(JSON.stringify(args)); });
    }
    script = () => messageEvents({ text: answer, stop: "end_turn" });
    await run("claude-opus-5-5", "A SITE'S OWN WORDS");
    expect(lines.filter((line) => line.includes("A SITE'S OWN WORDS"))).toEqual([]);
  });

  it("records a stream that fails after it opened as usage unknown, never a complete zero", async () => {
    script = () => [...messageEvents({ text: '{"answer":"o', stop: "end_turn" }).slice(0, 3),
      `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "x" } })}\n\n`];
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "failed", error: "anthropic_provider_request_failed",
      artifacts: { output_usage_complete: false, usage: { prompt_tokens: null, completion_tokens: null, estimated_total_cost_usd: null },
        inference_reservation: { reconciled_cost_status: "includes_worst_case_reservations" },
        provider_error: { error_class: "overloaded" } } });
    expect((result.artifacts?.usage_samples as Array<Record<string, unknown>>)[0]).toMatchObject({
      request_status: "stream_failed_after_open", usage_complete: false });
  });

  it("does not accept a turn with no stop reason", async () => {
    script = () => messageEvents({ text: answer, stop: null });
    const result = await run("claude-opus-5-5");
    expect(result).toMatchObject({ status: "failed", error: "anthropic_unexpected_stop_reason" });
  });

  it("sends no trace context even when a propagator is registered", async () => {
    propagation.setGlobalPropagator({
      inject: (_context, carrier, setter) => { setter.set(carrier, "traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"); },
      extract: (context) => context,
      fields: () => ["traceparent"],
    });
    script = () => messageEvents({ text: answer, stop: "end_turn" });
    await run("claude-opus-5-5");
    expect(seen[0].headers).not.toHaveProperty("traceparent");
  });
});

describe("Anthropic adapter with the real SDK: what a request is counted at", () => {
  it("prices a declined attempt that names no model at the dearer of the requested and the fallback model", async () => {
    // Fable 5.2 declines before any output and Opus 4.8 serves; the declined
    // entry carries model: null and message_start already names the fallback.
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "10");
    script = () => fallbackEvents({ startModel: "claude-opus-4-8", text: answer,
      usage: { input_tokens: 100_000, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      iterations: [
        { type: "message", model: null, input_tokens: 100_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 100_000, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
      ] });
    const result = await run("claude-fable-5-2");
    expect(result.status).toBe("completed");
    // Declined: 100,000 at Fable's $8. Served: 100,000 at $5 plus 1,000 at $25. Per million.
    expect((result.artifacts?.usage as Record<string, number>).estimated_total_cost_usd).toBeCloseTo(1.325, 12);
    expect(result.artifacts?.served_models).toEqual(["claude-opus-4-8"]);
  });

  it("names the model that served a mid-stream fallback, not the one that declined", async () => {
    script = () => fallbackEvents({ startModel: "claude-opus-5-5", text: answer,
      usage: { input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      iterations: [
        { type: "message", model: "claude-opus-5-5", input_tokens: 1_000, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
      ] });
    const result = await run("claude-opus-5-5");
    expect(result.artifacts?.served_models).toEqual(["claude-opus-4-8"]);
    expect(result.logs?.find((log) => log.event_type === "provider.response.received")).toMatchObject({ served_model: "claude-opus-4-8" });
  });

  it("reserves a failed stream on a lane without the input ceiling at no less than the input it reported", async () => {
    script = () => [...sse([["message_start", { type: "message_start", message: { id: "msg_big", type: "message", role: "assistant",
      model: "claude-haiku-5-5", content: [], stop_reason: null, stop_sequence: null, stop_details: null,
      usage: { input_tokens: 900_000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }]]),
      `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "x" } })}\n\n`];
    const result = await run("claude-haiku-5-5", "Return JSON.", "inbound_qualification");
    const reserved = (result.artifacts?.inference_reservation as Record<string, number>).unknown_usage_reserved_cost_usd;
    // The reported input alone at list price, long-prompt tier: 900,000 x $0.50 per million.
    expect(reserved).toBeGreaterThanOrEqual(0.45);
    // Exactly: 900,000 x $0.625 (cache-write rate, 5x tier) + 64,000 x $2.50, per million.
    expect(reserved).toBeCloseTo(0.7225, 12);
  });

});

