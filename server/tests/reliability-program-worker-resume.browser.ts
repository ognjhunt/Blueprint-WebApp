// Opt-in fresh-process worker replay against the isolated Firestore emulator.
import { it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { database, emulatorMode, reloadObjects, refreshDocumentView, durableSummary } from "./helpers/reliability-local-storage";
const fake = vi.hoisted(() => ({calls: 0, mails: [] as {to: string; subject: string}[]}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const local = await import("./helpers/reliability-local-storage");
  return {default: {firestore: {FieldValue: local.fieldValue}}, dbAdmin: local.database, storageAdmin: {bucket: () => local.bucket}, authAdmin: null};
});
vi.mock("../logger", () => ({logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()}}));
vi.mock("../utils/email", () => ({sendEmail: async (params: {to: string; subject: string}) => {
  if (typeof params.to !== "string" || !params.to.includes("@")) throw new Error("fixture_invalid_recipient");
  fake.mails.push({to: params.to, subject: params.subject});
  return {sent: true, provider: "local_sink", messageId: `worker-fixture-${fake.mails.length}`};
}}));
vi.mock("../utils/slack", () => ({notifySlackInboundRequest: vi.fn(async () => false)}));
vi.mock("../agents/runtime", () => ({runAgentTask: async () => {fake.calls++; return {status: "completed", output: {
  covers_scene: false, missing_views: ["The generated test pattern contains no work area"], supplement_would_finish: false,
  unreadable_reasons: ["Synthetic transport fixture"], confidence: 1,
  views: [{id: "work-area", status: "not_seen", timestamp_seconds: null, note: "Synthetic fixture"}],
}};}}));
vi.mock("../agents/private-evidence", () => ({hydrateAgentEvidence: vi.fn(async value => value)}));
it("fresh worker process consumes persisted producer intent without paid effects", async () => {
  expect(emulatorMode).toBe(true);
  vi.stubEnv("APP_URL", "http://127.0.0.1:42878");
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "false");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  reloadObjects();
  const {recoverCaptureReviews} = await import("../utils/captureReviewRecovery");
  const {reconcileCoverageReviews} = await import("../utils/captureCoverageQueue");
  const {deliverOutbox} = await import("../utils/captureOutbox");
  await recoverCaptureReviews(); await reconcileCoverageReviews(); await deliverOutbox(); await deliverOutbox();
  await refreshDocumentView();
  const receipt = {layer: "fresh-worker-process/firestore-emulator/fake-objectstore-model-local-notification", process_id: process.pid,
    source_sha256: createHash("sha256").update(fs.readFileSync(import.meta.filename)).digest("hex"),
    model_calls_simulated: fake.calls, mails: fake.mails, live_provider_calls: 0, durable: durableSummary()};
  const target = path.resolve(process.env.RELIABILITY_WORKER_RECEIPT!);
  if (!target.startsWith(path.resolve("output/reliability-program") + path.sep)) throw new Error("Worker receipt must remain private local output");
  fs.writeFileSync(target, JSON.stringify(receipt, null, 2));
  await (database as any).terminate(); vi.unstubAllEnvs();
});
