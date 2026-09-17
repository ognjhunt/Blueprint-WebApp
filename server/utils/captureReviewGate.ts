/**
 * Reading the walkthrough before paying to reconstruct it.
 *
 * ## The gap this closes
 *
 * The gates screen a *site* before we ever issue an upload link, and they are
 * good at it. What they cannot screen is the video, because it does not exist
 * yet. So a site can pass every condition, be handed a link, and send back
 * ninety seconds of a corridor, a dark clip, or a completely different station
 * from the one they described. Reconstructing that spends real money and — much
 * worse — produces a scene that *looks* like a result. A robot team evaluated
 * against a scene built from unusable footage gets a number, and the number
 * means nothing. That is fabricated readiness, which this repo refuses
 * everywhere else.
 *
 * So the review runs between the frames being loaded, which is free, and the
 * world being generated, which is not.
 *
 * ## It reuses the reader we already have
 *
 * `site_video_evidence` already watches footage and scores it against the
 * operator's own gate answers, with the corroborates / contradicts /
 * not_visible vocabulary and a schema in which no person can be described. A
 * second video agent asking overlapping questions would be a second set of
 * bugs and a second thing to keep honest. This module is only the decision:
 * given that reading, do we spend?
 *
 * ## One-way door, like everything else on this path
 *
 * Nothing here can approve. It can block a reconstruction the gates permitted,
 * and it can never start one they did not. `applyNarrativeReview`,
 * `credibleVideoContradictions`, `clampRecommendationToGates` and
 * `gateProvenance` all move verdicts one way; this is the same shape applied to
 * a spend decision rather than a verdict.
 *
 * ## Two kinds of no, and they are not interchangeable
 *
 * A bad video is cheap to fix: the site films it again, and forty-five seconds
 * later we try once more. A video that contradicts what the site told us, or
 * that shows people in a way consent has to cover, is not a filming problem and
 * telling someone to re-shoot it would be wrong. So a block says which it is.
 */

import { VIDEO_CONTRADICTION_CONFIDENCE_FLOOR } from "../../client/src/lib/gateTriage";
import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";

export type ReconstructionBlocker =
  /** Too dark, too short, too shaky, or not the work area. Re-filmable. */
  | "capture_footage_unusable"
  /** Footage shows people in a way the consent record has to cover first. */
  | "capture_footage_privacy_review"
  /** Footage plainly disagrees with an answer the site gave. A person decides. */
  | "capture_footage_contradicts_gates"
  /** The review was requested and did not come back. We do not spend on a guess. */
  | "capture_review_unavailable";

export type ReconstructionReviewDecision =
  | { reconstruct: true }
  | {
      reconstruct: false;
      blocker: ReconstructionBlocker;
      detail: string;
      /**
       * Whether the honest next step is "film it again".
       *
       * True only for footage problems. A contradiction or a consent question
       * is not fixed by re-shooting, and asking someone to re-film over one
       * would waste their time and hide the real issue.
       */
      refilm: boolean;
    };

export interface CaptureReviewGateInput {
  /**
   * What the footage reader returned. `null` means it was asked and failed,
   * which blocks — see `capture_review_unavailable`. A caller that does not
   * want the gate at all simply does not run it.
   */
  evidence: SiteVideoEvidenceOutput | null;
  /**
   * Gates that actually bind for this submission, after capture mode. A
   * contradiction on a gate nobody was asked is not a reason to stop.
   */
  bindingFieldIds?: readonly string[];
  /** Defaults to the floor the qualification path already uses. */
  contradictionFloor?: number;
}

/**
 * Decide whether this capture earns a paid reconstruction.
 *
 * Ordering is deliberate. Privacy comes before usability because a consent
 * question about footage already sitting in our bucket does not stop mattering
 * when the footage turns out to be blurry, and "film it again" would be the
 * wrong answer to it.
 */
export function decideReconstructionFromReview(
  input: CaptureReviewGateInput,
): ReconstructionReviewDecision {
  const { evidence } = input;

  if (!evidence) {
    return {
      reconstruct: false,
      blocker: "capture_review_unavailable",
      detail:
        "The footage review did not complete, so nothing has confirmed this video shows the task. Reconstructing anyway would risk a scene that looks like a result and is not one.",
      refilm: false,
    };
  }

  if (evidence.privacy_flag) {
    return {
      reconstruct: false,
      blocker: "capture_footage_privacy_review",
      detail:
        "The footage appears to centre identifiable people. Consent is a question for a person, not a re-shoot, and it is settled before the footage goes any further.",
      refilm: false,
    };
  }

  if (evidence.footage_status === "unusable") {
    return {
      reconstruct: false,
      blocker: "capture_footage_unusable",
      detail:
        evidence.footage_status_reason ||
        "The footage does not show the work area clearly enough to reconstruct.",
      refilm: true,
    };
  }

  const floor = input.contradictionFloor ?? VIDEO_CONTRADICTION_CONFIDENCE_FLOOR;
  const binding = input.bindingFieldIds;
  const contradictions = evidence.observations.filter(
    (item) =>
      item.stance === "contradicts" &&
      item.confidence >= floor &&
      // A gate that does not bind under this capture mode was never asked, so
      // footage disagreeing with it cannot hold anything.
      (!binding || binding.includes(item.field_id)),
  );

  if (contradictions.length) {
    return {
      reconstruct: false,
      blocker: "capture_footage_contradicts_gates",
      detail:
        `The footage disagrees with what the site told us about ` +
        `${contradictions.map((item) => item.field_id).join(", ")}. ` +
        "One of the two is wrong and only a conversation establishes which.",
      refilm: false,
    };
  }

  // `partially_usable` reconstructs. A partial view of a real workcell is still
  // a workcell, and Marble does not need a perfect orbit — holding it would
  // cost a site the whole loop over footage that was merely imperfect.
  return { reconstruct: true };
}

/** Human-readable trail for the capture record. */
export function describeReconstructionReview(
  decision: ReconstructionReviewDecision,
): string {
  if (decision.reconstruct) return "reviewed: footage supports reconstruction";
  return decision.refilm
    ? `held (${decision.blocker}): ${decision.detail} Asking the site to film it again.`
    : `held (${decision.blocker}): ${decision.detail}`;
}
