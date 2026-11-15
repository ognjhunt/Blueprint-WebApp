// @vitest-environment node
/**
 * The follow-up picker through the real runtime and the real OpenAI adapter;
 * only the OpenAI client, the store and the other adapters are fakes. One
 * picker call is one request with a 600-token ceiling, at the lane's own
 * model and effort, and the stored run keeps no copy of the site's text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => vi.fn());
const otherAdapters = vi.hoisted(() => ({ anthropic: vi.fn(), codex: vi.fn(), acp: vi.fn() }));
const logged = vi.hoisted(() => [] as string[]);
const store = vi.hoisted(() => new Map<string, Map<string, any>>());

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class FakeOpenAI { responses = { create: created }; embeddings = { create: vi.fn() }; }
  Object.assign(FakeOpenAI, { APIError: actual.default.APIError });
  return { ...actual, default: FakeOpenAI };
});
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const coll = (name: string) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name)!; };
  const doc = (name: string, id: string): any => ({
    id, path: `${name}/${id}`,
    async get() { const d = coll(name).get(id); return { exists: d !== undefined, id, data: () => d }; },
    async set(value: any, options?: { merge?: boolean }) {
      coll(name).set(id, options?.merge ? { ...(coll(name).get(id) || {}), ...value } : value);
    },
  });
  const query = (name: string): any => ({
    where: () => query(name), orderBy: () => query(name), limit: () => query(name), startAfter: () => query(name),
    async get() {
      const docs = [...coll(name).entries()].map(([id, d]) => ({ id, data: () => d, ref: doc(name, id) }));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => doc(name, id), ...query(name) }),
    doc: (path: string) => { const [name, id] = path.split("/"); return doc(name, id); },
    async runTransaction(fn: any) { return fn({ get: (ref: any) => ref.get(), set: (ref: any, v: any, o: any) => ref.set(v, o) }); },
    batch: () => ({ set() {}, delete() {}, async commit() {} }),
  };
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } }, dbAdmin: db, storageAdmin: null };
});
vi.mock("../agents/adapters/anthropic-agent-sdk", () => ({ runAnthropicAgentSdkTask: otherAdapters.anthropic }));
vi.mock("../logger", () => {
  const capture = (...args: unknown[]) => { logged.push(JSON.stringify(args)); };
  const logger = { info: capture, warn: capture, error: capture, debug: capture, child: () => logger };
  return { logger, attachRequestMeta: (meta: unknown) => meta, default: logger };
});

const SITE_TEXT = "SITE-TEXT-MARKER-7f3a";
const ANSWER_TEXT = "ANSWER-MARKER-91c2";
const eligible = ["success_target", "item_photos", "item_weight", "item_make_model"] as const;
const input = { requestId: "req-follow-up-1", taskStatement: `${SITE_TEXT} move totes`, briefSummary: `${SITE_TEXT} brief`,
  itemLabels: [`${SITE_TEXT} tote`], eligible: [...eligible] };
const fixedList = ["success_target", "item_photos", "item_weight"];
const answer = (text: string) => ({ id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text }] }],
  output_text: text, usage: { input_tokens: 1500, output_tokens: 100, input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 50 } } });
const noFunds = async () => (await import("openai")).default.APIError.generate(429,
  { error: { type: "insufficient_quota", code: "insufficient_quota", message: "wording that can change" } }, undefined, new Headers());

beforeEach(async () => {
  created.mockReset(); logged.length = 0; store.clear();
  Object.values(otherAdapters).forEach((fn) => {
    fn.mockReset();
    fn.mockResolvedValue({ status: "completed", provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk", model: "m",
      tool_mode: "api", output: { question_ids: ["item_make_model"] }, requires_human_review: false, requires_approval: false });
  });
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("OPENAI_DEFAULT_MODEL", ""); vi.stubEnv("OPENAI_REASONING_EFFORT", "");
  vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_MODEL", ""); vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_REASONING_EFFORT", "");
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", "");
  vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const storedRuns = () => [...(store.get("agentRuns")?.values() ?? [])];

describe("follow-up picker: one request per picker call", () => {
  it.each([
    // The schema accepts any JSON object: the code filters it, and the run completes.
    ["an off-list id", '{"question_ids":["made_up","item_make_model"]}', ["success_target", "item_photos", "item_make_model"], "completed"],
    ["four ids", '{"question_ids":["item_make_model","item_weight","success_target","item_photos"]}',
      ["success_target", "item_photos", "item_make_model"], "completed"],
    ["no question_ids", '{"status":"no_change"}', fixedList, "completed"],
    ["only off-list ids", '{"question_ids":["made_up"]}', fixedList, "completed"],
    // Not JSON: no correction round, the run fails and the site gets the fixed list.
    ["an answer that is not JSON", "I would ask about the weight.", fixedList, "failed"],
    ["a truncated answer", '{"question_ids":["item_wei', fixedList, "failed"],
  ])("makes exactly one request for %s, and the site gets the filtered answer or the fixed list", async (_name, text, expected, status) => {
    created.mockResolvedValue(answer(text));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(expected);
    expect(created).toHaveBeenCalledTimes(1);
    expect(storedRuns().map((run) => run.status)).toEqual([status]);
  });

  it("sends a 600-token ceiling and reserves the call's worst case from 600", async () => {
    created.mockResolvedValue(answer('{"question_ids":["item_weight"]}'));
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({ kind: "site_task_follow_up", input: { taskStatement: "t", briefSummary: "b",
      itemLabels: [], eligible: [...eligible] } }, { dispatchQueuedOnFinish: false });
    expect(created).toHaveBeenCalledTimes(1);
    expect(created.mock.calls[0][0].max_output_tokens).toBe(600);
    const reservation = (result.artifacts as any).inference_reservation;
    expect(reservation.max_output_tokens).toBe(600);
    const { buildExplicitOpenAIRequest, worstCaseOpenAIReservationUsd } = await import("../utils/openaiPromptCache");
    const { getAgentMaxInputTokens } = await import("../agents/provider-config");
    const { policy } = buildExplicitOpenAIRequest({ model: "gpt-6-luna", taskKind: "site_task_follow_up", dynamicPrompt: "x",
      expectedReuseCount: 0, expectedReuseProbability: 0 });
    const worstCase = (maxOutputTokens: number) => worstCaseOpenAIReservationUsd({ model: "gpt-6-luna",
      inputTokenCeiling: getAgentMaxInputTokens(), maxOutputTokens, policy });
    expect(reservation.projected_max_cost_per_call_usd).toBe(worstCase(600));
    expect(worstCase(600)).toBeLessThan(worstCase(16_000));
  });

  it("uses the shared ceiling when it is the smaller one", async () => {
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", "300");
    created.mockResolvedValue(answer('{"question_ids":[]}'));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await selectFollowUps(input);
    expect(created.mock.calls[0][0].max_output_tokens).toBe(300);
  });

  it("leaves every other lane's request at the shared ceiling", async () => {
    created.mockResolvedValue(answer("{}"));
    const { runAgentTask } = await import("../agents/runtime");
    const brief = { kind: "site_task_brief_reading" as const, provider: "openai_responses" as const,
      input: { requestId: "r", taskStatement: "Move totes", whatGoesWrong: null, gates: [] } };
    await runAgentTask(brief, { dispatchQueuedOnFinish: false });
    expect(created.mock.calls[0][0].max_output_tokens).toBe(16_000);
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", "9000");
    vi.resetModules();
    created.mockClear();
    await (await import("../agents/runtime")).runAgentTask(brief, { dispatchQueuedOnFinish: false });
    expect(created.mock.calls[0][0].max_output_tokens).toBe(9000);
  });
});

describe("follow-up picker: model and effort", () => {
  it("keeps gpt-6-luna at low effort whatever the global model and effort say", async () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6.1-sol"); vi.stubEnv("OPENAI_REASONING_EFFORT", "max");
    created.mockResolvedValue(answer('{"question_ids":[]}'));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await selectFollowUps(input);
    expect(created.mock.calls[0][0]).toMatchObject({ model: "gpt-6-luna", reasoning: { effort: "low" } });
    // Other lanes still follow the global settings.
    const config = await import("../agents/provider-config");
    expect(config.getTaskModelByProvider("site_task_brief_reading").openai_responses).toBe("gpt-6.1-sol");
    expect(config.getOpenAiReasoningEffort("site_task_brief_reading")).toBe("max");
  });

  it("follows the lane's own model and effort settings", async () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6.1-sol"); vi.stubEnv("OPENAI_REASONING_EFFORT", "max");
    vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_MODEL", "gpt-6-terra");
    vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_REASONING_EFFORT", "medium");
    created.mockResolvedValue(answer('{"question_ids":[]}'));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await selectFollowUps(input);
    expect(created.mock.calls[0][0]).toMatchObject({ model: "gpt-6-terra", reasoning: { effort: "medium" } });
  });
});

describe("follow-up picker: what is stored", () => {
  it("with no OpenAI key returns the fixed list at once: no request, no stored row", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(fixedList);
    expect(created).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it.each([
    ["an answer", `{"question_ids":["item_weight","${ANSWER_TEXT}"]}`, "completed"],
    ["an answer that is not JSON", `${ANSWER_TEXT} is what I would ask`, "failed"],
  ])("after %s, stores a row with the request id and no site text or answer text anywhere", async (_name, text, status) => {
    created.mockResolvedValue(answer(text));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await selectFollowUps(input);
    const runs = storedRuns();
    expect(runs).toHaveLength(1);
    const [run] = runs;
    expect(run).toMatchObject({ task_kind: "site_task_follow_up", status, provider: "openai_responses", model: "gpt-6-luna",
      metadata: { request_id: "req-follow-up-1" } });
    expect(run.input.input).toMatchObject({ redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    // Cost and usage are kept as they are.
    expect(run.artifacts.inference_reservation.max_output_tokens).toBe(600);
    expect(run.artifacts.usage).toMatchObject({ input_tokens: 1500, output_tokens: 100 });
    expect(run.metadata.cost_telemetry).toMatchObject({ provider: "openai_responses", model: "gpt-6-luna", prompt_tokens: 1500 });
    for (const [, docs] of store) {
      for (const [, stored] of docs) {
        const text = JSON.stringify(stored);
        expect(text).not.toContain(SITE_TEXT);
        expect(text).not.toContain(ANSWER_TEXT);
      }
    }
    expect(logged.filter((line) => line.includes(SITE_TEXT) || line.includes(ANSWER_TEXT))).toEqual([]);
  });
});

describe("follow-up picker: only providers the gate permits for site_job_text", () => {
  it("is sent to OpenAI once and to nothing else, with every setting naming another provider and OpenAI out of funds", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture"); vi.stubEnv("ACP_HARNESS_URL", "https://acp.example");
    vi.stubEnv("OPENCLAW_BASE_URL", "https://claw.example"); vi.stubEnv("CODEX_LOCAL_AVAILABLE", "1");
    vi.stubEnv("BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER", "anthropic_agent_sdk");
    vi.stubEnv("BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", "anthropic_agent_sdk,codex_local,acp_harness,openai_responses");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "codex_local");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "acp_harness,anthropic_agent_sdk");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", "anthropic_agent_sdk");
    created.mockRejectedValue(await noFunds());
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(fixedList);
    expect(created).toHaveBeenCalledTimes(1);
    for (const adapter of Object.values(otherAdapters)) expect(adapter).not.toHaveBeenCalled();
  });

  it("refuses a run pinned to a provider the gate does not permit, before its adapter", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({ kind: "site_task_follow_up", provider: "anthropic_agent_sdk",
      input: { taskStatement: "t", briefSummary: "b", itemLabels: [], eligible: [...eligible] } }, { dispatchQueuedOnFinish: false });
    expect(result.status).toBe("failed");
    expect(result.artifacts).toMatchObject({ inference_not_invoked: true, privacy_gate: { provider: "anthropic_agent_sdk" } });
    expect(otherAdapters.anthropic).not.toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
  });
});
