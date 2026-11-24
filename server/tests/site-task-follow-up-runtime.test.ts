// @vitest-environment node
/**
 * The follow-up picker goes through the agent runtime as its own lane
 * (`site_task_follow_up`), at the small tier, and keeps its fixed list
 * whenever the lane does not answer in time or answers with an error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => new Map<string, Map<string, any>>());
vi.mock("../agents/runtime", () => ({ runAgentTask }));
// The store holds the job each call is held against (`jobLaneSpend.ts`) and that hold.
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const coll = (name: string) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name)!; };
  const doc = (name: string, id: string): any => ({
    id, path: `${name}/${id}`,
    async get() { const d = coll(name).get(id); return { exists: d !== undefined, id, data: () => d }; },
    async set(value: any, options?: { merge?: boolean }) {
      coll(name).set(id, options?.merge ? { ...(coll(name).get(id) || {}), ...value } : value);
    },
    collection: (sub: string) => ({ doc: (subId: string) => doc(`${name}/${id}/${sub}`, subId), ...query(`${name}/${id}/${sub}`) }),
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
    async runTransaction(fn: any) { return fn({ get: (ref: any) => ref.get(), set: (ref: any, v: any, o: any) => ref.set(v, o) }); },
  };
  return { default: {}, dbAdmin: db, storageAdmin: null };
});

const eligible = ["success_target", "item_photos", "item_weight", "item_make_model"] as const;
const input = { requestId: "req-1", taskStatement: "x".repeat(4000), briefSummary: "y".repeat(2400),
  itemLabels: Array.from({ length: 20 }, (_, i) => `item ${i}`), eligible: [...eligible] };
const holds = () => [...(store.get("inboundRequests/req-1/modelLaneReservations")?.values() ?? [])];

// A provider that may receive the site's text is configured; without one the picker starts no run.
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  store.clear();
  store.set("inboundRequests", new Map([["req-1", { requestId: "req-1" }]]));
});
afterEach(() => { runAgentTask.mockReset(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("follow-up picker through the runtime", () => {
  it("sends its bounded input as the site_task_follow_up lane and keeps the essentials", async () => {
    runAgentTask.mockResolvedValue({ status: "completed", output: { question_ids: ["item_make_model", "made_up"] } });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_make_model"]);
    const [task, options] = runAgentTask.mock.calls[0];
    expect(task).toMatchObject({ kind: "site_task_follow_up" });
    expect(task.input.taskStatement).toHaveLength(3000);
    // The job's description goes whole, up to the one limit it has everywhere (`JOB_DESCRIPTION_MAX_LENGTH`).
    expect(task.input.briefSummary).toHaveLength(2000);
    expect(task.input.itemLabels).toHaveLength(12);
    expect(options).toMatchObject({ dispatchQueuedOnFinish: false });
  });

  it.each([
    ["a failed run (no key, no funds, privacy refusal)", { status: "failed", error: "no_provider_with_funds: x" }],
    ["a run with no output", { status: "completed" }],
  ])("uses the fixed list after %s", async (_name, result) => {
    runAgentTask.mockResolvedValue(result);
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_weight"]);
  });

  it("uses the fixed list when the runtime throws, and when the lane does not answer within 12 seconds", async () => {
    runAgentTask.mockRejectedValueOnce(new Error("agent_run_check_unavailable"));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_weight"]);
    vi.useFakeTimers();
    runAgentTask.mockReturnValueOnce(new Promise(() => undefined));
    const pending = selectFollowUps(input);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await pending).toEqual(["success_target", "item_photos", "item_weight"]);
  });

  it("passes the request id in the run's metadata, and starts no run when no permitted provider is configured", async () => {
    runAgentTask.mockResolvedValue({ status: "completed", output: { question_ids: [] } });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await selectFollowUps({ ...input, requestId: "req-1" });
    expect(runAgentTask.mock.calls[0][0]).toMatchObject({ metadata: { request_id: "req-1" } });
    vi.stubEnv("OPENAI_API_KEY", "");
    runAgentTask.mockClear();
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_weight"]);
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it("waits 12 seconds and no less, and clears its timer once the lane answers", async () => {
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    // Loaded before the clock is faked: what the picker reads before its call, the hold on the job's cap included.
    await Promise.all([import("../agents/provider-config"), import("../agents/provider-privacy"), import("../agents/tasks"),
      import("../agents/tasks/site-task-follow-up"), import("../utils/jobLaneSpend")]);
    vi.useFakeTimers();
    runAgentTask.mockReturnValueOnce(new Promise(() => undefined));
    let settled = false;
    const pending = selectFollowUps(input).then((value) => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(11_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual(["success_target", "item_photos", "item_weight"]);
    expect(vi.getTimerCount()).toBe(0);
    runAgentTask.mockResolvedValueOnce({ status: "completed", output: { question_ids: ["item_make_model"] } });
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_make_model"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  // Money is a hard stop: the picker's call is held against the job's one $40 cap (`jobLaneSpend.ts`).
  it("makes no paid call for a job at its cap, or for an id with no job: the fixed list, nothing held", async () => {
    store.set("inboundRequests", new Map([["req-1", { requestId: "req-1",
      website_preparation_reservations: { a: { admission: { maximum_cost_usd: 40 } } } }]]));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_weight"]);
    expect(await selectFollowUps({ ...input, requestId: "req-unknown" })).toEqual(["success_target", "item_photos", "item_weight"]);
    expect(runAgentTask).not.toHaveBeenCalled();
    expect(holds()).toEqual([]);
    expect(store.get("inboundRequests/req-unknown/modelLaneReservations")).toBeUndefined();
  });

  it("holds the call before it starts, settles it at the cost the run reports, and the job's spend counts it", async () => {
    let heldDuringCall: Array<Record<string, any>> = [];
    runAgentTask.mockImplementation(async () => {
      heldDuringCall = holds().map((row) => ({ ...row }));
      return { status: "completed", output: { question_ids: ["item_make_model"] },
        artifacts: { inference_reservation: { reconciled_cost_usd: 0.0007 } } };
    });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_make_model"]);
    expect(heldDuringCall).toEqual([expect.objectContaining({ lane: "site_task_follow_up", request_id: "req-1" })]);
    expect(heldDuringCall[0]).not.toHaveProperty("settlement");
    // The most the call could cost: what the adapter settles a request with no reported usage at (its input
    // ceiling), 600 output tokens, on gpt-6-luna; never below what the run may report.
    const { worstCaseOpenAIReservationUsd } = await import("../utils/openaiPromptCache");
    const { getAgentMaxInputTokens } = await import("../agents/provider-config");
    expect(heldDuringCall[0].admission.maximum_cost_usd).toBeGreaterThanOrEqual(worstCaseOpenAIReservationUsd({
      model: "gpt-6-luna", inputTokenCeiling: getAgentMaxInputTokens(), maxOutputTokens: 600,
      policy: { status: "disabled", economics: { stable_prefix_tokens: 0 } } as any }));
    expect(heldDuringCall[0].admission.maximum_cost_usd).toBeLessThan(0.05);
    await vi.waitFor(() => expect(holds()[0].settlement).toMatchObject({ actual_cost_usd: 0.0007, basis: "reported_usage" }));
    const { dbAdmin } = await import("../../client/src/lib/firebaseAdmin");
    const { transactionJobLedgerReader, websiteJobSpend } = await import("../utils/websiteJobCeiling");
    const spend = await websiteJobSpend({ record: store.get("inboundRequests")!.get("req-1"),
      reader: transactionJobLedgerReader(dbAdmin!, { get: (ref: any) => ref.get() }, "req-1") });
    expect(spend).toMatchObject({ model_lane_micros: 700, total_micros: 700 });
  });

  it("settles a late run's hold when it ends, after the page took the fixed list, and keeps a thrown run's hold whole", async () => {
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    await Promise.all([import("../agents/provider-config"), import("../agents/provider-privacy"), import("../agents/tasks"),
      import("../agents/tasks/site-task-follow-up"), import("../utils/jobLaneSpend")]);
    vi.useFakeTimers();
    let release!: (value: unknown) => void;
    runAgentTask.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const pending = selectFollowUps(input);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await pending).toEqual(["success_target", "item_photos", "item_weight"]);
    expect(holds()).toHaveLength(1);
    expect(holds()[0]).not.toHaveProperty("settlement");
    vi.useRealTimers();
    release({ status: "completed", output: { question_ids: [] }, artifacts: { inference_reservation: { reconciled_cost_usd: 0.0004 } } });
    await vi.waitFor(() => expect(holds()[0].settlement).toMatchObject({ actual_cost_usd: 0.0004 }));
    runAgentTask.mockRejectedValueOnce(new Error("provider went away"));
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_weight"]);
    await vi.waitFor(() => expect(holds()[1]?.settlement).toMatchObject({ basis: "unknown_counts_in_full" }));
    expect(holds()[1].settlement.actual_cost_usd).toBe(holds()[1].admission.maximum_cost_usd);
  });

  it("is a lane of the small tier whose data only OpenAI may receive", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
    vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "");
    vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
    const config = await import("../agents/provider-config");
    expect(config.describeStructuredAutomationProvider("site_task_follow_up")).toMatchObject({ provider: "openai_responses",
      reason: "lane_default" });
    expect(config.getTaskModelByProvider("site_task_follow_up").openai_responses).toBe("gpt-6-luna");
    expect(config.getOpenAiReasoningEffort("site_task_follow_up")).toBe("low");
    expect(config.getStructuredProviderOrder("site_task_follow_up")).toEqual(["openai_responses"]);
  });
});
