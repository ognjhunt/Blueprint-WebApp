// @vitest-environment node
// The real SDK and the real adapter; only globalThis.fetch is replaced, so
// nothing leaves the process. Ported from the independent review's probes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../agents/operator-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agents/operator-tools")>()),
  getCompanyHistoryAccess: async () => null,
}));

type Seen = { url: string; headers: Record<string, string>; body: Record<string, unknown> | null };
const seen: Seen[] = [];
let script: () => string[] = () => [];

function sse(events: Array<[string, unknown]>) {
  return events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
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
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const schema = z.object({ answer: z.string(), requires_human_review: z.boolean() });
async function run(model: string, prompt = "Return JSON.") {
  const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
  return runAnthropicAgentSdkTask({ kind: "preview_diagnosis", input: {}, metadata: {}, provider: "anthropic_agent_sdk",
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
});
