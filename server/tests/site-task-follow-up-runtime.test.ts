// @vitest-environment node
/**
 * The follow-up picker goes through the agent runtime as its own lane
 * (`site_task_follow_up`), at the small tier, and keeps its fixed list
 * whenever the lane does not answer in time or answers with an error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
vi.mock("../agents/runtime", () => ({ runAgentTask }));

const eligible = ["success_target", "item_photos", "item_weight", "item_make_model"] as const;
const input = { taskStatement: "x".repeat(4000), briefSummary: "y".repeat(400), itemLabels: Array.from({ length: 20 }, (_, i) => `item ${i}`),
  eligible: [...eligible] };

// A provider that may receive the site's text is configured; without one the picker starts no run.
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", ""); });
afterEach(() => { runAgentTask.mockReset(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("follow-up picker through the runtime", () => {
  it("sends its bounded input as the site_task_follow_up lane and keeps the essentials", async () => {
    runAgentTask.mockResolvedValue({ status: "completed", output: { question_ids: ["item_make_model", "made_up"] } });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps(input)).toEqual(["success_target", "item_photos", "item_make_model"]);
    const [task, options] = runAgentTask.mock.calls[0];
    expect(task).toMatchObject({ kind: "site_task_follow_up" });
    expect(task.input.taskStatement).toHaveLength(3000);
    expect(task.input.briefSummary).toHaveLength(300);
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
    await import("../agents/provider-config");
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
