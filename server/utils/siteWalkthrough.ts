/**
 * Whether a website job's walkthrough is saved, as every job page reads it.
 *
 * The private job page (`GET /api/site-task-brief/:token/status`) and the
 * workspace job page (`GET /api/workspace/tasks/:taskId`) both read it here,
 * so they cannot disagree about whether a site has filmed.
 */
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
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

/**
 * Whether the job's walkthrough arrived before the job was saved to an
 * account (owner decision 2026-10-18).
 *
 * Such a capture is born in the Pipeline with no owner, and saving the job
 * afterwards is an owner change the Pipeline refuses for that capture for
 * good; a re-upload cannot replace the first birth on Pipeline main. The
 * moment footage first landed is the WebApp's own durable `video_received`
 * notice (the capture outbox row, `CAPTURE_OUTBOX_COLLECTION`, never pruned);
 * the moment the job was saved is the claim's own `claimed_at_iso`. A job
 * started from a signed-in site workspace has an owner from the start.
 * Null when the notice cannot be read, which no caller may take as "yes".
 */
export async function footageArrivedBeforeAccount(requestId: string,
  record: { account_owner_uid?: unknown; claimed_at_iso?: unknown } | null | undefined): Promise<boolean | null> {
  if (!db || !record) return null;
  let receivedIso: string | null;
  try {
    const notice = await db.collection("captureOutbox").doc(`${requestId}:video_received`).get();
    receivedIso = notice.exists && typeof notice.data()?.createdAtIso === "string" ? notice.data()!.createdAtIso : null;
  } catch { return null; }
  if (!receivedIso) return false;
  if (typeof record.account_owner_uid !== "string" || !record.account_owner_uid) return true;
  const claimedIso = typeof record.claimed_at_iso === "string" ? record.claimed_at_iso : null;
  const received = Date.parse(receivedIso), claimed = claimedIso ? Date.parse(claimedIso) : Number.NaN;
  return Number.isFinite(received) && Number.isFinite(claimed) && received < claimed;
}
