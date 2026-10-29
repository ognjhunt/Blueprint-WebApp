/** Resume admitted browser footage on the existing worker, without a customer return visit. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { authorizeCaptureUpload } from "./captureUploadAuthorization";
import { loadWebsiteCaptureRights } from "./websiteTaskContext";
import { isWebsiteCaptureId } from "./websiteCaptureIdentity";
import { validateCaptureSupplement } from "./captureSupplement";
import { parseVideoMetadata } from "./browserCaptureManifest";
import { browserCaptureProcessingCurrent, finishStoredCapture, writeCompletionMarker } from "./browserCaptureProcessing";
import { browserPendingDecisionKey, loadBrowserPending, loadBrowserStoredUpload,
  releaseBrowserUpload, reserveBrowserStoredUploadRetry, storedCapturePrivacyCleared,
  type BrowserWriteReservation } from "./websiteBrowserPending";
import { originalManifestConsent, verifiedPendingManifest, verifiedStoredVideo } from "./websiteBrowserUploadStatus";
import { resumeHeldPrivacyScreen } from "./capturePrivacyResume";

let activePass: Promise<RecoverySummary> | null = null;
type RecoverySummary = { processedCount: number; blockedCount: number; failedCount: number };

/** The existing outbox tick owns the cadence. No new service, timer or grant. */
export function tickBrowserCaptureProcessing() {
  void reconcileBrowserCaptureProcessing().catch(error => logger.warn({ error }, "Retained video recovery will retry"));
}

export function reconcileBrowserCaptureProcessing({ perKindLimit = 1 }: { perKindLimit?: number } = {}): Promise<RecoverySummary> {
  if (!activePass) activePass = recover(Math.max(1, Math.min(10, Math.floor(perKindLimit) || 1)))
    .finally(() => { activePass = null; });
  return activePass;
}

async function recover(limit: number): Promise<RecoverySummary> {
  const summary = { processedCount: 0, blockedCount: 0, failedCount: 0 };
  if (!db) return summary;
  const seen = new Set<string>();
  // Each durable cursor gets a slot, so an unavailable original cannot starve
  // a source already admitted to the held-marker path (or vice versa).
  for (const kind of ["stored", "held"] as const) {
    const query = kind === "stored"
      ? db.collection("captureUploadSessions").where("browser_stored_upload.schema_version", "==", "website_browser_stored_upload.v1")
      : db.collection("captureUploadSessions").where("browser_pending_delivery.state", "==", "held");
    let rows = await automationBatch(db, query, `browser_capture_${kind}_recovery`, limit);
    if (!rows.docs.length) rows = await automationBatch(db, query, `browser_capture_${kind}_recovery`, limit);
    for (const row of rows.docs) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      let reservation: BrowserWriteReservation | null = null;
      try {
        const stored = kind === "stored" ? await loadBrowserStoredUpload(row.id) : null;
        const pending = kind === "held" ? await loadBrowserPending(row.id) : null;
        const source = stored ?? pending;
        if (!source || source.capture_id !== row.id || !isWebsiteCaptureId(source.request_id, source.scene_id, source.capture_id)
          || stored?.probe_failure === "video_unreadable") { summary.blockedCount++; continue; }
        const payload = { requestId: source.request_id, sceneId: source.scene_id, captureId: source.capture_id };
        if (!await browserCaptureProcessingCurrent(payload)) { summary.blockedCount++; continue; }
        if (payload.captureId.startsWith("supplement-")) {
          const link = (await db.collection("captureSupplements").doc(payload.captureId).get()).data();
          if (!link?.supplement) { summary.blockedCount++; continue; }
          await validateCaptureSupplement({ ...payload, supplement: link.supplement });
        }
        const [authorization, rights] = await Promise.all([
          authorizeCaptureUpload(payload.requestId), loadWebsiteCaptureRights(payload.requestId),
        ]);
        const manifest = stored?.manifest_json ?? (pending ? await verifiedPendingManifest(pending) : null);
        if (!authorization.allowed || !rights.derived_scene_generation_allowed || !manifest || !originalManifestConsent(manifest)
          || !await verifiedStoredVideo(source.video)) { summary.blockedCount++; continue; }
        if (stored) {
          reservation = await reserveBrowserStoredUploadRetry(stored);
          const original = JSON.parse(manifest);
          const metadata = parseVideoMetadata({ widthPx: original.width, heightPx: original.height,
            fps: original.fps_source, durationSeconds: original.duration_seconds, recordedAtEpochMs: original.capture_start_epoch_ms });
          if (!metadata && original.media_probe_pending !== true) throw new Error("browser_pending_invalid");
          const outcome = await finishStoredCapture({ payload, objectPath: source.video.object_name,
            rawPrefix: source.video.object_name.slice(0, source.video.object_name.lastIndexOf("/")),
            videoMetadata: metadata, sizeBytes: source.video.size_bytes, video: source.video,
            reservation, storedUpload: stored });
          if (outcome.body.state === "processing_ready") summary.processedCount++;
          else if (outcome.body.state === "held") summary.blockedCount++;
          else summary.failedCount++;
        } else if (pending?.state === "held") {
          const producerSource = { kind: "browser_pending" as const, key: browserPendingDecisionKey(pending) };
          const resumed = await resumeHeldPrivacyScreen({ ...payload, producerSource });
          if ((resumed.action === "cleared" && resumed.result.proceed)
            || await storedCapturePrivacyCleared(payload.requestId, payload.captureId, producerSource)) {
            await writeCompletionMarker(pending);
            summary.processedCount++;
          } else summary.blockedCount++;
        }
      } catch (error) {
        if (["browser_pending_conflict", "browser_pending_changed", "capture_update_superseded"].includes((error as Error).message))
          summary.blockedCount++;
        else {
          summary.failedCount++;
          logger.warn({ error, captureId: row.id }, "Retained browser video could not finish on this pass");
        }
      } finally {
        if (reservation) await releaseBrowserUpload(reservation).catch(() => undefined);
      }
    }
  }
  return summary;
}
