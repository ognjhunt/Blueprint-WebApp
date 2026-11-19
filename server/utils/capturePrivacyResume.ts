/** Release stored captures held by the retired upload-time people screen. */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { screenCaptureForPrivacy, type PrivacyScreenResult } from "./capturePrivacyScreen";
import { claimCapturePrivacyScreen, legacyCapturePrivacyClaimSource, recordCapturePrivacyScreen,
  releaseCapturePrivacyScreenClaim } from "./capturePrivacyRecord";
import type { CapturePrivacyProducerSource } from "./capturePrivacyRecord";

export interface StoredPrivacyScreen {
  capture_id?: string | null;
  outcome?: string | null;
  eligibility?: string | null;
  proceeded?: boolean | null;
  attempts?: number | null;
  first_held_at_iso?: string | null;
  screened_at_iso?: string | null;
}

export type ResumeOutcome =
  | { action: "nothing_held" }
  | { action: "cleared"; result: PrivacyScreenResult };

export async function resumeHeldPrivacyScreen(params: {
  requestId: string;
  captureId: string;
  sceneId: string;
  producerSource?: CapturePrivacyProducerSource | null;
}): Promise<ResumeOutcome> {
  if (!db) return { action: "nothing_held" };
  const snapshot = await db.collection("inboundRequests").doc(params.requestId).get();
  if (!snapshot.exists) return { action: "nothing_held" };
  const data = snapshot.data();
  const stored = (params.producerSource
    ? data?.capture_privacy_source_bound_decision ?? data?.capture_privacy_screen
    : data?.capture_privacy_screen ?? null) as StoredPrivacyScreen | null;
  if (stored?.capture_id && stored.capture_id !== params.captureId) {
    return { action: "nothing_held" };
  }
  if (params.producerSource) {
    // A saved clearance for this exact immutable producer is replayed by the
    // caller; a different or absent source must get its own fresh screen.
    const source = (stored as StoredPrivacyScreen & { producer_source?: CapturePrivacyProducerSource })?.producer_source;
    if (source?.kind === params.producerSource.kind && source.key === params.producerSource.key
        && (stored?.eligibility === "approved" || stored?.eligibility === "unscreened")) {
      return { action: "nothing_held" };
    }
    const priorClearanceForAnotherSource = stored?.proceeded === true
      && (stored.eligibility === "approved" || stored.eligibility === "unscreened")
      && (source == null || source.kind !== params.producerSource.kind
        || source.key !== params.producerSource.key);
    // A previous producer's clearance cannot bless a newly recorded source.
    // This includes pre-change app completions whose unbound decision may
    // still belong to an in-flight old worker. A later retry still needs a
    // transactional claim and its own fresh decision for this exact source.
    if (priorClearanceForAnotherSource) {
      const when = Date.parse(stored.screened_at_iso ?? "");
      if (!Number.isFinite(when) || Date.now() - when < 60 * 60 * 1000)
        return { action: "nothing_held" };
    }
    const claim = await claimCapturePrivacyScreen({ requestId: params.requestId,
      captureId: params.captureId, producerSource: params.producerSource });
    if (!claim) return { action: "nothing_held" };
    try {
      const result = await screenCaptureForPrivacy(params);
      await recordCapturePrivacyScreen({ requestId: params.requestId, captureId: params.captureId,
        result, attempts: Math.max(0, Number(stored?.attempts) || 0) + 1,
        producerSource: params.producerSource, claim });
      return { action: "cleared", result };
    } catch (error) {
      await releaseCapturePrivacyScreenClaim(claim);
      throw error;
    }
  }
  if (!stored || (stored.eligibility !== "pending" && stored.eligibility !== "rejected")) {
    return { action: "nothing_held" };
  }
  const claim = await claimCapturePrivacyScreen({ requestId: params.requestId,
    captureId: params.captureId,
    producerSource: legacyCapturePrivacyClaimSource(params.requestId, params.captureId, params.sceneId) });
  if (!claim) return { action: "nothing_held" };
  try {
    const result = await screenCaptureForPrivacy(params);
    await recordCapturePrivacyScreen({ requestId: params.requestId, captureId: params.captureId,
      result, attempts: Math.max(0, Number(stored.attempts) || 0),
      producerSource: null, claim });
    return { action: "cleared", result };
  } catch (error) {
    await releaseCapturePrivacyScreenClaim(claim);
    throw error;
  }
}
