/**
 * Which evaluations are worth a team's money today.
 *
 * ## The obvious ranking is the wrong one
 *
 * Ask "which sites is this robot most likely to pass?" and you get a list of
 * evaluations that teach nobody anything. A run confirming what the team
 * already knows produces a number they could have predicted, and they paid for
 * it. The whole reason to evaluate against a real site is to find out something
 * you did not know.
 *
 * So the ranking is **expected information gain per dollar**, not expected pass
 * rate. Concretely, the evaluations worth buying are the ones where:
 *
 * - **A hard constraint is unknown.** The match came back `provisional` because
 *   nobody has established whether this robot clears the payload or the
 *   envelope. One run settles it. This is the highest-value run in the system
 *   and it is worth more than a comfortable pass.
 * - **The site is near the edge of the team's known envelope.** A run inside
 *   the envelope confirms; a run just outside it maps where the envelope
 *   actually ends. The boundary is where the information is.
 * - **The scene is unlike anything the team has been run against.** The
 *   fifteenth tote-to-pallet warehouse teaches less than the first cold-storage
 *   room, whatever the scores.
 *
 * And the ones worth skipping:
 *
 * - **Already answered.** Same site, same checkpoint, recent result. Re-running
 *   it buys a second copy of a number we have.
 * - **Ruled out on a hard constraint we already measured.** Not a close call
 *   worth testing — a known no. Spending here is buying a confirmation of
 *   failure.
 *
 * ## Why this is arithmetic and not an agent
 *
 * Every input is a number we already hold: match outcome, band distances,
 * scene attributes, prior runs. A model asked to rank these would produce a
 * plausible ordering nobody could audit, and would be tempted by exactly the
 * pass-rate heuristic this module exists to reject. The agent's job is to
 * decide *whether to spend* and to explain the result afterwards; choosing
 * which rows to buy is a sort.
 *
 * ## Budget packing
 *
 * Given a daily budget, take candidates in value order while they fit. A
 * deliberately simple greedy pass rather than a knapsack: evaluations here are
 * near-uniform in cost, so the optimal packing and the greedy one agree almost
 * always, and a team reading its own agent's decisions should be able to
 * follow them.
 */

import type { MatchResult } from "../../client/src/lib/robotMatch";

export interface EvalCandidate {
  /** The scene this run would execute against. */
  sceneId: string;
  siteLabel: string;
  /** What the matcher concluded for this team against this site. */
  match: Pick<MatchResult, "outcome" | "score" | "scored" | "unknownHardConstraints">;
  /** Cost of the run at the team's rate, already quoted. */
  costUsd: number;
  /**
   * A coarse family label for the task — "tote_transfer", "shelf_restock".
   * Used to reward variety, not to judge fit.
   */
  taskFamily: string | null;
  /** Scene families this team has already been evaluated against. */
  alreadyEvaluatedFamilies?: readonly string[];
  /** True when this exact scene and checkpoint already produced a result. */
  alreadyRunForCheckpoint?: boolean;
}

export interface RankedEval extends EvalCandidate {
  /** Higher is worth buying sooner. Unitless; only the ordering means anything. */
  value: number;
  valuePerDollar: number;
  /** Why this ranked where it did, in words a team can argue with. */
  rationale: string;
  /** Set when the candidate should not be bought at all. */
  skipReason: string | null;
}

export interface SelectionResult {
  selected: RankedEval[];
  skipped: RankedEval[];
  totalCostUsd: number;
  budgetUsd: number;
  /** Plain summary of what the agent did and why, for the team to read. */
  summary: string;
}

/** An unknown hard constraint is the single most valuable thing to resolve. */
const VALUE_UNKNOWN_HARD_CONSTRAINT = 100;
/** A confirmed match near the edge of what we know teaches more than a safe one. */
const VALUE_BOUNDARY = 45;
/** First time against this kind of task. */
const VALUE_NOVEL_FAMILY = 35;
/** A plain confirmed match, inside the envelope. Worth something, not much. */
const VALUE_CONFIRMATION = 10;

/**
 * Score one candidate.
 *
 * Returns a skip reason instead of a low score where the right answer is "do
 * not buy this at all". A near-zero score still gets bought when the budget is
 * large, and some of these should never be bought.
 */
export function scoreEvalCandidate(candidate: EvalCandidate): RankedEval {
  const base: Omit<RankedEval, "value" | "valuePerDollar" | "rationale" | "skipReason"> = {
    ...candidate,
  };

  const finish = (value: number, rationale: string, skipReason: string | null = null): RankedEval => ({
    ...base,
    value,
    valuePerDollar: candidate.costUsd > 0 ? value / candidate.costUsd : value,
    rationale,
    skipReason,
  });

  if (candidate.alreadyRunForCheckpoint) {
    return finish(
      0,
      "This checkpoint already has a result on this scene.",
      "already_answered",
    );
  }

  if (candidate.match.outcome === "ruled_out") {
    return finish(
      0,
      "A hard constraint we have already measured rules this robot out here.",
      "ruled_out_on_measured_constraint",
    );
  }

  const unknowns = candidate.match.unknownHardConstraints?.length ?? 0;
  if (unknowns > 0) {
    // The best money in the system. A provisional match is an open question,
    // and one run closes it for every future site with the same constraint.
    return finish(
      VALUE_UNKNOWN_HARD_CONSTRAINT + unknowns * 10,
      `Resolves ${unknowns} hard constraint${unknowns === 1 ? "" : "s"} nobody has established for this robot. One run answers it for every site that shares them.`,
    );
  }

  const novelFamily =
    candidate.taskFamily != null &&
    !(candidate.alreadyEvaluatedFamilies ?? []).includes(candidate.taskFamily);

  // How comfortably this cleared. A team that clears every soft constraint is
  // well inside its envelope; one that clears half is at the boundary, which is
  // where a run actually tells you something.
  const clearedRatio =
    candidate.match.scored > 0 ? candidate.match.score / candidate.match.scored : 1;
  const nearBoundary = clearedRatio <= 0.7;

  if (nearBoundary && novelFamily) {
    return finish(
      VALUE_BOUNDARY + VALUE_NOVEL_FAMILY,
      "Near the edge of this robot's known envelope, and the first run against this kind of task.",
    );
  }
  if (nearBoundary) {
    return finish(
      VALUE_BOUNDARY,
      "Near the edge of the known envelope, which is where a run maps something rather than confirming it.",
    );
  }
  if (novelFamily) {
    return finish(
      VALUE_NOVEL_FAMILY,
      "First run against this kind of task, so the result is not predictable from the ones already held.",
    );
  }

  return finish(
    VALUE_CONFIRMATION,
    "Comfortably inside the known envelope and a familiar task; the result is close to predictable.",
  );
}

/**
 * Fill a budget with the most informative runs available.
 *
 * Ordering is by value per dollar, then raw value — so where two runs teach the
 * same amount the cheaper one goes first, and where they cost the same the more
 * informative one does.
 */
export function selectEvalsForBudget(params: {
  candidates: readonly EvalCandidate[];
  budgetUsd: number;
  /** Optional hard ceiling on how many runs to start at once. */
  maxRuns?: number;
}): SelectionResult {
  const scored = params.candidates.map(scoreEvalCandidate);
  const skipped = scored.filter((item) => item.skipReason !== null);

  const buyable = scored
    .filter((item) => item.skipReason === null)
    .sort((a, b) => b.valuePerDollar - a.valuePerDollar || b.value - a.value);

  const selected: RankedEval[] = [];
  let totalCostUsd = 0;

  for (const candidate of buyable) {
    if (params.maxRuns != null && selected.length >= params.maxRuns) break;
    if (totalCostUsd + candidate.costUsd > params.budgetUsd) continue;
    selected.push(candidate);
    totalCostUsd = Math.round((totalCostUsd + candidate.costUsd) * 100) / 100;
  }

  const unaffordable = buyable.filter((item) => !selected.includes(item));

  return {
    selected,
    skipped: [...skipped, ...unaffordable.map((item) => ({ ...item, skipReason: "over_budget" }))],
    totalCostUsd,
    budgetUsd: params.budgetUsd,
    summary: buildSummary(selected, skipped.length, unaffordable.length, totalCostUsd, params.budgetUsd),
  };
}

function buildSummary(
  selected: readonly RankedEval[],
  skippedCount: number,
  unaffordableCount: number,
  totalCostUsd: number,
  budgetUsd: number,
): string {
  if (!selected.length) {
    return skippedCount || unaffordableCount
      ? `Nothing worth buying today: ${skippedCount} candidate(s) were already answered or ruled out, and ${unaffordableCount} did not fit the $${budgetUsd} budget.`
      : "No evaluation candidates available today.";
  }

  const resolving = selected.filter(
    (item) => (item.match.unknownHardConstraints?.length ?? 0) > 0,
  ).length;

  const parts = [
    `Starting ${selected.length} run${selected.length === 1 ? "" : "s"} for $${totalCostUsd} of a $${budgetUsd} budget.`,
  ];
  if (resolving) {
    parts.push(
      `${resolving} of them close a hard constraint nobody has established for this robot, which is the most useful thing money can buy here.`,
    );
  }
  if (skippedCount) {
    parts.push(`${skippedCount} candidate(s) were skipped as already answered or ruled out.`);
  }
  return parts.join(" ");
}
