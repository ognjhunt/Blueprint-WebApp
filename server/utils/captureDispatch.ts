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
 * `bindsForCaptureModes` in `siteTaskQualification.ts` — so self-capture is
 * dispatchable anywhere, and the marketplace is one of two paths rather than
 * the only one.
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

  if (input.disposition !== "qualified") {
    return input.disposition === "needs_conversation"
      ? {
          dispatch: false,
          holdReason: "needs_conversation",
          detail:
            "Marginal answers are the ones a form could not settle, so dispatching on them would be guessing.",
        }
      : {
          dispatch: false,
          holdReason: "not_qualified",
          detail: `Disposition is ${input.disposition ?? "unknown"}; capture starts only on a clean pass.`,
        };
  }

  // Belt and braces. `triageGateAnswers` already refuses to return `qualified`
  // with anything unanswered, but this module is the last thing before real
  // money moves, so it re-checks rather than trusting an invariant it does not
  // own.
  if (input.unanswered?.length) {
    return {
      dispatch: false,
      holdReason: "gates_incomplete",
      detail: `Unanswered gates: ${input.unanswered.join(", ")}.`,
    };
  }

  // An outbound prospect's gates are a hypothesis about a facility nobody has
  // visited. They are enough to start a conversation and never enough to spend
  // money: dispatching on them would send a capturer to an address, or commit a
  // paid reconstruction, on the strength of a guess.
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
    channel: input.captureMode === "self_capture" ? "self_capture_upload" : "capturer_visit",
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
