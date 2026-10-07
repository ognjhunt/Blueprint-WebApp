/** Read-only upload evidence shared by the phone receipt and desktop job status. */
import { createHash } from "node:crypto";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { selfCaptureObjectPath } from "./captureUploadToken";
import { buildBrowserDelivery, capturedWriteIdentity, matchesBrowserDeliveryRecord,
  type WrittenObject } from "./websiteCaptureDelivery";
import { loadBrowserPending, loadBrowserStoredUpload, type BrowserPending } from "./websiteBrowserPending";
import { loadWebsiteCaptureRights } from "./websiteTaskContext";

type CaptureIdentity = { requestId: string; sceneId: string; captureId: string };
export const ALLOWED_EXTENSIONS = new Set(["mov", "mp4"]);
function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

/**
 * Find the video a capture already uploaded.
 *
 * The signed token carries the scene and capture ids but not the file
 * extension, and the retry path needs the real object path to name in the
 * marker. Rather than guess, this asks storage what is actually there -- the
 * manifest is written beside the video before the privacy screen runs, so for
 * any capture that can be held, both exist.
 */
export async function resolveStoredObjectPath(
  sceneId: string,
  captureId: string,
): Promise<{ rawPrefix: string; objectPath: string } | null> {
  if (!storageAdmin) throw new Error("Storage is unavailable");
  let readFailure: unknown;
  for (const extension of ALLOWED_EXTENSIONS) {
    const objectPath = selfCaptureObjectPath({ sceneId, captureId, extension });
    try {
      const [metadata] = await storageAdmin.bucket(storageBucketName()).file(objectPath).getMetadata();
      capturedWriteIdentity(objectPath, metadata);
      return { rawPrefix: objectPath.slice(0, objectPath.lastIndexOf("/")), objectPath };
    } catch (error) {
      // A storage error on one candidate extension is not a reason to stop
      // looking at the others, but it cannot prove that nothing is retained.
      if ((error as { code?: unknown })?.code !== 404) readFailure = error;
    }
  }
  if (readFailure) throw readFailure;
  return null;
}

export async function verifiedStoredVideo(video: WrittenObject): Promise<boolean> {
  if (!storageAdmin) throw new Error("Storage is unavailable");
  try {
    const [metadata] = await storageAdmin.bucket(storageBucketName()).file(video.object_name).getMetadata();
    const actual = capturedWriteIdentity(video.object_name, metadata);
    return actual.generation === video.generation && actual.size_bytes === video.size_bytes
      && actual.crc32c === video.crc32c;
  } catch (error) {
    if ((error as { code?: unknown })?.code === 404) return false;
    throw error;
  }
}

export function originalManifestConsent(manifestJson: string): boolean {
  try {
    const rights = JSON.parse(manifestJson).capture_rights;
    return rights?.derived_scene_generation_allowed === true && rights.consent_status === "granted"
      && rights.consent_revoked === false;
  } catch { return false; }
}

/** The saved generation and original grant must still be the selected source. */
export async function verifiedPendingManifest(pending: BrowserPending): Promise<string | null> {
  if (!storageAdmin || !(await verifiedStoredVideo(pending.video))) return null;
  const bucket = storageAdmin.bucket(storageBucketName());
  try {
    const [metadata] = await bucket.file(pending.manifest.object_name).getMetadata();
    const actual = capturedWriteIdentity(pending.manifest.object_name, metadata);
    if (actual.generation !== pending.manifest.generation || actual.size_bytes !== pending.manifest.size_bytes
        || actual.crc32c !== pending.manifest.crc32c || actual.size_bytes > 65_536) return null;
    const [bytes] = await bucket.file(actual.object_name, { generation: actual.generation }).download();
    if (bytes.length !== actual.size_bytes
        || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== pending.manifest.sha256) return null;
    const [after] = await bucket.file(actual.object_name).getMetadata();
    if (capturedWriteIdentity(actual.object_name, after).generation !== actual.generation) return null;
    return bytes.toString("utf8");
  } catch (error) {
    if ((error as { code?: unknown })?.code === 404) return null;
    throw error;
  }
}

/** A published row is not proof that its exact processing signal is still present. */
export async function verifiedPendingMarker(pending: BrowserPending): Promise<boolean> {
  if (!storageAdmin) return false;
  const delivery = buildBrowserDelivery({ requestId: pending.request_id, sceneId: pending.scene_id,
    captureId: pending.capture_id,
    rawPrefix: pending.video.object_name.slice(0, pending.video.object_name.lastIndexOf("/")),
    video: pending.video, manifest: pending.manifest, completedAtIso: pending.completed_at_iso });
  const bucket = storageAdmin.bucket(storageBucketName());
  for (const [name, expected, receipt] of [
    [`${delivery.record.raw_prefix}/capture_upload_complete.json`, delivery.markerBytes, false],
    [delivery.objectName, delivery.recordBytes, true],
  ] as const) {
    try {
      const [metadata] = await bucket.file(name).getMetadata();
      const selected = capturedWriteIdentity(name, metadata);
      if (receipt ? selected.size_bytes > 65_536 : selected.size_bytes !== expected.length) return false;
      const [bytes] = await bucket.file(name, { generation: selected.generation }).download();
      if (bytes.length !== selected.size_bytes
        || (receipt ? !matchesBrowserDeliveryRecord(bytes, delivery.record) : !bytes.equals(expected))) return false;
      const [after] = await bucket.file(name).getMetadata();
      if (capturedWriteIdentity(name, after).generation !== selected.generation) return false;
    } catch (error) {
      if ((error as { code?: unknown })?.code === 404) return false;
      throw error;
    }
  }
  return true;
}

export function belongsToLink(record: { request_id: string; scene_id: string; capture_id: string }, payload: CaptureIdentity) {
  return record.request_id === payload.requestId && record.scene_id === payload.sceneId
    && record.capture_id === payload.captureId;
}

type BrowserUploadStatus = { captureReceived: boolean; uploadState: string; processingRetryAvailable: boolean;
  processingHold?: { code: string; detail: string } };

export async function describeBrowserUpload(payload: CaptureIdentity, allowed: boolean): Promise<BrowserUploadStatus> {
  try {
    const [pending, stored] = await Promise.all([
      loadBrowserPending(payload.captureId), loadBrowserStoredUpload(payload.captureId),
    ]);
    // An interrupted newer write takes precedence over a prior published receipt.
    const source = stored ?? pending;
    if (source) {
      if (!belongsToLink(source, payload) || !(await verifiedStoredVideo(source.video))) {
        return { captureReceived: false, uploadState: "status_unavailable", processingRetryAvailable: false };
      }
      const manifest = stored?.manifest_json ?? (pending ? await verifiedPendingManifest(pending) : null);
      if (!stored && pending?.state === "published" && (manifest === null || !(await verifiedPendingMarker(pending)))) {
        return { captureReceived: true, uploadState: "retained", processingRetryAvailable: false,
          processingHold: { code: "capture_handoff_unverified",
            detail: "Your video is saved. We could not verify its current processing status. Keep the original file while we check it." } };
      }
      const currentRights = await loadWebsiteCaptureRights(payload.requestId);
      const retryAvailable = allowed && currentRights.derived_scene_generation_allowed === true
        && manifest !== null && originalManifestConsent(manifest);
      return { captureReceived: true,
        uploadState: !stored && pending?.state === "published" ? "processing_ready" : "processing_pending",
        processingRetryAvailable: retryAvailable && (Boolean(stored) || pending?.state === "held"),
        ...(!currentRights.derived_scene_generation_allowed || (manifest !== null && !originalManifestConsent(manifest))
          ? { processingHold: { code: "capture_processing_not_authorized",
            detail: "Your video is saved. Processing is on hold until its existing consent can be verified." } } : {}),
      };
    }
    // Older uploads have no generation-bound producer receipt. Presence proves
    // retention only; it cannot grant an automatic processing retry.
    const retained = await resolveStoredObjectPath(payload.sceneId, payload.captureId);
    const rights = retained ? await loadWebsiteCaptureRights(payload.requestId) : null;
    return { captureReceived: Boolean(retained), uploadState: retained ? "retained" : "not_received",
      processingRetryAvailable: false,
      ...(rights && !rights.derived_scene_generation_allowed ? {
        processingHold: { code: "capture_processing_not_authorized",
          detail: "Your video is saved. Processing is on hold until its existing consent can be verified." },
      } : {}),
    };
  } catch {
    return { captureReceived: false, uploadState: "status_unavailable", processingRetryAvailable: false };
  }
}
