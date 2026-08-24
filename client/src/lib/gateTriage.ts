/**
 * Gate triage.
 *
 * Turns a set of gated enum answers into one of three dispositions. Serves both
 * intakes: `@/data/siteTaskQualification` for sites and
 * `@/data/robotTeamQualification` for robot teams. The two ask about entirely
 * different things — a site is screened on whether a robot can work there, a
 * robot team on whether it would actually deploy — but the scoring shape is
 * identical, so there is one implementation and one set of guarantees rather
 * than two that drift. Imported by both the client (to show an operator where they
 * stand) and the server (as the authority), following the existing
 * `structuredIntake.ts` pattern — `server/routes/inbound-request.ts` reaches
 * into `client/src/lib/` deliberately so one implementation serves both.
 *
 * ## Rules decide. The model reads prose.
 *
 * This module contains no LLM call and must not acquire one. Everything it
 * decides is decidable from an enum: a site outside the metro, a scene that
 * gets rearranged, a station that never goes quiet. Delegating those to a model
 * would make the most consequential decisions in the funnel non-reproducible
 * and unauditable, and would mean two identical submissions could get different
 * answers.
 *
 * What a model is genuinely better at — reading the task description to judge
 * whether "one task" is really one task, and catching contradictions between
 * the dropdowns and the prose — happens downstream in the `inbound_qualification`
 * agent, against the `verdict` this module produces.
 *
 * ## The model may downgrade. It may never upgrade.
 *
 * `applyNarrativeReview` is the only door between the two, and it opens one
 * way. A model can move `qualified` to `needs_conversation`, or either to
 * `not_now`; it cannot move anything up. So the worst a hallucination can do is
 * cost a call. It cannot put an operator in a car.
 *
 * This mirrors a guardrail the repo already relies on: `server/agents/workflows.ts`
 * downgrades an LLM's `qualified_ready` to `in_review` rather than trusting it.
 * The same instinct, made structural.
 */

import {
  gateFields as siteGateFields,
  type OptionVerdict,
  type QualifyingField,
} from "@/data/siteTaskQualification";

/**
 * The three outcomes.
 *
 * `not_now` is deliberately not `rejected`. Every blocking answer carries the
 * change that would flip it, so the honest output is a deferral with a reason
 * rather than a no.
 */
export type TriageDisposition = "qualified" | "needs_conversation" | "not_now";

export interface TriageReason {
  /** The gate field that produced this reason. */
  fieldId: string;
  question: string;
  /** The option label the operator chose, echoed back in their words. */
  answer: string;
  verdict: Exclude<OptionVerdict, "clear">;
  /** For a blocker, what would flip it. For a marginal, why a form cannot settle it. */
  detail: string;
  /** Which of the four public conditions this bears on, when it bears on one. */
  condition?: string;
}

export interface TriageResult {
  disposition: TriageDisposition;
  /** Blocking reasons, in gate order. Empty unless `not_now`. */
  blockers: readonly TriageReason[];
  /** Marginal reasons. These are the agenda for the call. */
  openQuestions: readonly TriageReason[];
  /** Gate ids with no answer recorded. An unanswered gate is never a pass. */
  unanswered: readonly string[];
  /**
   * True when the disposition was reached without every gate answered, so a
   * caller can tell "we know this is a no" from "we could not tell".
   */
  incomplete: boolean;
}

export type GateAnswers = Readonly<Record<string, string | undefined>>;

function findOption(field: QualifyingField, value: string | undefined) {
  if (!value) return undefined;
  return field.options.find((option) => option.value === value);
}

/**
 * Score the gate answers.
 *
 * An unanswered gate cannot pass. Treating a blank as clear would let a partial
 * submission qualify, which is the one failure mode that costs a real visit —
 * so blanks push toward a conversation, and a submission with any blank never
 * returns `qualified`.
 */
export function triageGateAnswers(
  answers: GateAnswers,
  /** Defaults to the site-task gates, which were the first caller. */
  fields: readonly QualifyingField[] = siteGateFields,
): TriageResult {
  const blockers: TriageReason[] = [];
  const openQuestions: TriageReason[] = [];
  const unanswered: string[] = [];

  for (const field of fields) {
    const option = findOption(field, answers[field.id]);

    if (!option) {
      unanswered.push(field.id);
      continue;
    }

    if (option.verdict === "blocking") {
      blockers.push({
        fieldId: field.id,
        question: field.question,
        answer: option.label,
        verdict: "blocking",
        detail: option.unblocks ?? "",
        condition: field.condition,
      });
      continue;
    }

    if (option.verdict === "marginal") {
      openQuestions.push({
        fieldId: field.id,
        question: field.question,
        answer: option.label,
        verdict: "marginal",
        detail: option.ambiguity ?? "",
        condition: field.condition,
      });
    }
  }

  const incomplete = unanswered.length > 0;

  // A blocker is decisive even on a partial submission: being outside the metro
  // does not become truer or less true once the rest of the form is filled in.
  const disposition: TriageDisposition = blockers.length
    ? "not_now"
    : openQuestions.length || incomplete
      ? "needs_conversation"
      : "qualified";

  return { disposition, blockers, openQuestions, unanswered, incomplete };
}

/* ------------------------------------------------- the one-way door */

/** What the downstream triage model is allowed to report back. */
export interface NarrativeReview {
  /**
   * The model's read of the free-text description against the structured
   * answers. `contradicts_structured` is the case worth building for: a
   * description of three jobs filed under "one task, done the same way".
   */
  finding: "consistent" | "needs_detail" | "contradicts_structured";
  /** The model's own words, surfaced to ops rather than to the operator. */
  note: string;
}

const RANK: Record<TriageDisposition, number> = {
  qualified: 2,
  needs_conversation: 1,
  not_now: 0,
};

/**
 * Fold a model's read of the prose into a rules-derived result.
 *
 * Monotone toward caution by construction: the returned disposition is the
 * lower of the two ranks, so no `finding` can raise an outcome. A model that
 * decides a blocked submission looks great changes nothing.
 */
export function applyNarrativeReview(
  base: TriageResult,
  review: NarrativeReview | null | undefined,
): TriageResult {
  if (!review || review.finding === "consistent") {
    return base;
  }

  // Both non-consistent findings propose the same ceiling today: a human should
  // look. They are kept as separate findings because they need different
  // agendas on the call, not because they route differently — if that ever
  // changes, it changes here, and the min() below still guarantees the door
  // only opens downward.
  const proposed: TriageDisposition = "needs_conversation";

  const disposition = RANK[proposed] < RANK[base.disposition] ? proposed : base.disposition;

  if (disposition === base.disposition) {
    return base;
  }

  return {
    ...base,
    disposition,
    openQuestions: [
      ...base.openQuestions,
      {
        fieldId: "taskDescription",
        question: "Does the description match the structured answers?",
        answer:
          review.finding === "contradicts_structured"
            ? "The description and the dropdowns disagree"
            : "The description needs more detail",
        verdict: "marginal",
        detail: review.note,
      },
    ],
  };
}

/* ------------------------------------------------------ what we say back */

/**
 * The operator-facing message for each disposition.
 *
 * `not_now` gets the most care of the three. It is the highest-volume outcome
 * and the one most often wasted: a rejection that names the condition that
 * failed and the change that would flip it is a reason to come back, and a
 * generic no is not.
 */
export function describeDisposition(result: TriageResult): {
  headline: string;
  body: string;
  nextStep: string;
} {
  if (result.disposition === "not_now") {
    const first = result.blockers[0];
    return {
      headline: "Not yet — and here is exactly what is in the way.",
      body: first
        ? `You told us: ${first.answer.toLowerCase()}. ${first.detail}`
        : "One of the screening conditions does not hold at this site today.",
      nextStep:
        "We keep the task on file and come back to you when that changes on our side or yours. No call needed for this answer.",
    };
  }

  if (result.disposition === "needs_conversation") {
    return {
      headline: "Close. A short call settles it.",
      body: result.openQuestions.length
        ? `${result.openQuestions.length === 1 ? "One thing" : `${result.openQuestions.length} things`} cannot be decided from a form — we will bring exactly those to the call rather than starting from scratch.`
        : "We need a little more of the picture before putting this in front of a robot team.",
      nextStep: "About thirty minutes, with the agenda already written.",
    };
  }

  return {
    headline: "This clears the screen.",
    body: "Every condition holds and the task is specific enough to put in front of the robot teams we are talking to.",
    nextStep:
      "We check it against those teams before scheduling anything. A capture only follows a match — we do not capture speculatively.",
  };
}
