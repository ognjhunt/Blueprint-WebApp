/** Shared completion for a retained browser recording. HTTP and worker use the same writer. */
import { createHash } from "node:crypto";
import { dbAdmin, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { buildBrowserCaptureManifest, type BrowserVideoMetadata } from "./browserCaptureManifest";
import { probeCaptureVideo, probeStoredCaptureVideo, VideoProbeError } from "./selfCaptureMediaMetadata";
import { authorizeCaptureUpload } from "./captureUploadAuthorization";
import { getBrief } from "./siteTaskBrief";
import { loadWebsiteCaptureRights } from "./websiteTaskContext";
import { enqueueTaskLifecycleNotification } from "./taskLifecycleNotifications";
import { notifySlackFootageNeedsReview } from "./slack";
import { screenCaptureForPrivacy } from "./capturePrivacyScreen";
import { claimCapturePrivacyScreen, recordCapturePrivacyScreen, releaseCapturePrivacyScreenClaim } from "./capturePrivacyRecord";
import { enqueueCoverageReview } from "./captureCoverageQueue";
import { buildBrowserDelivery, capturedWriteIdentity, captureWriteFailureDiagnostic, publishBrowserDelivery,
 type WrittenObject, type WrittenManifest, type CaptureWriteStage } from "./websiteCaptureDelivery";
import { browserPendingDecisionKey, publishBrowserPending, recordBrowserPending, recordBrowserStoredUpload,
 completeBrowserStoredUploadProbe, recordBrowserVideoProbeFailure, loadBrowserPending,
 type BrowserStoredUpload, type BrowserPending, type BrowserWriteReservation } from "./websiteBrowserPending";
import { verifiedStoredVideo, originalManifestConsent, verifiedPendingManifest, describeBrowserUpload } from "./websiteBrowserUploadStatus";

type CaptureIdentity = { requestId: string; sceneId: string; captureId: string };
const storageBucketName = () => process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";

/** An unfinished update may follow its selected parent, but never a newer sibling. */
export async function browserCaptureProcessingCurrent(payload: CaptureIdentity): Promise<boolean> {
  if (!dbAdmin) return false;
  const snapshot = await dbAdmin.collection("inboundRequests").doc(payload.requestId).get();
  if (!snapshot.exists) return false;
  const selected = snapshot.data()?.active_capture_id;
  if (payload.captureId.startsWith("supplement-")) {
    const link = (await dbAdmin.collection("captureSupplements").doc(payload.captureId).get()).data();
    return link?.requestId === payload.requestId && link.sceneId === payload.sceneId && link.captureId === payload.captureId
      && (!selected || selected === payload.captureId || selected === link.supplement?.parent_capture_id);
  }
  return !selected || selected === payload.captureId;
}

async function assertCurrent(payload: CaptureIdentity) {
  if (!await browserCaptureProcessingCurrent(payload)) throw new Error("capture_update_superseded");
}

export async function currentObjectGeneration(bucket: ReturnType<NonNullable<typeof storageAdmin>["bucket"]>,
  objectPath: string): Promise<number | string> {
  try {
    const [metadata] = await bucket.file(objectPath).getMetadata();
    return capturedWriteIdentity(objectPath, metadata).generation;
  } catch (error) {
    if ((error as { code?: unknown })?.code === 404) return 0;
    throw error;
  }
}

export const processingPendingMessage = "Your video is saved. We could not confirm that processing started. You do not need to upload or record it again.";

export async function retainedProcessingFailure(video: WrittenObject, retryAvailable: boolean, payload: CaptureIdentity) {
  let retained = false;
  try { retained = await verifiedStoredVideo(video); } catch { /* Retention stays unconfirmed. */ }
  const authorization = await authorizeCaptureUpload(payload.requestId);
  const status = await describeBrowserUpload(payload, authorization.allowed);
  const hold = authorization.allowed ? status.processingHold : {
    code: authorization.holdReason ?? "capture_held",
    detail: authorization.detail ?? "Your video is saved. Processing is on hold for this site.",
  };
  return { status: retained && hold ? 409 : 502, body: retained ? {
    error: hold?.detail ?? processingPendingMessage, message: hold?.detail ?? processingPendingMessage,
    state: hold ? "held" : "processing_pending", captureReceived: true,
    ...(hold ? { code: hold.code, detail: hold.detail } : {}),
    processingRetryAvailable: retryAvailable && status.processingRetryAvailable,
  } : {
    error: "We could not confirm whether your video was saved. Keep the original file and check this upload link before sending it again.",
    state: "status_unavailable", captureReceived: false, processingRetryAvailable: false,
  } };
}

export async function writeCompletionMarker(pending: BrowserPending): Promise<void> {
  if (!storageAdmin) throw new Error("Storage is unavailable");
  await assertCurrent({ requestId: pending.request_id, sceneId: pending.scene_id, captureId: pending.capture_id });
  const [authorization, rights] = await Promise.all([
    authorizeCaptureUpload(pending.request_id), loadWebsiteCaptureRights(pending.request_id),
  ]);
  if (!authorization.allowed || !rights.derived_scene_generation_allowed)
    throw new Error("capture_processing_not_authorized");
  const manifest = await verifiedPendingManifest(pending);
  if (!manifest || !originalManifestConsent(manifest)) throw new Error("capture_processing_not_authorized");
  const current = await loadBrowserPending(pending.capture_id);
  if (!current || current.video.generation !== pending.video.generation
      || current.manifest.generation !== pending.manifest.generation
      || current.completed_at_iso !== pending.completed_at_iso) {
    throw new Error("browser_pending_changed");
  }
  const rawPrefix = pending.video.object_name.slice(0, pending.video.object_name.lastIndexOf("/"));
  const delivery = buildBrowserDelivery({
    requestId: pending.request_id, sceneId: pending.scene_id,
    captureId: pending.capture_id, rawPrefix, video: pending.video,
    manifest: pending.manifest, completedAtIso: pending.completed_at_iso,
  });
  await enqueueCoverageReview({ requestId: pending.request_id, sceneId: pending.scene_id, captureId: pending.capture_id });
  await publishBrowserDelivery(storageAdmin.bucket(storageBucketName()), delivery);
  await publishBrowserPending(pending);
}

/**
 * Everything that happens once the bytes are in the bucket.
 *
 * A single POST, composed resumable parts, and background recovery all use
 * the same completion sequence. The
 * sequence it owns is load-bearing in two places:
 *
 * - **Manifest before marker.** The marker starts extraction and extraction
 *   reads the manifest, so the reverse order produces a blocked report rather
 *   than a scene.
 * - **Source-bound privacy decision between them.** Preserve the existing
 *   decision receipt and current consent before starting downstream work.
 */
export async function finishStoredCapture(params: {
  payload: { requestId: string; sceneId: string; captureId: string };
  objectPath: string;
  rawPrefix: string;
  videoMetadata: BrowserVideoMetadata | null;
  probeFilePath?: string;
  sizeBytes: number;
  video: WrittenObject;
  reservation: BrowserWriteReservation;
  storedUpload?: BrowserStoredUpload;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { payload, objectPath, rawPrefix } = params;
  await assertCurrent(payload);

  if (!storageAdmin) {
    return {
      status: 503,
      body: { error: "Uploads are unavailable right now. Try again shortly." },
    };
  }
  const bucket = storageAdmin.bucket(storageBucketName());
  if (params.video.object_name !== objectPath || params.video.size_bytes !== params.sizeBytes) {
    return { status: 409, body: { error: "The stored video does not match this upload.", code: "video_identity_mismatch" } };
  }
  const currentAuthority = await authorizeCaptureUpload(payload.requestId);
  if (!currentAuthority.allowed) {
    // A retry reuses an earlier retained source; withdrawn authority cannot
    // turn that replay into deletion of the original upload.
    if (params.storedUpload) return retainedProcessingFailure(params.video, false, payload);
    if (currentAuthority.holdReason === "recording_consent_required") {
      // Delete only the exact generation this request just wrote; never a replacement.
      await bucket.file(objectPath, { generation: params.video.generation,
        preconditionOpts: { ifGenerationMatch: params.video.generation } }).delete({ ignoreNotFound: true });
    }
    return { status: 409, body: { code: currentAuthority.holdReason, error: currentAuthority.detail } };
  }

  let pending: BrowserPending;
  let storedUpload = params.storedUpload;
  let journalRecorded = Boolean(storedUpload);
  let captureWriteStage: CaptureWriteStage = "task_context_read";
  try {
    if (!storedUpload) {
      // Keep the exact server-built manifest with the observed write response.
      // A manifest-write retry must not fabricate measurements or rebuild the
      // original consent/task snapshot from a later state.
      const brief = await getBrief(payload.requestId);
      captureWriteStage = "capture_rights_read";
      const captureRights = await loadWebsiteCaptureRights(payload.requestId);
      captureWriteStage = "manifest_build";
      const firstReceivedAtIso = new Date().toISOString();
      const manifestJson = JSON.stringify(buildBrowserCaptureManifest({ payload,
        objectPath, video: params.videoMetadata, sizeBytes: params.sizeBytes,
        captureRights, firstReceivedAtIso,
        taskContext: { description: brief?.summary ?? "", confirmed: Boolean(brief?.confirmedAtIso),
          confirmed_at: brief?.confirmedAtIso ?? null },
      }), null, 2);
      storedUpload = { schema_version: "website_browser_stored_upload.v1",
        request_id: payload.requestId, scene_id: payload.sceneId, capture_id: payload.captureId,
        completed_at_iso: firstReceivedAtIso, video: params.video,
        manifest_json: manifestJson,
        manifest_sha256: `sha256:${createHash("sha256").update(manifestJson).digest("hex")}` };
      captureWriteStage = "stored_upload_record";
      await recordBrowserStoredUpload(storedUpload, params.reservation);
      journalRecorded = true;
    }
    captureWriteStage = "stored_video_verify";
    if (!(await verifiedStoredVideo(storedUpload.video))) throw new Error("browser_delivery_source_changed");
    if (JSON.parse(storedUpload.manifest_json).media_probe_pending === true) {
      if (!originalManifestConsent(storedUpload.manifest_json)) throw new Error("source_revoked");
      try {
        const options = { receivedAtEpochMs: Date.parse(storedUpload.completed_at_iso) };
        const measured = params.probeFilePath ? await probeCaptureVideo(params.probeFilePath, options)
          : await probeStoredCaptureVideo(storedUpload.video, () => bucket.file(storedUpload!.video.object_name,
            { generation: storedUpload!.video.generation }).createReadStream(), options);
        storedUpload = await completeBrowserStoredUploadProbe(storedUpload, measured, params.reservation);
      } catch (error) {
        if (error instanceof VideoProbeError && error.code === "video_unreadable")
          await recordBrowserVideoProbeFailure(storedUpload, params.reservation);
        throw error;
      }
    }
    const manifestName = `${rawPrefix}/manifest.json`;
    const manifestBytes = Buffer.from(storedUpload.manifest_json);
    const manifestFile = bucket.file(manifestName);
    captureWriteStage = "manifest_generation_read";
    const priorManifest = await currentObjectGeneration(bucket, manifestName);
    captureWriteStage = "manifest_write";
    await manifestFile.save(manifestBytes, { contentType: "application/json",
      preconditionOpts: { ifGenerationMatch: priorManifest } });
    captureWriteStage = "manifest_identity";
    const written = capturedWriteIdentity(manifestName, manifestFile.metadata);
    if (written.size_bytes !== manifestBytes.length) throw new Error("browser_manifest_write_unverified");
    const manifestIdentity: WrittenManifest = { ...written,
      sha256: `sha256:${createHash("sha256").update(manifestBytes).digest("hex")}` };
    captureWriteStage = "pending_record";
    pending = await recordBrowserPending({
      schema_version: "website_browser_pending.v1", request_id: payload.requestId,
      scene_id: payload.sceneId, capture_id: payload.captureId, state: "held",
      completed_at_iso: storedUpload.completed_at_iso, video: params.video, manifest: manifestIdentity,
    }, params.reservation);
  } catch (error) {
    logger.error(
      { captureWriteFailure: captureWriteFailureDiagnostic(captureWriteStage, error), captureId: payload.captureId },
      "Self-capture video stored but its exact manifest or pending identity failed",
    );
    return retainedProcessingFailure(params.video, journalRecorded, payload);
  }

  const currentRights = await loadWebsiteCaptureRights(payload.requestId);
  if (!currentRights.derived_scene_generation_allowed || !originalManifestConsent(storedUpload.manifest_json)) {
    return { status: 200, body: { ok: true, state: "held", uploadState: "retained", captureReceived: true,
      processingRetryAvailable: false, code: "capture_processing_not_authorized",
      message: "Your video is saved. Processing is on hold until its existing consent can be verified." } };
  }

  // The manifest is the durable proof that the upload is complete. Notify
  // before privacy review, while saying exactly that review is still pending.
  // A retried completion reaches this call again and repairs a missed enqueue;
  // the outbox key keeps that retry from creating a second message.
  try {
    await enqueueTaskLifecycleNotification({
      requestId: payload.requestId,
      milestone: "video_received",
    });
  } catch (error) {
    logger.warn({ error, requestId: payload.requestId }, "Could not enqueue video-received notice");
  }
  if (!isSiteVideoEvidenceEnabled()) {
    void notifySlackFootageNeedsReview({ requestId: payload.requestId }).catch(() => undefined);
  }

  const producerSource = { kind: "browser_pending" as const, key: browserPendingDecisionKey(pending) };
  await assertCurrent(payload);
  const claim = await claimCapturePrivacyScreen({ requestId: payload.requestId,
    captureId: payload.captureId, producerSource });
  if (!claim) return retainedProcessingFailure(params.video, true, payload);
  let privacy;
  try {
    privacy = await screenCaptureForPrivacy({
      requestId: payload.requestId,
      sceneId: payload.sceneId,
      captureId: payload.captureId,
    });
    await recordCapturePrivacyScreen({
      requestId: payload.requestId,
      captureId: payload.captureId,
      result: privacy,
      producerSource,
      claim,
    });
  } catch (error) {
    await releaseCapturePrivacyScreenClaim(claim);
    throw error;
  }

  if (!privacy.proceed) {
    // 200 and `ok: true`, because the upload genuinely succeeded. Accepting
    // fails open; only deriving fails closed. Telling someone their video
    // failed when we are holding it would send them off to re-film something
    // we already have.
    //
    // The two cases read differently to whoever is looking at them.
    // `rejected` needs a person and asking again will not change it.
    // `pending` is our problem and retries on its own.
    return {
      status: 200,
      body: {
        ok: true,
        captureId: payload.captureId,
        state: "held",
        uploadState: "retained",
        captureReceived: true,
        processingRetryAvailable: privacy.retryable ?? false,
        eligibility: privacy.eligibility,
        retryable: privacy.retryable ?? false,
        code:
          privacy.eligibility === "pending"
            ? "capture_review_unavailable"
            : "capture_privacy_review",
        message: privacy.detail,
      },
    };
  }

  try {
    await writeCompletionMarker(pending);
  } catch (error) {
    // The video is already stored, so this is recoverable by rewriting the
    // marker rather than re-uploading hundreds of megabytes. Say so plainly
    // instead of reporting a success that will never produce a scene.
    logger.error(
      { error, captureId: payload.captureId, sceneId: payload.sceneId },
      "Self-capture video stored but completion marker failed; capture will not extract",
    );
    return retainedProcessingFailure(params.video, true, payload);
  }

  return {
    status: 201,
    body: {
      ok: true,
      captureId: payload.captureId,
      state: "processing_ready",
      uploadState: "processing_ready",
      captureReceived: true,
      processingRetryAvailable: false,
      eligibility: privacy.eligibility,
      message: "Got it. We'll build the scene and come back to you.",
    },
  };
}
