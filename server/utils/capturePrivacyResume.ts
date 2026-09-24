/** Release stored captures held by the retired upload-time people screen. */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { screenCaptureForPrivacy, type PrivacyScreenResult } from "./capturePrivacyScreen";
import { recordCapturePrivacyScreen } from "./capturePrivacyRecord";

export interface StoredPrivacyScreen {
  capture_id?: string | null;
  outcome?: string | null;
  eligibility?: string | null;
  proceeded?: boolean | null;
  attempts?: number | null;
  first_held_at_iso?: string | null;
  screened_at_iso?: string | null;
  escalated?: boolean | null;
}

export type ResumeOutcome =
  | { action: "nothing_held" }
  | { action: "cleared"; result: PrivacyScreenResult };

export async function resumeHeldPrivacyScreen(params: {
  requestId: string;
  captureId: string;
  sceneId: string;
}): Promise<ResumeOutcome> {
  if (!db) return { action: "nothing_held" };
  const snapshot = await db.collection("inboundRequests").doc(params.requestId).get();
  if (!snapshot.exists) return { action: "nothing_held" };
  const stored = (snapshot.data()?.capture_privacy_screen ?? null) as StoredPrivacyScreen | null;
  if (!stored || (stored.capture_id && stored.capture_id !== params.captureId)
      || (stored.eligibility !== "pending" && stored.eligibility !== "rejected")) {
    return { action: "nothing_held" };
  }
  const result = await screenCaptureForPrivacy(params);
  await recordCapturePrivacyScreen({ requestId: params.requestId, captureId: params.captureId,
    result, attempts: Math.max(0, Number(stored.attempts) || 0) });
  return { action: "cleared", result };
}

/** How many fresh budgets one capture can be given before it stays with a person. */
const MAX_RESCREENS = 3;

export interface RescreenGrant {
  request_id: string;
  capture_id: string;
  previous_attempts: number;
  previous_escalated: boolean;
  previous_first_held_at_iso: string | null;
  reason: string;
  granted_by: string;
  granted_at_iso: string;
}

/**
 * Give a held capture a fresh retry budget, on the record.
 *
 * For a hold that is our own failure to get an answer -- the review crashed,
 * timed out or could not finish because of a defect since fixed -- not a
 * reading. A `rejected` capture (the reviewer saw identifiable people) and an
 * approved one are refused: this re-asks the reviewer, it never overrides it.
 * Each grant is appended to the capture's history with who gave it and why,
 * and there are at most three per capture.
 *
 * Previews unless `apply`.
 */
export async function grantPrivacyRescreen(params: {
  requestId: string;
  captureId: string;
  reason: string;
  grantedBy: string;
  apply: boolean;
}): Promise<{ applied: boolean; grant: RescreenGrant }> {
  if (!db) throw new Error("capture_privacy_store_unavailable");
  const reason = params.reason.trim();
  const grantedBy = params.grantedBy.trim();
  if (reason.length < 10) throw new Error("rescreen_reason_required");
  if (!grantedBy) throw new Error("rescreen_granted_by_required");

  const ref = db.collection("inboundRequests").doc(params.requestId);
  const store = db;
  return store.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("request_not_found");
    const stored = (snapshot.data()?.capture_privacy_screen ?? null) as
      | (StoredPrivacyScreen & { rescreens?: RescreenGrant[] })
      | null;
    if (!stored) throw new Error("no_privacy_screen_on_file");
    if (stored.capture_id && stored.capture_id !== params.captureId) throw new Error("capture_mismatch");
    if (stored.eligibility !== "pending") throw new Error(`rescreen_refused_${stored.eligibility ?? "unknown"}`);
    const history = Array.isArray(stored.rescreens) ? stored.rescreens : [];
    if (history.length >= MAX_RESCREENS) throw new Error("rescreen_limit_reached");

    const now = new Date().toISOString();
    const grant: RescreenGrant = {
      request_id: params.requestId,
      capture_id: params.captureId,
      previous_attempts: Math.max(0, Number(stored.attempts) || 0),
      previous_escalated: Boolean(stored.escalated),
      previous_first_held_at_iso: stored.first_held_at_iso ?? null,
      reason,
      granted_by: grantedBy,
      granted_at_iso: now,
    };
    if (params.apply) {
      transaction.set(ref, {
        capture_privacy_screen: {
          attempts: 0,
          first_held_at_iso: now,
          escalated: false,
          rescreens: [...history, grant],
        },
      }, { merge: true });
    }
    return { applied: params.apply, grant };
  });
}
