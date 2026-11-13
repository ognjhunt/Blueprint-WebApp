// @vitest-environment node
/**
 * Company-history tools go only to a provider the STRICTEST Privacy table permits every class the history exposes:
 * history spans jobs of every version, so the version of a job a run is bound to never widens it. Real runtime and
 * real adapters; only the two SDK clients, the store, the history binding and the logger are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => vi.fn());
const anthropic = vi.hoisted(() => ({ requests: [] as Array<Record<string, any>> }));
const store = vi.hoisted(() => new Map<string, Map<string, any>>());
const history = vi.hoisted(() => ({ access: { scope: "fixture", expiresAt: "2099-01-01T00:00:00.000Z" } as unknown }));

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class FakeOpenAI { responses = { create: created }; embeddings = { create: vi.fn() }; }
  Object.assign(FakeOpenAI, { APIError: actual.default.APIError });
  return { ...actual, default: FakeOpenAI };
});
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class Anthropic {
    static APIError = real.default.APIError;
    beta = { messages: { stream: (params: Record<string, unknown>) => {
      anthropic.requests.push(structuredClone(params));
      return { finalMessage: async () => ({ id: "msg_1", model: params.model, stop_reason: "end_turn", stop_details: null,
        content: [{ type: "text", text: '{"proposals":[],"notFound":[],"summary":"ok"}' }],
        usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }) };
    } } };
  }
  return { ...real, default: Anthropic };
});
vi.mock("../research-learning/research-worker-host", async (importOriginal) => ({
  ...await importOriginal<typeof import("../research-learning/research-worker-host")>(),
  boundResearchHistoryControl: () => ({ access: history.access }),
}));
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
vi.mock("../agents/adapters/codex-local", () => ({ runCodexLocalTask: vi.fn() }));
vi.mock("../agents/adapters/acp-harness", () => ({ runAcpHarnessTask: vi.fn() }));
vi.mock("../logger", () => {
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => logger };
  return { logger, attachRequestMeta: (meta: unknown) => meta, default: logger };
});

const extraction = { kind: "robot_capability_extraction" as const, input: { robotTeamId: "t", teamName: "T",
  currentCapability: {}, sources: [{ url: "https://example.com/robot", text: "A robot arm." }], allowedValues: {} } };
const answer = { id: "resp_1", output: [{ type: "message", content: [{ type: "output_text",
  text: '{"proposals":[],"notFound":[],"summary":"ok"}' }] }], output_text: '{"proposals":[],"notFound":[],"summary":"ok"}',
  usage: { input_tokens: 20, output_tokens: 10, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
const HISTORY_TOOLS = ["search_company_history", "fetch_company_history_record"];
const toolNames = (tools: unknown) => Array.isArray(tools) ? tools.map((tool: any) => tool.name ?? tool.function?.name) : [];

beforeEach(async () => {
  created.mockReset(); anthropic.requests.length = 0; store.clear();
  store.set("blueprintDailyResearch", new Map([["sites-first", { learning: {} }]]));
  store.set("inboundRequests", new Map([["job-new", { privacy_version_at_submission: "2026-11-13.1" }]]));
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture"); vi.stubEnv("ANTHROPIC_BASE_URL", "");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
  created.mockResolvedValue(answer);
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("company-history tools and the provider serving the run", () => {
  it("gives them to OpenAI for every lane that has them, and to no provider the strictest table does not name", async () => {
    const { companyHistoryWithheld } = await import("../agents/operator-tools");
    const lanes = ["operator_thread", "adp_run_operator", "external_harness_thread", "capture_dispatch",
      "robot_capability_extraction", "outbound_outreach", "support_triage", "site_assessment"] as const;
    for (const kind of lanes) {
      for (const provider of ["openai_responses", "openai_agents_api", "openai_agents_sdk"]) {
        expect(companyHistoryWithheld(kind, provider), `${kind} ${provider}`).toBeNull();
      }
      for (const provider of ["anthropic_agent_sdk", "gemini_video", "codex_local", "acp_harness", "openclaw"]) {
        expect(companyHistoryWithheld(kind, provider), `${kind} ${provider}`).toBe("provider_not_permitted");
      }
    }
  });

  it("sends the history tools to OpenAI for robot_capability_extraction, as before", async () => {
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({ ...extraction, provider: "openai_responses", runtime: "openai_responses" },
      { dispatchQueuedOnFinish: false });
    expect(created).toHaveBeenCalled();
    expect(toolNames(created.mock.calls[0][0].tools)).toEqual(HISTORY_TOOLS);
    expect(result.artifacts).not.toHaveProperty("history_tools_withheld");
  });

  it.each([
    ["an unbound run", undefined],
    ["a run bound to a job submitted under 2026-11-13.1", { request_id: "job-new" }],
  ])("sends no history tools to Anthropic for robot_capability_extraction, and records why: %s", async (_name, binding) => {
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({ ...extraction, provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk" },
      { dispatchQueuedOnFinish: false, ...(binding ? { privacyRequestBinding: binding } : {}) });
    expect(anthropic.requests.length).toBeGreaterThan(0);
    for (const request of anthropic.requests) expect(request).not.toHaveProperty("tools");
    expect(result.artifacts).toMatchObject({ history_tools_withheld: "provider_not_permitted" });
    expect(result.logs?.some((log: any) => log.history_tools_withheld === "provider_not_permitted")).toBe(true);
  });
});
