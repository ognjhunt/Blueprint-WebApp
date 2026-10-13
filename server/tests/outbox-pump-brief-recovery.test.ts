// @vitest-environment node
/**
 * The web outbox pump is the only recurring lane in the deployed topology: the
 * worker runs launch-forward only and the web process runs the ops scheduler
 * only when BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1. Pending brief reviews must
 * therefore drain from the pump, bounded, under the same persisted leases and
 * three-attempt budget the scheduler lane uses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const mocks = vi.hoisted(() => ({
  brief: vi.fn(), save: vi.fn(), send: vi.fn(), tickCoverage: vi.fn(),
  readingEnabled: vi.fn(() => true), isLeader: vi.fn(() => true),
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: mocks.send }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../utils/siteTaskBrief", () => ({
  getBrief: async (id: string) => state.docs.get(`siteTaskBriefs/${id}`) || null,
  saveBrief: mocks.save, draftBrief: (value: unknown) => value,
}));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: mocks.brief }));
vi.mock("../config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/env")>()),
  isSiteTaskBriefReadingEnabled: mocks.readingEnabled,
}));
vi.mock("../utils/captureCoverageQueue", () => ({ tickCoverageReviews: mocks.tickCoverage, enqueueCoverageReview: vi.fn() }));
vi.mock("../utils/automationLeaderLease", () => ({
  getOpsAutomationLeaderLease: () => ({ start: vi.fn(), stop: vi.fn(), isLeader: mocks.isLeader }),
}));

const { runOutboxPumpPass, startOutboxPump, PUMP_BRIEF_REVIEW_BATCH } = await import("../utils/captureOutbox");
const { recoverCaptureReviews } = await import("../utils/captureReviewRecovery");

function pendingBrief(id: string, work: Record<string, unknown> = {}) {
  state.docs.set(`inboundRequests/${id}`, {
    request: { taskStatement: `Move boxes ${id}`, capture_mode: "self_capture" },
    briefReviewPending: true,
    briefReviewWork: { state: "pending", attempts: 0, dueAtMs: 0, ...work },
  });
}
const row = (id: string) => state.docs.get(`inboundRequests/${id}`) as Record<string, any>;

beforeEach(() => {
  vi.stubEnv("IS_PULL_REQUEST", "false");
  state.docs.clear();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.brief.mockResolvedValue(true);
  mocks.readingEnabled.mockReturnValue(true);
  mocks.isLeader.mockReturnValue(true);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("outbox pump drains brief reviews", () => {
  it("reads a pending brief without the ops scheduler running", async () => {
    pendingBrief("req-a");
    await runOutboxPumpPass();
    expect(mocks.brief).toHaveBeenCalledTimes(1);
    expect(row("req-a")).toMatchObject({ briefReviewPending: false, briefReviewWork: { state: "completed", attempts: 1 } });
  });

  it("bounds each pass to a small batch", async () => {
    for (const id of ["r1", "r2", "r3", "r4", "r5"]) pendingBrief(id);
    await runOutboxPumpPass();
    expect(mocks.brief).toHaveBeenCalledTimes(PUMP_BRIEF_REVIEW_BATCH);
    expect(PUMP_BRIEF_REVIEW_BATCH).toBeLessThanOrEqual(2);
  });

  it("respects an unexpired lease and the three-attempt budget", async () => {
    pendingBrief("leased", { state: "processing", attempts: 1, dueAtMs: Date.now() + 60_000 });
    pendingBrief("spent", { state: "pending", attempts: 3, dueAtMs: 0 });
    await runOutboxPumpPass();
    expect(mocks.brief).not.toHaveBeenCalled();
    expect(row("leased").briefReviewWork).toMatchObject({ state: "processing", attempts: 1 });
    expect(row("spent")).toMatchObject({ briefReviewPending: false, briefReviewWork: { state: "needs_review", lastError: "attempt_budget_exhausted" } });
  });

  it("does not double-run a row when the scheduler lane runs the same recovery concurrently", async () => {
    pendingBrief("shared");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    mocks.brief.mockImplementation(async () => { await held; return true; });
    const passes = Promise.all([runOutboxPumpPass(), recoverCaptureReviews({ limit: 2 })]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await passes;
    expect(mocks.brief).toHaveBeenCalledTimes(1);
    expect(row("shared").briefReviewWork.attempts).toBe(1);
  });

  it("keeps the brief-reading model gate: disabled reading saves the draft brief without a model call", async () => {
    mocks.readingEnabled.mockReturnValue(false);
    pendingBrief("gated");
    await runOutboxPumpPass();
    expect(mocks.brief).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(row("gated").briefReviewWork.state).toBe("completed");
  });

  it("never consumes brief reviews from a pull request preview", async () => {
    vi.stubEnv("IS_PULL_REQUEST", "true");
    pendingBrief("preview");
    await runOutboxPumpPass();
    expect(mocks.brief).not.toHaveBeenCalled();
    expect(row("preview").briefReviewWork.attempts).toBe(0);
  });

  it("only the leader's timer drains reviews", async () => {
    vi.useFakeTimers();
    pendingBrief("timer");
    mocks.isLeader.mockReturnValue(false);
    const stop = startOutboxPump(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.brief).not.toHaveBeenCalled();
    mocks.isLeader.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(10_000);
    vi.useRealTimers();
    for (let i = 0; i < 20 && !mocks.brief.mock.calls.length; i++) await new Promise((r) => setTimeout(r, 5));
    stop();
    expect(mocks.brief).toHaveBeenCalledTimes(1);
  });
});
