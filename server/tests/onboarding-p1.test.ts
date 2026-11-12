// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import { createRequire } from "node:module";
const { PNG } = createRequire(import.meta.url)("pngjs");
const { sanitizeTaskThumbnail } = await import("../utils/taskThumbnail");
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { InboundRequest } from "../types/inbound-request";
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } } };
});
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const { projectTaskBrowseCard, listTaskBrowseCards } = await import("../utils/taskBrowse");
const { approvedTaskDetails, taskListingSchema } = await import("../utils/taskListingDetails");
const { isRunnableTask } = await import("../utils/teamJobAccess");
const { ensureTaskStatusUpdate, TASK_STATUS_UPDATES } = await import("../utils/taskStatusUpdates");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
// Sharing follows the job's outlook (review, 2026-11-11). These tests are about cards on jobs that have an answer,
// so the outlook is a test result unless a test sets another phase.
const outlookPhase = vi.hoisted(() => ({ value: "result" as string }));
vi.mock("../utils/jobOutlook", async importOriginal => ({ ...await importOriginal<typeof import("../utils/jobOutlook")>(),
  loadJobOutlookDecision: vi.fn(async () => ({ outlook: { phase: outlookPhase.value, reason: null, sentence: null }, certain: true })) }));
const publicRouter = (await import("../routes/site-worlds")).default;
const thumbnail = () => PNG.sync.write({ width: 24, height: 15, data: Buffer.alloc(24 * 15 * 4, 160) }).toString("base64");
const details = { title: "Move cartons from conveyor to pallet", taskFamily: "Palletizing", region: "US Midwest", siteType: "Warehouse", objects: "Sealed cartons", cycleTarget: "12 seconds", pilotTiming: "October", pilotBudget: "", opportunity: "past" };
const record = (patch: Record<string, unknown> = {}) => ({
  requestId: "req1", contact: { email: "owner@example.test", firstName: "PRIVATE PERSON" },
  request: { buyerType: "site_operator", taskStatement: "PRIVATE TASK", siteName: "PRIVATE SITE", siteLocation: "PRIVATE ADDRESS", capture_mode: "self_capture", siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10", deploymentTimeline: "this_quarter", accessWindow: "scheduled" },
    consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: "2026-09-19T00:00:00.000Z" } },
  public_task_listing: { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: "2026-09-19T00:00:00.000Z", details },
  capture_privacy_screen: { capture_id: "walkthrough-req1", proceeded: true, eligibility: "eligible", screened_at_iso: "2026-09-19T00:00:00.000Z" },
  site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: "2026-09-19T00:00:00.000Z",
  pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://private/scene.json" } },
  evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" }, ...patch,
} as unknown as InboundRequest);
beforeEach(() => { outlookPhase.value = "result"; state.docs.clear(); sendEmail.mockReset().mockResolvedValue({ sent: true, messageId: "fake", provider: "fake" }); });
afterEach(() => vi.useRealTimers());

describe("public task disclosure", () => {
  it("publishes only the closed category of the job, with no contact, intake, storage, footage or stored free text", () => {
    const card = projectTaskBrowseCard("req1", record());
    // The stored title is free text, so the card shows the neutral category (2026-11-12: never trust stored text).
    expect(card).toMatchObject({ title: "Work assessment opportunity", opportunity: "open", evaluationAvailable: true, stage: "ready", costUsd: 0 });
    expect(JSON.stringify(card)).not.toMatch(/PRIVATE|gs:\/\/|email|contact|worldlabs|Move cartons|US Midwest|Warehouse|Sealed cartons/);
  });
  it("rebuilds a shared card from its category and never shows the site's proposed terms or any stored text", () => {
    const proposed = { ...details, title: "Carton palletizing opportunity", pilotBudget: "$20,000", pilotPriceStatus: "site_offer",
      pilotConditions: "PLANTED Four weeks including setup and support", ongoingTarget: "$5,000 per month" };
    const card = projectTaskBrowseCard("req1", record({ public_task_listing: {
      enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: "2026-09-19T00:00:00.000Z", details: proposed } }));
    expect(card).toMatchObject({ title: "Carton palletizing opportunity", taskFamily: "Pallet handling", objects: "Cartons",
      pilotBudget: "", pilotConditions: "", ongoingTarget: "", region: "", siteType: "" });
    expect(JSON.stringify(card)).not.toMatch(/PLANTED|\$20,000|\$5,000|US Midwest|Warehouse/);
    expect(taskListingSchema.parse({ ...proposed, pilotBudget: "" }).pilotBudget).toBe("");
    expect(taskListingSchema.parse({ ...proposed, pilotBudget: undefined }).pilotBudget).toBe("");
  });
  it.each([
    { public_task_listing: undefined }, { public_task_listing: { enabled: true, details } },
    { workspace_task: { archived: true } }, { debug: { autoCreatedByPipeline: true } },
    { evidence_tier: "development_only" }, { pipeline: { rights_review_status: "blocked" } },
    // Where the Pipeline sync actually reports its rights verdict.
    { evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready", rights_review_status: "needs_review" } },
    { consent_revoked: true },
    // A card under an older statement, or a video that has not passed the privacy screen (2026-11-12).
    { public_task_listing: { enabled: true, consentVersion: "public-task-card-v1", approvedAtIso: "2026-09-19T00:00:00.000Z", details } },
    { capture_privacy_screen: { eligibility: "rejected", proceeded: false } },
  ])("does not expose unconsented, closed, development or restricted records: %j", patch => {
    expect(projectTaskBrowseCard("req1", record(patch))).toBeNull();
  });
  it("public interest in a pilot cannot make an unproven scene runnable", () => {
    const source = record({ evaluation_readiness: null });
    expect(projectTaskBrowseCard("req1", source)).toMatchObject({ stage: "preparing", evaluationAvailable: false, costUsd: null });
    expect(isRunnableTask(source)).toBe(false);
  });
  it("shows capture progress separately and keeps closed scenes out of paid supply", () => {
    // A listed job's video has passed the privacy screen (2026-11-12), so it is never still at "capture".
    expect(projectTaskBrowseCard("req1", record({ pipeline: null, evaluation_readiness: null }))).toMatchObject({ stage: "preparing", evaluationAvailable: false });
    // A pause no longer hides the job from companies (must-fix 3) but still keeps it out of paid runs, as does a close.
    expect(isRunnableTask(record({ workspace_task: { archived: true } }))).toBe(false);
    expect(isRunnableTask(record({ workspace_task: { paused: true } }))).toBe(false);
  });
  it("lists a job whose video passed the privacy screen", () => {
    expect(projectTaskBrowseCard("req1", record())).toMatchObject({ id: "req1", stage: "ready" });
  });
  it("listing reads share the same admission and withdrawal checks", async () => {
    state.docs.set("siteTaskBriefs/req1", { requestId: "req1", summary: "Move cartons from the conveyor to a pallet" } as never);
    state.docs.set("inboundRequests/req1", record() as never);
    expect(await listTaskBrowseCards()).toHaveLength(1);
    state.docs.set("inboundRequests/req1", record({ public_task_listing: { enabled: false } }) as never);
    expect(await listTaskBrowseCards()).toEqual([]);
    expect(approvedTaskDetails(record({ public_task_listing: {} }))).toBeNull();
  });
});

describe("timed check-ins are retired", () => {
  // Every real event now sends its own email, so nothing is scheduled. What
  // the timer left behind is cleared without sending anything.
  it("removes a scheduled check-in, orphaned or not, and sends nothing", async () => {
    state.docs.set(`${TASK_STATUS_UPDATES}/removed`, { requestId: "removed", dueAtIso: "2020-01-01T00:00:00Z", dueAtMs: 0 });
    state.docs.set("inboundRequests/req1", record({ site_task_next_update_iso: "2026-09-21T10:00:00.000Z" }) as never);
    state.docs.set(`${TASK_STATUS_UPDATES}/req1`, { requestId: "req1", dueAtIso: "2026-09-21T10:00:00.000Z", dueAtMs: 1 });
    await deliverOutbox();
    expect(state.docs.has(`${TASK_STATUS_UPDATES}/removed`)).toBe(false);
    expect(state.docs.has(`${TASK_STATUS_UPDATES}/req1`)).toBe(false);
    expect(state.docs.get("inboundRequests/req1")?.site_task_next_update_iso).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("promises no next-update time", async () => {
    state.docs.set("inboundRequests/req1", record() as never);
    expect(await ensureTaskStatusUpdate("req1")).toBeNull();
    expect(state.docs.has(`${TASK_STATUS_UPDATES}/req1`)).toBe(false);
  });
  it("cancels a check-in that was already queued in the outbox", async () => {
    state.docs.set("inboundRequests/req1", record() as never);
    state.docs.set("captureOutbox/req1:progress_update:1", {
      idempotencyKey: "req1:progress_update:1", requestId: "req1", kind: "progress_update",
      to: "owner@example.test", subject: "Your Blueprint task — scheduled update", body: "check-in",
      status: "pending", attempts: 0,
    });
    await deliverOutbox();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.docs.get("captureOutbox/req1:progress_update:1")?.status).toBe("cancelled");
  });
});

// The owner's Share settings route (`task-listings.ts`) and its card, thumbnail and "summary is shared" tests were
// removed with it on 2026-11-12: sharing is the service, agreed once with recording statement v4.

// Add a valid PNG text chunk to prove that re-encoding drops location-like metadata.
describe("task thumbnail metadata", () => {
  it("strips metadata and refuses oversized or non-raster inputs", () => {
    const png = Buffer.from(thumbnail(), "base64");
    const value = Buffer.from("Location\0PRIVATE SITE ADDRESS");
    const chunk = Buffer.alloc(value.length + 12);
    chunk.writeUInt32BE(value.length); chunk.write("tEXt", 4); value.copy(chunk, 8);
    let crc = 0xffffffff;
    for (const byte of chunk.subarray(4, chunk.length - 4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
    const withMetadata = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
    const cleaned = Buffer.from(sanitizeTaskThumbnail(withMetadata.toString("base64")).pngBase64, "base64");
    expect(cleaned.includes(Buffer.from("PRIVATE SITE ADDRESS"))).toBe(false);
    expect(PNG.sync.read(cleaned).data).toEqual(PNG.sync.read(png).data);
    const oversized = Buffer.from(png); oversized.writeUInt32BE(100_000, 16);
    expect(() => sanitizeTaskThumbnail(oversized.toString("base64"))).toThrow(/480/);
    expect(() => sanitizeTaskThumbnail(Buffer.from("<svg/>").toString("base64"))).toThrow(/PNG/);
  });
});
