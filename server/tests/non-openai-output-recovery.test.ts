// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
// This suite isolates output correction from the company-history tool phase.
// Company-lane correction and transport evidence have their own adapter tests.
const task = (provider: string) => ({ kind: "preview_diagnosis", provider, runtime: provider, model: provider === "gemini_video" ? "gemini-3.8-flash" : "claude-test",
  input: { taskVideoUrl: "https://example.com/clip.mp4" }, tool_policy: { mode: "api" },
  definition: { build_prompt: () => "Report observed count as JSON: {count:number}", output_schema: z.object({ count: z.number() }), video_processing_mode: "STATIC" } });
const anthropic = (text: string, tokens = 10) => ({ id: "message", content: [{ type: "text", text }], usage: { input_tokens: 20, output_tokens: tokens }, stop_reason: "end_turn" });

function geminiFixture(outputs: Array<{ text: string; tokens?: number; thoughts?: number; finish?: string; omitUsage?: boolean; omitInputUsage?: boolean; status?: number }>) {
  let index = 0;
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === "https://example.com/clip.mp4") return new Response("fixture-video", { headers: { "content-type": "video/mp4" } });
    if (url.endsWith("/upload/v1beta/files")) return new Response("{}", { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/fixture" } });
    if (url.endsWith("/upload/fixture")) return new Response(JSON.stringify({ file: { name: "files/fixture", uri: "https://generativelanguage.googleapis.com/files/fixture", mimeType: "video/mp4", state: "ACTIVE" } }));
    if (init.method === "DELETE") return new Response("{}");
    if (url.includes(":generateContent")) {
      const result = outputs[Math.min(index++, outputs.length - 1)];
      if (result.status) return new Response("PRIVATE_PROVIDER_URL", { status: result.status });
      return new Response(JSON.stringify({ candidates: [{ finishReason: result.finish ?? "STOP", content: { parts: [{ text: result.text }] } }],
        ...(result.omitUsage ? {} : { usageMetadata: { ...(result.omitInputUsage ? {} : { promptTokenCount: 20 }), candidatesTokenCount: result.tokens ?? 10, thoughtsTokenCount: result.thoughts ?? 0, totalTokenCount: 20 + (result.tokens ?? 10) + (result.thoughts ?? 0) } }) }));
    }
    throw new Error("unexpected fixture URL");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

beforeEach(() => { vi.resetModules(); create.mockReset(); vi.stubEnv("ANTHROPIC_API_KEY", "fixture"); vi.stubEnv("GEMINI_API_KEY", "fixture"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("provider output correction retains paid evidence", () => {
  it.each([true, false])("preserves Anthropic output with missing usage without inventing counters (valid=%s)", async valid => {
    create.mockResolvedValue({ id: "message-no-usage", content: [{ type: "text", text: valid ? '{"count":2}' : "not-json" }], stop_reason: "end_turn" });
    const result = await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task("anthropic_agent_sdk") as never);
    expect(result.status).toBe(valid ? "completed" : "failed");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: null, completion_tokens: null, total_tokens: null });
    expect(result.artifacts?.output_usage_complete).toBe(false);
    expect(result.raw_output_text).toBe(valid ? '{"count":2}' : "not-json");
    if (!valid) expect(result.error).toBe("output_correction_usage_unavailable");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("Anthropic repairs field errors in the same context and aggregates usage", async () => {
    create.mockResolvedValueOnce(anthropic('{"count":"two"}')).mockResolvedValueOnce(anthropic('{"count":2}'));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task("anthropic_agent_sdk") as never);
    expect(result).toMatchObject({ status: "completed", output: { count: 2 }, artifacts: { usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 } } });
    expect(create.mock.calls[1][0].messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: "assistant", content: [{ type: "text", text: '{"count":"two"}' }] })]));
    expect(JSON.stringify(create.mock.calls[1][0])).toContain("/count");
    expect(JSON.stringify(create.mock.calls[1][0])).toContain('expected');
    expect(create.mock.calls[1][0].tools).toBeUndefined();
    expect((result.artifacts?.output_repairs as any[])[0]).toMatchObject({ rawOutput: '{"count":"two"}', rawOutputSha256: expect.any(String) });
  });

  it.each(["anthropic_agent_sdk", "gemini_video"])("%s bounds repeated invalid output and retains all responses", async provider => {
    create.mockResolvedValue(anthropic("not-json"));
    const fetcher = geminiFixture([{ text: "not-json" }]);
    const result = provider === "gemini_video"
      ? await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task(provider) as never)
      : await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task(provider) as never);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("output_correction_limit");
    expect(result.raw_output_text).toBe("not-json");
    expect((result.artifacts?.output_repairs as any[])).toHaveLength(6);
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: 60 });
    expect(provider === "gemini_video" ? fetcher.mock.calls.filter(([url]) => url.includes(":generateContent")).length : create.mock.calls.length).toBe(6);
  });

  it("Gemini repairs text in the same context without video download, upload or analysis repetition", async () => {
    const fetcher = geminiFixture([{ text: '{"count":"two"}' }, { text: '{"count":2}' }]);
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    expect(result).toMatchObject({ status: "completed", output: { count: 2 }, artifacts: { usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 }, video_bytes: 13 } });
    expect(fetcher.mock.calls.filter(([url]) => url === "https://example.com/clip.mp4")).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/upload/v1beta/files"))).toHaveLength(1);
    const calls = fetcher.mock.calls.filter(([url]) => url.includes(":generateContent"));
    const correction = JSON.parse(calls[1][1]!.body as string);
    expect(correction.contents).toEqual(expect.arrayContaining([expect.objectContaining({ role: "model", parts: [{ text: '{"count":"two"}' }] })]));
    expect(JSON.stringify(correction)).not.toMatch(/file_data|file_uri|media_processing|tools/);
    expect(JSON.stringify(correction)).toContain("/count");
    expect(result.artifacts?.video_processing).toMatchObject({ mode: "static" });
  });

  it("retains Gemini incomplete paid usage without retrying the video analysis", async () => {
    const fetcher = geminiFixture([{ text: "unfinished", finish: "MAX_TOKENS", tokens: 32_768 }]);
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    expect(result.status).toBe("failed");
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: 32_768, total_tokens: 32_788 });
    expect(result.raw_output_text).toBe("unfinished");
    expect(result.artifacts?.video_sha256).toEqual(expect.any(String));
    expect(fetcher.mock.calls.filter(([url]) => url.includes(":generateContent"))).toHaveLength(1);
  });

  it.each(["anthropic_agent_sdk", "gemini_video"])("%s returns prior paid evidence when correction transport fails", async provider => {
    create.mockResolvedValueOnce(anthropic("not-json")).mockRejectedValueOnce(new Error("PRIVATE_PROVIDER_URL"));
    geminiFixture([{ text: "not-json" }, { text: "", status: 503 }]);
    const result = provider === "gemini_video"
      ? await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task(provider) as never)
      : await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task(provider) as never);
    expect(result.status).toBe("failed");
    expect(result.raw_output_text).toBe("not-json");
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: 10, total_tokens: 30 });
    expect(result.error).not.toContain("PRIVATE");
    expect((result.artifacts?.output_repairs as any[])[0]).toMatchObject({ rawOutput: "not-json" });
  });

  it("subtracts Gemini thinking from the original aggregate output allowance", async () => {
    const fetcher = geminiFixture([{ text: "not-json", tokens: 100, thoughts: 20_000 }, { text: '{"count":2}', tokens: 50 }]);
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    const calls = fetcher.mock.calls.filter(([url]) => url.includes(":generateContent"));
    expect(JSON.parse(calls[1][1]!.body as string).generationConfig.maxOutputTokens).toBe(12_668);
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: 20_150, reasoning_tokens: 20_000 });
  });

  it.each(["anthropic_agent_sdk", "gemini_video"])("%s preserves evidence and stops when aggregate output allowance is exhausted", async provider => {
    create.mockResolvedValueOnce(anthropic("not-json", 4000));
    const fetcher = geminiFixture([{ text: "not-json", tokens: 100, thoughts: 32_668 }]);
    const result = provider === "gemini_video"
      ? await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task(provider) as never)
      : await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task(provider) as never);
    expect(result.error).toContain("output_correction_budget_exhausted");
    expect(result.raw_output_text).toBe("not-json");
    expect(provider === "gemini_video" ? fetcher.mock.calls.filter(([url]) => url.includes(":generateContent")).length : create.mock.calls.length).toBe(1);
  });

  it.each(["anthropic_agent_sdk", "gemini_video"])("%s does not authorize further spend with missing usage", async provider => {
    create.mockResolvedValueOnce({ ...anthropic("not-json"), usage: {} });
    const fetcher = geminiFixture([{ text: "not-json", omitUsage: true }]);
    const result = provider === "gemini_video"
      ? await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task(provider) as never)
      : await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task(provider) as never);
    expect(result.error).toContain("output_correction_usage_unavailable");
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: null, total_tokens: null });
    expect(provider === "gemini_video" ? fetcher.mock.calls.filter(([url]) => url.includes(":generateContent")).length : create.mock.calls.length).toBe(1);
  });

  it("includes Anthropic cache writes and reads in retained billed input", async () => {
    create.mockResolvedValueOnce({ ...anthropic('{"count":2}'), usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 200 } });
    const result = await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task("anthropic_agent_sdk") as never);
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: 320, total_tokens: 330, prompt_cache_hit_tokens: 100, cache_write_tokens: 200 });
  });

  it("retains known Gemini output but does not spend again when input usage is missing", async () => {
    const fetcher = geminiFixture([{ text: "not-json", omitInputUsage: true }]);
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    expect(result.error).toContain("output_correction_usage_unavailable");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: null, completion_tokens: 10, total_tokens: 30 });
    expect(fetcher.mock.calls.filter(([url]) => url.includes(":generateContent"))).toHaveLength(1);
  });

  it("labels a truncated failed video upload as partial provenance", async () => {
    const baseFetcher = geminiFixture([{ text: '{"count":2}' }]);
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      if (url === "https://example.com/clip.mp4") return new Response("fixture-video", { headers: { "content-type": "video/mp4", "content-length": "100" } });
      if (url.endsWith("/upload/fixture")) {
        await new Response(init.body).arrayBuffer().catch(() => undefined);
        return new Response("{}", { status: 400 });
      }
      return baseFetcher(url, init);
    });
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    expect(result.status).toBe("failed");
    expect(result.artifacts).toMatchObject({ video_read_complete: false, video_partial_bytes: 13, video_partial_sha256: expect.any(String) });
    expect(result.artifacts?.video_sha256).toBeUndefined();
    expect(baseFetcher.mock.calls.filter(([url]) => url.includes(":generateContent"))).toHaveLength(0);
  });

  it("does not reflect private correction transport error prose", async () => {
    let generations = 0;
    const baseFetcher = geminiFixture([{ text: "not-json" }]);
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      if (url.includes(":generateContent") && ++generations === 2) throw new Error("PRIVATE_PROVIDER_URL");
      return baseFetcher(url, init);
    });
    const result = await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task("gemini_video") as never);
    expect(result.error).not.toContain("PRIVATE_PROVIDER_URL");
    expect(result.artifacts?.usage).toMatchObject({ completion_tokens: 10 });
    expect(result.raw_output_text).toBe("not-json");
  });

  it.each(["anthropic_agent_sdk", "gemini_video"])("%s does not start correction after the original runtime deadline", async provider => {
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      create.mockImplementation(async () => { now = 600_000; return anthropic("not-json"); });
      const fetcher = geminiFixture([{ text: "not-json" }]);
      vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
        if (url.includes(":generateContent")) now = 600_000;
        return fetcher(url, init);
      });
      const result = provider === "gemini_video"
        ? await (await import("../agents/adapters/gemini-video")).runGeminiVideoTask(task(provider) as never)
        : await (await import("../agents/adapters/anthropic-agent-sdk")).runAnthropicAgentSdkTask(task(provider) as never);
      expect(result.error).toContain("output_correction_budget_exhausted");
      expect(provider === "gemini_video" ? fetcher.mock.calls.filter(([url]) => url.includes(":generateContent")).length : create.mock.calls.length).toBe(1);
    } finally { clock.mockRestore(); }
  });
});
