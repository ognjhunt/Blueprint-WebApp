// @vitest-environment node
/**
 * "View your scene": the Pipeline's web-sized scene preview on the site's own job page.
 *
 * Pins: the signed callback stores only a digest-bound preview identity, once per scene
 * revision, and only while the site's rights allow derived scenes; the vendored viewer
 * reads it only through its own 15-minute ticket, checked against the stored digest; and
 * a withdrawal drops cached copies at once and the deletion pass deletes the reference.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true }),
}));

import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { orientPlyForViewer, websiteAtlasPreviewViewerUrl } from "../utils/websiteAtlasPreviewView";
import { forgetWebsiteScenePreviews, websiteScenePreviewDigestValid, websiteScenePreviewSchema,
  websiteScenePreviewViewerUrl } from "../utils/websiteScenePreview";
import { recordWebsiteCaptureWithdrawal } from "../utils/websiteCaptureWithdrawal";
import { DELETION_RECEIPTS_COLLECTION, resetWebsiteCaptureDeletionCursorsForTests,
  runWebsiteCaptureDeletions } from "../utils/websiteCaptureDeletion";

const REQUEST = "inboundRequests/req1", SESSION = "captureUploadSessions/walkthrough-req1";
const realFetch = globalThis.fetch;
const consent = { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-07T00:00:00.000Z" };
const PLY_PROPERTIES = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2",
  "rot_0", "rot_1", "rot_2", "rot_3"];
function plyFixture(rows: number[][]) {
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${rows.length}\n`
    + PLY_PROPERTIES.map(name => `property float ${name}\n`).join("") + "end_header\n";
  return Buffer.concat([Buffer.from(header, "latin1"), Buffer.from(new Float32Array(rows.flat()).buffer)]);
}
const splat = plyFixture([[1, 2, 3, 0.1, 0.2, 0.3, 2, -5, -5, -7, 0.9, 0.1, 0.2, 0.3],
  [4, 5, 6, 0.4, 0.5, 0.6, 1, -4, -4, -4, 0.5, 0.5, 0.5, 0.5]]);
const splatDigest = `sha256:${createHash("sha256").update(splat).digest("hex")}`;

function sealed(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_scene_preview.v1", capture_id: "walkthrough-req1",
    scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
    coordinate_frame: "right_up_back_y_up", digest: splatDigest, size_bytes: splat.length, gaussian_count: 2,
    source_gaussian_count: 2_000_000, start_view: { position: [1, 1.5, 2], target: [3, 1.5, 2] },
    claim_ceiling: "development_only", updated_at_epoch: 1_794_000_000, ...patch };
  delete value.preview_digest;
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}

function seed(request: Record<string, unknown> = {}) {
  state.docs.set(REQUEST, { request: { consent_attestation: consent }, ...request });
  state.docs.set(SESSION, { browser_stored_upload: { request_id: "req1" }, updated_at_iso: "2026-11-07T00:00:00.000Z" });
}

let server: Server, base: string;
beforeEach(async () => {
  state.docs.clear();
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  await forgetWebsiteScenePreviews("req1");
  const app = express();
  app.use(express.json());
  app.use((await import("../routes/internal-capture-worlds")).default);
  app.use("/api/website-atlas-preview-views", (await import("../routes/website-atlas-preview-views")).default);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await forgetWebsiteScenePreviews("req1");
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

const publish = (preview: unknown, capture = "walkthrough-req1") => realFetch(`${base}/creator-captures/${capture}/scene-preview`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", preview }) });

it("checks the preview the Pipeline seals: one cross-runtime vector", () => {
  // Sealed by website_scene_preview.preview_record's cross_runtime_canonical_digest.
  const vector = { schema_version: "website_scene_preview.v1", capture_id: "walkthrough-req1",
    scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
    coordinate_frame: "right_up_back_y_up", digest: `sha256:${"2".repeat(64)}`, size_bytes: 28000312,
    gaussian_count: 500000, source_gaussian_count: 2000000,
    start_view: { position: [0.1234, -1.5, 2.0], target: [3.0001, -1.5, 1e-05] }, claim_ceiling: "development_only",
    updated_at_epoch: 1794000000, preview_digest: "sha256:61bd227ea5aa5f7c3ea976ec960f48dfd3990dd3d790964efbc25b43dd6a8afa" };
  expect(websiteScenePreviewDigestValid(websiteScenePreviewSchema.parse(vector))).toBe(true);
  expect(websiteScenePreviewDigestValid(websiteScenePreviewSchema.parse({ ...vector, gaussian_count: 1 }))).toBe(false);
});

describe("the Pipeline's scene preview callback", () => {
  it("stores the preview's identity on the capture session once per scene revision", async () => {
    seed();
    const first = sealed();
    const accepted = await publish(first);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ schema_version: "website_scene_preview_acceptance.v1", accepted: true,
      scene_revision: first.scene_revision, preview_digest: first.preview_digest });
    expect(state.docs.get(SESSION)).toMatchObject({ scene_preview: first, browser_stored_upload: { request_id: "req1" } });
    // A replay is accepted and changes nothing; the same revision with other bytes is refused.
    const stored = structuredClone(state.docs.get(SESSION));
    expect((await publish(first)).status).toBe(200);
    expect(state.docs.get(SESSION)).toEqual(stored);
    const conflict = await publish(sealed({ gaussian_count: 1 }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ code: "idempotency_conflict" });
    // A new revision replaces it; an older one never does.
    const stale = await publish(sealed({ scene_revision: `sha256:${"3".repeat(64)}`, updated_at_epoch: 1_793_000_000 }));
    expect(await stale.json()).toEqual({ code: "website_scene_preview_stale" });
    const next = sealed({ scene_revision: `sha256:${"4".repeat(64)}`, updated_at_epoch: 1_794_000_100 });
    expect((await publish(next)).status).toBe(200);
    expect(state.docs.get(SESSION)?.scene_preview).toEqual(next);
  });

  it("refuses an unsealed, oversized, misnamed or orphaned preview", async () => {
    seed();
    expect((await publish({ ...sealed(), gaussian_count: 3 })).status).toBe(409);
    expect((await publish(sealed({ size_bytes: 32 * 1024 * 1024 + 1 }))).status).toBe(400);
    expect((await publish({ ...sealed(), splat_path: "/srv/scenes/site-req1/x.ply" })).status).toBe(400);
    expect((await publish(sealed(), "walkthrough-other")).status).toBe(409);
    state.docs.delete(SESSION);
    expect(await (await publish(sealed())).json()).toEqual({ code: "website_scene_preview_capture_missing" });
    expect(state.docs.has(SESSION)).toBe(false);
  });

  it("stores nothing unless the site's rights allow derived scenes", async () => {
    for (const request of [{ request: {} }, { consent_revoked: true },
      { request: { consent_attestation: { ...consent, revoked_at_iso: "2026-11-07T01:00:00.000Z" } } }]) {
      state.docs.clear();
      seed(request);
      const refused = await publish(sealed());
      expect(refused.status).toBe(409);
      expect(await refused.json()).toEqual({ code: "source_revoked" });
      expect(state.docs.get(SESSION)).not.toHaveProperty("scene_preview");
    }
  });
});

describe("viewing the scene preview", () => {
  /** The vendored host page's own rule for a content URL (client/public/splat-viewer/boot.js). */
  const HOST_PAGE_SCENE_URL = /^\/api\/website-atlas-preview-views\/([A-Za-z0-9][A-Za-z0-9._-]{0,119})\/[^/?]+\/scene\.ply\?/;
  const pipelineReads: Array<{ url: string; headers: Record<string, string> }> = [];
  function readsFromPipeline(body: Buffer = splat) {
    pipelineReads.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: URL | string, init?: RequestInit) => {
      pipelineReads.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(body);
    }));
  }
  const content = (viewer: string | null) => new URL(viewer!, "https://tryblueprint.io").searchParams.get("content")!;

  it("serves the turned splat and its start view only under the owner's scene ticket", async () => {
    seed();
    state.docs.get(SESSION)!.scene_preview = sealed();
    readsFromPipeline();
    const scene = content(websiteScenePreviewViewerUrl("req1", "walkthrough-req1"));
    expect(HOST_PAGE_SCENE_URL.exec(scene)?.[1]).toBe("req1");
    expect(scene).toContain("source=scene");
    const served = await realFetch(`${base}${scene}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await served.arrayBuffer())).toEqual(orientPlyForViewer(Buffer.from(splat)));
    expect(pipelineReads).toHaveLength(1);
    expect(pipelineReads[0]!.url).toBe(`https://pipeline.invalid/api/live-pipeline/website-scene-previews/walkthrough-req1/scene.ply?request_id=req1&digest=${encodeURIComponent(splatDigest)}`);
    expect(pipelineReads[0]!.headers["x-blueprint-pipeline-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    const settings = await (await realFetch(`${base}${scene.replace("/scene.ply?", "/settings.json?")}`)).json();
    expect(settings.cameras).toEqual([{ initial: { position: [1, 1.5, 2], target: [3, 1.5, 2], fov: 70 } }]);
    expect(pipelineReads).toHaveLength(1); // cached per job, capture and digest

    // Opening the file directly, an Atlas preview ticket, or a missing source is refused.
    expect((await realFetch(`${base}${scene}`, { headers: { "sec-fetch-dest": "document" } })).status).toBe(403);
    const atlas = content(websiteAtlasPreviewViewerUrl("req1", "walkthrough-req1"));
    expect((await realFetch(`${base}${atlas}&source=scene`)).status).toBe(404);
    expect((await realFetch(`${base}${scene.replace("source=scene&", "")}`)).status).toBe(404);
    // Rights are re-read on every view.
    state.docs.set(REQUEST, { ...state.docs.get(REQUEST), consent_revoked: true });
    expect((await realFetch(`${base}${scene}`)).status).toBe(404);
  });

  it("refuses bytes that are not the preview the callback stored", async () => {
    seed();
    state.docs.get(SESSION)!.scene_preview = sealed();
    const changed = Buffer.from(splat);
    changed[changed.length - 1] ^= 0xff;
    readsFromPipeline(changed);
    const response = await realFetch(`${base}${content(websiteScenePreviewViewerUrl("req1", "walkthrough-req1"))}`);
    expect(response.status).toBe(503);
    const cache = path.join(tmpdir(), "blueprint-scene-preview-views", "req1", "walkthrough-req1");
    expect((await readdir(cache).catch(() => [] as string[])).filter(name => !name.endsWith(".partial"))).toEqual([]);
  });

  it("withdrawal drops the cached copy at once and the deletion pass deletes the stored reference", async () => {
    seed();
    state.docs.get(SESSION)!.scene_preview = sealed();
    readsFromPipeline();
    const scene = content(websiteScenePreviewViewerUrl("req1", "walkthrough-req1"));
    expect((await realFetch(`${base}${scene}`)).status).toBe(200);
    const cache = path.join(tmpdir(), "blueprint-scene-preview-views", "req1");
    expect(await readdir(path.join(cache, "walkthrough-req1"))).toHaveLength(2);

    await recordWebsiteCaptureWithdrawal({ requestId: "req1", requestedBy: "signed_owner_link", authorize: () => undefined });
    await expect(readdir(cache)).rejects.toThrow();
    expect((await realFetch(`${base}${scene}`)).status).toBe(404);
    expect(state.docs.get(SESSION)).toHaveProperty("scene_preview");

    resetWebsiteCaptureDeletionCursorsForTests();
    const bucket = { getFiles: async () => [[], null] as [never[], null], file: () => ({ delete: async () => undefined }) };
    await runWebsiteCaptureDeletions({ deps: { bucket, bucketName: "fake-bucket", now: () => Date.now() + 3 * 3600_000,
      ackTimeoutMs: 2 * 3600_000 } });
    expect(state.docs.get(SESSION)).not.toHaveProperty("scene_preview");
    expect(state.docs.get(SESSION)).toMatchObject({ browser_stored_upload: { request_id: "req1" } });
    const receipts = [...state.docs.entries()].filter(([key]) => key.startsWith(`${DELETION_RECEIPTS_COLLECTION}/`));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]![1]).toMatchObject({ outcome: "complete", scene_preview_references_deleted: ["walkthrough-req1"] });
  });
});
