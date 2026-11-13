// @vitest-environment node
/**
 * The follow-up picker when OpenAI is out of funds, through the real runtime
 * and both real adapters; only the two SDK clients, the store and the logger
 * are fakes. For a job started under Privacy 2026-11-13.1 the picker moves to
 * Anthropic once and keeps its bound there: one request, a 600-token ceiling,
 * no correction round, the small model, low effort, and no site text stored.
 * Any other job stays on the fixed list with nothing sent to Anthropic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => vi.fn());
const anthropic = vi.hoisted(() => ({
  requests: [] as Array<Record<string, any>>,
  respond: (() => { throw new Error("no response queued"); }) as () => unknown,
}));
const logged = vi.hoisted(() => [] as string[]);
const store = vi.hoisted(() => new Map<string, Map<string, any>>());

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
      return { finalMessage: async () => anthropic.respond() };
    } } };
  }
  return { ...real, default: Anthropic };
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
vi.mock("../agents/operator-tools", async (importOriginal) => ({
  ...await importOriginal<typeof import("../agents/operator-tools")>(),
  getCompanyHistoryAccess: async () => null,
}));
vi.mock("../agents/adapters/codex-local", () => ({ runCodexLocalTask: vi.fn() }));
vi.mock("../agents/adapters/acp-harness", () => ({ runAcpHarnessTask: vi.fn() }));
vi.mock("../logger", () => {
  const capture = (...args: unknown[]) => { logged.push(JSON.stringify(args)); };
  const logger = { info: capture, warn: capture, error: capture, debug: capture, child: () => logger };
  return { logger, attachRequestMeta: (meta: unknown) => meta, default: logger };
});

const SITE_TEXT = "SITE-TEXT-MARKER-c41d";
const eligible = ["success_target", "item_photos", "item_weight", "item_make_model"] as const;
const fixedList = ["success_target", "item_photos", "item_weight"];
const input = (requestId: string) => ({ requestId, taskStatement: `${SITE_TEXT} move totes`,
  briefSummary: `${SITE_TEXT} brief`, itemLabels: [`${SITE_TEXT} tote`], eligible: [...eligible] });
const acceptance = (version: string) => ({ accepted_terms: true, terms_version: "2026-11-12.2", privacy_version: version,
  terms_url: "/terms", privacy_url: "/privacy", accepted_at: "2026-11-13T09:00:00.000Z", accepted_from_ip_hash: null });
const usage = { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const message = (text: string) => ({ id: `msg_${anthropic.requests.length}`, model: "claude-haiku-5-5",
  content: [{ type: "text", text }], usage, stop_reason: "end_turn", stop_details: null });
const noFunds = async () => (await import("openai")).default.APIError.generate(429,
  { error: { type: "insufficient_quota", code: "insufficient_quota", message: "wording that can change" } }, undefined, new Headers());

beforeEach(async () => {
  created.mockReset(); anthropic.requests.length = 0; logged.length = 0; store.clear();
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture"); vi.stubEnv("ANTHROPIC_BASE_URL", "");
  // The global settings point every lane at the large models and the most effort; the picker ignores them.
  vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6.1-sol"); vi.stubEnv("OPENAI_REASONING_EFFORT", "max");
  vi.stubEnv("ANTHROPIC_DEFAULT_MODEL", "claude-opus-5-5"); vi.stubEnv("ANTHROPIC_EFFORT", "max");
  vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_MODEL", ""); vi.stubEnv("OPENAI_SITE_TASK_FOLLOW_UP_REASONING_EFFORT", "");
  vi.stubEnv("ANTHROPIC_SITE_TASK_FOLLOW_UP_MODEL", ""); vi.stubEnv("ANTHROPIC_SITE_TASK_FOLLOW_UP_EFFORT", "");
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", ""); vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
  created.mockRejectedValue(await noFunds());
  store.set("inboundRequests", new Map<string, any>([
    ["job-new", { privacy_version_at_submission: "2026-11-13.1", terms_acceptance: acceptance("2026-11-13.1") }],
    ["job-old", { privacy_version_at_submission: "2026-11-12.2", terms_acceptance: acceptance("2026-11-12.2") }],
    // Accepted later on its page under 2026-11-13.1, with no version at submission: older.
    ["job-accepted-later", { terms_acceptance: acceptance("2026-11-13.1") }],
  ]));
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const storedRuns = () => [...(store.get("agentRuns")?.values() ?? [])];

describe("follow-up picker: OpenAI out of funds", () => {
  it("moves a job under Privacy 2026-11-13.1 to Anthropic once, on the small model at low effort and 600 tokens", async () => {
    anthropic.respond = () => message('{"question_ids":["item_make_model"]}');
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input("job-new"))).toEqual(["success_target", "item_photos", "item_make_model"]);
    expect(created).toHaveBeenCalledTimes(1);
    expect(anthropic.requests).toHaveLength(1);
    expect(anthropic.requests[0]).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 600 });
    expect(JSON.stringify(anthropic.requests[0])).toContain('"effort":"low"');
    const [run] = storedRuns();
    expect(storedRuns()).toHaveLength(1);
    expect(run).toMatchObject({ task_kind: "site_task_follow_up", status: "completed", provider: "anthropic_agent_sdk",
      model: "claude-haiku-5-5", metadata: { request_id: "job-new" } });
    expect(run.artifacts.provider_failover).toMatchObject({ from_provider: "openai_responses",
      to_provider: "anthropic_agent_sdk", trigger: "no_funds" });
    expect(run.input.input).toMatchObject({ redacted: true });
    for (const [, docs] of store) for (const [, stored] of docs) expect(JSON.stringify(stored)).not.toContain(SITE_TEXT);
    expect(logged.filter((line) => line.includes(SITE_TEXT))).toEqual([]);
  });

  it("makes no correction round on Anthropic: an answer that is not JSON gives the fixed list after one request", async () => {
    anthropic.respond = () => message(`${SITE_TEXT} is what I would ask`);
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input("job-new"))).toEqual(fixedList);
    expect(created).toHaveBeenCalledTimes(1);
    expect(anthropic.requests).toHaveLength(1);
    const [run] = storedRuns();
    expect(run).toMatchObject({ status: "failed", provider: "anthropic_agent_sdk" });
    for (const [, docs] of store) for (const [, stored] of docs) expect(JSON.stringify(stored)).not.toContain(SITE_TEXT);
  });

  it.each(["job-old", "job-accepted-later", "job-unrecorded"])("keeps %s off Anthropic: the fixed list, nothing sent there", async (requestId) => {
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input(requestId))).toEqual(fixedList);
    expect(created).toHaveBeenCalledTimes(1);
    expect(anthropic.requests).toHaveLength(0);
  });

  it("lets only the picker lane ignore the global Anthropic model and effort", async () => {
    // Global settings that differ from what the OpenAI settings would map to, so a lane that follows them shows it.
    vi.stubEnv("ANTHROPIC_EFFORT", "high"); vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    vi.stubEnv("ANTHROPIC_DEFAULT_MODEL", "claude-opus-5-5"); vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6-luna");
    const config = await import("../agents/provider-config");
    expect(config.getAnthropicEffort("site_task_follow_up")).toBe("low");
    expect(config.getTaskModelByProvider("site_task_follow_up").anthropic_agent_sdk).toBe("claude-haiku-5-5");
    for (const kind of ["site_task_brief_reading", "inbound_qualification", "support_triage", "robot_fit_ranking"] as const) {
      expect(config.getAnthropicEffort(kind), kind).toBe("high");
      expect(config.getTaskModelByProvider(kind).anthropic_agent_sdk, kind).toBe("claude-opus-5-5");
    }
  });

  it("follows the lane's own Anthropic model and effort settings", async () => {
    vi.stubEnv("ANTHROPIC_SITE_TASK_FOLLOW_UP_MODEL", "claude-opus-5-5");
    vi.stubEnv("ANTHROPIC_SITE_TASK_FOLLOW_UP_EFFORT", "medium");
    const config = await import("../agents/provider-config");
    expect(config.getTaskModelByProvider("site_task_follow_up").anthropic_agent_sdk).toBe("claude-opus-5-5");
    expect(config.getAnthropicEffort("site_task_follow_up")).toBe("medium");
    // Other lanes still follow the global settings.
    expect(config.getTaskModelByProvider("site_task_brief_reading").anthropic_agent_sdk).toBe("claude-opus-5-5");
    expect(config.getAnthropicEffort("site_task_brief_reading")).toBe("max");
  });
});
