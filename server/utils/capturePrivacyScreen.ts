/**
 * Look at the walkthrough before we start copying it.
 *
 * ## The ordering this fixes
 *
 * The footage review already existed, and it was correctly placed for what it
 * mostly does. `startWorldReconstruction` runs it immediately before
 * `generateWorldFromFrames` — the billed call — so a video that does not show
 * the task, or that contradicts what the site told us, is stopped before any
 * money moves.
 *
 * Two of its three blockers are cost questions and belong exactly there. The
 * third is not. `capture_footage_privacy_review` says the footage centres
 * identifiable people, and its own words are that consent "is settled before
 * the footage goes any further" — but by the time it fires, `extractFrames` has
 * already decoded the video and written frames of those people into our bucket.
 * The gate was in front of the spending and behind the copying.
 *
 * Privacy is a question about data, not about cost, and a question about data
 * wants answering before the data multiplies. So this runs a bounded
 * privacy-only reviewer at upload and holds the completion marker — which is
 * what starts extraction — until it returns an explicit clear reading.
 *
 * ## It only ever asks the privacy question
 *
 * Deliberately narrow. "Unusable" and "contradicts" stay at reconstruction
 * where they belong: they are about whether to spend, they benefit from the
 * frames being in hand, and re-deciding them here would mean two places could
 * disagree about the same footage. This reads one enum decision; uncertain
 * answers, errors and timeouts cannot clear the gate.
 *
 * ## Accepting an upload fails open. Deriving from it fails closed.
 *
 * The first version of this failed open on every path — lane off, no signable
 * video, model error, timeout — and defended that by pointing at the
 * reconstruction-time review, which still refuses to spend on footage it could
 * not read.
 *
 * That defence was circular, and an audit took it apart cleanly: **the
 * downstream gate does not protect the thing this gate was moved here to
 * protect.** The reconstruction review guards *spending*. This one exists
 * because by the time that review runs, the extractor has already decoded the
 * video into frames of whoever is in it. A later gate cannot un-copy them. So
 * "there is a gate downstream" is no reason at all to let a timeout produce
 * persistent derivative copies.
 *
 * The real answer was not "fail open or strand every upload" — that was a
 * limitation of the state machine, not a trade-off. Two transitions, two
 * postures:
 *
 * - **Accepting the upload** fails open. It always succeeds, is always
 *   recorded, and never depends on a reviewer. Nobody re-films because our
 *   model timed out.
 * - **Deriving from the upload** fails closed. The completion marker — the
 *   thing that starts extraction — is written only for footage we actually
 *   cleared, or footage nobody was ever configured to screen.
 *
 * ## Which leaves one honest distinction
 *
 * "We asked and could not get an answer" is not the same as "nobody ever
 * configured a reviewer". The first is a failure of something we opted into,
 * and it retries rather than deriving. The second is a deployment that never
 * turned privacy screening on, where halting the product would be a surprise
 * and pretending the footage was cleared would be a lie — so it proceeds, and
 * it is recorded as `unscreened`, which is a word that cannot be mistaken for
 * `cleared`.
  */

import { logger } from "../logger";
import { buildCapturePrivacyReviewer } from "./captureFootageReview";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import type { CaptureVideoPrivacyOutput } from "../agents/tasks/capture-video-privacy";

/**
 * How long an upload may wait on the reviewer.
 *
 * The site is holding an open request with a video already stored, so this is
 * not free time. Long enough for a model to watch a short walkthrough, short
 * enough that a stuck provider does not look like a failed upload.
 */
const DEFAULT_PRIVACY_SCREEN_TIMEOUT_MS = 45_000;

function timeoutMs(): number {
  const raw = Number(process.env.BLUEPRINT_CAPTURE_PRIVACY_SCREEN_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PRIVACY_SCREEN_TIMEOUT_MS;
}

/**
 * Whether anything may be derived from this upload yet.
 *
 * Deliberately separate from whether the upload succeeded. The upload always
 * succeeds; this is about the next transition.
 */
export type ProcessingEligibility =
  /** Watched and clear. Extraction may start. */
  | "approved"
  /** We asked and got no answer. Retryable, and nothing is derived meanwhile. */
  | "pending"
  /** Watched, and it needs a person before anything is processed. */
  | "rejected"
  /** No reviewer was ever configured here. Proceeds, and says so. */
  | "unscreened";

export interface PrivacyScreenResult {
  /** Whether the completion marker may be written, and extraction may start. */
  proceed: boolean;
  /** What the upload is eligible for, which is not whether it arrived. */
  eligibility: ProcessingEligibility;
  /** Why, in one machine-readable word. */
  outcome:
    | "cleared"
    | "privacy_hold"
    /** Asked, no answer. Retries; derives nothing in the meantime. */
    | "review_unavailable"
    /** Nobody configured a reviewer. Proceeds, recorded as unscreened. */
    | "not_reviewed";
  detail: string | null;
  /** Set on `pending`: whether asking again could plausibly help. */
  retryable?: boolean;
  /**
   * The bounded privacy reading itself, when there was one. Full task
   * interpretation remains separate, and a person can inspect a held
   * decision and timestamps without a description of anyone.
   */
  evidence: CaptureVideoPrivacyOutput | null;
}

/**
 * No reviewer exists in this deployment.
 *
 * Proceeds, because a deployment that never switched the evidence lane on has
 * not made a privacy decision and stopping every capture dead would be a
 * surprise rather than a safeguard. Recorded as `unscreened` so it can never be
 * read as "watched and found nothing".
 */
const PROCEED_UNSCREENED: PrivacyScreenResult = {
  proceed: true,
  eligibility: "unscreened",
  outcome: "not_reviewed",
  detail: null,
  evidence: null,
};

/**
 * We asked and could not get an answer.
 *
 * Holds. This is the case the old fail-open covered and should not have: a
 * model error or a timeout is not evidence that the footage is clear, and
 * treating it as such is how frames of unconsented people end up in a bucket.
 * The upload is kept and the screen is retried.
 */
/** A review is already running for this capture; waiting on it costs nothing. */
export function reviewStillRunning(): PrivacyScreenResult {
  return reviewUnavailable(
    "The review is still running. Nothing has been processed from the footage yet, and we will "
    + "check again shortly.",
  );
}

function reviewUnavailable(detail: string): PrivacyScreenResult {
  return {
    proceed: false,
    eligibility: "pending",
    outcome: "review_unavailable",
    retryable: true,
    detail,
    evidence: null,
  };
}

/** Resolve to null rather than hang the upload on a provider that has stopped. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Decide whether this capture may start extracting.
 *
 * Called with the video already stored and the manifest already written, which
 * is the only moment both of those are true and nothing has been derived yet.
 */
export async function screenCaptureForPrivacy(params: {
  requestId: string;
  sceneId: string;
  captureId: string;
}): Promise<PrivacyScreenResult> {
  // Never configured. Status quo, named honestly.
  if (!isSiteVideoEvidenceEnabled()) return PROCEED_UNSCREENED;

  let reviewer: Awaited<ReturnType<typeof buildCapturePrivacyReviewer>> = null;
  try {
    reviewer = await buildCapturePrivacyReviewer(params);
  } catch (error) {
    logger.warn({ error, ...params }, "Could not build a privacy reviewer; holding for retry");
    return reviewUnavailable(
      "We could not review the footage yet. Nothing has been processed from it, and we will try "
      + "again shortly.",
    );
  }
  // The lane is on but this capture has nothing signable to watch -- no video
  // URL we can hand a reviewer. Not the same as "no reviewer exists", so it
  // holds and retries rather than proceeding.
  if (!reviewer) {
    return reviewUnavailable(
      "There is nothing we can review yet. Nothing has been processed, and we will try again "
      + "shortly.",
    );
  }

  let evidence: CaptureVideoPrivacyOutput | null = null;
  try {
    evidence = await withTimeout(reviewer.review(), timeoutMs());
  } catch (error) {
    // The path the audit was specifically about. A model error is not
    // evidence that the footage is clear, and proceeding on it is how frames
    // of unconsented people get written.
    logger.warn({ error, ...params }, "Privacy screen failed; holding rather than deriving");
    return reviewUnavailable(
      "We could not finish reviewing the footage. Nothing has been processed from it, and we "
      + "will try again shortly.",
    );
  }

  if (!evidence) {
    // Distinguished in the log from "cleared" on purpose: a review that timed
    // out and a review that found nothing look identical downstream otherwise,
    // and only one of them is a reason to look at the provider.
    logger.warn(params, "Privacy screen returned nothing; holding rather than deriving");
    return reviewUnavailable(
      "The review did not come back in time. Nothing has been processed from the footage, and we "
      + "will try again shortly.",
    );
  }

  if (evidence.decision !== "clear") {
    logger.info({ ...params, decision: evidence.decision }, "Capture held at upload for privacy review");
  }
  return privacyResultFromEvidence(evidence);
}

/** What a reading decides, whether it arrived now or from a review that outlived an earlier wait. */
export function privacyResultFromEvidence(evidence: CaptureVideoPrivacyOutput): PrivacyScreenResult {
  if (evidence.decision !== "clear") {
    return {
      proceed: false,
      eligibility: "rejected",
      // Not retryable: asking the same model the same question about the same
      // video will give the same answer. This one needs a person.
      retryable: false,
      outcome: "privacy_hold",
      detail: evidence.decision === "hold"
        ? "The footage appears to centre identifiable people. Consent is a question for a person "
          + "rather than a re-shoot, so nothing is processed from it until that is settled."
        : "The privacy review could not determine whether the footage centres identifiable people. "
          + "Nothing is processed until a person settles that question.",
      evidence,
    };
  }

  return { proceed: true, eligibility: "approved", outcome: "cleared", detail: null, evidence };
}
