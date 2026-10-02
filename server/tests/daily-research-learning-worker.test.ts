import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), error: vi.fn() }, attachRequestMeta: (input: unknown) => input }));
import { startDailyResearchWorker } from "../utils/dailyResearchWorker";
const learning = () => ({ daily: vi.fn(async () => ({ state: "completed" })), beforeWork: vi.fn(async () => ({ available: true as const, handoff: { contextHash: "synthetic-context", paidModelCalls: 0 } })),
  afterNativeWork: vi.fn(async () => ({})) });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("existing native research worker learning lifecycle", () => {
  it("does not load the package, start timers, or aggregate when the existing worker flag is disabled", async () => {
    vi.stubEnv("BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "false");
    const hooks = learning(), load = vi.fn(); await startDailyResearchWorker({ learning: hooks as any, loadPackage: load }).stop();
    expect(load).not.toHaveBeenCalled(); expect(hooks.daily).not.toHaveBeenCalled();
  });
  it("passes bounded pre-prompt and post-native callbacks while preserving the research package and provider flags", async () => {
    vi.stubEnv("BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "true"); vi.useFakeTimers();
    const hooks = learning(), stop = vi.fn(async () => {}), start = vi.fn((_options: any) => ({ stop }));
    const worker = startDailyResearchWorker({ learning: hooks as any, loadPackage: async () => ({ startDailyResearchWorker: start }) });
    await vi.advanceTimersByTimeAsync(0); expect(start).toHaveBeenCalledTimes(1); expect(hooks.daily).toHaveBeenCalledTimes(1);
    const options = start.mock.calls[0][0] as any;
    expect(options).toMatchObject({ enabled: true }); expect(options).not.toHaveProperty("allowPaidInference"); expect(options).not.toHaveProperty("control");
    expect(await options.learningHooks.beforeRun()).toEqual({ contextHash: "synthetic-context", paidModelCalls: 0 });
    expect(hooks.beforeWork).toHaveBeenCalledWith("daily_research");
    await options.learningHooks.afterRun("2026-10-02"); expect(hooks.afterNativeWork).toHaveBeenCalledWith("blueprintDailyResearch/sites-first/runs/2026-10-02");
    await options.learningHooks.afterRun("unrelated/mailbox"); expect(hooks.afterNativeWork).toHaveBeenCalledTimes(1);
    const stopping = worker.stop(); expect(worker.stop()).toBe(stopping); await stopping;
    expect(stop).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(60000); expect(hooks.daily).toHaveBeenCalledTimes(2);
  });
  it("keeps optional context/observation failures separate from native research behavior", async () => {
    vi.stubEnv("BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "true");
    const hooks = { ...learning(), beforeWork: vi.fn(async () => ({ available: false as const, unknown: "native_learning_context_unavailable" })), afterNativeWork: vi.fn(async () => { throw new Error("PRIVATE_ERROR"); }) };
    let options: any;
    const worker = startDailyResearchWorker({ learning: hooks as any, loadPackage: async () => ({ startDailyResearchWorker: input => { options = input; return { stop: async () => {} }; } }) });
    await Promise.resolve();
    expect(await options.learningHooks.beforeRun()).toEqual({ unknown: "native_learning_context_unavailable", paidModelCalls: 0 });
    await expect(options.learningHooks.afterRun("2026-10-02")).resolves.toBeUndefined(); await worker.stop();
  });
  it("drains learning and does not start a package whose import completes after shutdown", async () => {
    vi.stubEnv("BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "true");
    let resolvePackage: (value: any) => void = () => {}, resolveLearning: (value: any) => void = () => {};
    const start = vi.fn(() => ({ stop: async () => {} })), hooks = { ...learning(), daily: vi.fn(() => new Promise(resolve => { resolveLearning = resolve; })) };
    const worker = startDailyResearchWorker({ learning: hooks as any, loadPackage: () => new Promise(resolve => { resolvePackage = resolve; }) });
    let drained = false; const stopping = worker.stop().then(() => { drained = true; });
    resolvePackage({ startDailyResearchWorker: start }); await Promise.resolve(); expect(drained).toBe(false); expect(start).not.toHaveBeenCalled();
    resolveLearning({ state: "completed" }); await stopping; expect(drained).toBe(true);
  });
});
