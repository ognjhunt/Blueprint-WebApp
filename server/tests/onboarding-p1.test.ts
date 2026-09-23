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
const { approvedTaskDetails } = await import("../utils/taskListingDetails");
const { isRunnableTask } = await import("../utils/teamEvalCandidates");
const { ensureTaskStatusUpdate, TASK_STATUS_UPDATES } = await import("../utils/taskStatusUpdates");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const router = (await import("../routes/task-listings")).default;
const publicRouter = (await import("../routes/site-worlds")).default;
const thumbnail = () => PNG.sync.write({ width: 24, height: 15, data: Buffer.alloc(24 * 15 * 4, 160) }).toString("base64");
const details = { title: "Move cartons from conveyor to pallet", taskFamily: "Palletizing", region: "US Midwest", siteType: "Warehouse", objects: "Sealed cartons", cycleTarget: "12 seconds", pilotTiming: "October", pilotBudget: "", opportunity: "past" };
const record = (patch: Record<string, unknown> = {}) => ({
  requestId: "req1", contact: { email: "owner@example.test", firstName: "PRIVATE PERSON" },
  request: { buyerType: "site_operator", taskStatement: "PRIVATE TASK", siteName: "PRIVATE SITE", siteLocation: "PRIVATE ADDRESS", capture_mode: "self_capture", siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10", deploymentTimeline: "this_quarter", accessWindow: "scheduled" } },
  public_task_listing: { enabled: true, consentVersion: "public-task-card-v1", approvedAtIso: "2026-09-19T00:00:00.000Z", details },
  site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: "2026-09-19T00:00:00.000Z",
  pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://private/scene.json" } },
  evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" }, ...patch,
} as unknown as InboundRequest);
beforeEach(() => { state.docs.clear(); sendEmail.mockReset().mockResolvedValue({ sent: true, messageId: "fake", provider: "fake" }); });
afterEach(() => vi.useRealTimers());

describe("public task disclosure", () => {
  it("publishes only previewed fields, with no contact, intake, storage or footage", () => {
    const card = projectTaskBrowseCard("req1", record());
    expect(card).toMatchObject({ title: details.title, opportunity: "past", evaluationAvailable: true, stage: "ready", costUsd: 99 });
    expect(JSON.stringify(card)).not.toMatch(/PRIVATE|gs:\/\/|email|contact|worldlabs/);
  });
  it.each([
    { public_task_listing: undefined }, { public_task_listing: { enabled: true, details } },
    { workspace_task: { paused: true } }, { debug: { autoCreatedByPipeline: true } },
    { evidence_tier: "development_only" }, { pipeline: { rights_review_status: "blocked" } },
  ])("does not expose unconsented, paused, development or restricted records: %j", patch => {
    expect(projectTaskBrowseCard("req1", record(patch))).toBeNull();
  });
  it("public interest in a pilot cannot make an unproven scene runnable", () => {
    const source = record({ evaluation_readiness: null });
    expect(projectTaskBrowseCard("req1", source)).toMatchObject({ stage: "preparing", evaluationAvailable: false, costUsd: null });
    expect(isRunnableTask(source)).toBe(false);
  });
  it("shows capture progress separately and hides paused historical scenes from paid supply", () => {
    expect(projectTaskBrowseCard("req1", record({ pipeline: null, evaluation_readiness: null }))).toMatchObject({ stage: "capture", evaluationAvailable: false });
    expect(isRunnableTask(record({ workspace_task: { paused: true } }))).toBe(false);
  });
  it("listing reads share the same admission and withdrawal checks", async () => {
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

describe("owner authorization and durable demand", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    const app = express(); app.use(express.json({ limit: "1mb" })); app.use(router); app.use("/public", publicRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    state.docs.set("inboundRequests/req1", record() as never);
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const token = (scope: "owner" | "film") => createCaptureUploadToken({ requestId: "req1", sceneId: "s", captureId: "c", scope });
  it("rejects film-only grants and unreviewed owner grants; allows an owner to withdraw", async () => {
    const post = (scope: "owner" | "film", body: unknown) => fetch(`${base}/owner/${token(scope)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await post("film", { enabled: true, details, consent: true })).status).toBe(403);
    expect((await post("owner", { enabled: true, details, consent: false })).status).toBe(400);
    expect((await post("owner", { enabled: false, details, consent: true })).status).toBe(200);
    expect(await listTaskBrowseCards()).toHaveLength(0);
  });
  it("emails the site once when its card goes live, and again only if it is switched off and on", async () => {
    const post = (enabled: boolean) => fetch(`${base}/owner/${token("owner")}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled, details, consent: true }) });
    const live = () => [...state.docs.keys()].filter(key => key.startsWith("captureOutbox/req1:listing_live:"));
    state.docs.set("inboundRequests/req1", record({ public_task_listing: undefined }) as never);
    expect((await post(true)).status).toBe(200);
    expect(live()).toHaveLength(1);
    expect((await post(true)).status).toBe(200);
    expect(live()).toHaveLength(1);
    await post(false);
    await new Promise(resolve => setTimeout(resolve, 2));
    await post(true);
    expect(live()).toHaveLength(2);
  });
  it("requires photo permission, serves sanitized approved pixels, and revokes access on pause or withdrawal", async () => {
    const post = (body: unknown) => fetch(`${base}/owner/${token("owner")}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const grant = { enabled: true, consent: true, details, thumbnailPng: thumbnail() };
    expect((await post(grant)).status).toBe(400);
    expect((await post({ ...grant, thumbnailConsent: true })).status).toBe(200);
    const response = await fetch(`${base}/public/tasks/req1/thumbnail`);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await response.arrayBuffer()).toString("base64")).toBe(sanitizeTaskThumbnail(grant.thumbnailPng).pngBase64);
    expect((await listTaskBrowseCards())[0].thumbnailUrl).toBe("/api/site-worlds/tasks/req1/thumbnail");
    const saved = state.docs.get("inboundRequests/req1")!;
    state.docs.set("inboundRequests/req1", { ...saved, workspace_task: { paused: true } });
    expect((await fetch(`${base}/public/tasks/req1/thumbnail`)).status).toBe(404);
    state.docs.set("inboundRequests/req1", saved);
    expect((await post({ ...grant, enabled: false, thumbnailConsent: true })).status).toBe(200);
    expect((await fetch(`${base}/public/tasks/req1/thumbnail`)).status).toBe(404);
    expect((await post({ ...grant, thumbnailPng: null })).status).toBe(200);
    expect(state.docs.has("taskThumbnails/req1")).toBe(false);
    expect((await listTaskBrowseCards())[0].thumbnailUrl).toBeNull();
  });
});

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
