/**
 * Three different questions that used to share one answer.
 *
 * ## The dead end this exists to close
 *
 * The site page stopped leading with a screen, which was right: four of the
 * gates that bind a self-recorded capture are things the footage shows better
 * than a dropdown, and asking a site to describe a room before we would accept
 * a film of the same room was backwards.
 *
 * But the verdict downstream did not move with it. `triageGateAnswers` never
 * returns `qualified` with any gate blank; footage may only lower a disposition
 * and never raise one; and `loadRunnableSites` shows robot teams nothing that
 * is not `qualified`. So a site could submit, film, and be reconstructed, and
 * *nothing in the system could ever promote it*. The funnel was open at the
 * wide end and welded shut at the narrow one — and because reconstruction never
 * checked the disposition, we paid to rebuild scenes that could not be sold.
 *
 * ## What actually fixes it
 *
 * Not a looser verdict. A brief we draft and the operator corrects, whose
 * confirmation is the attestation that turns a blank gate into an
 * operator-stated one. See `siteTaskBrief.ts`.
 *
 * And this: the recognition that "enough" means three different things, and
 * that one checklist for all three is what made the gates a toll booth.
 *
 * - **Assessment** — enough to say what the job is and what to ask next. A
 *   description can do this. It is the cheapest useful thing we produce.
 * - **Capture** — enough to ask somebody to go and film their workcell. Only
 *   the gates whose answers change *what to record* belong here.
 * - **Evaluation** — enough to prepare something a robot team would pay to run
 *   against. Everything binds here, and it is the only state that becomes
 *   supply.
 *
 * A gate says which of these it blocks (`QualifyingField.blocks`). An unknown
 * carton weight does not stop us documenting where the conveyor is; not knowing
 * whether the station is rearranged between shifts does, because it decides
 * which configuration is worth recording at all.
 *
 * ## What this is not
 *
 * It is not the old six-question screen with new labels. The screen's defining
 * property was that six answers were required before anything happened; here
 * three of them gate a recording, the rest gate a sale, and every one of them
 * can be answered from footage we already hold or a question we ask later.
 * Rebuilding the screen as six compulsory chat turns would change the
 * decoration and not the requirement.
 */

import {
  gateFields,
  isCaptureMode,
  defaultCaptureMode,
  type CaptureMode,
  type QualifyingField,
} from "../data/siteTaskQualification";

/** What a submission is ready for. Ordered: each stage implies the ones before. */
export const READINESS_STAGES = [
  /** Something arrived. We have not read it yet. */
  "received",
  /** Read, drafted, and waiting on the operator for something specific. */
  "needs_clarification",
  /** The operator has confirmed our reading. The gates are theirs now. */
  "brief_confirmed",
  /** Confirmed, and what is missing is footage rather than answers. */
  "capture_needed",
  /** Confirmed, captured, reconstructed. The only stage that is supply. */
  "evaluation_ready",
] as const;

export type ReadinessStage = (typeof READINESS_STAGES)[number];

/** Which gates bind, given how the site is being captured. */
export function bindingGates(captureMode: CaptureMode): readonly QualifyingField[] {
  return gateFields.filter(
    (field) => !field.bindsForCaptureModes || field.bindsForCaptureModes.includes(captureMode),
  );
}

/**
 * The gates that have to be settled before we ask anyone to film.
 *
 * Deliberately a subset. Everything else can be settled with the footage in
 * hand, which is both later and easier for the operator.
 */
export function captureBlockingGates(captureMode: CaptureMode): readonly QualifyingField[] {
  return bindingGates(captureMode).filter((field) => field.blocks === "capture");
}

/** The gates a robot team's result depends on. All of them, by the end. */
export function evaluationBlockingGates(captureMode: CaptureMode): readonly QualifyingField[] {
  return bindingGates(captureMode);
}

export interface ReadinessInput {
  /** Gate answers on file, from any source. */
  answers: Readonly<Record<string, string | undefined>>;
  captureMode?: string | null;
  /** True once we have read the evidence and drafted a brief from it. */
  briefDrafted: boolean;
  /** True once the operator has confirmed the brief we drafted. */
  briefConfirmed: boolean;
  /**
   * What the evidence on file is good for.
   *
   * Two purposes, not two uploads. One recording can serve both, and when it
   * does we reuse it — nobody films twice because our workflow has stages.
   */
  evidence: EvidenceOnFile;
  /** True once a scene exists. */
  reconstructed: boolean;
}

/**
 * The same footage, asked two different questions.
 *
 * A video that shows a carton going from conveyor to pallet can explain the job
 * perfectly and still leave most of the surrounding geometry unseen — a
 * stationary close-up is a good demonstration and a poor scene capture. So
 * "explains the task" and "covers the scene" are separate findings about one
 * artifact, and collapsing them into a single boolean is what produces the
 * "upload a better video" message that tells the operator nothing.
 *
 * Whether one continuous recording can satisfy both is a fact about our
 * reconstruction pipeline, and it is the pipeline's acceptance criteria that
 * decide it — not an assumption made here.
 */
export interface EvidenceOnFile {
  /** A description, photographs, or a recording: anything we can read. */
  hasAny: boolean;
  /**
   * Photographs or a recording, as opposed to words.
   *
   * Separate from `explainsTask` because a description can explain the job
   * perfectly and there is still nothing to look at. Conflating them told
   * someone who had written us two sentences that their footage needed more
   * views of the work area -- footage they had never taken. Whether there is
   * anything visual on file decides which sentence they get; whether it covers
   * the scene decides whether they film at all.
   */
  hasVisual: boolean;
  /** Enough to say what the job is, what the objects are, and what success looks like. */
  explainsTask: boolean;
  /** Enough visual coverage of the work area to prepare a scene. */
  coversScene: boolean;
  /**
   * The specific views still needed, when we know them.
   *
   * The difference between a request an operator can act on and one they
   * cannot: "views of the pallet area and the space beside the conveyor",
   * rather than "a better video".
   */
  missingCoverage?: readonly string[];
}

export interface ReadinessVerdict {
  stage: ReadinessStage;
  /** Gate ids blocking a capture request. Empty means we can ask them to film. */
  blockingCapture: readonly string[];
  /** Gate ids blocking a sale. Empty plus a scene means this is supply. */
  blockingEvaluation: readonly string[];
  /** True when a robot team may be shown this site. */
  isSupply: boolean;
  /** One line for the operator: what happens next and why. */
  nextAction: string;
}

function unanswered(
  fields: readonly QualifyingField[],
  answers: ReadinessInput["answers"],
): string[] {
  return fields
    .filter((field) => {
      const answer = answers[field.id];
      return answer === undefined || answer === null || answer === "";
    })
    .map((field) => field.id);
}

/**
 * Where a submission stands, and what would move it.
 *
 * Pure, so the same verdict can be shown to an operator, enforced on a
 * reconstruction, and queried for supply without three implementations
 * disagreeing about what "ready" meant.
 */
export function assessReadiness(input: ReadinessInput): ReadinessVerdict {
  const captureMode = isCaptureMode(input.captureMode)
    ? input.captureMode
    : defaultCaptureMode;

  const blockingCapture = unanswered(captureBlockingGates(captureMode), input.answers);
  const blockingEvaluation = unanswered(evaluationBlockingGates(captureMode), input.answers);

  // Supply is the strict conjunction, and it is the only thing a robot team
  // sees. Text intake can discover future supply; it must never inflate the
  // runnable catalogue, and this is where that is enforced.
  const isSupply =
    input.briefConfirmed && input.reconstructed && blockingEvaluation.length === 0;

  if (isSupply) {
    return {
      stage: "evaluation_ready",
      blockingCapture,
      blockingEvaluation,
      isSupply: true,
      nextAction: "Ready for evaluation. Robot teams can run against this scene.",
    };
  }

  if (!input.briefDrafted) {
    // Ours to do, and worth its own stage: an operator looking at this should
    // see "we are reading it", not a list of things they have failed to
    // provide.
    return {
      stage: "received",
      blockingCapture,
      blockingEvaluation,
      isSupply: false,
      nextAction: "We are reading what you sent and drafting the task brief.",
    };
  }

  if (!input.briefConfirmed) {
    // Drafted, and the operator has not said whether we read it right. Nothing
    // downstream moves on our reading alone -- that is the whole point of the
    // confirmation, and why it can stand in for a questionnaire.
    return {
      stage: "needs_clarification",
      blockingCapture,
      blockingEvaluation,
      isSupply: false,
      nextAction:
        "Check the task brief we drafted and correct anything we read wrong. Confirming it is "
        + "what lets us act on it.",
    };
  }

  if (blockingCapture.length) {
    return {
      stage: "brief_confirmed",
      blockingCapture,
      blockingEvaluation,
      isSupply: false,
      nextAction:
        "Before we suggest a recording, a couple of details would change what we need you to "
        + "film.",
    };
  }

  if (!input.evidence.coversScene) {
    // Three different things to say here, and the difference matters to whoever
    // has to act on it. What we must never say is "film it again" to someone
    // whose footage we are keeping.
    // Three cases, and the difference is what the operator can act on. The one
    // thing we never say is "film it again" to someone whose footage we intend
    // to keep -- or "we need more views" to someone who has not filmed at all.
    const nextAction = input.evidence.hasVisual && input.evidence.explainsTask
      ? input.evidence.missingCoverage?.length
        ? "Your footage shows the task clearly. To prepare the scene we also need "
          + `${input.evidence.missingCoverage.join(", ")}.`
        : "Your footage shows the task clearly. To prepare the scene we need a few more views of "
          + "the work area — we will tell you which."
      : blockingEvaluation.length
        ? "We have enough to guide the recording. Some answers are still needed before a robot "
          + "team can evaluate this, and you can film the work area now."
        : "We have enough to guide the recording. Film the work area and we will take it from "
          + "there.";

    return {
      stage: "capture_needed",
      blockingCapture,
      blockingEvaluation,
      isSupply: false,
      nextAction,
    };
  }

  // The footage already meets the capture requirements, so there is no second
  // upload. What is left is our work, or a specific answer.
  return {
    stage: "capture_needed",
    blockingCapture,
    blockingEvaluation,
    isSupply: false,
    nextAction: input.reconstructed
      ? `Scene built. Still needed before a robot team can evaluate it: ${blockingEvaluation.join(", ")}.`
      : "Your footage meets our capture requirements. No additional recording is needed — we are "
        + "building the scene.",
  };
}

/**
 * Whether it is worth spending on a reconstruction.
 *
 * The check reconstruction never had. `startWorldReconstruction` refused
 * unusable footage and footage that contradicted the site, and never asked
 * whether the resulting scene could be sold — so a site whose gates were blank
 * got a scene nothing could ever offer to a robot team. Paid for, and unsellable.
 */
export function shouldSpendOnReconstruction(input: ReadinessInput): {
  spend: boolean;
  reason: string;
} {
  if (!input.briefConfirmed) {
    return {
      spend: false,
      reason:
        "The task brief has not been confirmed, so the gates are still our reading rather than "
        + "the operator's answers. A scene built on that cannot be offered to anyone.",
    };
  }
  const verdict = assessReadiness(input);
  if (verdict.blockingEvaluation.length) {
    return {
      spend: false,
      reason:
        `Unanswered gates a robot team's result depends on: ${verdict.blockingEvaluation.join(", ")}. `
        + "The scene would be unsellable until these are settled.",
    };
  }
  return { spend: true, reason: "Brief confirmed and every binding gate answered." };
}
