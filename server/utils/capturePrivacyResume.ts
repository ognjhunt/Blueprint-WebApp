/**
 * Nothing sits in the bucket forever because a model timed out.
 *
 * ## Why this has to exist
 *
 * The privacy screen used to fail open on every path, and the stated reason was
 * that failing closed "would strand every upload in the bucket with no marker
 * and nothing watching". That was true of the state machine as written, and it
 * was an argument for fixing the state machine rather than for copying frames
 * of people nobody had cleared.
 *
 * So the screen now holds when it cannot get an answer, and this is the other
 * half: the thing that watches. Without it, failing closed really would be the
 * worse bug.
 *
 * ## Two recovery paths, and the cheap one is the important one
 *
 * - **On the site's own status poll.** The capture page asks how its upload is
 *   doing; a held screen is retried right there. This is the same shape as
 *   `reconcileTeamHolds` running on the agent's own call path: the caller who
 *   cares is the one who triggers the work, so recovery does not depend on a
 *   scheduler being switched on in this deployment.
 * - **On expiry, a person.** After the attempts are spent, a held capture stops
 *   being a retry and becomes somebody's job. A capture that can never clear
 *   itself and never reaches a human is exactly the strand this set out to
 *   avoid.
 *
 * `rejected` is not retried. A privacy hold is a reading, and asking the same
 * reviewer the same question about the same video gives the same answer. That
 * one always needs a person.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  privacyResultFromEvidence,
  reviewStillRunning,
  screenCaptureForPrivacy,
  type PrivacyScreenResult,
} from "./capturePrivacyScreen";
import { findPriorFootageReview } from "./captureFootageReview";
import { recordCapturePrivacyScreen } from "./capturePrivacyRecord";
import { notifySlackCapturePrivacyEscalation } from "./slack";

/** How many times we ask again before it becomes a person's problem. */
const DEFAULT_MAX_ATTEMPTS = 5;

/** And how long, so a slow trickle of attempts cannot hold a capture for days. */
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function maxAttempts(): number {
  const raw = Number(process.env.BLUEPRINT_CAPTURE_PRIVACY_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_ATTEMPTS;
}

function maxAgeMs(): number {
  const raw = Number(process.env.BLUEPRINT_CAPTURE_PRIVACY_MAX_AGE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_AGE_MS;
}

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
  /** Nothing was being held. */
  | { action: "nothing_held" }
  /** Retried, and it cleared. The caller writes the marker. */
  | { action: "cleared"; result: PrivacyScreenResult }
  /** Retried, still no answer. Will be retried again. */
  | { action: "still_pending"; attempts: number; result: PrivacyScreenResult }
  /** Retried, and the reading says a person is needed. */
  | { action: "rejected"; result: PrivacyScreenResult }
  /** Out of attempts or out of time. A person has been asked. */
  | { action: "escalated"; attempts: number; reason: string };

/**
 * Retry a held screen, or hand it to a person.
 *
 * Returns what happened rather than acting on storage, because writing the
 * completion marker needs the bucket and the capture's own prefix and those
 * belong to the upload route. This decides; the caller derives.
 */
export async function resumeHeldPrivacyScreen(params: {
  requestId: string;
  captureId: string;
  sceneId: string;
  /** Injectable so a test does not need a model. */
  screen?: typeof screenCaptureForPrivacy;
  /** Injectable so a test does not need run records. */
  findPrior?: typeof findPriorFootageReview;
}): Promise<ResumeOutcome> {
  if (!db) return { action: "nothing_held" };

  const snapshot = await db.collection("inboundRequests").doc(params.requestId).get();
  if (!snapshot.exists) return { action: "nothing_held" };

  const stored = (snapshot.data()?.capture_privacy_screen ?? null) as StoredPrivacyScreen | null;
  if (!stored) return { action: "nothing_held" };

  // Only our own failure to get an answer is retryable. A privacy reading is
  // not, and an approved or unscreened capture is not held at all.
  if (stored.eligibility !== "pending") return { action: "nothing_held" };
  if (stored.escalated) return { action: "nothing_held" };

  const attempts = Math.max(0, Number(stored.attempts) || 0);

  // A review that outlived an earlier wait is waited on or used, never
  // repeated: repeating it spends an attempt and starts a review that will
  // outlive this wait too. Checked before the budget, because a reading that
  // has arrived settles the hold however many attempts it took.
  const findPrior = params.findPrior ?? findPriorFootageReview;
  const prior = await Promise.resolve()
    .then(() => findPrior(params.captureId))
    .catch((error) => {
      logger.warn({ error, ...params }, "Could not look up an earlier footage review; asking again");
      return { state: "none" as const };
    });
  if (prior.state === "running") {
    return { action: "still_pending", attempts, result: reviewStillRunning() };
  }
  if (prior.state === "completed") {
    const result = privacyResultFromEvidence(prior.output);
    await recordCapturePrivacyScreen({
      requestId: params.requestId,
      captureId: params.captureId,
      result,
      attempts,
    });
    if (result.eligibility === "rejected") return { action: "rejected", result };
    logger.info({ ...params, attempts }, "Held capture cleared by a review that outlived its wait");
    return { action: "cleared", result };
  }

  const firstHeld = stored.first_held_at_iso || stored.screened_at_iso || null;
  const ageMs = firstHeld ? Date.now() - Date.parse(firstHeld) : 0;

  const outOfAttempts = attempts >= maxAttempts();
  const outOfTime = Number.isFinite(ageMs) && ageMs >= maxAgeMs();

  if (outOfAttempts || outOfTime) {
    const reason = outOfAttempts
      ? `The privacy review did not complete after ${attempts} attempts.`
      : "The privacy review has been held longer than it is allowed to sit.";

    // Marked before anyone is notified, so a failure to notify cannot produce
    // an endless retry loop that also never reaches a person.
    await db
      .collection("inboundRequests")
      .doc(params.requestId)
      .set(
        {
          capture_privacy_screen: {
            escalated: true,
            escalated_at_iso: new Date().toISOString(),
            escalated_at: admin.firestore.FieldValue.serverTimestamp(),
            escalation_reason: reason,
          },
        },
        { merge: true },
      );

    logger.error(
      { ...params, attempts, ageMs, reason },
      "Capture held for privacy review needs a person: retries exhausted",
    );
    // The flag above is the record; this is the bell. Exhaustion used to end
    // in a log line nobody reads — now it ends in the channel ops reads.
    notifySlackCapturePrivacyEscalation({
      requestId: params.requestId,
      reason,
      attempts,
    }).catch((error) =>
      logger.error(
        { error, requestId: params.requestId },
        "Privacy escalation Slack notification failed",
      ),
    );
    return { action: "escalated", attempts, reason };
  }

  // Spent before the review runs, not after it returns. A review that takes
  // the process down with it never returns, so counting afterwards left the
  // budget untouched and every status poll retried -- and crashed -- again,
  // never reaching the person the escalation above exists for.
  await db
    .collection("inboundRequests")
    .doc(params.requestId)
    .set({ capture_privacy_screen: { attempts: attempts + 1 } }, { merge: true });

  const screen = params.screen ?? screenCaptureForPrivacy;
  const result = await screen({
    requestId: params.requestId,
    sceneId: params.sceneId,
    captureId: params.captureId,
  });

  await recordCapturePrivacyScreen({
    requestId: params.requestId,
    captureId: params.captureId,
    result,
    attempts: attempts + 1,
  });

  if (result.eligibility === "approved" || result.eligibility === "unscreened") {
    logger.info({ ...params, attempts: attempts + 1 }, "Held capture cleared on retry");
    return { action: "cleared", result };
  }
  if (result.eligibility === "rejected") {
    return { action: "rejected", result };
  }
  return { action: "still_pending", attempts: attempts + 1, result };
}
