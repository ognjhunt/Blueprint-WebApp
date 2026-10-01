// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { memoryFirestore, communicationsNow } from "./fixtures/communications";
import { reserveCommunicationsDraft, recordCommunicationsDraftUsage, reconcileCommunicationsDraftCost, estimatedDraftMicros,
  COMMUNICATIONS_DRAFT_BUDGET, configuredCommunicationsDraftBudget } from "../agents/communications-draft-budget";
import { communicationsDigest } from "../agents/communications-contract";
import { CommunicationsStore } from "../agents/communications-store";
const root = "blueprintCommunications/default", digest = "a".repeat(64);
const usage = { input_tokens: 1000, output_tokens: 200, total_tokens: 1200,
  input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 100 } };
// Hermetic test targets below are invented fixtures, unrelated to any owner
// approval or production configuration. They are never used to enable spending.
beforeEach(() => vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "2.5"));
afterEach(() => vi.unstubAllEnvs());

describe("communications-only soft model target and serialized admissions", () => {
  it("serializes fresh admissions and retains an unresolved in-flight reservation", async () => {
    const db = memoryFirestore();
    const results = await Promise.allSettled(["job-1", "job-2"].map(job => reserveCommunicationsDraft(db, job, digest, communicationsNow)));
    expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, timezone: "America/Chicago", estimatedModelMicros: 0 });
    await expect(reserveCommunicationsDraft(db, "job-3", digest, communicationsNow)).rejects.toThrow("cost_unresolved");
  });
  it("reuses the same proven pre-create admission without counting twice, but fences a different request", async () => {
    const db = memoryFirestore(), first = await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).toBe(first);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).admissions).toBe(1);
    await expect(reserveCommunicationsDraft(db, "job-1", "b".repeat(64), communicationsNow)).rejects.toThrow("reservation_requires_reconciliation");
  });
  it("counts verified usage conservatively and never silently refunds later lower best-effort counts", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await recordCommunicationsDraftUsage(db, "job-1", digest, usage, communicationsNow)).toBe(true);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    await recordCommunicationsDraftUsage(db, "job-1", digest, { input_tokens: 1, output_tokens: 0, total_tokens: 1 }, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetDays/2026-09-30`).estimatedModelMicros).toBe(358);
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow();
  });
  it.each([null, {}, { input_tokens: 1, output_tokens: -1, total_tokens: 0 }, { input_tokens: 100, output_tokens: 1, total_tokens: 2 },
    { ...usage, input_tokens_details: { cached_tokens: 1001 } }])("retains unknown/inconsistent cost without treating it as zero", async invalid => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(await recordCommunicationsDraftUsage(db, "job-1", digest, invalid, communicationsNow)).toBe(false);
    expect(estimatedDraftMicros(invalid)).toBeNull();
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow + 86400000)).rejects.toThrow("cost_unresolved");
  });
  it("stops at the initial five admissions independently of discovery volume", async () => {
    const db = memoryFirestore();
    for (let i = 0; i < 5; i++) { await reserveCommunicationsDraft(db, `job-${i}`, digest, communicationsNow); await recordCommunicationsDraftUsage(db, `job-${i}`, digest, usage, communicationsNow); }
    expect(COMMUNICATIONS_DRAFT_BUDGET.maxDailyAdmissions).toBe(5);
    await expect(reserveCommunicationsDraft(db, "job-6", digest, communicationsNow)).rejects.toThrow("daily_admission_limit");
    // UTC midnight during the user's evening does not provide another allowance.
    await expect(reserveCommunicationsDraft(db, "job-6", digest, Date.parse("2026-10-01T01:00:00Z"))).rejects.toThrow("daily_admission_limit");
    await expect(reserveCommunicationsDraft(db, "job-6", digest, Date.parse("2026-10-01T05:00:00Z"))).resolves.toBeTruthy();
  });
  it("refuses further calls once known cost reaches the soft target, without claiming an in-flight hard cap", async () => {
    const db = memoryFirestore(); await db.doc(`${root}/draftBudgetDays/2026-09-30`).set({ admissions: 1, estimatedModelMicros: 2500000 });
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow)).rejects.toThrow("soft_target_reached");
  });
  it.each(["", "0", "-1", "1e3", "01", "NaN", "Infinity", "0.0000001"])("refuses absent or invalid private target %s before admission", async value => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", value);
    expect(() => configuredCommunicationsDraftBudget()).toThrow("communications_draft_target_not_configured");
    const db = memoryFirestore();
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow("communications_draft_target_not_configured");
    expect(db.records.size).toBe(0);
  });
  it("binds a private configured target and refuses a changed pre-create reservation", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    expect(db.records.get(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "job-1" })}`).policy.softTargetUsd).toBe(2.5);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "3");
    await expect(reserveCommunicationsDraft(db, "job-1", digest, communicationsNow)).rejects.toThrow("reservation_requires_reconciliation");
  });
  it("keeps a pre-create budget-held prospect queued without consuming its recovery attempts", async () => {
    const db = memoryFirestore(), store = new CommunicationsStore(db, () => communicationsNow, "budget-worker");
    const job = await store.enqueue({ prospectId: "prospect-1", briefId: "brief-1", briefDigest: digest, intent: "outreach", inboundMessageId: null });
    await store.claim(job.jobId); await store.deferDraftForBudget(job.jobId, "communications_draft_daily_admission_limit");
    expect(db.records.get(`${root}/jobs/${job.jobId}`)).toMatchObject({ state: "queued", attempts: 0,
      reason: "communications_draft_daily_admission_limit", nextAttemptAt: communicationsNow + 15 * 60000 });
  });
  it("reconciles one actual saved root turn with reads and releases accounting only after verified usage", async () => {
    const db = memoryFirestore(); await reserveCommunicationsDraft(db, "job-1", digest, communicationsNow);
    await recordCommunicationsDraftUsage(db, "job-1", digest, null, communicationsNow);
    const checkpoint = { sessionId: "mock-session", turnId: "mock-turn", createClaimedAt: "2026-09-30T23:00:00Z" };
    await db.doc(`${root}/jobs/job-1`).set({ checkpoint });
    const api = { reconcileUsage: vi.fn(async () => usage) };
    await reconcileCommunicationsDraftCost(db, api, communicationsNow);
    expect(api.reconcileUsage).toHaveBeenCalledWith(checkpoint, "job-1");
    expect(db.records.get(`${root}/draftBudgetAdmissions/${communicationsDigest({ jobId: "job-1" })}`).state).toBe("usage_recorded");
    await expect(reserveCommunicationsDraft(db, "job-2", digest, communicationsNow)).resolves.toBeTruthy();
  });
});
