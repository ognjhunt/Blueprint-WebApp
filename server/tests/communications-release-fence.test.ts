// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { logger } from "../logger";
import { communicationsResearchReleaseAllowsTick, startCommunicationsQueueLoop,
  type CommunicationsDependencies } from "../agents/communications-worker";

describe("communications research release fence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-06T04:00:00Z");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  function setup(lease?: { owner: string; generation: number; expires_at_ms: number }) {
    const readControl = vi.fn(async () => ({ data: () => ({ lease }) }));
    const db = { doc: vi.fn(() => ({ get: readControl })) };
    const store = { automaticJobs: vi.fn(async () => [{ jobId: "synthetic-existing-send-job" }]),
      finishAutomatic: vi.fn(async () => undefined), dueJobIds: vi.fn(async () => []) };
    const deps = { store, now: () => Date.now(), sendAutomatic: vi.fn(async () => ({ state: "failed" as const })),
      api: { run: vi.fn() } } as unknown as CommunicationsDependencies;
    const intake = vi.fn(async () => undefined), observeFounderSends = vi.fn(async () => undefined), copyDrafts = vi.fn(async () => undefined);
    const options = { canStartTick: () => communicationsResearchReleaseAllowsTick(db as unknown as FirebaseFirestore.Firestore, deps.now),
      intake, observeFounderSends, copyDrafts };
    const admissions = [intake, observeFounderSends, copyDrafts, store.automaticJobs, deps.sendAutomatic!, store.dueJobIds, deps.api.run];
    return { db, readControl, store, deps, options, admissions };
  }

  it("skips every admission lane for a live canonical release lease", async () => {
    const f = setup({ owner: "research-release:synthetic", generation: 3, expires_at_ms: Date.now() + 180000 });
    const stop = startCommunicationsQueueLoop(f.deps, f.options);
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.db.doc).toHaveBeenCalledWith("blueprintDailyResearch/sites-first");
    for (const admission of f.admissions) expect(admission).not.toHaveBeenCalled();
    await stop();
  });

  it("resumes the existing lanes when the release lease expires", async () => {
    const f = setup({ owner: "research-release:synthetic", generation: 3, expires_at_ms: Date.now() + 120000 });
    const stop = startCommunicationsQueueLoop(f.deps, f.options);
    await vi.advanceTimersByTimeAsync(60000);
    for (const admission of f.admissions) expect(admission).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.options.intake).toHaveBeenCalledOnce(); expect(f.options.copyDrafts).toHaveBeenCalledOnce();
    expect(f.deps.sendAutomatic).toHaveBeenCalledWith("communications_synthetic-existing-send-job");
    expect(f.store.dueJobIds).toHaveBeenCalledOnce();
    await stop();
  });

  it("leaves a live ordinary research or QA lease unaffected", async () => {
    const f = setup({ owner: "synthetic-qa-owner", generation: 3, expires_at_ms: Date.now() + 180000 });
    const stop = startCommunicationsQueueLoop(f.deps, f.options);
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.options.intake).toHaveBeenCalledOnce(); expect(f.options.observeFounderSends).toHaveBeenCalledOnce();
    expect(f.options.copyDrafts).toHaveBeenCalledOnce(); expect(f.store.dueJobIds).toHaveBeenCalledOnce();
    await stop();
  });

  it("admits nothing on a control read failure and retries the next tick with a stable sanitized code", async () => {
    const f = setup(); f.readControl.mockRejectedValueOnce(new Error("synthetic private backend detail"));
    const stop = startCommunicationsQueueLoop(f.deps, f.options);
    await vi.advanceTimersByTimeAsync(60000);
    for (const admission of f.admissions) expect(admission).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({ code: "communications_research_release_control_unavailable" },
      "Communications admission waits for research release control");
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.options.intake).toHaveBeenCalledOnce();
    await stop();
  });

  it("keeps injected loops unchanged when no release callback is supplied", async () => {
    const f = setup(), { canStartTick: _guard, ...options } = f.options;
    const stop = startCommunicationsQueueLoop(f.deps, options);
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.readControl).not.toHaveBeenCalled(); expect(options.intake).toHaveBeenCalledOnce();
    expect(f.store.dueJobIds).toHaveBeenCalledOnce();
    await stop();
  });

  it("awaits an in-flight control read on stop and then admits nothing", async () => {
    const f = setup(); let finish!: (value: { data: () => { lease: undefined } }) => void;
    f.readControl.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const stop = startCommunicationsQueueLoop(f.deps, f.options);
    await vi.advanceTimersByTimeAsync(60000);
    let stopped = false; const drained = stop(); expect(stop()).toBe(drained);
    void drained.then(() => { stopped = true; }); await Promise.resolve(); expect(stopped).toBe(false);
    finish({ data: () => ({ lease: undefined }) }); await drained;
    for (const admission of f.admissions) expect(admission).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000); expect(f.readControl).toHaveBeenCalledOnce();
  });
});
