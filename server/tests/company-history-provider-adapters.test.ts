// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { digest } from "../research-learning/contract";

// Provider-only fixtures keep their existing fetch fake at the new download
// seam. Public DNS/TLS/redirect controls have separate transport coverage.
vi.mock("../agents/adapters/public-video-fetch", () => ({
  fetchPublicVideo: (url: string, { signal }: { signal?: AbortSignal | null }) => globalThis.fetch(url, { signal }),
}));

const { anthropicCreate, historyRun, retained } = vi.hoisted(() => ({ anthropicCreate: vi.fn(), historyRun: vi.fn(), retained: {learning:null as any} }));
vi.mock("../../client/src/lib/firebaseAdmin",()=>({dbAdmin:{doc:()=>({get:async()=>({data:()=>({learning:retained.learning})})})}}));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: anthropicCreate }; } }));
vi.mock("../agents/operator-tools", async importOriginal => ({
  ...await importOriginal<typeof import("../agents/operator-tools")>(), runOperatorTool: historyRun,
}));

const task = (kind = "capture_dispatch", mode: "AGENTIC" | "STATIC" = "AGENTIC") => ({
  kind, input: { taskVideoUrl: "https://example.com/clip.mp4", companyWide: true },
  metadata: { company_history_access: { companyWide: true } },
  provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk", model: "fixture-model",
  tool_policy: { mode: "api" }, definition: { build_prompt: () => "Original task; return JSON with answer.",
    output_schema: z.object({ answer: z.string() }), video_processing_mode: mode, video_sampling_fps: 2,
    video_max_output_tokens: 1000 },
});
const message = (content: unknown[], usage: unknown = { input_tokens: 20, output_tokens: 10 }) => ({
  id: `response-${anthropicCreate.mock.calls.length}`, content, usage, stop_reason: "end_turn",
});
const call = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const answer = (text = "final") => ({ type: "text", text: JSON.stringify({ answer: text }) });

beforeEach(() => {
  vi.resetModules(); anthropicCreate.mockReset(); historyRun.mockReset(); retained.learning={
  version:"blueprint.research-learning-worker.v1",enabled:true,startDate:"2026-10-01",
  binding:{version:"blueprint.research-learning-consumer-binding.v1",principalId:"blueprint-learning-host",role:"daily_research",
    sourceSnapshotId:"a".repeat(64),crmIds:["BP-000001"],prospectIds:[],discoveryCapabilityIds:["summary-capability"],detailCapabilityIds:[],expiresAt:"2099-10-03T00:00:00.000Z"},
  businessScope:{principalId:"blueprint-learning-host",subjectKeys:["blueprint:research-learning"],expiresAt:"2099-10-02T13:00:00.000Z"},
};
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture"); vi.stubEnv("GEMINI_API_KEY", "offline-fixture");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Anthropic read-only company history", () => {
  it("repairs tool arguments, pages and fetches in the same original conversation", async () => {
    anthropicCreate.mockResolvedValueOnce(message([call("bad", "search_company_history", { query: 17 })]))
      .mockResolvedValueOnce(message([call("page1", "search_company_history", { query: "prior logistics", page_size: 2 })]))
      .mockResolvedValueOnce(message([call("page2", "search_company_history", { query: "prior logistics", cursor: "next", filters: { city: "Chicago" } })]))
      .mockResolvedValueOnce(message([call("full", "fetch_company_history_record", { record_id: "company:prior" })]))
      .mockResolvedValueOnce(message([answer()]));
    const fetched = { record_id: "company:prior", content: "canonical prior evidence", source_sha256: digest("canonical prior evidence"),
      original_checked_at: "2026-09-30T12:00:00.000Z", source_ref: "blueprintResearchLearning/default/businessHistoryEvents/prior", coverage: ["company_business_decisions_and_hypotheses"] };
    historyRun.mockResolvedValueOnce({ ok: false, error: "company_history_arguments_invalid", issues: [{ field: "query", code: "invalid_type" }] })
      .mockResolvedValueOnce({ records: [{ record_id: "company:prior" }], next_cursor: "next" })
      .mockResolvedValueOnce({ records: [], next_cursor: null })
      .mockResolvedValueOnce(fetched);
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.status).toBe("completed");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: 100, completion_tokens: 50 });
    expect(historyRun).toHaveBeenCalledTimes(4);
    expect(historyRun.mock.calls[0][2]).toMatchObject({ principalId: "blueprint-learning-host", companyWide: false, prospectIds: [], expiresAt: "2099-10-02T13:00:00.000Z" });
    const request = anthropicCreate.mock.calls.at(-1)![0];
    expect(request.tools.map((tool: any) => tool.name)).toEqual(["search_company_history", "fetch_company_history_record"]);
    expect(request.messages[0].content).toContain("Original task");
    expect(request.messages[1].content[0]).toMatchObject({ type: "tool_use", id: "bad" });
    expect(request.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "bad", is_error: true });
    expect(request.messages[2].content[0].content).toContain("invalid_type");
    expect(request.messages.at(-1).content[0].content).toContain("canonical prior evidence");
    expect(request.max_tokens).toBe(3960);
    const retained = result.artifacts?.company_history_tool_calls as any[];
    expect(retained[0].result_status).toBe("error");
    expect(retained[2].args).toEqual({ query: "prior logistics", cursor: "next", filters: { city: "Chicago" } });
    expect(retained[3]).toMatchObject({ tool_call_id: "full", name: "fetch_company_history_record", result_status: "completed",
      args: { record_id: "company:prior" }, result: fetched, args_sha256: digest({ record_id: "company:prior" }), result_sha256: digest(fetched) });
    fetched.content = "Mutated fixture after adapter context exited";
    expect(retained[3].result.content).toBe("canonical prior evidence");
  });

  it("refuses a mutation tool even for an authorized nonoperator company task", async () => {
    anthropicCreate.mockResolvedValueOnce(message([call("mutation", "queue_growth_campaign_send", {})]))
      .mockResolvedValueOnce(message([answer()]));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    expect((await runAnthropicAgentSdkTask(task() as never)).status).toBe("completed");
    expect(historyRun).not.toHaveBeenCalled();
    expect(anthropicCreate.mock.calls[1][0].messages[2].content[0].is_error).toBe(true);
  });

  it("does not grant customer privacy tasks company history from input or metadata", async () => {
    anthropicCreate.mockResolvedValue(message([answer()]));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    expect((await runAnthropicAgentSdkTask(task("capture_video_privacy") as never)).status).toBe("completed");
    expect(anthropicCreate.mock.calls[0][0].tools).toBeUndefined();
    expect(historyRun).not.toHaveBeenCalled();
  });

  it("retains unknown usage and refuses a further request after a tool-use response", async () => {
    anthropicCreate.mockResolvedValue(message([call("search", "search_company_history", { query: "history" })], {}));
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.error).toBe("output_correction_usage_unavailable");
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: null, completion_tokens: null });
    expect(historyRun).not.toHaveBeenCalled(); expect(anthropicCreate).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("retains history and paid field-correction evidence when later transport fails=%s", async fails => {
    const invalid = '{"answer":17}', evidence = { ok: true, record_id: "company:prior", content: "canonical evidence" };
    anthropicCreate.mockResolvedValueOnce(message([call("record", "fetch_company_history_record", { record_id: "company:prior" })]))
      .mockResolvedValueOnce(message([{ type: "text", text: invalid }]));
    if (fails) anthropicCreate.mockRejectedValueOnce(new Error("PRIVATE_PROVIDER_URL"));
    else anthropicCreate.mockResolvedValueOnce(message([answer("corrected") ]));
    historyRun.mockResolvedValue(evidence);
    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const result = await runAnthropicAgentSdkTask(task() as never);
    expect(result.status).toBe(fails ? "failed" : "completed");
    if (fails) expect(result.error).not.toContain("PRIVATE_PROVIDER_URL");
    else expect(result.error).toBeNull();
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: fails ? 40 : 60, completion_tokens: fails ? 20 : 30, total_tokens: fails ? 60 : 90 });
    expect(result.artifacts?.provider_responses).toHaveLength(fails ? 2 : 3);
    expect(result.artifacts?.output_repairs).toEqual([expect.objectContaining({ rawOutput: invalid })]);
    expect(result.artifacts?.company_history_tool_calls).toEqual([expect.objectContaining({ result: evidence, result_sha256: digest(evidence) })]);
    const correction = anthropicCreate.mock.calls[2][0];
    expect(correction.messages[0].content).toContain("Original task");
    expect(correction.messages.at(-1).content).toContain("/answer");
    expect(correction.messages.at(-2).content).toEqual([{ type: "text", text: invalid }]);
    expect(correction.max_tokens).toBe(3980);
    expect(anthropicCreate).toHaveBeenCalledTimes(3);
    expect(result.raw_output_text).toBe(fails ? invalid : JSON.stringify({ answer: "corrected" }));
  });
});

const clip = Buffer.from("offline video");
const nativeTrace = [{ toolCall: { toolType: "MEDIA_PROCESSING" } }, { toolResponse: { toolType: "MEDIA_PROCESSING" } }];
const videoReply = (parts: unknown[], usage: unknown = { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }) =>
  new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts } }], usageMetadata: usage }), { status: 200 });

function videoFetcher(replies: Response[]) {
  const requests: any[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === "https://example.com/clip.mp4") return new Response(clip, { headers: { "content-type": "video/mp4" } });
    if (url.endsWith("/upload/v1beta/files")) return new Response("{}", { headers: { "x-goog-upload-url": "https://upload.example.com/offline" } });
    if (url === "https://upload.example.com/offline") return new Response(JSON.stringify({ file: { name: "files/offline", uri: "https://files.example.com/offline", mimeType: "video/mp4", state: "ACTIVE" } }));
    if (init.method === "DELETE") return new Response("{}");
    if (url.includes(":generateContent")) { requests.push(JSON.parse(init.body as string)); return replies.shift()!; }
    throw new Error("Unexpected offline fixture URL");
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, requests };
}

describe("Gemini history after native video analysis", () => {
  it.each(["AGENTIC", "STATIC"] as const)("keeps %s media semantics and reads history through text-only continuations", async mode => {
    const original = JSON.stringify({ answer: "original video observation" });
    const { fetcher, requests } = videoFetcher([
      videoReply([...(mode === "AGENTIC" ? nativeTrace : []), { text: original }]),
      videoReply([{ functionCall: { name: "search_company_history", args: { query: "prior video", cursor: "next", filters: { industry: "logistics" } }, id: "search" }, thoughtSignature: "preserved-signature" }]),
      videoReply([{ functionCall: { name: "fetch_company_history_record", args: { record_id: "company:video" }, id: "fetch" } }]),
      videoReply([answer("grounded final")]),
    ]);
    const fetched = { record_id: "company:video", content: "prior evidence", source_sha256: digest("prior evidence"),
      original_checked_at: "2026-09-30T12:00:00.000Z", source_ref: "blueprintResearchLearning/default/siteLearningEvents/prior" };
    historyRun.mockResolvedValueOnce({ records: [{ record_id: "company:video" }], next_cursor: null })
      .mockResolvedValueOnce(fetched);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task("capture_dispatch", mode) as never);
    expect(result).toMatchObject({ status: "completed", output: { answer: "grounded final" }, artifacts: {
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      video_processing: { mode: mode.toLowerCase(), media_tool_calls: mode === "AGENTIC" ? 1 : 0 },
      initial_analysis_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    } });
    expect(requests[0].contents[0].parts[1].media_processing).toBe(mode);
    expect(requests[0].tools).toBeUndefined();
    if (mode === "STATIC") expect(requests[0].contents[0].parts[1].video_metadata.fps).toBe(2);
    for (const request of requests.slice(1)) {
      expect(JSON.stringify(request)).not.toMatch(/file_data|file_uri|media_processing|MEDIA_PROCESSING/);
      expect(request.tools[0].functionDeclarations.map((tool: any) => tool.name)).toEqual(["search_company_history", "fetch_company_history_record"]);
      expect(request.contents[1].parts[0].text).toBe(original);
    }
    expect(requests[2].contents[3].parts[0].thoughtSignature).toBe("preserved-signature");
    expect(requests.at(-1).contents.at(-1).parts[0].functionResponse).toMatchObject({ name: "fetch_company_history_record", id: "fetch", response: { result: { content: "prior evidence" } } });
    expect(historyRun).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.filter(([url]) => url === "https://example.com/clip.mp4")).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/upload/v1beta/files"))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
    const retained = result.artifacts?.company_history_tool_calls as any[];
    expect(retained[0].args).toEqual({ query: "prior video", cursor: "next", filters: { industry: "logistics" } });
    expect(retained[1]).toMatchObject({ tool_call_id: "fetch", name: "fetch_company_history_record", result_status: "completed",
      args: { record_id: "company:video" }, result: fetched, args_sha256: digest({ record_id: "company:video" }), result_sha256: digest(fetched) });
    fetched.content = "Mutated fixture after adapter context exited";
    expect(retained[1].result.content).toBe("prior evidence");
  });

  it("preserves an unknown-usage valid original answer without further paid history inference", async () => {
    const { requests } = videoFetcher([videoReply([...nativeTrace, answer("retained")], {})]);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task() as never);
    expect(result).toMatchObject({ status: "completed", output: { answer: "retained" }, artifacts: { usage: { total_tokens: null } } });
    expect(requests).toHaveLength(1); expect(historyRun).not.toHaveBeenCalled();
  });

  it("keeps customer privacy video tasks on their original static request without company tools", async () => {
    const { requests } = videoFetcher([videoReply([answer("privacy only")])]);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task("capture_video_privacy", "STATIC") as never);
    expect(result.status).toBe("completed"); expect(requests).toHaveLength(1);
    expect(requests[0].tools).toBeUndefined(); expect(historyRun).not.toHaveBeenCalled();
  });

  it("repairs read-only tool arguments and refuses foreign mutations in the same text context", async () => {
    const { requests } = videoFetcher([
      videoReply([...nativeTrace, answer("original")]),
      videoReply([{ functionCall: { name: "search_company_history", args: { query: 42 } } }]),
      videoReply([{ functionCall: { name: "search_company_history", args: { query: "repaired" } } }]),
      videoReply([{ functionCall: { name: "queue_growth_campaign_send", args: { campaignId: "forbidden" } } }]),
      videoReply([answer("recovered")]),
    ]);
    historyRun.mockResolvedValueOnce({ ok: false, error: "company_history_arguments_invalid", issues: [{ field: "query", code: "invalid_type" }] })
      .mockResolvedValueOnce({ ok: true, records: [] });
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task() as never);
    expect(result.status).toBe("completed"); expect(historyRun).toHaveBeenCalledTimes(2);
    expect(requests[2].contents.at(-1).parts[0].functionResponse.response).toMatchObject({ is_error: true, result: { issues: [{ field: "query" }] } });
    expect(requests[4].contents.at(-1).parts[0].functionResponse.response.is_error).toBe(true);
    expect(result.artifacts?.initial_video_analysis).toMatchObject({ text: JSON.stringify({ answer: "original" }) });
  });

  it("retains initial analysis when unknown tool-turn usage prevents another paid request", async () => {
    const { requests } = videoFetcher([
      videoReply([...nativeTrace, answer("retained original")]),
      videoReply([{ functionCall: { name: "search_company_history", args: { query: "history" } } }], {}),
    ]);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task() as never);
    expect(result.status).toBe("failed"); expect(result.error).toContain("output_correction_usage_unavailable");
    expect(result.artifacts?.initial_video_analysis).toMatchObject({ text: JSON.stringify({ answer: "retained original" }) });
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: null, completion_tokens: null });
    expect(requests).toHaveLength(2); expect(historyRun).not.toHaveBeenCalled();
  });

  it.each([false, true])("retains initial video, history and paid output-correction evidence when later transport fails=%s", async fails => {
    const original = JSON.stringify({ answer: "original video observation" }), invalid = '{"answer":17}';
    const { fetcher, requests } = videoFetcher([
      videoReply([...nativeTrace, { text: original }]),
      videoReply([{ functionCall: { name: "fetch_company_history_record", args: { record_id: "company:prior" }, id: "record" } }]),
      videoReply([{ text: invalid }]),
      fails ? new Response("PRIVATE_PROVIDER_URL", { status: 503 }) : videoReply([answer("corrected")]),
    ]);
    const evidence = { ok: true, record_id: "company:prior", content: "canonical evidence" };
    historyRun.mockResolvedValue(evidence);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task() as never);
    expect(result.status).toBe(fails ? "failed" : "completed");
    if (fails) expect(result.error).not.toContain("PRIVATE_PROVIDER_URL");
    else expect(result.error).toBeNull();
    expect(result.artifacts?.initial_video_analysis).toMatchObject({ text: original, processing: { media_tool_calls: 1 } });
    expect(result.artifacts?.initial_analysis_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: fails ? 60 : 80, completion_tokens: fails ? 30 : 40, total_tokens: fails ? 90 : 120 });
    expect(result.artifacts?.usage_samples).toHaveLength(fails ? 3 : 4);
    expect(result.artifacts?.output_repairs).toEqual([expect.objectContaining({ rawOutput: invalid })]);
    expect(result.artifacts?.company_history_tool_calls).toEqual([expect.objectContaining({ result: evidence, result_sha256: digest(evidence) })]);
    expect(requests).toHaveLength(4);
    const correction = requests[3];
    expect(correction.contents[0].parts[0].text).toContain("Original task");
    expect(correction.contents.at(-1).parts[0].text).toContain("/answer");
    expect(correction.contents.at(-2).parts).toEqual([{ text: invalid }]);
    expect(correction.generationConfig.maxOutputTokens).toBe(970);
    for (const request of requests.slice(1)) expect(JSON.stringify(request)).not.toMatch(/file_data|file_uri|media_processing|MEDIA_PROCESSING/);
    expect(fetcher.mock.calls.filter(([url]) => url === "https://example.com/clip.mp4")).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/upload/v1beta/files"))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
    expect(result.raw_output_text).toBe(fails ? invalid : JSON.stringify({ answer: "corrected" }));
  });

  it("retains a malformed paid initial analysis if the first history continuation transport fails", async () => {
    const { fetcher, requests } = videoFetcher([
      videoReply([...nativeTrace, { text: "retained initial non-JSON analysis" }]),
      new Response("PRIVATE_PROVIDER_URL", { status: 503 }),
    ]);
    const { runGeminiVideoTask } = await import("../agents/adapters/gemini-video");
    const result = await runGeminiVideoTask(task() as never);
    expect(result.status).toBe("failed"); expect(result.error).not.toContain("PRIVATE_PROVIDER_URL");
    expect(result.raw_output_text).toBe("retained initial non-JSON analysis");
    expect(result.artifacts?.initial_video_analysis).toMatchObject({ text: "retained initial non-JSON analysis" });
    expect(result.artifacts?.usage).toMatchObject({ prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 });
    expect(result.artifacts?.usage_samples).toHaveLength(1);
    // No field-correction response happened: this is the initial history phase.
    expect(result.artifacts?.output_repairs).toEqual([]);
    expect(requests).toHaveLength(2); expect(historyRun).not.toHaveBeenCalled();
    expect(JSON.stringify(requests[1])).not.toMatch(/file_data|file_uri|media_processing|MEDIA_PROCESSING/);
    expect(fetcher.mock.calls.filter(([url]) => url === "https://example.com/clip.mp4")).toHaveLength(1);
  });
});
