// @vitest-environment node
/** Actual encryption, producer, coverage worker, status and outbox; fake model, DB and strict local mail sink. */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const mocks = vi.hoisted(() => ({ model: vi.fn(), send: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ file: () => ({ exists: async () => [true], getSignedUrl: async () => ["https://fixture.example.invalid/video"] }) }) },
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
import { encryptInboundRequestForStorage, isEncryptedField } from "../utils/field-encryption";
import { enqueueCoverageReview, reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { deliverOutbox } from "../utils/captureOutbox";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
const EMAIL = "notification-test@example.invalid", ID = "notification-encrypted-fixture";
const traces: Record<string, unknown>[] = [];
const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHashes = Object.fromEntries(["server/utils/captureCoverageReview.ts", "server/utils/field-encryption.ts", "server/tests/reliability-encrypted-notification.test.ts"].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
beforeEach(() => {
  state.docs.clear(); mocks.model.mockReset(); mocks.send.mockReset();
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  mocks.model.mockResolvedValue({ output: { covers_scene: false, views: [], missing_views: ["Destination view"], supplement_would_finish: true, unreadable_reasons: [], confidence: 0.9 } });
  mocks.send.mockImplementation(async ({ to }: { to: string }) => {
    // email.emailDomain() trims the recipient before provider dispatch. Refuse encrypted objects here too.
    if (typeof to !== "string" || to.trim() !== EMAIL) throw new TypeError("notification_recipient_not_plaintext");
    return { sent: true, provider: "local-strict-sink", messageId: "fixture-receipt" };
  });
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => {
  const dir = resolve(process.env.RELIABILITY_NOTIFICATION_OUTPUT || "output/reliability-program/notification"); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "results.json"), JSON.stringify({ schemaVersion: "notification-encrypted.v1", codeSha, sourceHashes,
    layer: "actual-encryption-producer-worker-status-outbox/fake-firestore-model-and-strict-local-email-sink", liveProviderCalls: 0,
    replay: "npx vitest run server/tests/reliability-encrypted-notification.test.ts --maxWorkers=1", traces }, null, 2));
});

describe("coverage-shortfall recipient encryption boundary", () => {
  it.each(["encrypted", "legacy_plaintext", "withdrawn", "unavailable_decryption"])("NOTIFY-ENCRYPTED-001 %s", async mode => {
    const request = { contact: { email: EMAIL, firstName: "Fixture", lastName: "Operator", company: "Test", roleTitle: "Owner" },
      request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" },
        budgetBucket: null, requestedLanes: [], helpWith: [], buyerType: "site_operator" },
      capture_privacy_source_bound_decision: { capture_id: "notify-capture", proceeded: true, producer_source: { kind: "app_bundle_completion", key: "notification-source" } } };
    const stored = mode === "legacy_plaintext" ? request : await encryptInboundRequestForStorage(request as never);
    expect(isEncryptedField(stored.contact.email)).toBe(mode !== "legacy_plaintext");
    await db.collection("inboundRequests").doc(ID).set(stored);
    await db.collection("siteTaskBriefs").doc(ID).set({ summary: "Move synthetic cartons", proposed: [] });
    state.docs.get(`inboundRequests/${ID}`)!.site_task_brief_confirmed_at = "2026-10-01T00:00:00Z";
    const params = { requestId: ID, sceneId: "notify-scene", captureId: "notify-capture" };
    await enqueueCoverageReview(params); await enqueueCoverageReview(params);
    if (mode === "withdrawn") state.docs.get(`inboundRequests/${ID}`)!.request.consent_attestation.granted = false;
    if (mode === "unavailable_decryption") vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 8).toString("base64"));
    await reconcileCoverageReviews(); await reconcileCoverageReviews();
    let outbox = [...state.docs.entries()].filter(([path]) => path.startsWith("captureOutbox/") && !path.includes("/deliveryReceipts/"));
    const recipientType = typeof outbox[0]?.[1]?.to;
    await deliverOutbox(); await deliverOutbox();
    outbox = [...state.docs.entries()].filter(([path]) => path.startsWith("captureOutbox/") && !path.includes("/deliveryReceipts/"));
    const record = state.docs.get(`inboundRequests/${ID}`)!;
    const status = projectTaskStatus(taskStatusInputFrom({ ...record, briefDrafted: true, hasStoredCapture: true, stage: null })).decision;
    const observation = { mode, storedContactEncrypted: isEncryptedField(record.contact.email), queuedRecipientType: recipientType,
      recipientMatchesExpected: outbox[0]?.[1]?.to === EMAIL, outboxStates: outbox.map(([, row]) => row.status),
      strictSinkCalls: mocks.send.mock.calls.length, modelCalls: mocks.model.mock.calls.length, customerStatus: status };
    traces.push(observation);
    if (["encrypted", "legacy_plaintext"].includes(mode)) {
      expect(outbox).toHaveLength(1); expect(recipientType).toBe("string"); expect(outbox[0][1].to).toBe(EMAIL);
      expect(outbox[0][1].status).toBe("sent"); expect(outbox[0][1].attempts).toBe(1); expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(outbox[0][1].body).toContain("Hi Fixture"); expect(status).toBe("add_views");
      await enqueueCoverageReview(params); await reconcileCoverageReviews(); await deliverOutbox();
      expect(mocks.model).toHaveBeenCalledTimes(1); expect(mocks.send).toHaveBeenCalledTimes(1);
    } else {
      expect(outbox).toHaveLength(0); expect(mocks.send).not.toHaveBeenCalled();
      expect(status).toBe(mode === "withdrawn" ? "footage_received" : "add_views");
    }
    expect(isEncryptedField(record.contact.email)).toBe(mode !== "legacy_plaintext");
  });
});
