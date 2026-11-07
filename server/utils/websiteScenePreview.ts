/**
 * "View your scene" on a site's own job page (owner ask 2026-11-07).
 *
 * The Pipeline turns the scene it built from the site's video (the Atlas base scene, or
 * the finished reconstruction before it) into a down-sampled splat and publishes it
 * through the channel that writes `world_reconstruction` onto the capture session: a
 * signed callback in internal-capture-worlds.ts. Only the preview's identity is stored, at
 * `captureUploadSessions/{captureId}.scene_preview`; the bytes stay private with the
 * Pipeline. The vendored viewer fetches them once through the signed Pipeline read, behind
 * a 15-minute ticket that only the job's owner link mints. Film-only links get nothing.
 *
 * Rights are re-read on every view, so a withdrawal stops serving at once; the withdrawal
 * drops this instance's cached copy, and the deletion worker deletes the stored reference
 * (websiteCaptureDeletion.ts). Development-only: never a measurement, task or robot claim.
 */
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { DEFAULT_VIEWER_SETTINGS, plyViewerOrientationStream, WEBSITE_ATLAS_PREVIEW_VIEW_ROUTE } from "./websiteAtlasPreviewView";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

/** The capture session field the callback writes, beside `world_reconstruction`. */
export const SCENE_PREVIEW_FIELD = "scene_preview";
/** The Pipeline's size cap (website_scene_preview.MAX_PREVIEW_BYTES); anything larger is refused. */
export const MAX_SCENE_PREVIEW_BYTES = 32 * 1024 * 1024;
/** The view query value that selects this preview on the shared viewer route. */
export const SCENE_PREVIEW_VIEW_SOURCE = "scene";
const VIEW_TICKET_DOMAIN = "website_scene_preview_view";
const CACHE_ROOT = path.join(tmpdir(), "blueprint-scene-preview-views");

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const coordinate = z.number().finite().min(-1e6).max(1e6);
const point = z.tuple([coordinate, coordinate, coordinate]);

export const websiteScenePreviewSchema = z.object({
  schema_version: z.literal("website_scene_preview.v1"),
  capture_id: z.string().regex(WEBSITE_ATLAS_CAPTURE_ID),
  scene_revision: sha,
  state: z.literal("ready"),
  /** Which retained scene it came from; any source kind, never a path. */
  source_kind: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  format: z.literal("ply_3dgs_sh0"),
  coordinate_frame: z.literal("right_up_back_y_up"),
  digest: sha,
  size_bytes: z.number().int().positive().max(MAX_SCENE_PREVIEW_BYTES),
  gaussian_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  source_gaussian_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  start_view: z.object({ position: point, target: point }).strict().nullable(),
  claim_ceiling: z.literal("development_only"),
  updated_at_epoch: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  preview_digest: sha,
}).strict();
export type WebsiteScenePreview = z.infer<typeof websiteScenePreviewSchema>;

/** `preview_digest` is the cross-runtime digest of every other field. */
export function websiteScenePreviewDigestValid(preview: WebsiteScenePreview) {
  try { return crossRuntimeArtifactDigest(preview, "preview_digest") === preview.preview_digest; }
  catch { return false; }
}

/** Every read re-verifies the stored entry; an invalid one is never shown or served. */
function verifiedScenePreview(value: unknown, captureId: string) {
  const parsed = websiteScenePreviewSchema.safeParse(value);
  return parsed.success && parsed.data.capture_id === captureId && websiteScenePreviewDigestValid(parsed.data)
    ? parsed.data : null;
}

/**
 * Store the Pipeline's signed preview on the capture session. Only while the site's rights
 * allow derived scene generation, only for a capture of this job that has a session, and
 * idempotently: the same revision and digest is a replay, the same revision with another
 * digest is `idempotency_conflict`, and an older preview than the stored one is
 * `website_scene_preview_stale`.
 */
export async function recordWebsiteScenePreview(requestId: string, sceneId: string, captureId: string,
  preview: WebsiteScenePreview) {
  if (!db) throw new Error("website_scene_preview_store_unavailable");
  const store = db;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || sceneId !== `site-${requestId}` || preview.capture_id !== captureId)
    throw new Error("task_context_capture_mismatch");
  if (!websiteScenePreviewDigestValid(preview)) throw new Error("website_scene_preview_digest_invalid");
  const binding = await resolveWebsiteCaptureBinding(requestId, sceneId, captureId);
  return storeTimeout(store.runTransaction(async transaction => {
    const requestRef = store.collection("inboundRequests").doc(requestId);
    const sessionRef = store.collection("captureUploadSessions").doc(captureId);
    const request = await transaction.get(requestRef);
    const session = await transaction.get(sessionRef);
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, binding);
    const record = request.data();
    if (!request.exists || !record) throw new Error("website_scene_preview_request_missing");
    if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) throw new Error("source_revoked");
    if (!session.exists) throw new Error("website_scene_preview_capture_missing");
    const prior = verifiedScenePreview(session.data()?.[SCENE_PREVIEW_FIELD], captureId);
    if (prior && prior.scene_revision === preview.scene_revision) {
      if (prior.preview_digest !== preview.preview_digest) throw new Error("idempotency_conflict");
    } else if (prior && preview.updated_at_epoch < prior.updated_at_epoch) {
      throw new Error("website_scene_preview_stale");
    } else {
      transaction.set(sessionRef, { [SCENE_PREVIEW_FIELD]: preview, updated_at_iso: new Date().toISOString() },
        { merge: true });
    }
    return { schema_version: "website_scene_preview_acceptance.v1", accepted: true as const,
      scene_revision: preview.scene_revision, preview_digest: preview.preview_digest };
  }));
}

/** The stored preview of this capture, verified; the caller checks rights. */
export function storedWebsiteScenePreview(session: Record<string, any> | undefined, captureId: string) {
  return verifiedScenePreview(session?.[SCENE_PREVIEW_FIELD], captureId);
}

/** The preview a job page may show: rights still allow it and the stored entry verifies. */
export function viewableWebsiteScenePreview(record: Record<string, any> | undefined,
  session: Record<string, any> | undefined, captureId: string) {
  if (!record || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed) return null;
  return verifiedScenePreview(session?.[SCENE_PREVIEW_FIELD], captureId);
}

/**
 * The viewer page with a 15-minute view ticket for exactly this job and capture. The splat is
 * served by the viewer's existing route, selected by `source=scene`, so the vendored viewer and
 * its host page are unchanged.
 */
export function websiteScenePreviewViewerUrl(requestId: string, captureId: string, nowSeconds?: number) {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)) return null;
  const ticket = createSignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ source: SCENE_PREVIEW_VIEW_SOURCE, expires: String(ticket.expires),
    signature: ticket.signature });
  const content = `${WEBSITE_ATLAS_PREVIEW_VIEW_ROUTE}/${encodeURIComponent(requestId)}/${encodeURIComponent(captureId)}/scene.ply?${query}`;
  return `/splat-viewer/index.html?${new URLSearchParams({ content })}`;
}

export function verifyWebsiteScenePreviewViewTicket(requestId: string, captureId: string,
  expires: unknown, signature: unknown, nowSeconds?: number) {
  return verifySignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId], expires, signature, nowSeconds);
}

/** The Pipeline's start view, else the package defaults. Coordinates are the splat's own. */
export function viewerSettingsFromStartView(view: WebsiteScenePreview["start_view"]) {
  if (!view || view.position.every((value, axis) => value === view.target[axis])) return DEFAULT_VIEWER_SETTINGS;
  return { ...DEFAULT_VIEWER_SETTINGS, cameras: [{ initial: { position: [...view.position], target: [...view.target], fov: 70 } }] };
}

const preparing = new Map<string, Promise<{ splat: string; settings: string }>>();

/**
 * The preview's splat (turned for the viewer, as the Atlas preview's is) and its start view
 * as local files, fetched once through the signed Pipeline read, checked against the stored
 * digest and size on the way, and cached per job, capture and digest. Never held in memory.
 */
export async function websiteScenePreviewViewerFiles(requestId: string, captureId: string, preview: WebsiteScenePreview) {
  const digestHex = /^sha256:([a-f0-9]{64})$/.exec(preview.digest)?.[1];
  if (!digestHex || !WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    || !(preview.size_bytes > 0 && preview.size_bytes <= MAX_SCENE_PREVIEW_BYTES)) throw new Error("website_scene_preview_invalid");
  const directory = path.join(CACHE_ROOT, requestId, captureId);
  const files = { splat: path.join(directory, `${digestHex}.viewer-v1.ply`),
    settings: path.join(directory, `${digestHex}.viewer-v1.settings.json`) };
  if ((await stat(files.splat).catch(() => null))?.isFile() && (await stat(files.settings).catch(() => null))?.isFile()) return files;
  const key = `${requestId}/${captureId}/${digestHex}`;
  const pending = preparing.get(key);
  if (pending) return pending;
  const job = prepareViewerFiles(requestId, captureId, preview, digestHex, directory, files).finally(() => preparing.delete(key));
  preparing.set(key, job);
  return job;
}

async function prepareViewerFiles(requestId: string, captureId: string, preview: WebsiteScenePreview, digestHex: string,
  directory: string, files: { splat: string; settings: string }) {
  const origin = signedWebsitePipelineRequest(`/api/live-pipeline/website-scene-previews/${encodeURIComponent(captureId)}/scene.ply`,
    "", { request_id: requestId, digest: preview.digest });
  if (!origin) throw new Error("website_scene_preview_delivery_not_configured");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const attempt = randomUUID();
  const partial = { splat: `${files.splat}.${attempt}.partial`, settings: `${files.settings}.${attempt}.partial` };
  try {
    const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("website_scene_preview_unavailable");
    }
    const hash = createHash("sha256");
    let received = 0;
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), new Transform({
      transform(chunk: Buffer, _encoding, done) {
        received += chunk.length;
        if (received > preview.size_bytes) return done(new Error("website_scene_preview_mismatch"));
        hash.update(chunk);
        done(null, chunk);
      },
    }), plyViewerOrientationStream(), createWriteStream(partial.splat, { flags: "wx", mode: 0o600 }));
    if (received !== preview.size_bytes || hash.digest("hex") !== digestHex) throw new Error("website_scene_preview_mismatch");
    await writeFile(partial.settings, JSON.stringify(viewerSettingsFromStartView(preview.start_view)), { flag: "wx", mode: 0o600 });
    await rename(partial.settings, files.settings);
    await rename(partial.splat, files.splat);
  } finally {
    await Promise.all([partial.splat, partial.settings].map(file => rm(file, { force: true })));
  }
  return files;
}

/** Drop every cached copy of this job's scene previews on this instance. */
export async function forgetWebsiteScenePreviews(requestId: string) {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId)) return;
  await rm(path.join(CACHE_ROOT, requestId), { recursive: true, force: true });
}

/**
 * Withdrawal deletion: remove the stored preview reference from each named capture session
 * of this job, and this instance's cached copies. Returns the captures that held one.
 */
export async function deleteWebsiteScenePreviews(requestId: string, captureIds: string[]) {
  if (!db) throw new Error("website_scene_preview_store_unavailable");
  const store = db;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId)) throw new Error("website_deletion_request_invalid");
  const cleared: string[] = [];
  for (const captureId of [...new Set(captureIds)].filter(id => WEBSITE_ATLAS_CAPTURE_ID.test(id))) {
    const removed = await store.runTransaction(async transaction => {
      const ref = store.collection("captureUploadSessions").doc(captureId);
      const session = await transaction.get(ref);
      if (!session.exists || session.data()?.[SCENE_PREVIEW_FIELD] === undefined) return false;
      transaction.set(ref, { [SCENE_PREVIEW_FIELD]: admin.firestore.FieldValue.delete() }, { merge: true });
      return true;
    });
    if (removed) cleared.push(captureId);
  }
  await forgetWebsiteScenePreviews(requestId);
  return cleared;
}
