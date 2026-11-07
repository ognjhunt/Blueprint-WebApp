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
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
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
import { orientPlyForViewer, plyViewerOrientationStream, websiteAtlasPreviewViewerUrl } from "../utils/websiteAtlasPreviewView";
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

// PlayCanvas's compressed PLY, as the vendored viewer reads it (isCompressedPly in
// client/public/splat-viewer/index.js) and website_scene_preview.build_preview writes it.
const CHUNK_PROPERTIES = ["min_x", "min_y", "min_z", "max_x", "max_y", "max_z", "min_scale_x", "min_scale_y", "min_scale_z",
  "max_scale_x", "max_scale_y", "max_scale_z", "min_r", "min_g", "min_b", "max_r", "max_g", "max_b"];
const VERTEX_PROPERTIES = ["packed_position", "packed_rotation", "packed_scale", "packed_color"];
function compressedHeader(chunks: number, count: number, { chunkProperties = CHUNK_PROPERTIES.map(name => `float ${name}`),
  vertexProperties = VERTEX_PROPERTIES.map(name => `uint ${name}`), extra = "" } = {}) {
  return `ply\nformat binary_little_endian 1.0\nelement chunk ${chunks}\n${chunkProperties.map(line => `property ${line}\n`).join("")}`
    + `element vertex ${count}\n${vertexProperties.map(line => `property ${line}\n`).join("")}${extra}end_header\n`;
}
/** The smallest-three rotation of (w, x, y, z): largest index in the top 2 bits, the others as a·√2/2 + 0.5. */
function packRotation(quaternion: number[]) {
  const length = Math.hypot(...quaternion), q = quaternion.map(value => value / length);
  const largest = q.reduce((best, value, index) => Math.abs(value) > Math.abs(q[best]!) ? index : best, 0);
  const sign = q[largest]! < 0 ? -1 : 1;
  const stored = q.filter((_, index) => index !== largest)
    .map(value => Math.min(1023, Math.max(0, Math.round((sign * value * Math.SQRT1_2 + 0.5) * 1023))));
  return ((largest << 30) | (stored[0]! << 20) | (stored[1]! << 10) | stored[2]!) >>> 0;
}
/** A seeded generator, so a fixture is the same on every run. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
/** Random chunks and splats, every field and every rotation case (and a chunk whose bounds meet) covered. */
function compressedFixture(count: number, seed = 1) {
  const random = seeded(seed), chunks = Math.ceil(count / 256);
  const chunk = new Float32Array(chunks * 18), vertex = new Uint32Array(count * 4);
  for (let index = 0; index < chunks; index += 1) {
    for (let field = 0; field < 9; field += 1) {
      const low = (random() - 0.5) * 20, span = index === 1 && field === 1 ? 0 : random() * 5;
      chunk[index * 18 + (field % 3) + Math.floor(field / 3) * 6] = low;
      chunk[index * 18 + (field % 3) + Math.floor(field / 3) * 6 + 3] = low + span;
    }
  }
  const edges = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, -1, 0], [0, 0, 0, -1], [Math.SQRT1_2, Math.SQRT1_2, 0, 0],
    [0.5, -0.5, 0.5, -0.5], [-0.1, 0.2, -0.3, -0.9]];
  for (let index = 0; index < count; index += 1) {
    const quaternion = edges[index] ?? [0, 1, 2, 3].map(() => random() * 2 - 1);
    vertex.set([Math.floor(random() * 2 ** 32), packRotation(quaternion), Math.floor(random() * 2 ** 32),
      Math.floor(random() * 2 ** 32)], index * 4);
    if (index === edges.length) vertex[index * 4] = 0;
    if (index === edges.length + 1) vertex[index * 4] = 0xffffffff;
  }
  return Buffer.concat([Buffer.from(compressedHeader(chunks, count), "latin1"), Buffer.from(chunk.buffer),
    Buffer.from(vertex.buffer)]);
}
/**
 * The viewer's reading (SplatCompressedIterator.read, then decompress()): each splat's
 * position, (w, x, y, z) rotation, log scale and colour.
 */
function decodeCompressed(ply: Buffer) {
  const body = ply.indexOf("end_header\n") + "end_header\n".length;
  const header = ply.subarray(0, body).toString("latin1");
  const chunks = Number(/element chunk (\d+)/.exec(header)![1]), count = Number(/element vertex (\d+)/.exec(header)![1]);
  const view = new DataView(ply.buffer, ply.byteOffset + body);
  const chunk = (index: number, field: number) => view.getFloat32((Math.floor(index / 256) * 18 + field) * 4, true);
  const packed = (index: number, field: number) => view.getUint32(chunks * 72 + (index * 4 + field) * 4, true);
  const unorm = (value: number, bits: number) => (value & ((1 << bits) - 1)) / ((1 << bits) - 1);
  const unpack111011 = (value: number) => [unorm(value >>> 21, 11), unorm(value >>> 11, 10), unorm(value, 11)];
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  return Array.from({ length: count }, (_, index) => {
    const position = unpack111011(packed(index, 0)).map((t, axis) => lerp(chunk(index, axis), chunk(index, axis + 3), t));
    const scale = unpack111011(packed(index, 2)).map((t, axis) => lerp(chunk(index, axis + 6), chunk(index, axis + 9), t));
    const colour = [24, 16, 8, 0].map(shift => unorm(packed(index, 3) >>> shift, 8))
      .map((t, channel) => channel < 3 ? lerp(chunk(index, channel + 12), chunk(index, channel + 15), t) : t);
    const rotation = packed(index, 1);
    const [a, b, c] = [20, 10, 0].map(shift => (unorm(rotation >>> shift, 10) - 0.5) * Math.SQRT2) as [number, number, number];
    const m = Math.sqrt(1 - (a * a + b * b + c * c));
    // result.set(x, y, z, w) by the top two bits; decompress() writes rot_0 = w.
    const [x, y, z, w] = [[a, b, c, m], [m, b, c, a], [b, m, c, a], [b, c, m, a]][rotation >>> 30]!;
    return { position, rotation: [w, x, y, z], scale, colour };
  });
}
/** The float path's turn of decoded splats: a float PLY of them, turned by the unchanged float code. */
function floatTurned(splats: ReturnType<typeof decodeCompressed>) {
  const turned = orientPlyForViewer(plyFixture(splats.map(({ position, rotation, scale }) =>
    [...position, 0, 0, 0, 0, ...scale, ...rotation])));
  const body = turned.indexOf("end_header\n") + "end_header\n".length;
  const floats = new Float32Array(new Uint8Array(turned.subarray(body)).buffer);
  return splats.map((_, index) => ({ position: Array.from(floats.subarray(index * 14, index * 14 + 3)),
    rotation: Array.from(floats.subarray(index * 14 + 10, index * 14 + 14)) }));
}
const compressedSplat = compressedFixture(700);
const compressedDigest = `sha256:${createHash("sha256").update(compressedSplat).digest("hex")}`;

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
  // The compressed writer's record: every one of 2,000,000 Gaussians in 32,563,153 bytes.
  const compressed = { ...vector, format: "ply_3dgs_compressed_sh0", size_bytes: 32563153, gaussian_count: 2000000,
    preview_digest: "sha256:54b6497e9c4c853d43b8c07790d786711ebe87b38502ab7cca515768fb4e0218" };
  expect(websiteScenePreviewDigestValid(websiteScenePreviewSchema.parse(compressed))).toBe(true);
  expect(websiteScenePreviewSchema.safeParse({ ...compressed, format: "spz" }).success).toBe(false);
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

describe("a compressed scene preview (every Gaussian under the cap)", () => {
  it("turns each splat exactly as the float path turns it, on the packed integers", () => {
    const decoded = decodeCompressed(compressedSplat);
    const turned = orientPlyForViewer(Buffer.from(compressedSplat));
    const header = compressedSplat.indexOf("end_header\n") + "end_header\n".length;
    expect(turned.subarray(0, header)).toEqual(compressedSplat.subarray(0, header));
    const after = decodeCompressed(turned), reference = floatTurned(decoded);
    expect(after).toHaveLength(700);
    after.forEach((splat, index) => {
      // x and y negate within the swapped chunk bounds; z stays.
      splat.position.forEach((value, axis) => expect(value).toBeCloseTo(reference[index]!.position[axis]!, 5));
      expect(splat.position[2]).toBe(decoded[index]!.position[2]);
      // The same rotation as Rz(180°)·q, up to the sign the viewer's largest-is-positive packing picks.
      const sign = Math.sign(splat.rotation.reduce((sum, value, axis) => sum + value * reference[index]!.rotation[axis]!, 0));
      expect(Math.abs(sign)).toBe(1);
      splat.rotation.forEach((value, axis) => expect(sign * value).toBeCloseTo(reference[index]!.rotation[axis]!, 6));
      // Scale and colour are untouched.
      expect(splat.scale).toEqual(decoded[index]!.scale);
      expect(splat.colour).toEqual(decoded[index]!.colour);
    });
    // Every stored largest index and both rotation signs were exercised.
    const vertex = (ply: Buffer, index: number, field: number) => ply.readUInt32LE(header + 3 * 72 + (index * 4 + field) * 4);
    expect(new Set(decoded.map((_, index) => vertex(compressedSplat, index, 1) >>> 30))).toEqual(new Set([0, 1, 2, 3]));
    // Turned twice is the splat itself, byte for byte (a chunk whose y bounds meet included).
    expect(orientPlyForViewer(Buffer.from(turned))).toEqual(compressedSplat);
    // Bounds swap exactly; scale and colour bounds and packed scale and colour stay.
    for (let index = 0; index < 3; index += 1) {
      const bound = (ply: Buffer, field: number) => ply.readFloatLE(header + (index * 18 + field) * 4);
      expect([0, 1, 3, 4].map(field => bound(turned, field))).toEqual([3, 4, 0, 1].map(field => -bound(compressedSplat, field)));
      for (let field = 2; field < 18; field += 1) if (![3, 4].includes(field)) expect(bound(turned, field)).toBe(bound(compressedSplat, field));
    }
    for (let index = 0; index < 700; index += 1) {
      expect([2, 3].map(field => vertex(turned, index, field))).toEqual([2, 3].map(field => vertex(compressedSplat, index, field)));
    }
  });

  it("turns a compressed splat the same way however it arrives in pieces", async () => {
    const expected = orientPlyForViewer(Buffer.from(compressedSplat));
    const turned = async (piece: number) => {
      const pieces: Buffer[] = [], out: Buffer[] = [];
      for (let offset = 0; offset < compressedSplat.length; offset += piece)
        pieces.push(Buffer.from(compressedSplat.subarray(offset, offset + piece)));
      await pipeline(Readable.from(pieces), plyViewerOrientationStream(),
        new Writable({ write(chunk: Buffer, _encoding, done) { out.push(Buffer.from(chunk)); done(); } }));
      return Buffer.concat(out);
    };
    for (const piece of [1, 5, 16, 71, 72, 73, 1000, compressedSplat.length]) expect(await turned(piece)).toEqual(expected);
    const discard = () => new Writable({ write(_chunk, _encoding, done) { done(); } });
    // Copies: the stream turns in place.
    await expect(pipeline(Readable.from([Buffer.from(compressedSplat.subarray(0, compressedSplat.length - 1))]), plyViewerOrientationStream(),
      discard())).rejects.toThrow("ply_size_mismatch");
    await expect(pipeline(Readable.from([Buffer.concat([compressedSplat, Buffer.alloc(16)])]), plyViewerOrientationStream(),
      discard())).rejects.toThrow("ply_size_mismatch");
  });

  it("refuses any other chunked layout rather than turn it wrongly", () => {
    const body = (chunks: number, count: number) => Buffer.alloc(chunks * 72 + count * 16);
    const refused = (header: string, chunks = 1, count = 2) => expect(() =>
      orientPlyForViewer(Buffer.concat([Buffer.from(header, "latin1"), body(chunks, count)]))).toThrow("ply_properties_unsupported");
    expect(orientPlyForViewer(Buffer.concat([Buffer.from(compressedHeader(1, 2), "latin1"), body(1, 2)])).length).toBeGreaterThan(0);
    // Spherical harmonics, a chunk without colour bounds, reordered, retyped or misnamed properties.
    refused(compressedHeader(1, 2, { extra: "element sh 2\nproperty uchar f_rest_0\n" }));
    refused(compressedHeader(1, 2, { chunkProperties: CHUNK_PROPERTIES.slice(0, 12).map(name => `float ${name}`) }));
    refused(compressedHeader(1, 2, { chunkProperties: [...CHUNK_PROPERTIES].reverse().map(name => `float ${name}`) }));
    refused(compressedHeader(1, 2, { vertexProperties: VERTEX_PROPERTIES.map(name => `int ${name}`) }));
    refused(compressedHeader(1, 2, { vertexProperties: ["uint packed_position", "uint packed_scale", "uint packed_rotation",
      "uint packed_color"] }));
    refused(compressedHeader(1, 2, { vertexProperties: [...VERTEX_PROPERTIES, "packed_extra"].map(name => `uint ${name}`) }));
    // Chunk counts that are not ceil(count / 256), and elements in another order.
    refused(compressedHeader(2, 2), 2, 2);
    refused(compressedHeader(1, 257), 1, 257);
    refused(`ply\nformat binary_little_endian 1.0\nelement vertex 2\n${VERTEX_PROPERTIES.map(name => `property uint ${name}\n`).join("")}`
      + `element chunk 1\n${CHUNK_PROPERTIES.map(name => `property float ${name}\n`).join("")}end_header\n`);
  });

  it("stores and serves a compressed preview, turned, through the same viewer route", async () => {
    seed();
    const preview = sealed({ format: "ply_3dgs_compressed_sh0", digest: compressedDigest, size_bytes: compressedSplat.length,
      gaussian_count: 700 });
    expect((await publish(preview)).status).toBe(200);
    expect(state.docs.get(SESSION)?.scene_preview).toEqual(preview);
    expect((await publish(sealed({ format: "ply_3dgs_spz" }))).status).toBe(400);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(compressedSplat)));
    const scene = new URL(websiteScenePreviewViewerUrl("req1", "walkthrough-req1")!, "https://tryblueprint.io").searchParams.get("content")!;
    const served = await realFetch(`${base}${scene}`);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer())).toEqual(orientPlyForViewer(Buffer.from(compressedSplat)));
  });
});
