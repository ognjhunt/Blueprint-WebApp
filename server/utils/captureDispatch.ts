/**
 * Deciding, without a person, what happens to a submission that qualified.
 *
 * This is the step that used to be someone reading a queue: a site passes the
 * gates, and somebody eventually notices and arranges a capture. The gates were
 * already scored deterministically and the prose was already read by an agent,
 * so what remained was not judgement — it was latency. A submission sat until a
 * human looked at it, and the looking changed nothing in the ordinary case.
 *
 * So this module answers one question: given a verdict that already exists,
 * does capture start now, and through which channel?
 *
 * ## The same one-way door the rest of the funnel uses
 *
 * `gateTriage` decides. The `inbound_qualification` agent may lower a
 * disposition and never raise one. This module inherits that and adds nothing
 * of its own: it dispatches only on `qualified`, and every other disposition,
 * every human-review flag, and every unanswered gate holds. There is no input
 * here that can turn a `needs_conversation` into a capture, which is what makes
 * removing the human safe rather than merely faster.
 *
 * ## Two channels, and why geography only binds one
 *
 * A site that records its own workcell needs an upload link. A site that wants
 * someone to come needs a person in a van, and that person is in Austin. The
 * service-area gate exists for the second case only — see
 * `bindsForCaptureModes` in `siteTaskQualification.ts` — so self-capture is not
 * bound by where our capturers are, and the marketplace is one of two paths
 * rather than the only one.
 *
 * ## "Not bound by our capturers" is not "anywhere"
 *
 * This header used to say self-capture was "dispatchable anywhere". That was
 * wrong, and it was wrong in the direction that costs a site something: the
 * privacy policy scopes the beta to US capture sites, and says non-US
 * participation needs signed transfer terms *before capture*. Two different
 * geographies were being conflated — where a capturer can drive, and where we
 * are cleared to receive footage from. The first does not bind an upload. The
 * second binds both, and it is now checked here rather than asserted in prose.
 */

import {
  defaultCaptureMode,
  isCaptureMode,
  type CaptureMode,
} from "../../client/src/data/siteTaskQualification";
import type { TriageDisposition } from "../../client/src/lib/gateTriage";
import {
  auditInferredGates,
  type GateAnswerSources,
} from "../../client/src/lib/gateProvenance";
import {
  isApprovedCaptureRegion,
  isCaptureRegion,
} from "../../client/src/data/captureResidency";

export type CaptureChannel =
  /** The site films it. We send an upload link; no app, no scheduling. */
  | "self_capture_upload"
  /** A capturer is dispatched. Austin metro only, because someone drives. */
  | "capturer_visit";

export type CaptureDispatchDecision =
  | { dispatch: true; channel: CaptureChannel; captureMode: CaptureMode }
  | { dispatch: false; holdReason: CaptureHoldReason; detail: string };

export type CaptureHoldReason =
  | "not_qualified"
  | "needs_conversation"
  | "human_review_requested"
  | "gates_incomplete"
  | "gates_inferred"
  /** The site is somewhere the beta has not been cleared to collect from. */
  | "capture_region_unapproved"
  /** Nobody recorded which region the site is in, so there is no basis to rely on. */
  | "capture_region_unknown"
  | "capture_mode_missing";

export interface CaptureDispatchInput {
  /** The deterministic gate verdict. Authoritative. */
  disposition: TriageDisposition | null | undefined;
  /** Whether any upstream check asked for a person. Always honoured. */
  requiresHumanReview?: boolean;
  /** Gate ids with no answer. Any of these holds. */
  unanswered?: readonly string[];
  /** What the site chose on the form. */
  captureMode?: string | null;
  /**
   * The gates that actually bind, after capture mode has been applied. Needed
   * to tell an inferred answer that matters from one nobody was asked.
   */
  bindingFieldIds?: readonly string[];
  /**
   * Where each gate answer came from. Absent means operator-stated, which is
   * correct for every inbound request and for everything stored before
   * outbound existed.
   */
  gateAnswerSources?: GateAnswerSources | null;
  /**
   * Which region the site is in, as the operator stated it.
   *
   * Absent is not "probably fine". A capture invitation is the act that starts
   * collection, and the beta's lawful basis for collecting is region-scoped, so
   * an unrecorded region means there is no basis to point at. See
   * `captureResidency.ts` for why this is asked rather than parsed out of the
   * free-text location.
   */
  captureRegion?: string | null;
}

/**
 * Decide whether capture starts now.
 *
 * Returns a hold with a named reason rather than throwing, because the caller
 * is a background workflow that has to record why nothing happened. A silent
 * no-op is the failure mode this replaces.
 */
export function decideCaptureDispatch(input: CaptureDispatchInput): CaptureDispatchDecision {
  if (input.requiresHumanReview) {
    return {
      dispatch: false,
      holdReason: "human_review_requested",
      detail:
        "An upstream check asked for a person. Nothing here overrides that, whatever the gates said.",
    };
  }

  // Checked before anything else about cost, because it is not a cost question.
  //
  // An outbound prospect's gates are a hypothesis about a facility nobody has
  // visited, which means the operator has never spoken to us. Inviting someone
  // to film a site they never asked us about is wrong at any price, so "this
  // one is free" does not excuse skipping it.
  const inferred = auditInferredGates(
    input.bindingFieldIds ?? [],
    input.gateAnswerSources,
  );
  if (!inferred.allOperatorStated) {
    return {
      dispatch: false,
      holdReason: "gates_inferred",
      detail:
        `Still resting on inferred answers: ${inferred.inferredFieldIds.join(", ")}. ` +
        "The operator has to confirm these before anything is captured.",
    };
  }

  // Checked before the self-capture return, and before anything about cost,
  // for the same reason as the inferred-gates check above: it is not a cost
  // question.
  //
  // The privacy policy scopes the external beta to US capture sites and says
  // non-US participation needs signed transfer terms "before capture or
  // sharing". A capture invitation is what starts collection. So inviting an
  // out-of-region site to film is asking for data we have said we are not
  // cleared to receive, and "the upload is free" is no more of an excuse here
  // than it was there.
  //
  // This binds to a visit as well as an upload. The concern is the basis for
  // collecting the footage, which does not change depending on who holds the
  // phone.
  if (!isApprovedCaptureRegion(input.captureRegion)) {
    return isCaptureRegion(input.captureRegion)
      ? {
          dispatch: false,
          holdReason: "capture_region_unapproved",
          detail:
            "The site is outside the region the beta is cleared to collect from. " +
            "Transfer terms have to be signed before a walkthrough is recorded, not after.",
        }
      : {
          dispatch: false,
          holdReason: "capture_region_unknown",
          detail:
            "No region recorded for this site, so there is no basis to collect a walkthrough " +
            "against. Ask the operator which country the site is in.",
        };
  }

  // A self-recorded walkthrough costs us nothing to receive.
  //
  // This is the asymmetry the rest of this function was missing. Every check
  // below exists to stop us *spending* — sending a person to an address,
  // committing a paid reconstruction — and none of that is triggered by a site
  // uploading a phone video. The video lands in our bucket, the privacy screen
  // reads it before anything is derived from it, and the footage review refuses to
  // reconstruct anything unusable. The money is guarded after this point and
  // not at all by this point.
  //
  // What the screen verdict actually decides is whether a site is offered to
  // robot teams, and `loadRunnableSites` enforces that separately on
  // `disposition === "qualified"`. Requiring it here as well meant a site had
  // to pass a screen before we would accept the one artifact that makes the
  // screen answerable: four of its five binding gates are things the footage
  // shows better than any dropdown.
  //
  // So an unscreened site may record. It is not sellable until the gates are
  // resolved — that part is unchanged — but resolving them is now a later
  // conversation rather than a toll gate in front of our own supply.
  if (input.captureMode === "self_capture") {
    return {
      dispatch: true,
      captureMode: "self_capture",
      channel: "self_capture_upload",
    };
  }

  /* --------------------------------------------- from here, a visit only */

  // Everything below guards a capturer travelling to an address, and a
  // reconstruction committed on answers nobody has stood in a room to check.

  if (input.disposition !== "qualified") {
    return input.disposition === "needs_conversation"
      ? {
          dispatch: false,
          holdReason: "needs_conversation",
          detail:
            "Marginal answers are the ones a form could not settle, so sending someone on them would be guessing.",
        }
      : {
          dispatch: false,
          holdReason: "not_qualified",
          detail: `Disposition is ${input.disposition ?? "unknown"}; a visit starts only on a clean pass.`,
        };
  }

  // Belt and braces. `triageGateAnswers` already refuses to return `qualified`
  // with anything unanswered, but this is the last thing before real money
  // moves, so it re-checks rather than trusting an invariant it does not own.
  if (input.unanswered?.length) {
    return {
      dispatch: false,
      holdReason: "gates_incomplete",
      detail: `Unanswered gates: ${input.unanswered.join(", ")}.`,
    };
  }

  if (!isCaptureMode(input.captureMode)) {
    // A submission from before the question existed. Falling back to
    // `site_visit` would silently dispatch a capturer for a site that may be
    // anywhere, so this holds instead and asks.
    return {
      dispatch: false,
      holdReason: "capture_mode_missing",
      detail:
        "No capture mode recorded. Ask the site whether they will record it themselves before dispatching anyone.",
    };
  }

  return {
    dispatch: true,
    captureMode: input.captureMode,
    channel: "capturer_visit",
  };
}

/**
 * Whether this submission should reach the capturer marketplace at all.
 *
 * Self-capture requests never publish a job, so the marketplace narrows to the
 * visits that actually need a driver instead of being the only way in.
 */
export function publishesCapturerJob(decision: CaptureDispatchDecision): boolean {
  return decision.dispatch && decision.channel === "capturer_visit";
}

/** Human-readable trail for the request record. */
export function describeCaptureDispatch(decision: CaptureDispatchDecision): string {
  if (!decision.dispatch) {
    return `held (${decision.holdReason}): ${decision.detail}`;
  }
  return decision.channel === "self_capture_upload"
    ? "dispatched: upload link sent to the site, no visit required"
    : "dispatched: capturer job published for an on-site visit";
}

export { defaultCaptureMode };
