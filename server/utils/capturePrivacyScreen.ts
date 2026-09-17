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
 * wants answering before the data multiplies. So this runs the same reviewer at
 * upload, on the video, and holds the completion marker — which is what starts
 * extraction — rather than holding the cheque.
 *
 * ## It only ever asks the privacy question
 *
 * Deliberately narrow. "Unusable" and "contradicts" stay at reconstruction
 * where they belong: they are about whether to spend, they benefit from the
 * frames being in hand, and re-deciding them here would mean two places could
 * disagree about the same footage. This reads one boolean and ignores the rest.
 *
 * ## And it fails open
 *
 * Every path that cannot get an answer — the lane switched off, no signable
 * video, a model error, a timeout — proceeds. That is the opposite of the rule
 * everywhere else in this repo, and it is deliberate:
 *
 * This check is a *tightening* of an existing gate, not the gate itself. The
 * reconstruction-time review is unchanged and still refuses to spend on footage
 * it could not read. If this one failed closed, a deployment with the evidence
 * lane off would strand every upload in the bucket with no marker and nothing
 * watching — which is a worse failure than the one it set out to prevent, and
 * the exact shape of bug this codebase has already been bitten by once.
 *
 * So the worst case here is that we are no better off than before, at the point
 * where before was already safe about money.
 */

import { logger } from "../logger";
import { buildCaptureFootageReviewer } from "./captureFootageReview";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";

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

export interface PrivacyScreenResult {
  /** Whether the completion marker may be written, and extraction may start. */
  proceed: boolean;
  /** Why, in one machine-readable word. */
  outcome:
    | "cleared"
    | "privacy_hold"
    /** No review was possible. Proceeds; see the fail-open note above. */
    | "not_reviewed";
  detail: string | null;
  /**
   * The reading itself, when there was one, so it can be stored rather than
   * thrown away — a second model call to ask the same question of the same
   * video is waste, and a person handling a privacy hold needs to see what
   * was seen.
   */
  evidence: SiteVideoEvidenceOutput | null;
}

const PROCEED_UNREVIEWED: PrivacyScreenResult = {
  proceed: true,
  outcome: "not_reviewed",
  detail: null,
  evidence: null,
};

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
  if (!isSiteVideoEvidenceEnabled()) return PROCEED_UNREVIEWED;

  let reviewer: Awaited<ReturnType<typeof buildCaptureFootageReviewer>> = null;
  try {
    reviewer = await buildCaptureFootageReviewer(params);
  } catch (error) {
    logger.warn({ error, ...params }, "Could not build a privacy reviewer; proceeding unreviewed");
    return PROCEED_UNREVIEWED;
  }
  if (!reviewer) return PROCEED_UNREVIEWED;

  let evidence: SiteVideoEvidenceOutput | null = null;
  try {
    evidence = await withTimeout(reviewer.review(), timeoutMs());
  } catch (error) {
    logger.warn({ error, ...params }, "Privacy screen failed; proceeding unreviewed");
    return PROCEED_UNREVIEWED;
  }

  if (!evidence) {
    // Distinguished in the log from "cleared" on purpose: a review that timed
    // out and a review that found nothing look identical downstream otherwise,
    // and only one of them is a reason to look at the provider.
    logger.warn(params, "Privacy screen returned nothing; proceeding unreviewed");
    return PROCEED_UNREVIEWED;
  }

  if (evidence.privacy_flag) {
    logger.info(params, "Capture held at upload: footage appears to centre identifiable people");
    return {
      proceed: false,
      outcome: "privacy_hold",
      detail:
        "The footage appears to centre identifiable people. Consent is a question for a person "
        + "rather than a re-shoot, so nothing is processed from it until that is settled.",
      evidence,
    };
  }

  return { proceed: true, outcome: "cleared", detail: null, evidence };
}
