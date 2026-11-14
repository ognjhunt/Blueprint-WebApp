// @vitest-environment node
/**
 * Failover on "no funds" only: once per run, to a provider the data-class gate
 * permits for the lane's data, that is configured and priced, recorded on the
 * run. Fake adapters stand for each error class; nothing is sent anywhere.
 *
 * The runs use the robot-fit ranking (the site's job text, the job's records and
 * public research notes); the list settings use the follow-up picker. Bound to a
 * job started under Privacy 2026-11-13.1 it may move to Anthropic; bound to an
 * older job, or to none, only OpenAI may receive its data, so it never moves.
 * Anthropic is first on no lane (the lane resolves on the strictest table), so
 * every switch here runs from OpenAI to Anthropic.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() => vi.fn());
const runAnthropicAgentSdkTask = vi.hoisted(() => vi.fn());

const store = vi.hoisted(() => new Map<string, Map<string, any>>());
// A small in-memory store: the runtime reads the bound job's Privacy version from it.
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
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } }, dbAdmin: db, storageAdmin: null,
    authAdmin: null };
});
vi.mock("../agents/adapters/openai-responses", () => ({ runOpenAIResponsesTask }));
vi.mock("../agents/adapters/anthropic-agent-sdk", () => ({ runAnthropicAgentSdkTask }));
const recordOpsActionLog = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../agents/ops-action-logs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agents/ops-action-logs")>()), recordOpsActionLog }));

const headers = () => new Headers({ "request-id": "req_fixture" });
const openAiError = (status: number, type: string | undefined, code: string | undefined) =>
  OpenAI.APIError.generate(status, { error: { type, code, message: "wording that can change" } }, undefined, headers());
const anthropicNoFunds = () => Anthropic.APIError.generate(402, { type: "error", error: { type: "billing_error", message: "x" } }, undefined, headers());

const completed = (task: { provider: string; runtime: string; model: string }) => ({
  status: "completed", provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: "api",
  output: { question_ids: [] }, raw_output_text: "{}", requires_human_review: false, requires_approval: false,
  artifacts: { usage: { prompt_tokens: 10, completion_tokens: 2 } },
});
const failedNoFunds = (task: { provider: string; runtime: string; model: string }, extra: Record<string, unknown> = {}) => ({
  status: "failed", provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: "api", error: "anthropic_provider_request_failed",
  requires_human_review: true, requires_approval: false,
  artifacts: { provider_error: { error_class: "no_funds", provider: task.provider, sdk: "anthropic", status: 402,
    type: "billing_error", code: null }, provider_responses: [], company_history_tool_calls: [],
    inference_reservation: { reconciled_cost_usd: 0 }, ...extra },
});

const SITE_TEXT = "Jane at 1 Main St";
const picker = { kind: "robot_fit_ranking", input: { candidates: [{ teamId: "t", name: "T", status: "prospect", agreed: false,
  notes: "n", whatGoesWrong: null, recorded: [] }], job: { summary: `${SITE_TEXT}: move totes`, instruction: null, rated: false,
  notRatedReason: null, needs: [], requirements: [], unknowns: [], forms: [], serviceArea: null } } };
const acceptance = (version: string) => ({ accepted_terms: true, terms_version: "2026-11-12.2", privacy_version: version,
  terms_url: "/terms", privacy_url: "/privacy", accepted_at: "2026-11-13T09:00:00.000Z", accepted_from_ip_hash: null });
type Run = (task: unknown) => Promise<any>;
/** The ranking for a job under Privacy 2026-11-13.1: OpenAI and Anthropic may both receive its data. */
const runLane = async (task: unknown = picker) => {
  const { runAgentTask } = await import("../agents/runtime");
  return runAgentTask(task as never, { privacyRequestBinding: { request_id: "job-new" } });
};
/** The ranking for an older job: only OpenAI may receive its data. */
const runOpenAiOnly: Run = async (task = picker) => {
  const { runAgentTask } = await import("../agents/runtime");
  return runAgentTask(task as never, { privacyRequestBinding: { request_id: "job-old" } });
};

beforeEach(async () => {
  for (const key of ["BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
    "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS",
    "ANTHROPIC_BASE_URL", "OPENAI_BASE_URL", "ACP_HARNESS_URL", "OPENCLAW_BASE_URL", "ANTHROPIC_SITE_TASK_FOLLOW_UP_MODEL",
    "OPENAI_SITE_TASK_FOLLOW_UP_MODEL", "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDERS", "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDER",
    "ANTHROPIC_ROBOT_FIT_RANKING_MODEL", "OPENAI_ROBOT_FIT_RANKING_MODEL", "ANTHROPIC_DEFAULT_MODEL", "OPENAI_DEFAULT_MODEL"]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
  store.clear();
  store.set("inboundRequests", new Map<string, any>([
    ["job-new", { privacy_version_at_submission: "2026-11-13.1", terms_acceptance: acceptance("2026-11-13.1") }],
    ["job-old", { privacy_version_at_submission: "2026-11-12.2", terms_acceptance: acceptance("2026-11-12.2") }],
  ]));
});
afterEach(() => {
  runOpenAIResponsesTask.mockReset();
  runAnthropicAgentSdkTask.mockReset();
  recordOpsActionLog.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("failover on no funds", () => {
  it("switches once to a permitted, configured, priced provider and records it on the run", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    const result = await runLane();
    expect(result.status).toBe("completed");
    expect(result.provider).toBe("anthropic_agent_sdk");
    expect(runAnthropicAgentSdkTask.mock.calls[0][0]).toMatchObject({ provider: "anthropic_agent_sdk", model: "claude-haiku-5-5" });
    expect(result.artifacts?.provider_failover).toMatchObject({ from_provider: "openai_responses", to_provider: "anthropic_agent_sdk",
      to_model: "claude-haiku-5-5", trigger: "no_funds", error: { error_class: "no_funds", http_status: 429, error_code: "insufficient_quota" } });
    expect(result.logs?.some((log: { event_type: string }) => log.event_type === "provider.failover")).toBe(true);
    expect((await import("../agents/provider-funds")).listProvidersOutOfFunds()).toEqual([expect.objectContaining({
      provider: "openai_responses", error_code: "insufficient_quota", http_status: 429 })]);
  });

  it("skips a provider still cooling down after no funds, without calling it", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    await runLane();
    runOpenAIResponsesTask.mockClear();
    const second = await runLane();
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    expect(second.artifacts?.provider_failover).toMatchObject({ trigger: "cooling_down_no_funds", to_provider: "anthropic_agent_sdk" });
  });

  it.each([
    ["a plain rate limit", openAiError(429, "requests", "rate_limit_exceeded")],
    ["an authentication error", openAiError(401, "invalid_request_error", "invalid_api_key")],
    ["an overload", openAiError(503, "server_error", "server_is_overloaded")],
    ["an unknown error", new Error("socket hang up")],
  ])("does not switch on %s", async (_name, error) => {
    runOpenAIResponsesTask.mockRejectedValue(error);
    const result = await runLane().catch((thrown) => ({ status: "failed", thrown, artifacts: undefined }));
    expect(result.status).toBe("failed");
    expect(runAnthropicAgentSdkTask).not.toHaveBeenCalled();
    expect(result.artifacts?.provider_failover).toBeUndefined();
  });

  it("switches at most once: when the second provider also has no funds the run fails", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => failedNoFunds(task));
    const result = await runLane();
    expect(result.status).toBe("failed");
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
    expect(runAnthropicAgentSdkTask).toHaveBeenCalledTimes(1);
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("anthropic_agent_sdk")).toBe(true);
  });

  it("never switches a lane whose data only one provider may receive: it fails as no_provider_with_funds", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    for (const run of [runOpenAiOnly, async () => (await import("../agents/runtime")).runAgentTask(picker as never)]) {
      runOpenAIResponsesTask.mockClear();
      (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
      const result = await run(picker);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("no_provider_with_funds");
      expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
      expect(runAnthropicAgentSdkTask).not.toHaveBeenCalled();
      expect(result.artifacts?.provider_failover).toMatchObject({ to_provider: null, from_provider: "openai_responses" });
    }
  });

  it("does not switch after the first provider answered, called a tool or may have charged", async () => {
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    // Without a trace the same answer moves the run: the trace is what holds it.
    runOpenAIResponsesTask.mockImplementation(async (task) => failedNoFunds(task));
    expect((await runLane()).provider).toBe("anthropic_agent_sdk");
    for (const trace of [{ provider_responses: [{ responseId: "r" }] }, { company_history_tool_calls: [{ name: "search" }] },
      { inference_reservation: { reconciled_cost_usd: 0.01 } }]) {
      runAnthropicAgentSdkTask.mockClear();
      runOpenAIResponsesTask.mockReset();
      runOpenAIResponsesTask.mockImplementation(async (task) => failedNoFunds(task, trace));
      (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
      const result = await runLane();
      expect(result.status).toBe("failed");
      expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
      expect(runAnthropicAgentSdkTask).not.toHaveBeenCalled();
    }
  });

  it("classifies Anthropic's own no-funds error from the adapter the same way (a 402 at the request)", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockRejectedValue(anthropicNoFunds());
    const result = await runLane();
    expect(result.artifacts?.provider_failover).toMatchObject({ from_provider: "openai_responses", to_provider: "anthropic_agent_sdk",
      second_attempt: { threw: true, error_class: "no_funds", http_status: 402, error_type: "billing_error" } });
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("anthropic_agent_sdk")).toBe(true);
  });
});

describe("ordered lists and the Anthropic model check (S2)", () => {
  it("serves the lane from its list, refusing entries the gate does not permit", async () => {
    vi.stubEnv("ACP_HARNESS_URL", "http://harness.invalid");
    vi.stubEnv("BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", "acp_harness,anthropic_agent_sdk,deepseek_chat,openai_responses");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    // On the strictest table only OpenAI may receive the site's job text: the harness and Anthropic are refused.
    expect(config.describeStructuredAutomationProvider("site_task_follow_up")).toMatchObject({
      provider: "openai_responses", reason: "lane_list",
      provider_list: { env_key: "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", unrecognized: ["removed_provider"] },
      refused_settings: [
        expect.objectContaining({ env_key: "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", requested: "acp_harness" }),
        expect.objectContaining({ env_key: "BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", requested: "anthropic_agent_sdk" })] });
    expect(config.getStructuredProviderOrder("site_task_follow_up")).toEqual(["openai_responses"]);
    // A job under 2026-11-13.1 may also go to Anthropic, after OpenAI; the harness stays refused.
    expect(config.getStructuredProviderOrder("site_task_follow_up", "2026-11-13.1")).toEqual(["openai_responses", "anthropic_agent_sdk"]);
    expect(config.listRemovedProviderSettings()).toContain("BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS");
  });

  it("keeps OpenAI first without a list, and a list cannot put a refused provider on a lane", async () => {
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "anthropic_agent_sdk,openai_responses");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    expect(config.getStructuredProviderOrder("robot_fit_ranking")).toEqual(["openai_responses"]);
    expect(config.getStructuredProviderOrder("site_task_brief_reading")).toEqual(["openai_responses"]);
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "");
    vi.resetModules();
    expect((await import("../agents/provider-config")).getStructuredProviderOrder("site_task_follow_up", "2026-11-13.1"))
      .toEqual(["openai_responses", "anthropic_agent_sdk"]);
  });

  it("skips Anthropic for a lane whose Anthropic model has no request shape or price row", async () => {
    vi.stubEnv("ANTHROPIC_SITE_TASK_FOLLOW_UP_MODEL", "claude-model-without-a-row");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    expect(config.getStructuredProviderOrder("site_task_follow_up", "2026-11-13.1")).toEqual(["openai_responses"]);
    expect(config.chooseFailoverProvider("site_task_follow_up", "openai_responses", { privacyVersion: "2026-11-13.1" }).provider)
      .toBeNull();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.resetModules();
    expect((await import("../agents/provider-config")).describeStructuredAutomationProvider("site_task_follow_up")).toMatchObject({
      provider: "openai_responses", fails_closed: "permitted_provider_not_configured" });
  });
});

const executeRow = () => recordOpsActionLog.mock.calls.map((call) => call[0] as Record<string, unknown>)
  .filter((row) => row.action_key === "agent.run.execute" && row.status !== "started").at(-1);

describe("a second attempt that throws", () => {
  it.each([
    ["a server error", () => Anthropic.APIError.generate(500, { type: "error", error: { type: "api_error", message: "x" } },
      undefined, headers()), false],
    ["its own no-funds answer", () => anthropicNoFunds(), true],
  ])("keeps the switch record and names the second provider when it throws %s", async (_name, make, cooling) => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockRejectedValue(make());
    const result = await runLane();
    expect(result).toMatchObject({ status: "failed", provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk",
      requires_human_review: true });
    expect(result.error).toBe((make() as Error).message);
    expect(result.artifacts?.provider_failover).toMatchObject({ from_provider: "openai_responses", to_provider: "anthropic_agent_sdk",
      second_attempt: { threw: true, status: null, error_class: cooling ? "no_funds" : expect.any(String), http_status: cooling ? 402 : 500 } });
    expect(result.artifacts?.provider_error).toMatchObject({ error_class: cooling ? "no_funds" : expect.any(String) });
    expect(result.logs?.map((log: { event_type: string }) => log.event_type)).toEqual(["provider.failover", "provider.second_attempt"]);
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("anthropic_agent_sdk")).toBe(cooling);
    expect(runAnthropicAgentSdkTask).toHaveBeenCalledTimes(1);
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
  });

  it("records how a second attempt that returned ended", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    const result = await runLane();
    expect(result.artifacts?.provider_failover).toMatchObject({ second_attempt: { threw: false, status: "completed",
      error_class: null, http_status: null } });
  });
});

describe("a switch is visible to operators", () => {
  it("names the provider that served the run in the action log and writes one warning", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    const { logger } = await import("../logger");
    const warn = vi.spyOn(logger, "warn");
    const error = vi.spyOn(logger, "error");
    await runLane();
    expect(executeRow()).toMatchObject({ provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk",
      summary: expect.stringContaining("switched from openai_responses to anthropic_agent_sdk after no funds") });
    const lines = warn.mock.calls.filter((call) => call[1] === "Agent task switched provider after no funds");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toEqual({ runId: expect.any(String), taskKind: "robot_fit_ranking", fromProvider: "openai_responses",
      toProvider: "anthropic_agent_sdk", trigger: "no_funds", errorClass: "no_funds", httpStatus: 429, errorCode: "insufficient_quota" });
    expect(error).not.toHaveBeenCalled();
  });

  it("writes one error line when no provider with funds is left, with ids and codes only", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    const { logger } = await import("../logger");
    const error = vi.spyOn(logger, "error");
    await runOpenAiOnly(picker);
    const lines = error.mock.calls.filter((call) => call[1] === "Agent task failed: no provider with funds");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatchObject({ taskKind: "robot_fit_ranking", fromProvider: "openai_responses", toProvider: null,
      errorClass: "no_funds", httpStatus: 429, errorCode: "insufficient_quota" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("Jane");
    expect(executeRow()).toMatchObject({ provider: "openai_responses", status: "failed" });
  });

  it("writes one error line when the run fails after a switch", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockRejectedValue(Anthropic.APIError.generate(500, { type: "error",
      error: { type: "api_error", message: "x" } }, undefined, headers()));
    const { logger } = await import("../logger");
    const warn = vi.spyOn(logger, "warn");
    const error = vi.spyOn(logger, "error");
    await runLane();
    expect(warn.mock.calls.filter((call) => call[1] === "Agent task switched provider after no funds")).toHaveLength(1);
    const lines = error.mock.calls.filter((call) => call[1] === "Agent task failed after switching provider");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatchObject({ fromProvider: "openai_responses", toProvider: "anthropic_agent_sdk",
      secondAttemptThrew: true, secondHttpStatus: 500 });
    expect(error.mock.calls.filter((call) => call[1] === "Agent task failed")).toHaveLength(0);
    expect(executeRow()).toMatchObject({ provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk", status: "failed",
      summary: expect.stringContaining("switched from openai_responses to anthropic_agent_sdk after no funds") });
  });
});

describe("the cool-down never blocks a run with nowhere else to go", () => {
  it("asks the cooling provider again when no other provider can take the run, and succeeds once it recovers", async () => {
    runOpenAIResponsesTask.mockRejectedValueOnce(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runOpenAIResponsesTask.mockRejectedValueOnce(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runOpenAIResponsesTask.mockImplementation(async (task) => completed(task));
    const funds = await import("../agents/provider-funds");
    const first = await runOpenAiOnly(picker);
    const until = funds.listProvidersOutOfFunds()[0].retry_after;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 1000);
      const second = await runOpenAiOnly(picker);
      expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(2);
      expect(first.error).toContain("no_provider_with_funds");
      expect(second.error).toContain("no_provider_with_funds");
      expect(funds.listProvidersOutOfFunds()[0].retry_after > until).toBe(true);
      const third = await runOpenAiOnly(picker);
      expect(third.status).toBe("completed");
      expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says no inference was invoked only when no request was sent", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    const thrown = await runOpenAiOnly(picker);
    expect(thrown.artifacts?.inference_not_invoked).toBe(false);
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    runOpenAIResponsesTask.mockClear();
    const skipped = await runLane();
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    expect(skipped.artifacts?.provider_failover).toMatchObject({ trigger: "cooling_down_no_funds" });
    runAnthropicAgentSdkTask.mockImplementation(async (task) => failedNoFunds(task));
    const none = await runLane();
    expect(none.artifacts?.provider_failover).toMatchObject({ trigger: "cooling_down_no_funds", second_attempt: { error_class: "no_funds" } });
    // Both providers are cooling down now: OpenAI is asked again, so a request was sent.
    runOpenAIResponsesTask.mockClear();
    const again = await runLane();
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
    expect(again.artifacts?.inference_not_invoked).toBe(false);
  });
});

describe("the no-funds cool-down setting", () => {
  it.each([["", 15 * 60 * 1000], ["   ", 15 * 60 * 1000], ["0", 0], ["60000", 60000]])("%j means %i ms", async (value, expected) => {
    vi.stubEnv("BLUEPRINT_PROVIDER_NO_FUNDS_COOLDOWN_MS", value);
    const funds = await import("../agents/provider-funds");
    expect(funds.getNoFundsCooldownMs()).toBe(expected);
    funds.markProviderOutOfFunds("openai_responses", { type: null, code: null, status: 429 }, 1_000);
    expect(funds.isProviderCoolingDown("openai_responses", 1_001)).toBe(expected > 0);
  });
});

describe("chooseFailoverProvider", () => {
  it("never switches to a provider that does not enforce the per-run cap, even when it is permitted, configured and listed", async () => {
    // Test-only: the gate is told the harness may receive the lane's data, so only the run cap can keep it out.
    vi.doMock("../agents/provider-privacy", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../agents/provider-privacy")>();
      return { ...actual, privacyDecision: ((provider, taskKind, version) => provider === "acp_harness"
        ? { ...actual.privacyDecision("openai_responses", taskKind, version), permitted: true, blocked_by: [] }
        : actual.privacyDecision(provider, taskKind, version)) as typeof actual.privacyDecision };
    });
    try {
      vi.stubEnv("ACP_HARNESS_URL", "http://harness.invalid");
      for (const [list, expected] of [["openai_responses,acp_harness", null],
        ["openai_responses,acp_harness,anthropic_agent_sdk", "anthropic_agent_sdk"]] as const) {
        vi.stubEnv("BLUEPRINT_SITE_TASK_FOLLOW_UP_PROVIDERS", list);
        vi.resetModules();
        const config = await import("../agents/provider-config");
        expect(config.getStructuredProviderOrder("site_task_follow_up", "2026-11-13.1")).toContain("acp_harness");
        expect(config.RUN_CAP_ENFORCING_PROVIDERS.has("acp_harness")).toBe(false);
        const decision = config.chooseFailoverProvider("site_task_follow_up", "openai_responses", { privacyVersion: "2026-11-13.1" });
        expect(decision.provider).toBe(expected);
        expect(decision.skipped).toContainEqual({ provider: "acp_harness", reason: "run_cap_not_enforced" });
      }
    } finally {
      vi.doUnmock("../agents/provider-privacy");
    }
  });
});
