// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { savedRecoveryFixture } from "./fixtures/communications-saved-recovery";
import { recoverCommunicationsDraftInProcess } from "../agents/communications-inprocess-recovery";
import { communicationsMemoryCounters, assertCommunicationsRecoveryHeadroom } from "../agents/communications-recovery-memory";
import { communicationsDigest } from "../agents/communications-contract";
import { COMMUNICATIONS_WORKER_LAP_PATH } from "../agents/communications-release-lease";

const sample = (stage: string) => ({ stage, observedAt: new Date().toISOString(), pid: 999, rss: 180000000, heapUsed: 60000000,
  external: 4000000, processLifetimeMaxRss: 185000000, cgroup: { current: 300000000, limit: 536870912,
    counters: communicationsMemoryCounters("anon 180000000\nfile 80000000\nkernel 40000000\nshmem 0\nfile_mapped 10000000\nfile_dirty 0\nfile_writeback 0\ninactive_file 40000000\nactive_file 40000000\nunevictable 0") } });
beforeEach(() => {
  vi.stubEnv("RENDER_GIT_COMMIT", "a".repeat(40));
  for (const name of ["BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED", "BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED"]) vi.stubEnv(name, "false");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("owner-directed recovery inside the existing process", () => {
  it("runs the real saved consumer once, retains liabilities and replay is read-only", async () => {
    const f = await savedRecoveryFixture(), budget = structuredClone(f.db.records.get(f.budgetPath));
    const run = vi.spyOn(f.deps.api, "run"), cancel = vi.spyOn(f.deps.api, "cancel");
    const result = await recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample });
    expect(result).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(f.requests).toHaveLength(3);
    expect(f.db.records.get(f.path).savedOutputRecovery.ownerAction).toMatchObject({ actorUid: "synthetic-owner", originalJobDigest: f.input.expectedJobDigest });
    expect(f.db.records.get(f.budgetPath)).toEqual(budget);
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH)).toMatchObject({ phase: "complete", lease: { until: 0 } });
    expect(await recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).toMatchObject({ state: "no_op" });
    expect(f.requests).toHaveLength(3); expect(run).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  });
  it.each(["failure", "cancelled"] as const)("drains %s and admits a different following job", async mode => {
    const f = await savedRecoveryFixture(mode);
    const result = await recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample });
    expect(["blocked", "retry"]).toContain(result.state);
    expect([...f.db.records.keys()].filter(x => x.startsWith("action_ledger/"))).toHaveLength(0);
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH).phase).toBe("complete");
    const next = await savedRecoveryFixture();
    expect(await recoverCommunicationsDraftInProcess(next.input, "synthetic-owner", next.deps, { sample })).toMatchObject({ state: "pending_approval" });
  });
  it("stops request cancellation before writes and rejects concurrent admission without retaining it", async () => {
    const f = await savedRecoveryFixture(), aborted = AbortSignal.abort();
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample, signal: aborted })).rejects.toThrow("request_cancelled");
    expect(f.db.records.get(f.path)).toEqual(f.original);
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(r => { enter = r; }), held = new Promise<void>(r => { release = r; });
    const original = f.deps.api.reconcileSaved.bind(f.deps.api);
    vi.spyOn(f.deps.api, "reconcileSaved").mockImplementation(async (...args) => { enter(); await held; return original(...args); });
    const first = recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample });
    await entered;
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).rejects.toThrow("process_busy");
    release(); expect(await first).toMatchObject({ state: "pending_approval" });
  });
  it.each(["job", "checkpoint", "source", "optout", "release"])("refuses changed %s without a provider call", async kind => {
    const f = await savedRecoveryFixture();
    if (kind === "job") await f.db.doc(f.path).update({ reason: "changed" });
    if (kind === "checkpoint") await f.db.doc(f.path).update({ checkpoint: { ...f.original.checkpoint, sessionId: "other" } });
    if (kind === "source") vi.stubEnv("RENDER_GIT_COMMIT", "b".repeat(40));
    if (kind === "optout") await f.db.doc(`outboundProspects/${f.brief.prospectId}`).update({ stage: "closed" });
    if (kind === "release") await f.db.doc("blueprintDailyResearch/sites-first").set({ lease: { owner: "research-release:fixture", expires_at_ms: f.deps.now() + 100000 } });
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
  });
  it("CAS checks the full job again in the transaction before retry", async () => {
    const f = await savedRecoveryFixture(), store = f.deps.store, originalRetry = store.retryBlocked.bind(store);
    vi.spyOn(store, "retryBlocked").mockImplementation(async input => {
      await f.db.doc(f.path).update({ reason: "changed_during_async_read" });
      return originalRetry(input);
    });
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).rejects.toThrow("record_changed");
    expect(f.requests).toHaveLength(0);
  });
  it.each(["unavailable", "lost_ack"])("retains the exact drained lap after completion %s", async mode => {
    const f = await savedRecoveryFixture(), run = f.db.runTransaction.bind(f.db);
    let failed = false;
    f.db.runTransaction = async (fn: any) => {
      let completing = false;
      const result = await run((tx: any) => fn({ ...tx, set: (ref: any, value: any, ...args: any[]) => {
        if (!failed && ref.path === COMMUNICATIONS_WORKER_LAP_PATH && value.phase === "complete") {
          completing = true;
          if (mode === "unavailable") { failed = true; throw Error("synthetic_completion_unavailable"); }
        }
        return tx.set(ref, value, ...args);
      } }));
      if (completing && !failed) { failed = true; throw Error("synthetic_completion_ack_lost"); }
      return result;
    };
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).rejects.toThrow("lap_release_unavailable");
    const held = structuredClone(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH));
    expect(held.phase).toBe(mode === "unavailable" ? "active" : "complete");
    expect(f.db.records.get(f.path).state).toBe("pending_approval");
    expect(await recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample })).toMatchObject({ state: "no_op" });
    const settled = f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH);
    expect(settled.phase).toBe("complete"); expect(settled.lease.generation).toBe(held.lease.generation + 1);
    expect(f.requests).toHaveLength(3);
  });
  it("refuses cancellation during awaited commit reads before any approval write", async () => {
    const f = await savedRecoveryFixture(), controller = new AbortController(), run = f.db.runTransaction.bind(f.db);
    f.db.runTransaction = (fn: any) => run((tx: any) => fn({ ...tx, get: async (ref: any) => {
      const value = await tx.get(ref);
      if (ref.path.startsWith("action_ledger/")) controller.abort();
      return value;
    } }));
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample, signal: controller.signal })).rejects.toThrow("request_cancelled");
    expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
    expect(f.db.records.get(f.path).state).not.toBe("pending_approval");
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH).phase).toBe("complete");
  });
  it("refuses an owner pin changed between retry and claim", async () => {
    const f = await savedRecoveryFixture();
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample, loadRecovery: async () => {
      const record = f.db.records.get(f.path);
      await f.db.doc(f.path).update({ savedOutputRecovery: { ...record.savedOutputRecovery,
        ownerAction: { ...record.savedOutputRecovery.ownerAction, actorUid: "changed-actor", sourceCommit: "b".repeat(40) } } });
      return import("../agents/communications-worker");
    } })).rejects.toThrow("binding_changed");
    expect(f.requests).toHaveLength(0);
    expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
  });
  it.each(["turnId", "requestDigest", "historyProfile", "draftProfile"])("refuses paired checkpoint/pin %s drift", async field => {
    const f = await savedRecoveryFixture();
    await expect(recoverCommunicationsDraftInProcess(f.input, "synthetic-owner", f.deps, { sample, loadRecovery: async () => {
      const record = f.db.records.get(f.path), checkpoint = { ...record.checkpoint, [field]: "changed" };
      await f.db.doc(f.path).update({ checkpoint, savedOutputRecovery: { ...record.savedOutputRecovery,
        checkpointDigest: communicationsDigest(checkpoint) } });
      return import("../agents/communications-worker");
    } })).rejects.toThrow("binding_changed");
    expect(f.requests).toHaveLength(0);
    expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
  });
  it("never discounts file cache to admit a full cgroup", async () => {
    const value = sample("full"); value.cgroup.current = value.cgroup.limit - 1;
    expect(value.cgroup.counters.potentialCleanUnmappedFileCacheBytes).toBeGreaterThan(0);
    expect(() => assertCommunicationsRecoveryHeadroom(value)).toThrow("headroom_unavailable");
    expect(() => communicationsMemoryCounters("anon 1\nfile 2")).toThrow("incomplete");
    expect(() => communicationsMemoryCounters("anon -1")).toThrow("invalid");
  });
});
