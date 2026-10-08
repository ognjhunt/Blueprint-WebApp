// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { queueCases, QUEUE_CASE_VERSION, type QueueCase } from "./helpers/reliability-queue-cases";

const mocks = vi.hoisted(() => ({ send: vi.fn(), authority: vi.fn(), description: vi.fn(), save: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "FAKE_TIMESTAMP", increment: (v: number) => v } } },
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: mocks.send }));
vi.mock("../utils/pilotRecommendationNotifications", () => ({ pilotRecommendationNotificationIsCurrent: mocks.authority }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ reconcileSceneReadyNotifications: vi.fn() }));
vi.mock("../utils/agentRunResultNotifications", () => ({ reconcileAgentRunResultNotifications: vi.fn() }));
vi.mock("../utils/taskEvaluationNotificationRetry", () => ({ reconcileTaskEvaluationNotificationRetries: vi.fn() }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (v: unknown) => v }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async (id: string) => state.docs.get(`siteTaskBriefs/${id}`) || null,
  draftBrief: (v: unknown) => v, saveBrief: mocks.save }));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: mocks.description }));
vi.mock("../config/env", async importOriginal => ({ ...await importOriginal<object>(), isSiteTaskBriefReadingEnabled: () => true }));
// Description-worker tests do not execute the separately covered video queue.
vi.mock("../utils/captureCoverageQueue", () => ({ enqueueCoverageReview: vi.fn() }));

import { deliverOutbox, enqueueOutbox, reconcileOutboxDeliveries } from "../utils/captureOutbox";
import { recoverCaptureReviews } from "../utils/captureReviewRecovery";
import { recordCohortCostReceipt, getCohort, type CohortCostReceipt } from "../utils/cohortEconomics";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";

const key = "rq:brief_confirmed", path = `captureOutbox/${key}`;
const row = () => state.docs.get(path)!;
const baseEntry = () => ({ idempotencyKey: key, requestId: "rq", kind: "brief_confirmed" as const,
  to: "fixture@example.invalid", subject: "Fixture event", body: "Fixture body" });
const accepted = { sent: true, provider: "resend", messageId: "fake-accepted-id" };
const rejected = { sent: false, provider: "resend", messageId: null, outcome: "not_sent" };
const uncertain = { sent: false, provider: "resend", messageId: null, outcome: "unknown" };
const traceResults: Record<string, unknown>[] = [];
const started = new Date().toISOString();
const baseSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHashes = Object.fromEntries([
  "server/utils/captureOutbox.ts", "server/utils/captureReviewRecovery.ts", "server/utils/cohortEconomics.ts",
  "server/tests/reliability-program-queue.test.ts", "server/tests/helpers/reliability-queue-cases.ts",
].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
beforeEach(() => {
  state.docs.clear(); Object.values(mocks).forEach(m => m.mockReset());
  // The integrated dispatcher reads present capture authority. These provider
  // fault cases own a consented source; withdrawal has its separate regressions.
  state.docs.set("inboundRequests/rq", { request: { consent_attestation: {
    granted: true, statement_version: RECORDING_CONSENT_VERSION,
    recorded_at_iso: "2026-10-01T00:00:00Z",
  } } });
  mocks.authority.mockResolvedValue(true); mocks.send.mockResolvedValue(accepted);
  mocks.description.mockResolvedValue(true);
  mocks.save.mockImplementation(async (v: any) => state.docs.set(`siteTaskBriefs/${v.requestId}`, v));
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  const dir = resolve(process.env.RELIABILITY_QUEUE_OUTPUT || "output/reliability-program/queue");
  mkdirSync(dir, { recursive: true });
  const catalog = { schemaVersion: QUEUE_CASE_VERSION, generated: queueCases.length,
    deduplicated: new Set(queueCases.map(c => c.hash)).size, cases: queueCases,
    seedPolicy: "No seeds or schedule permutations counted. Each hash changes a documented failure boundary, provider evidence, durable attempt budget, race mutation or allocation type.",
    replay: "npx vitest run server/tests/reliability-program-queue.test.ts --maxWorkers=1" };
  writeFileSync(resolve(dir, "catalog.json"), JSON.stringify(catalog, null, 2));
  const counts = Object.fromEntries(["passed", "failed", "skipped", "blocked", "partially_executed"].map(s => [s, traceResults.filter(r => r.status === s).length]));
  writeFileSync(resolve(dir, "results.json"), JSON.stringify({ schemaVersion: QUEUE_CASE_VERSION, started,
    finished: new Date().toISOString(), codeSha: baseSha, sourceHashes, generated: queueCases.length,
    deduplicated: new Set(queueCases.map(c => c.hash)).size, attempted: traceResults.length, ...counts,
    providerMode: "fake-local-sink", storageMode: "in-memory-serialized-Firestore-fake", liveProviderCalls: 0,
    liveProviderCostUsd: null, liveCostReason: "No live dispatch; fake latency and calls are not provider performance or billing receipts.", traces: traceResults }, null, 2));
});
async function tracked(c: QueueCase, run: () => Promise<void>) {
  const begin = performance.now(); let status = "passed", error: string | null = null;
  try { await run(); } catch (e) { status = "failed"; error = e instanceof Error ? e.message.slice(0, 800) : String(e); throw e; }
  finally {
    const documents = [...state.docs.entries()].map(([id, data]) => ({ id,
      status: data.status ?? data.briefReviewWork?.state ?? null, attempts: data.attempts ?? data.briefReviewWork?.attempts ?? null,
      receiptStatus: data.receipt?.status ?? null, unknownCostReceipts: data.unknownCostReceipts ?? null,
      estimatedCostReceipts: data.estimatedCostReceipts ?? null, siteCostUsd: data.siteCostUsd ?? null,
      incrementalPolicyCostUsd: data.incrementalPolicyCostUsd ?? null }));
    traceResults.push({ caseId: c.id, semanticHash: c.hash, status, error, elapsedMs: performance.now() - begin,
      layer: c.layer, codeSha: baseSha, promptVersion: null, providerCalls: mocks.send.mock.calls.length,
      descriptionCalls: mocks.description.mock.calls.length, documents,
      traceDigest: createHash("sha256").update(JSON.stringify(documents)).digest("hex") });
  }
}
const cases = (family: string) => queueCases.filter(c => c.family === family);

describe("frozen queue cases: successor ordering", () => {
  it.each(cases("ordering"))("$id", c => tracked(c, async () => {
    await enqueueOutbox(baseEntry());
    mocks.send.mockImplementation(async () => {
      const mutation = String(c.parameters.mutation);
      if (["cancelled", "sent"].includes(mutation)) row().status = mutation;
      else row()[mutation] = "changed-successor";
      return c.parameters.provider === "accepted" ? accepted : c.parameters.provider === "rejected" ? rejected : uncertain;
    });
    await deliverOutbox();
    const terminal = ["cancelled", "sent"].includes(String(c.parameters.mutation));
    expect(row().status).toBe(terminal ? c.parameters.mutation : "dispatching");
    expect(row().deliveryMessageId).toBeUndefined();
    expect([...state.docs.keys()].filter(p => p.includes("/deliveryReceipts/"))).toHaveLength(1);
    row().deliveryLeaseUntilMs = Date.now() - 1;
    await deliverOutbox(); await deliverOutbox();
    expect(row().status).toBe(terminal ? c.parameters.mutation : "unknown");
    expect(mocks.send).toHaveBeenCalledTimes(1);
  }));
});

describe("frozen queue cases: storage boundaries", () => {
  it.each(cases("storage_dependencies"))("$id", c => tracked(c, async () => {
    const boundary = String(c.parameters.boundary), attempts = Number(c.parameters.attempts);
    let restoreFault: (() => void) | undefined;
    if (boundary === "enqueue") {
      const duplicate = c.parameters.storageError === "duplicate";
      if (duplicate) await enqueueOutbox(baseEntry());
      const original = db.collection.bind(db);
      vi.spyOn(db, "collection").mockImplementation((name: string) => {
        const collection = original(name);
        if (name !== "captureOutbox") return collection;
        return { ...collection, doc: (id: string) => ({ ...collection.doc(id), create: async () => {
          throw Object.assign(new Error(`fixture storage ${c.parameters.storageError}`), {
            code: duplicate ? 6 : c.parameters.storageError === "permission_denied" ? 7 : 14,
          });
        } }) };
      });
      expect(await enqueueOutbox({ ...baseEntry(), body: "New duplicate content must not overwrite original" })).toEqual({ enqueued: false });
      if (duplicate) expect(row()).toMatchObject({ status: "pending", attempts: 0, body: "Fixture body" });
      else expect(row()).toBeUndefined();
      expect(mocks.send).not.toHaveBeenCalled(); return;
    }
    await enqueueOutbox(baseEntry()); row().attempts = attempts;
    if (["cursor_read", "cursor_write", "pending_query"].includes(boundary)) {
      const original = db.collection.bind(db);
      const fault = vi.spyOn(db, "collection").mockImplementation((name: string) => {
        const collection = original(name);
        if (name === "automationCursors" && boundary.startsWith("cursor")) return { ...collection, doc: (id: string) => {
          const ref = collection.doc(id);
          return { ...ref, [boundary === "cursor_read" ? "get" : "set"]: async () => { throw new Error("fixture dependency unavailable"); } };
        } };
        if (name === "captureOutbox" && boundary === "pending_query") return { ...collection, where: (field: string, op: string, value: unknown) => {
          const query = collection.where(field, op, value);
          return value === "pending" ? { ...query, limit: () => ({ get: async () => { throw new Error("fixture missing index"); } }) } : query;
        } };
        return collection;
      });
      restoreFault = () => fault.mockRestore();
    } else if (boundary === "authority_read") mocks.authority.mockRejectedValue(new Error("fixture authority unavailable"));
    else {
      const original = db.runTransaction.bind(db);
      const fault = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({ ...tx,
        get: async (ref: any) => {
          if (boundary === "claim_read" && ref.path === path) throw new Error("fixture claim read unavailable");
          return tx.get(ref);
        },
        set: (ref: any, data: any, options: any) => {
          const fail = boundary === "claim_write" && data.status === "claimed"
            || boundary === "dispatch_write" && data.status === "dispatching"
            || boundary === "receipt_write" && ref.path.includes("/deliveryReceipts/")
            || boundary === "ack_write" && ref.path === path && data.status === "sent";
          if (fail) throw new Error("fixture persistence boundary unavailable");
          return tx.set(ref, data, options);
        },
      })));
      restoreFault = () => fault.mockRestore();
    }
    await expect(deliverOutbox()).rejects.toThrow(/fixture/);
    const dispatched = ["receipt_write", "ack_write"].includes(boundary);
    expect(mocks.send).toHaveBeenCalledTimes(dispatched ? 1 : 0);
    expect(row().status).toBe(dispatched ? "dispatching" : ["authority_read", "dispatch_write"].includes(boundary) ? "claimed" : "pending");
    expect(row().attempts).toBe(attempts + (dispatched ? 1 : 0));
    restoreFault?.(); mocks.authority.mockResolvedValue(true);
    if (dispatched) {
      row().deliveryLeaseUntilMs = Date.now() - 1;
      await deliverOutbox(); await deliverOutbox();
      expect(row().status).toBe("unknown"); expect(mocks.send).toHaveBeenCalledTimes(1);
    }
  }));
});

describe("frozen queue cases: provider evidence", () => {
  it.each(cases("provider_failures"))("$id", c => tracked(c, async () => {
    await enqueueOutbox(baseEntry()); const attempts = Number(c.parameters.attempts); row().attempts = attempts;
    const outcome = String(c.parameters.outcome);
    const results: Record<string, unknown> = { accepted, not_sent: rejected, unknown: uncertain,
      legacy_provider_failure: { sent: false, provider: "resend", messageId: null },
      unconfigured: { sent: false, provider: null, messageId: null },
      accepted_missing_id: { sent: true, provider: "resend", messageId: null },
      accepted_empty_id: { sent: true, provider: "resend", messageId: "" },
      accepted_numeric_id: { sent: true, provider: "resend", messageId: 123 }, malformed_null: null };
    if (outcome === "throw") mocks.send.mockRejectedValue(new Error("fixture connection lost"));
    else mocks.send.mockResolvedValue(results[outcome]);
    await deliverOutbox();
    const retriable = ["not_sent", "unconfigured"].includes(outcome);
    expect(row().status).toBe(outcome === "accepted" ? "sent" : retriable ? attempts === 5 ? "failed" : "pending" : "unknown");
    expect(row().attempts).toBe(attempts + 1);
    if (!retriable) { await deliverOutbox(); expect(mocks.send).toHaveBeenCalledTimes(1); }
  }));
});

function seedBrief(attempts: number, boundary: string) {
  state.docs.set("inboundRequests/rq", { request: { taskStatement: "Move test cartons", capture_mode: "self_capture" }, briefReviewPending: true,
    briefReviewWork: { state: boundary.startsWith("lease") ? "processing" : "pending", attempts,
      dueAtMs: boundary === "lease_active" ? Date.now() + 60_000 : 0 } });
}
const briefRow = () => state.docs.get("inboundRequests/rq")!;

describe("frozen queue cases: durable producer and worker recovery", () => {
  it.each(cases("worker_lifecycle"))("$id", c => tracked(c, async () => {
    const attempts = Number(c.parameters.attempts), boundary = String(c.parameters.boundary);
    seedBrief(attempts, boundary);
    if (boundary === "unavailable") mocks.description.mockResolvedValue(false);
    if (boundary === "throw") mocks.description.mockRejectedValue(new Error("fixture provider unavailable"));
    if (boundary === "stale_token") mocks.description.mockImplementation(async () => {
      briefRow().briefReviewWork.token = "successor-token"; return true;
    });
    if (boundary === "cached_brief") state.docs.set("siteTaskBriefs/rq", { summary: "Retained owner brief" });
    if (boundary === "late_brief") mocks.save.mockRejectedValueOnce(new Error("fixture brief write unavailable"));
    if (boundary === "claim_write_failure") {
      const original = db.runTransaction.bind(db);
      vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({ ...tx,
        set: (ref: any, data: any, options: any) => {
          if (data.briefReviewWork?.state === "processing") throw new Error("fixture claim write unavailable");
          return tx.set(ref, data, options);
        },
      })));
    }
    if (boundary === "starvation") {
      state.docs.delete("inboundRequests/rq");
      state.docs.set("inboundRequests/aaa-held", { briefReviewPending: true,
        briefReviewWork: { state: "processing", attempts: 1, dueAtMs: Date.now() + 60_000 } });
      seedBrief(attempts, "pending");
      await recoverCaptureReviews({ limit: 1 }); await recoverCaptureReviews({ limit: 1 });
      if (attempts < 3) expect(briefRow().briefReviewWork.state).toBe("completed");
      else expect(briefRow().briefReviewWork.state).toBe("needs_review");
      expect(state.docs.get("inboundRequests/aaa-held")?.briefReviewWork.attempts).toBe(1);
      return;
    }
    if (boundary === "claim_write_failure" && attempts < 3) {
      await expect(recoverCaptureReviews()).rejects.toThrow("fixture claim write unavailable");
      expect(briefRow().briefReviewWork.attempts).toBe(attempts); expect(mocks.description).not.toHaveBeenCalled(); return;
    }
    await recoverCaptureReviews();
    if (boundary === "lease_active") {
      expect(mocks.description).not.toHaveBeenCalled(); expect(briefRow().briefReviewWork.attempts).toBe(attempts); return;
    }
    if (attempts === 3) {
      expect(mocks.description).not.toHaveBeenCalled(); expect(briefRow().briefReviewWork.state).toBe("needs_review"); return;
    }
    expect(briefRow().briefReviewWork.attempts).toBe(attempts + 1);
    if (boundary === "stale_token") expect(briefRow().briefReviewWork).toMatchObject({ state: "processing", token: "successor-token" });
    else if (["unavailable", "throw", "late_brief"].includes(boundary)) {
      expect(briefRow().briefReviewWork.state).toBe(attempts === 2 ? "needs_review" : "pending");
      if (boundary === "late_brief" && attempts === 0) {
        briefRow().briefReviewWork.dueAtMs = 0; await recoverCaptureReviews();
        expect(briefRow().briefReviewWork.state).toBe("completed");
      }
    } else expect(briefRow()).toMatchObject({ briefReviewPending: false, briefReviewWork: { state: "completed" } });
    if (boundary === "cached_brief") expect(mocks.save).not.toHaveBeenCalled();
    const calls = mocks.description.mock.calls.length; await recoverCaptureReviews();
    expect(mocks.description).toHaveBeenCalledTimes(calls);
  }));
});

describe("frozen queue cases: receipt accounting", () => {
  it.each(cases("notifications_accounting"))("$id", c => tracked(c, async () => {
    const allocation = c.parameters.allocation as CohortCostReceipt["allocation"], scenario = String(c.parameters.scenario);
    const receipt: CohortCostReceipt = { receiptId: "rq-receipt", sceneId: "rq-scene", sourceDigest: `sha256:${"a".repeat(64)}`,
      sourceUri: "fixture://authorized-local-receipt", currency: "USD", allocation, allocationId: "rq-preparation", status: "settled", amountUsd: 4 };
    if (["invalid_currency", "invalid_digest", "negative_amount", "unknown_with_amount"].includes(scenario)) {
      const invalid: any = { ...receipt, ...(scenario === "invalid_currency" ? { currency: "EUR" } : scenario === "invalid_digest" ? { sourceDigest: "bad" }
        : scenario === "negative_amount" ? { amountUsd: -1 } : { status: "unknown", amountUsd: 4 }) };
      await expect(recordCohortCostReceipt(invalid)).rejects.toThrow("receipt_invalid"); expect(await getCohort(receipt.sceneId)).toBeNull(); return;
    }
    if (scenario === "missing_predecessor") {
      await expect(recordCohortCostReceipt({ ...receipt, supersedesReceiptId: "absent" })).rejects.toThrow("predecessor_missing"); return;
    }
    if (["unknown", "estimated", "supersede_unknown", "supersede_estimate"].includes(scenario)) {
      const unknown = scenario.includes("unknown");
      await recordCohortCostReceipt({ ...receipt, status: unknown ? "unknown" : "estimated", amountUsd: unknown ? null : 3 });
      const initial = (await getCohort(receipt.sceneId))!;
      expect(initial.siteCostUsd).toBe(0); expect(initial.incrementalPolicyCostUsd ?? 0).toBe(0);
      expect(unknown ? initial.unknownCostReceipts : initial.estimatedCostReceipts).toBe(1);
      if (!scenario.startsWith("supersede")) return;
      await recordCohortCostReceipt({ ...receipt, receiptId: "rq-final", supersedesReceiptId: receipt.receiptId });
    } else {
      await recordCohortCostReceipt(receipt);
      if (scenario === "duplicate") await recordCohortCostReceipt(receipt);
      if (scenario === "concurrent_duplicate") await Promise.all([recordCohortCostReceipt(receipt), recordCohortCostReceipt(receipt), recordCohortCostReceipt(receipt)]);
      if (scenario === "changed_amount") await expect(recordCohortCostReceipt({ ...receipt, amountUsd: 9 })).rejects.toThrow("receipt_conflict");
      if (scenario === "changed_source") await expect(recordCohortCostReceipt({ ...receipt, sourceDigest: `sha256:${"b".repeat(64)}` })).rejects.toThrow("receipt_conflict");
      if (scenario === "settled_immutable") await expect(recordCohortCostReceipt({ ...receipt, receiptId: "rq-new", supersedesReceiptId: receipt.receiptId, amountUsd: 8 })).rejects.toThrow("allocation_conflict");
      if (scenario === "conflicting_allocation") await expect(recordCohortCostReceipt({ ...receipt, receiptId: "rq-second" })).rejects.toThrow("allocation_conflict");
    }
    const cohort = (await getCohort(receipt.sceneId))!;
    expect(cohort.siteCostUsd).toBe(allocation === "shared_preparation" ? 4 : 0);
    expect(cohort.incrementalPolicyCostUsd ?? 0).toBe(allocation === "incremental_policy" ? 4 : 0);
    expect(cohort.unknownCostReceipts ?? 0).toBe(0); expect(cohort.estimatedCostReceipts ?? 0).toBe(0);
  }));
});
