/**
 * Where a gate answer came from.
 *
 * Inbound and outbound produce the same shape of answer and mean entirely
 * different things by it. A site that filled in the form told us its scene is
 * stable. A prospect we found told us nothing — we guessed from the building
 * type, and the guess is a hypothesis to put in front of them, not a fact.
 *
 * Both end up in the same `siteTaskGates` map, which is exactly why this exists.
 * Without provenance, an outbound guess is indistinguishable from an operator's
 * statement one function call later, and the thing at the end of that chain
 * spends money: `decideCaptureDispatch` sends a capturer to an address or
 * commits a paid reconstruction.
 *
 * ## The rule
 *
 * An inferred answer can form a hypothesis. It can never qualify a site.
 *
 * This is the fourth instance of a door the codebase already builds the same
 * way — `applyNarrativeReview`, `credibleVideoContradictions` and
 * `clampRecommendationToGates` all move a verdict downward and never upward.
 * Outbound is the case where the pressure to cheat is highest, because a
 * confident-sounding model can produce six plausible answers about a warehouse
 * it has never seen, and every one of them would read as operator truth.
 *
 * Provenance is per field rather than per request because a reply corrects some
 * answers and not others. A prospect who writes back "actually we run two
 * shifts, not three" has stated one gate and left five inferred, and treating
 * that whole request as operator-stated would be the same error at a smaller
 * scale.
 */

export type GateAnswerSource =
  /** The operator said it: the intake form, or a reply we transcribed. */
  | "operator_stated"
  /** We guessed it from observable facts about the facility. */
  | "inferred";

export type GateAnswerSources = Readonly<Record<string, GateAnswerSource>>;

/** Absent provenance means operator-stated: every inbound answer predates this. */
export const DEFAULT_GATE_ANSWER_SOURCE: GateAnswerSource = "operator_stated";

export function gateAnswerSource(
  sources: GateAnswerSources | null | undefined,
  fieldId: string,
): GateAnswerSource {
  const value = sources?.[fieldId];
  return value === "inferred" ? "inferred" : DEFAULT_GATE_ANSWER_SOURCE;
}

export interface InferredGateAudit {
  /** Gate ids still resting on a guess. */
  readonly inferredFieldIds: readonly string[];
  /** True when nothing is inferred, so a verdict may stand on its own. */
  readonly allOperatorStated: boolean;
}

/**
 * Which of the gates that actually matter are still guesses.
 *
 * Takes the field ids that bind — the caller has already applied capture mode,
 * so a gate nobody was asked cannot hold a request open.
 */
export function auditInferredGates(
  bindingFieldIds: readonly string[],
  sources: GateAnswerSources | null | undefined,
): InferredGateAudit {
  const inferredFieldIds = bindingFieldIds.filter(
    (fieldId) => gateAnswerSource(sources, fieldId) === "inferred",
  );
  return { inferredFieldIds, allOperatorStated: inferredFieldIds.length === 0 };
}

/**
 * Promote the answers a prospect actually corrected.
 *
 * Only the fields named become operator-stated; everything else keeps whatever
 * it had. A reply that answers one question does not ratify the other five.
 */
export function withOperatorStatedAnswers(
  sources: GateAnswerSources | null | undefined,
  statedFieldIds: readonly string[],
): GateAnswerSources {
  const next: Record<string, GateAnswerSource> = { ...(sources || {}) };
  for (const fieldId of statedFieldIds) {
    next[fieldId] = "operator_stated";
  }
  return next;
}
