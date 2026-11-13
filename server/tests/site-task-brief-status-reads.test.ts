// @vitest-environment node
/**
 * One status read of the job page: how often it asks the Pipeline for the preparation status, and how long its
 * optional parts may hold the status back.
 *
 * The page shows nothing about the job until a status read answers. Each Pipeline preparation read is capped at
 * 5 seconds, and one status read used to make three of them one after another (the route, the outlook, and the
 * outlook's answer), so a busy Pipeline kept the page on "Checking the current job status". The status read now
 * makes one and hands it on; the outlook, the first-look words and the site advisory wait only on one deadline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const preparation = vi.hoisted(() => ({
  read: vi.fn(async (): Promise<Record<string, unknown>> => ({ state: "handed_off", correlationId: "bp-prep-1234567890abcdef" })),
  question: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("../utils/websitePreparationStatus", async (orig) => ({ ...(await orig() as object),
  loadCurrentWebsitePreparationStatus: preparation.read, loadCurrentTaskTargetChoiceQuestion: preparation.question }));
// The optional parts, each replaceable by a read that never answers; the company read by a slow one.
const slow = vi.hoisted(() => ({ advisory: false, firstLook: false, evidence: false, companyDelayMs: 0,
  events: [] as string[], advisoryHook: null as null | (() => void) }));
const never = () => new Promise<never>(() => undefined);
vi.mock("../utils/siteAssessmentPublic", async (orig) => {
  const actual = await orig() as Record<string, (...args: unknown[]) => unknown>;
  return { ...actual, loadCurrentSiteAdvisory: async (...args: unknown[]) => {
    slow.events.push("advisory:start"); slow.advisoryHook?.();
    if (slow.advisory) return never();
    return actual.loadCurrentSiteAdvisory(...args);
  } };
});
vi.mock("../utils/teamJobAccess", async (orig) => {
  const actual = await orig() as Record<string, (...args: unknown[]) => unknown>;
  return { ...actual, loadCompanyJobAccess: async (...args: unknown[]) => {
    if (slow.companyDelayMs) await new Promise(resolve => setTimeout(resolve, slow.companyDelayMs));
    slow.events.push("company:end");
    return actual.loadCompanyJobAccess(...args);
  } };
});
vi.mock("../utils/jobOutlook", async (orig) => {
  const actual = await orig() as Record<string, (...args: unknown[]) => Promise<unknown>>;
  return { ...actual, loadJobOutlook: async (...args: unknown[]) => {
    const value = await actual.loadJobOutlook(...args);
    slow.events.push("outlook:done");
    return value;
  } };
});
vi.mock("../utils/firstLookTable", async (orig) => {
  const actual = await orig() as Record<string, (...args: unknown[]) => unknown>;
  return { ...actual, loadFirstLookWords: (...args: unknown[]) => slow.firstLook ? never() : actual.loadFirstLookWords(...args) };
});
vi.mock("../utils/siteManagedEvidence", async (orig) => {
  const actual = await orig() as Record<string, (...args: unknown[]) => unknown>;
  return { ...actual, readSiteManagedEvidence: (...args: unknown[]) => slow.evidence ? never() : actual.readSiteManagedEvidence(...args) };
});
const storage = vi.hoisted(() => ({ objects: new Map<string, { generation: string; size: string; crc32c: string; bytes?: Buffer }>() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => ({ file: (name: string) => ({
      getMetadata: async () => { const m = storage.objects.get(name); if (!m) throw Object.assign(new Error("missing"), { code: 404 }); return [{ name, ...m }]; },
      exists: async () => [storage.objects.has(name)],
      download: async () => [storage.objects.get(name)?.bytes ?? Buffer.alloc(0)],
      save: async () => { throw new Error("no write"); }, delete: async () => { throw new Error("no write"); } }) }) } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } }));
vi.mock("../utils/captureOutbox", () => ({ enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })) }));

const { default: briefRouter, STATUS_OPTIONAL_DEADLINE_MS, statusRouteTiming } = await import("../routes/site-task-brief");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");
const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");

const requestId = "capture-00000000-0000-4000-8000-000000000001", sceneId = `site-${requestId}`, captureId = `walkthrough-${requestId}`;
let server: Server; let baseUrl: string;
async function status() {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${createCaptureUploadToken({ requestId, captureId, sceneId })}/status`);
  return { code: response.status, body: await response.json() };
}
function preview() {
  const value: Record<string, unknown> = { schema_version: "website_scene_preview.v1", capture_id: captureId,
    scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
    coordinate_frame: "right_up_back_y_up", digest: `sha256:${"2".repeat(64)}`, size_bytes: 1024, gaussian_count: 10,
    source_gaussian_count: 2_000_000, start_view: null, claim_ceiling: "development_only", updated_at_epoch: 1_794_481_620 };
  value.preview_digest = crossRuntimeArtifactDigest(value, "preview_digest");
  return value;
}
const selector = { request_id: requestId, scene_id: sceneId, capture_id: captureId, completion_marker_generation: "17",
  producer_delivery_key: `sha256:${"3".repeat(64)}`, source_payload_sha256: "4".repeat(64), task_context_digest: `sha256:${"5".repeat(64)}` };

beforeEach(async () => {
  vi.clearAllMocks(); storage.objects.clear(); sharedFakeFirestoreState.docs.clear();
  Object.assign(slow, { advisory: false, firstLook: false, evidence: false, companyDelayMs: 0, events: [], advisoryHook: null });
  statusRouteTiming.optionalDeadlineMs = STATUS_OPTIONAL_DEADLINE_MS;
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  const app = express(); app.use(express.json()); app.use("/api/site-task-brief", briefRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, {
    requestId, account_owner_uid: "owner-uid-1", claimed_at_iso: null,
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {},
      consent_attestation: { granted: true, statement_version: "2026-11-02.v2", recorded_at_iso: "2026-11-11T18:40:00.000Z" } },
    site_task_brief_confirmed_at: "2026-11-11T18:43:00.000Z",
    capture_coverage: { covers_scene: true, missing_coverage: [], supplement_would_finish: false },
  });
  await saveBrief({ ...draftBrief({ requestId, summary: "Move the box from the shelf to the table", captureMode: "self_capture", proposed: [] }),
    confirmedAtIso: "2026-11-11T18:43:00.000Z", confirmedBy: "owner-uid-1" });
  storage.objects.set(`scenes/${sceneId}/captures/${captureId}/raw/walkthrough.mp4`, { generation: "9", size: "10", crc32c: "AAAAAA==" });
  sharedFakeFirestoreState.docs.set(`captureUploadSessions/${captureId}`, { scene_preview: preview(), website_preparation: { selector } });
});
afterEach(async () => { vi.unstubAllEnvs(); statusRouteTiming.optionalDeadlineMs = STATUS_OPTIONAL_DEADLINE_MS; await new Promise<void>(resolve => server.close(() => resolve())); });

describe("one status read", () => {
  it.each<[string, Record<string, unknown>]>([
    ["handed off", { state: "handed_off", correlationId: "bp-prep-1234567890abcdef" }],
    ["handed off with a robot fit", { state: "handed_off", correlationId: "bp-prep-1234567890abcdef", robotFit: { route: "full", status: "completed", robots: [] } }],
    ["preparing", { state: "preparing", correlationId: "bp-prep-1234567890abcdef" }],
    ["unavailable", { state: "unavailable", correlationId: null }],
  ])("reads the Pipeline's preparation status once, %s, and still gives the outlook and the answer", async (_name, value) => {
    preparation.read.mockResolvedValue(value);
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(preparation.read).toHaveBeenCalledTimes(1);
    expect(body.status).toBeTruthy();
    expect(body.outlook?.phase).toEqual(expect.any(String));
    expect(body.answer).toBeTruthy();
    expect(body.sceneViewUrl).toContain("/splat-viewer/index.html");
  });

  it("gives the same outlook the standalone loader gives", async () => {
    const { body } = await status();
    const { loadJobOutlook } = await import("../utils/jobOutlook");
    expect(await loadJobOutlook(requestId)).toEqual(body.outlook);
  });

  it("makes reads that do not depend on each other together, not one after another", async () => {
    // The Pipeline read finishes only once the advisory read has started: one after another, it would never finish.
    let advisoryStarted!: () => void;
    const started = new Promise<void>(resolve => { advisoryStarted = resolve; });
    slow.advisoryHook = () => advisoryStarted();
    preparation.read.mockImplementation(async () => {
      slow.events.push("preparation:start");
      const first = await Promise.race([started.then(() => "advisory"), new Promise(resolve => setTimeout(() => resolve("timeout"), 3_000))]);
      slow.events.push(`preparation:end:${first}`);
      return { state: "handed_off", correlationId: "bp-prep-1234567890abcdef" };
    });
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(body.outlook?.phase).toEqual(expect.any(String));
    expect(slow.events.indexOf("advisory:start")).toBeLessThan(slow.events.indexOf("preparation:end:advisory"));
    expect(slow.events).not.toContain("preparation:end:timeout");
  });

  it("gives the outlook from the bare answer: it does not wait on the company reads", async () => {
    slow.companyDelayMs = 300;
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(body.answer).toBeTruthy();
    expect(body.outlook?.phase).toEqual(expect.any(String));
    expect(body.outlookLate).toBeUndefined();
    expect(slow.events.indexOf("outlook:done")).toBeGreaterThanOrEqual(0);
    expect(slow.events.indexOf("outlook:done")).toBeLessThan(slow.events.indexOf("company:end"));
  });

  it("says when the outlook missed the deadline", async () => {
    statusRouteTiming.optionalDeadlineMs = 300;
    slow.evidence = true;
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(body.outlook).toBeNull();
    expect(body.outlookLate).toBe(true);
    expect(body.status).toBeTruthy();
  });

  it("makes no Pipeline read for a withdrawn job, and says it ended by the site", async () => {
    const record = sharedFakeFirestoreState.docs.get(`inboundRequests/${requestId}`) as Record<string, any>;
    sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, { ...record, request: { ...record.request,
      consent_attestation: { ...record.request.consent_attestation, withdrawn_at_iso: "2026-11-12T09:00:00.000Z" } } });
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(preparation.read).not.toHaveBeenCalled();
    expect(body.outlook).toMatchObject({ phase: "ended_by_site", reason: "permission_withdrawn" });
    expect(body.sceneViewUrl).toBeNull();
    expect(body.answer).toBeNull();
  });

  it("goes out by the deadline with the status, the link and the answer, and the optional parts null", async () => {
    Object.assign(slow, { advisory: true, firstLook: true, evidence: true });
    const started = Date.now();
    const { code, body } = await status();
    const took = Date.now() - started;
    expect(code).toBe(200);
    expect(took).toBeGreaterThanOrEqual(STATUS_OPTIONAL_DEADLINE_MS - 50);
    expect(took).toBeLessThan(STATUS_OPTIONAL_DEADLINE_MS + 2_000);
    expect(body.status?.decision).toEqual(expect.any(String));
    expect(body.sceneViewUrl).toContain("/splat-viewer/index.html");
    expect(body.answer).toBeTruthy();
    expect(body).toMatchObject({ siteAdvisory: null, firstLookTable: null, outlook: null, outlookLate: true });
  }, 20_000);
});
