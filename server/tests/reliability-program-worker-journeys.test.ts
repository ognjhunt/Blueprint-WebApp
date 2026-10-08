// @vitest-environment node
/** Real producer, video worker, publication and status handlers; synthetic video-provider output,
 * versioned-object interface stub, serialized fake Firestore with private local snapshot restore.
 * Reentry after disk restore is not proof of OS/browser restart or Firestore durability. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const mocks = vi.hoisted(() => ({ model: vi.fn(), send: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ file: () => ({ exists: async () => [true], getSignedUrl: async () => ["https://fixture.example.invalid/private-video"] }) }) },
  default: { firestore: { FieldValue: { serverTimestamp: () => "FAKE_TIMESTAMP" } } },
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../agents/runtime", () => ({ runAgentTask: mocks.model }));
vi.mock("../utils/email", () => ({ sendEmail: mocks.send }));
vi.mock("../config/env", async importOriginal => ({ ...await importOriginal<object>(), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async (id: string) => ({ allowed: state.docs.get(`inboundRequests/${id}`)?.request?.consent_attestation?.granted === true }) }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async (id: string) => (await db.collection("siteTaskBriefs").doc(id).get()).data() || null }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ reconcileSceneReadyNotifications: vi.fn() }));
vi.mock("../utils/agentRunResultNotifications", () => ({ reconcileAgentRunResultNotifications: vi.fn() }));
vi.mock("../utils/taskEvaluationNotificationRetry", () => ({ reconcileTaskEvaluationNotificationRetries: vi.fn() }));
import { enqueueCoverageReview, reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { deliverOutbox } from "../utils/captureOutbox";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";

const outputDir = resolve(process.env.RELIABILITY_QUEUE_OUTPUT || "output/reliability-program/queue");
mkdirSync(outputDir, { recursive: true });
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHashes = Object.fromEntries([
  "server/utils/captureCoverageQueue.ts", "server/utils/captureCoverageReview.ts", "server/utils/captureOutbox.ts",
  "server/utils/taskStatusProjection.ts", "server/tests/reliability-program-worker-journeys.test.ts",
].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
const traces: Record<string, unknown>[] = [];
const definitions = ["covered", "missing_views", "contradictory", "low_confidence", "no_output"].flatMap(evidence =>
  ["happy", "restore_after_producer", "withdraw_during_provider", "replace_source_during_provider"].map(boundary => {
    const parameters = { evidence, boundary };
    const hash = createHash("sha256").update(JSON.stringify({ version: "RQ-journey.v1", parameters })).digest("hex");
    return { id: `RQJ-${hash.slice(0, 12)}`, hash, parameters, source: "synthetic-publication-fixture",
      expected: "Current consent and source bind publication; missing/null output stays unknown; covered and contradictions stay distinct; send once; durable producer intent restored before worker" };
  }));
beforeEach(() => { state.docs.clear(); mocks.model.mockReset(); mocks.send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "fixture-notification" }); });
afterAll(() => writeFileSync(resolve(outputDir, "worker-journeys.json"), JSON.stringify({
  schemaVersion: "RQ-journey.v1", layer: "actual-producer-worker-status/in-memory-firestore-private-local-snapshot/fake-model-and-email",
  codeSha: sourceSha, sourceHashes, generated: definitions.length, deduplicated: new Set(definitions.map(d => d.hash)).size,
  attempted: traces.length, passed: traces.filter(t => t.status === "passed").length, failed: traces.filter(t => t.status === "failed").length,
  blocked: 0, skipped: 0, liveProviderCalls: 0, liveProviderCostUsd: null,
  replay: "npx vitest run server/tests/reliability-program-worker-journeys.test.ts --maxWorkers=1",
  limitation: "No real video perception, no genuine process restart, no Firebase emulator or production provider; restored local JSON tests handler reentry against retained simulated state.",
  definitions, traces,
}, null, 2)));
async function tickUntilProcessed() { await reconcileCoverageReviews(); await reconcileCoverageReviews(); }

describe("joined producer -> worker -> evidence publication -> customer status -> local notification sink", () => {
  it.each(definitions)("$id", async definition => {
    const begin = performance.now(), transitions: Record<string, unknown>[] = [];
    let status = "passed", error: string | null = null;
    const snapshot = (boundary: string) => {
      const record = state.docs.get("inboundRequests/rqj");
      transitions.push({ boundary, pending: record?.capture_coverage_pending ?? null,
        reviewState: record?.capture_coverage_review?.state ?? null, coversScene: record?.capture_coverage?.covers_scene ?? null,
        modelCalls: mocks.model.mock.calls.length, notificationCalls: mocks.send.mock.calls.length,
        jobs: [...state.docs.entries()].filter(([p]) => p.startsWith("captureCoverageReviews/")).map(([id, data]) => ({ id, state: data.state, attempts: data.attempts })) });
    };
    try {
      await db.collection("inboundRequests").doc("rqj").set({
        request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
        contact: { email: "fixture@example.invalid", firstName: "Test" },
        site_task_brief_confirmed_at: "2026-10-01T00:00:00Z",
        capture_privacy_source_bound_decision: { capture_id: "rqj-capture", proceeded: true,
          producer_source: { kind: "app_bundle_completion", key: "rqj-original-source" } },
      });
      await db.collection("siteTaskBriefs").doc("rqj").set({ summary: "Move synthetic cartons", proposed: [] });
      const params = { requestId: "rqj", sceneId: "rqj-scene", captureId: "rqj-capture" };
      await enqueueCoverageReview(params); await enqueueCoverageReview(params); snapshot("producer-durable");
      if (definition.parameters.boundary === "restore_after_producer") {
        const saved = resolve(outputDir, `${definition.id}-private-state.json`);
        writeFileSync(saved, JSON.stringify([...state.docs.entries()])); state.docs.clear();
        for (const [key, value] of JSON.parse(readFileSync(saved, "utf8"))) state.docs.set(key, value);
        snapshot("private-local-state-restored");
      }
      mocks.model.mockImplementation(async () => {
        snapshot("provider-entered");
        const record = state.docs.get("inboundRequests/rqj")!;
        if (definition.parameters.boundary === "withdraw_during_provider") record.request.consent_attestation.granted = false;
        if (definition.parameters.boundary === "replace_source_during_provider") record.capture_privacy_source_bound_decision.producer_source.key = "rqj-successor-source";
        if (definition.parameters.evidence === "no_output") return { output: null };
        const missing = ["missing_views", "contradictory"].includes(definition.parameters.evidence);
        return { output: { covers_scene: definition.parameters.evidence !== "missing_views",
          views: [{ id: "work-area", status: "seen", timestamp_seconds: 1, note: "Synthetic visible work area" }],
          missing_views: missing ? ["Destination view"] : [], supplement_would_finish: missing,
          unreadable_reasons: [], confidence: definition.parameters.evidence === "low_confidence" ? 0.3 : 0.9 } };
      });
      await tickUntilProcessed(); snapshot("worker-returned");
      const record = state.docs.get("inboundRequests/rqj")!;
      const invalidated = ["withdraw_during_provider", "replace_source_during_provider"].includes(definition.parameters.boundary);
      const hasOutput = definition.parameters.evidence !== "no_output";
      if (invalidated || !hasOutput) {
        expect(record.capture_coverage).toBeUndefined(); expect(record.capture_coverage_pending).toBe(true);
        expect(record.capture_coverage_review?.state).not.toBe("completed");
      } else {
        const covered = definition.parameters.evidence === "covered";
        expect(record.capture_coverage.covers_scene).toBe(covered);
        expect(record.capture_coverage_review.state).toBe("completed"); expect(record.capture_coverage_pending).toBe(false);
      }
      const projection = projectTaskStatus(taskStatusInputFrom({ ...record, briefDrafted: true, hasStoredCapture: true, stage: null }));
      expect(projection.decision).toBe(invalidated || !hasOutput || definition.parameters.evidence === "low_confidence" ? "footage_received"
        : definition.parameters.evidence === "covered" ? "assessing" : "add_views");
      transitions.push({ boundary: "customer-status", decision: projection.decision });
      await deliverOutbox(); await deliverOutbox(); snapshot("notification-sink");
      const expectedSend = !invalidated && hasOutput && ["missing_views", "contradictory"].includes(definition.parameters.evidence);
      expect(mocks.send).toHaveBeenCalledTimes(expectedSend ? 1 : 0);
      if (!invalidated && hasOutput) {
        await enqueueCoverageReview(params); await tickUntilProcessed();
        expect(mocks.model).toHaveBeenCalledTimes(1);
      }
    } catch (e) { status = "failed"; error = e instanceof Error ? e.message : String(e); throw e; }
    finally { traces.push({ caseId: definition.id, semanticHash: definition.hash, status, error, elapsedMs: performance.now() - begin,
      transitions, modelCalls: mocks.model.mock.calls.length, notificationCalls: mocks.send.mock.calls.length }); }
  });
});
