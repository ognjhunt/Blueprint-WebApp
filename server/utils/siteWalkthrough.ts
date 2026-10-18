/**
 * Whether a website job's walkthrough is saved, as every job page reads it.
 *
 * The private job page (`GET /api/site-task-brief/:token/status`) and the
 * workspace job page (`GET /api/workspace/tasks/:taskId`) both read it here,
 * so they cannot disagree about whether a site has filmed.
 */
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { storedCaptureMarkerExists } from "./captureParts";
import { describeBrowserUpload } from "./websiteBrowserUploadStatus";

type CaptureIdentity = { requestId: string; sceneId: string; captureId: string };

/** The walkthrough every website job films into (`captureUploadUrlFor`). */
export function siteWalkthroughIdentity(requestId: string): CaptureIdentity {
  return { requestId, sceneId: `site-${requestId}`, captureId: `walkthrough-${requestId}` };
}

/**
 * Whether the walkthrough is saved, whichever device or app sent it. Retention
 * only: a saved recording does not prove processing started. Null when the
 * recording's status could not be read, which no caller may take as "not filmed".
 */
export async function savedWalkthrough(payload: CaptureIdentity) {
  // A saved recording is distinct from its processing completion marker.
  // Use the phone receipt's exact generation check: privacy holds and a
  // failed marker write must not send the laptop back to filming again.
  const upload = await describeBrowserUpload(payload, false);
  if (upload.uploadState === "status_unavailable") return null;
  let received = upload.captureReceived;
  let uploadState = upload.uploadState;
  if (!received && storageAdmin) {
    // Completed app bundles need not use the browser walkthrough filename.
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim() || "blueprint-8c1ca.appspot.com";
    received = await storedCaptureMarkerExists(storageAdmin.bucket(bucketName) as never,
      `scenes/${payload.sceneId}/captures/${payload.captureId}/raw`);
    if (received) uploadState = "retained";
  }
  return { upload, received, uploadState };
}
