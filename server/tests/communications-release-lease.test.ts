// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { logger } from "../logger";
import { claimCommunicationsWorkerLap, COMMUNICATIONS_WORKER_LAP_PATH as LAP, COMMUNICATIONS_WORKER_LAP_LEASE_MS,
  CommunicationsWorkerLapError, type CommunicationsWorkerLap } from "../agents/communications-release-lease";
import { startCommunicationsQueueLoop, type CommunicationsDependencies } from "../agents/communications-worker";

const CONTROL = "blueprintDailyResearch/sites-first", ownerA = "communications-worker-lap:synthetic-a", ownerB = "communications-worker-lap:synthetic-b";
const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
/** Optimistic transactional fixture: a changed read forces the callback to retry.
 * This models the canonical-release race, rather than a serialized blind write. */
function firestore() {
  const values = new Map<string, any>(), versions = new Map<string, number>(), writes: string[] = [], reads: string[][] = [];
  let beforeCommit: (() => void) | undefined, unavailable = false, uncertainCommit = false;
  const put = (path: string, value: any) => { values.set(path, clone(value)); versions.set(path, (versions.get(path) ?? 0) + 1); };
  const doc = (path: string) => ({ path });
  const db = { doc, runTransaction: vi.fn(async (callback: any) => {
    if (unavailable) throw new Error("SYNTHETIC_PRIVATE_BACKEND_DETAIL");
    for (let retry = 0; retry < 5; retry++) {
      const seen = new Map<string, number>(), pending: [string, any][] = [];
      const result = await callback({ get: async (ref: { path: string }) => {
        seen.set(ref.path, versions.get(ref.path) ?? 0);
        const saved = clone(values.get(ref.path)); return { data: () => saved };
      }, set: (ref: { path: string }, value: any) => pending.push([ref.path, value]) });
      reads.push([...seen.keys()]);
      const race = beforeCommit; beforeCommit = undefined; race?.();
      if ([...seen].some(([path, version]) => (versions.get(path) ?? 0) !== version)) continue;
      pending.forEach(([path, value]) => { put(path, value); writes.push(path); });
      if (uncertainCommit) { uncertainCommit = false; throw new Error("SYNTHETIC_COMMIT_ACK_UNKNOWN"); }
      return result;
    }
    throw new Error("SYNTHETIC_TRANSACTION_CONFLICT");
  }) };
  return { db: db as unknown as FirebaseFirestore.Firestore, values, writes, reads, put,
    race: (callback: () => void) => { beforeCommit = callback; }, unavailable: (value: boolean) => { unavailable = value; },
    uncertainCommit: () => { uncertainCommit = true; } };
}
function queue(f: ReturnType<typeof firestore>, claimLap = () => claimCommunicationsWorkerLap(f.db, Date.now, ownerA)) {
  const store = { automaticJobs: vi.fn(async () => [{ jobId: "synthetic-send" }]),
    finishAutomatic: vi.fn(async () => undefined), dueJobIds: vi.fn(async () => []) };
  const deps = { store, now: Date.now, sendAutomatic: vi.fn(async () => ({ state: "failed" })), api: { run: vi.fn() } } as unknown as CommunicationsDependencies;
  const intake = vi.fn(async (_allowed: () => boolean): Promise<void> => {}), observeFounderSends = vi.fn(async (_allowed: () => boolean): Promise<void> => {}),
    copyDrafts = vi.fn(async (_allowed: () => boolean): Promise<void> => {});
  const options = { claimLap, intake, observeFounderSends, copyDrafts };
  const effects = [intake, observeFounderSends, copyDrafts, store.automaticJobs, deps.sendAutomatic!, store.finishAutomatic, store.dueJobIds, deps.api.run];
  return { deps, options, effects };
}

describe("atomic communications whole-lap lease (synthetic only)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime("2026-10-06T06:00:00Z");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    vi.spyOn(logger, "warn").mockImplementation(() => undefined); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("retries a canonical lease change atomically and creates no lap or side effects", async () => {
    const f = firestore(), q = queue(f);
    f.race(() => f.put(CONTROL, { lease: { owner: "research-release:synthetic", expires_at_ms: Date.now() + 180000 } }));
    const stop = startCommunicationsQueueLoop(q.deps, q.options);
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(f.reads).toEqual([[CONTROL, LAP], [CONTROL, LAP]]); expect(f.values.has(LAP)).toBe(false);
    expect(f.writes).toEqual([]); q.effects.forEach(effect => expect(effect).not.toHaveBeenCalled());
  });
  it("makes a winning lap visible to the canonical release transaction before any stage", async () => {
    const f = firestore(); await claimCommunicationsWorkerLap(f.db, Date.now, ownerA);
    let acquired = false;
    await f.db.runTransaction(async tx => {
      await tx.get(f.db.doc(CONTROL));
      const lap = (await tx.get(f.db.doc(LAP))).data();
      if (lap?.phase === "active") return;
      acquired = true; tx.set(f.db.doc(CONTROL), { lease: { owner: "research-release:synthetic", expires_at_ms: Date.now() + 180000 } });
    });
    expect(acquired).toBe(false); expect(f.values.get(LAP)).toMatchObject({ phase: "active", lease: { owner: ownerA, generation: 1 } });
    expect(f.writes).toEqual([LAP]);
  });
  it("leaves ordinary QA leases and expired canonical release leases unaffected", async () => {
    for (const lease of [{ owner: "synthetic-qa", expires_at_ms: Date.now() + 180000 },
      { owner: "research-release:synthetic", expires_at_ms: Date.now() - 1 }]) {
      const f = firestore(); f.put(CONTROL, { lease });
      const lap = await claimCommunicationsWorkerLap(f.db, Date.now, ownerA);
      expect(lap).not.toBeNull(); expect(f.values.get(CONTROL)).toEqual({ lease }); expect(f.writes).toEqual([LAP]);
    }
  });
  it("increments generation only after own drained completion and uses a distinct owner", async () => {
    const f = firestore(), first = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    await first.release();
    expect(f.values.get(LAP)).toMatchObject({ phase: "complete", lease: { owner: ownerA, generation: 1, until: 0 } });
    const second = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerB))!;
    expect(second).toMatchObject({ owner: ownerB, generation: 2 });
  });
  it("an earlier owner/generation cannot renew or release its successor", async () => {
    const f = firestore(), first = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    await first.release(); await claimCommunicationsWorkerLap(f.db, Date.now, ownerB);
    const before = clone(f.values.get(LAP));
    await expect(first.release()).rejects.toMatchObject({ code: "communications_worker_lap_ownership_changed" });
    await expect(first.renew()).rejects.toMatchObject({ code: "communications_worker_lap_ownership_changed" });
    expect(f.values.get(LAP)).toEqual(before);
  });
  it("requires generation even if an old owner string is reused", async () => {
    const f = firestore(), first = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    await first.release(); await claimCommunicationsWorkerLap(f.db, Date.now, ownerA);
    await expect(first.release()).rejects.toMatchObject({ code: "communications_worker_lap_ownership_changed" });
    expect(f.values.get(LAP)).toMatchObject({ phase: "active", lease: { generation: 2 } });
  });
  it("retries a changed release read and cannot overwrite successor evidence", async () => {
    const f = firestore(), first = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    const successor = { ...clone(f.values.get(LAP)), lease: { owner: ownerB, generation: 2, until: Date.now() + 180000 } };
    f.race(() => f.put(LAP, successor));
    await expect(first.release()).rejects.toMatchObject({ code: "communications_worker_lap_ownership_changed" });
    expect(f.values.get(LAP)).toEqual(successor); expect(f.writes).toEqual([LAP]);
  });
  it("never steals expired active evidence; only its drained owner can complete it", async () => {
    const f = firestore(), first = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    await vi.advanceTimersByTimeAsync(COMMUNICATIONS_WORKER_LAP_LEASE_MS + 1);
    expect(first.canContinue()).toBe(false);
    await expect(claimCommunicationsWorkerLap(f.db, Date.now, ownerB)).rejects.toMatchObject({ code: "communications_worker_lap_unsettled" });
    await expect(first.renew()).rejects.toMatchObject({ code: "communications_worker_lap_expired" });
    expect(f.values.get(LAP).phase).toBe("active"); await first.release(); expect(f.values.get(LAP).phase).toBe("complete");
  });
  it("refuses uncertain records instead of resetting them", async () => {
    const f = firestore(); f.put(LAP, { phase: "uncertain" });
    await expect(claimCommunicationsWorkerLap(f.db, Date.now, ownerA)).rejects.toMatchObject({ code: "communications_worker_lap_unsettled" });
    expect(f.writes).toEqual([]);
  });
  it("renews an owned live lap for 180 seconds without changing its generation or controls", async () => {
    const f = firestore(), lap = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    await vi.advanceTimersByTimeAsync(60000); await lap.renew();
    expect(f.values.get(LAP)).toMatchObject({ phase: "active", lease: { owner: ownerA, generation: 1, until: Date.now() + 180000 }, renewedAt: Date.now() });
    expect(f.values.has(CONTROL)).toBe(false); expect(f.writes).toEqual([LAP, LAP]);
  });
  it("retains active evidence on renewal or release read failure with fixed codes", async () => {
    const f = firestore(), lap = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    f.unavailable(true);
    await expect(lap.renew()).rejects.toMatchObject({ code: "communications_worker_lap_renew_unavailable" });
    await expect(lap.release()).rejects.toMatchObject({ code: "communications_worker_lap_release_unavailable" });
    expect(f.values.get(LAP).phase).toBe("active");
  });
  it("blocks all queue effects on live canonical release, orphan active, and failed claim", async () => {
    for (const mode of ["release", "orphan", "unavailable"]) {
      const f = firestore(), q = queue(f);
      if (mode === "release") f.put(CONTROL, { lease: { owner: "research-release:synthetic", expires_at_ms: Date.now() + 180000 } });
      if (mode === "orphan") await claimCommunicationsWorkerLap(f.db, Date.now, ownerB);
      if (mode === "unavailable") f.unavailable(true);
      const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(60000); await stop();
      q.effects.forEach(effect => expect(effect).not.toHaveBeenCalled());
    }
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("PRIVATE");
  });
  it("an uncertain claim acknowledgement admits nothing and never resets its durable active record", async () => {
    const f = firestore(), q = queue(f); f.uncertainCommit();
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(120000); await stop();
    q.effects.forEach(effect => expect(effect).not.toHaveBeenCalled());
    expect(f.values.get(LAP)).toMatchObject({ phase: "active", lease: { owner: ownerA, generation: 1 } });
    expect(f.writes).toEqual([LAP]);
    expect(logger.warn).toHaveBeenCalledWith({ code: "communications_worker_lap_claim_unavailable" }, "Communications worker requires recovery");
    expect(logger.warn).toHaveBeenCalledWith({ code: "communications_worker_lap_unsettled" }, "Communications worker requires recovery");
  });
  it("stop waits for a pending claim, then releases its acquired scope without admission", async () => {
    const f = firestore(); let finish!: (lap: CommunicationsWorkerLap) => void;
    const q = queue(f, () => new Promise<CommunicationsWorkerLap>(resolve => { finish = resolve; }));
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(60000);
    let drained = false; const stopping = stop(); expect(stop()).toBe(stopping); void stopping.then(() => { drained = true; });
    await Promise.resolve(); expect(drained).toBe(false);
    finish((await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!); await stopping;
    expect(f.values.get(LAP).phase).toBe("complete"); q.effects.forEach(effect => expect(effect).not.toHaveBeenCalled());
  });
  it("renews during stop drainage and releases only after the final awaited stage write", async () => {
    const f = firestore(), q = queue(f); let finish!: () => void;
    q.options.intake.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      f.put("synthetic/final-stage-write", { settled: true });
    });
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(60000);
    const stopping = stop(); await vi.advanceTimersByTimeAsync(120000);
    expect(f.values.get(LAP)).toMatchObject({ phase: "active", lease: { until: Date.now() + 180000 } });
    expect(f.values.has("synthetic/final-stage-write")).toBe(false);
    finish(); await stopping;
    expect(f.values.get("synthetic/final-stage-write")).toEqual({ settled: true }); expect(f.values.get(LAP).phase).toBe("complete");
    expect(q.options.observeFounderSends).not.toHaveBeenCalled(); expect(q.options.copyDrafts).not.toHaveBeenCalled();
    const writes = f.writes.length; await vi.advanceTimersByTimeAsync(120000); expect(f.writes).toHaveLength(writes);
  });
  it("a renewal failure drains in-flight work while preventing every subsequent stage", async () => {
    const f = firestore(), q = queue(f); let finish!: () => void, allowed!: () => boolean;
    q.options.intake.mockImplementationOnce(async callback => { allowed = callback; await new Promise<void>(resolve => { finish = resolve; }); });
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(60000);
    expect(allowed()).toBe(true); f.unavailable(true); await vi.advanceTimersByTimeAsync(60000);
    expect(allowed()).toBe(false); expect(f.values.get(LAP).phase).toBe("active");
    f.unavailable(false); finish(); await Promise.resolve(); await stop();
    expect(q.options.observeFounderSends).not.toHaveBeenCalled(); expect(q.options.copyDrafts).not.toHaveBeenCalled();
    expect(q.deps.store.automaticJobs).not.toHaveBeenCalled(); expect(q.deps.store.dueJobIds).not.toHaveBeenCalled();
    expect(f.values.get(LAP).phase).toBe("complete");
  });
  it("awaits an in-flight renewal on stop before releasing the exact scope", async () => {
    const f = firestore(), q = queue(f); let finishStage!: () => void, finishRenew!: () => void;
    const acquired = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    const scope = { ...acquired, renew: vi.fn(() => new Promise<void>(resolve => { finishRenew = resolve; })) };
    q.options.claimLap = async () => scope;
    q.options.intake.mockImplementationOnce(() => new Promise<void>(resolve => { finishStage = resolve; }));
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(120000);
    expect(scope.renew).toHaveBeenCalledOnce(); expect(scope.canContinue()).toBe(true);
    const stopping = stop(); finishStage(); await Promise.resolve(); expect(f.values.get(LAP).phase).toBe("active");
    finishRenew(); await stopping; expect(f.values.get(LAP).phase).toBe("complete");
  });
  it("holds later admission while renewal is pending, then admits after its success", async () => {
    const f = firestore(), q = queue(f); let finishStage!: () => void, finishRenew!: () => void, allowed!: () => boolean;
    const acquired = (await claimCommunicationsWorkerLap(f.db, Date.now, ownerA))!;
    q.options.claimLap = async () => ({ ...acquired, renew: () => new Promise<void>(resolve => { finishRenew = resolve; }) });
    q.options.intake.mockImplementationOnce(callback => { allowed = callback; return new Promise<void>(resolve => { finishStage = resolve; }); });
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(120000);
    expect(allowed()).toBe(false); finishStage(); await Promise.resolve();
    expect(q.options.observeFounderSends).not.toHaveBeenCalled(); expect(f.values.get(LAP).phase).toBe("active");
    finishRenew(); await vi.advanceTimersByTimeAsync(0);
    expect(q.options.observeFounderSends).toHaveBeenCalledOnce(); expect(q.options.copyDrafts).toHaveBeenCalledOnce();
    await stop(); expect(f.values.get(LAP).phase).toBe("complete");
  });
  it("failed final release leaves active evidence and no raw exception in logs", async () => {
    const f = firestore(), q = queue(f);
    q.options.intake.mockImplementationOnce(async () => { f.unavailable(true); });
    const stop = startCommunicationsQueueLoop(q.deps, q.options); await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(f.values.get(LAP).phase).toBe("active");
    expect(logger.warn).toHaveBeenCalledWith({ code: "communications_worker_lap_release_unavailable" }, "Communications lap drainage awaits its durable receipt");
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("PRIVATE");
  });
});
