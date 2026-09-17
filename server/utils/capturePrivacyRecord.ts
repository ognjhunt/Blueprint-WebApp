/**
 * Writing down what the upload-time privacy screen saw.
 *
 * A hold that nobody can see is a video sitting in a bucket with no marker and
 * no explanation — indistinguishable, from the outside, from an upload that
 * silently failed. So the reading goes onto the request: what was seen, when,
 * and whether it stopped anything.
 *
 * It is also not free. Watching a walkthrough is a model call, and the
 * reconstruction-time review asks the same question of the same video minutes
 * later. Storing the evidence here means that second reading has something to
 * compare against rather than being the only record.
 *
 * Nothing here is allowed to fail an upload. The video is already stored and
 * the decision is already made by the time this is called; a Firestore hiccup
 * must not turn a held capture into an error or a cleared one into a retry.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { PrivacyScreenResult } from "./capturePrivacyScreen";

export async function recordCapturePrivacyScreen(params: {
  requestId: string;
  captureId: string;
  result: PrivacyScreenResult;
}): Promise<void> {
  if (!db) return;

  try {
    await db
      .collection("inboundRequests")
      .doc(params.requestId)
      .set(
        {
          capture_privacy_screen: {
            capture_id: params.captureId,
            outcome: params.result.outcome,
            proceeded: params.result.proceed,
            detail: params.result.detail,
            screened_at_iso: new Date().toISOString(),
            screened_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          // Only when there was a real reading. An absent evidence block means
          // nothing was watched, which must not read as "watched and found
          // nothing" -- the same distinction the footage schema draws with
          // `not_evidenced`.
          ...(params.result.evidence
            ? { site_video_evidence: params.result.evidence }
            : {}),
        },
        { merge: true },
      );
  } catch (error) {
    logger.warn(
      { error, requestId: params.requestId, captureId: params.captureId },
      "Could not record the capture privacy screen; the decision stands regardless",
    );
  }
}
