/**
 * Capture admission after the site's recorded authority and terms acceptance.
 *
 * A person appearing in task footage does not trigger a separate upload review.
 * The ordinary task-footage review still decides whether the video is useful
 * before paid reconstruction. Historical screen fields remain readable so
 * existing capture records and resume callers keep their shape.
 */

import type { CaptureVideoPrivacyOutput } from "../agents/tasks/capture-video-privacy";

export type ProcessingEligibility = "approved" | "pending" | "rejected" | "unscreened";

export interface PrivacyScreenResult {
  proceed: boolean;
  eligibility: ProcessingEligibility;
  outcome: "cleared" | "privacy_hold" | "review_unavailable" | "not_reviewed";
  detail: string | null;
  retryable?: boolean;
  evidence: CaptureVideoPrivacyOutput | null;
}

const PROCEED_WITH_TERMS: PrivacyScreenResult = {
  proceed: true,
  eligibility: "unscreened",
  outcome: "not_reviewed",
  detail: null,
  evidence: null,
};

export async function screenCaptureForPrivacy(_params: {
  requestId: string;
  sceneId: string;
  captureId: string;
}): Promise<PrivacyScreenResult> {
  return { ...PROCEED_WITH_TERMS };
}

/** Convert a completed legacy review without reinstating its people hold. */
export function privacyResultFromEvidence(_evidence: CaptureVideoPrivacyOutput): PrivacyScreenResult {
  return { ...PROCEED_WITH_TERMS };
}

/** Kept for readers of a legacy in-flight receipt. */
export function reviewStillRunning(): PrivacyScreenResult {
  return { ...PROCEED_WITH_TERMS };
}
