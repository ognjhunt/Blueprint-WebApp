/**
 * The record the Pipeline owes us, and the tests that say whether it delivered.
 *
 * ## The gap this closes, and the one it cannot
 *
 * `/api/internal/pipeline/agent-run-results` and
 * `/api/internal/pipeline/agent-run-settlements` are live, signed, and have no
 * caller. The execution Pipeline lives in a repository this one cannot change,
 * so until it reports, a real evaluation run is **released at expiry rather
 * than billed** and the team never learns what it showed. Revenue is
 * structurally zero even when work executes.
 *
 * "Different repo" is an ownership problem, not a product boundary — somebody
 * has to own the whole transaction. What this repo can own is the contract:
 * what a completed run has to say about itself, and a suite that answers
 * whether an implementation got it right. That is the artifact this module is.
 *
 * ## Why one record rather than two calls
 *
 * The two routes are deliberately separate: one carries what the work cost and
 * one what it showed, so a change to either schema cannot silently stop the
 * other happening. But they are two *views of one event*, and the Pipeline
 * should not be asked to decide twice what happened. So it emits one completion
 * record and both routes consume it idempotently.
 *
 * ## What "idempotent" has to mean here
 *
 * The repeated-delivery case is the one our current code gets wrong, and it is
 * worth stating exactly. A settlement is keyed on the reservation, so the
 * ledger dedupes a retry of the *same* call. What it did not handle was a
 * second, *different* resolution of the same reservation — a timeout releasing
 * a hold and a late completion then settling it. That is now one financial
 * resolution, first one wins, with the later amount absorbed rather than
 * charged (see `deriveBalance`). The result is still recorded, because
 * financial finality and evidence retention are different things and a late
 * result is still a result.
 *
 * Which is why `episodes_billable` is its own field rather than derived. The
 * Pipeline knows which attempts were the robot's failure and which were our
 * environment's; we must not infer that from a count.
 */

import { z } from "zod";

/**
 * What a finished run has to be able to say about itself.
 *
 * Every field is here because something downstream breaks without it, and the
 * comments say what. A field nobody can name a consumer for does not belong in
 * a contract another team has to implement.
 */
export const completionRecordSchema = z
  .object({
    /** The identity both sides agreed on. Settlement and results key on it. */
    reservation_id: z.string().trim().min(1).max(300),
    /** The Pipeline's own id, for its logs and ours to be reconcilable. */
    run_id: z.string().trim().min(1).max(200),
    team_id: z.string().trim().min(1).max(200),

    /**
     * What was actually run, and against what.
     *
     * A measured band belongs to a checkpoint, an embodiment, a scene version,
     * a task definition and a scoring version -- not to a team in general. A
     * result that cannot name its own inputs cannot be invalidated later when
     * one of them turns out to have been wrong.
     */
    checkpoint_version: z.string().trim().min(1).max(200),
    scene_version: z.string().trim().min(1).max(200),
    scoring_version: z.string().trim().min(1).max(200),

    /** Episodes that executed. The denominator, and the cost side's input. */
    episodes_run: z.number().int().min(0).max(100_000),
    /**
     * Of those, the ones that met the task's success contract.
     *
     * Refused rather than clamped when it exceeds `episodes_run`: more
     * successes than attempts is a bug on the reporting side, and clamping it
     * would write a measured claim from a number nobody meant.
     */
    episodes_succeeded: z.number().int().min(0).max(100_000),
    /**
     * Of those, the ones the team is charged for.
     *
     * Separate from `episodes_run` because the published rule is that a failed
     * attempt is billable and a failure of ours is not: "the robot dropping the
     * box is a result, and you pay for it. An environment that will not launch
     * is not a result, and you do not." Only the Pipeline knows which is which,
     * so it says, rather than us guessing from a count.
     */
    episodes_billable: z.number().int().min(0).max(100_000),

    /**
     * Attempts lost to our own infrastructure, itemised.
     *
     * Not billable, and worth carrying separately from "did not succeed" so a
     * bad week for our environment does not read as a bad policy.
     */
    infrastructure_failures: z
      .array(
        z.object({
          episode_index: z.number().int().min(0).max(100_000),
          reason: z.string().trim().min(1).max(400),
        }),
      )
      .max(1_000)
      .default([]),

    /** Where the artifacts are, so a result is inspectable rather than asserted. */
    result_manifest_uri: z.string().trim().min(1).max(1600),

    median_cycle_seconds: z.number().finite().nonnegative().max(86_400).nullish(),
    cycle_seconds_p10: z.number().finite().nonnegative().max(86_400).nullish(),
    cycle_seconds_p90: z.number().finite().nonnegative().max(86_400).nullish(),

    /** The rate the episodes were quoted at, so the cost is checkable. */
    rate_usd: z.number().finite().min(0).max(1_000),

    /** When the run finished, for ordering two reports of one event. */
    completed_at_iso: z.string().trim().min(1).max(64),
    note: z.string().trim().max(2000).nullish(),
  })
  .strict();

export type CompletionRecord = z.infer<typeof completionRecordSchema>;

export type CompletionRecordProblem =
  | "successes_exceed_episodes"
  | "billable_exceeds_episodes"
  | "infrastructure_failures_exceed_episodes"
  | "billable_overlaps_infrastructure_failures";

/**
 * The checks a schema cannot express.
 *
 * All four are relationships between fields, and each one has a way of being
 * wrong that produces a plausible-looking number rather than an obvious error —
 * which is why they are refusals rather than clamps.
 */
export function validateCompletionRecord(record: CompletionRecord): CompletionRecordProblem[] {
  const problems: CompletionRecordProblem[] = [];

  if (record.episodes_succeeded > record.episodes_run) {
    problems.push("successes_exceed_episodes");
  }
  if (record.episodes_billable > record.episodes_run) {
    problems.push("billable_exceeds_episodes");
  }
  if (record.infrastructure_failures.length > record.episodes_run) {
    problems.push("infrastructure_failures_exceed_episodes");
  }
  // An episode cannot be both our fault and their bill. If the counts imply it
  // is, one of the two numbers is wrong and we do not know which.
  if (record.episodes_billable + record.infrastructure_failures.length > record.episodes_run) {
    problems.push("billable_overlaps_infrastructure_failures");
  }

  return problems;
}

/**
 * What the team is charged, from the record alone.
 *
 * Still capped at the quote by the settlement route, because a wrong rate on
 * the reporting side would otherwise come out of a real balance. This is the
 * amount the record *claims*; the ceiling is ours.
 */
export function billableAmountUsd(record: CompletionRecord): number {
  return Math.round(record.episodes_billable * record.rate_usd * 100) / 100;
}

/**
 * Whether this run is a spend or a release.
 *
 * Zero billable episodes is a release rather than a settle of nothing, so the
 * ledger says what happened instead of recording a spend of zero.
 */
export function resolutionFor(record: CompletionRecord): {
  kind: "settle" | "release";
  amountUsd: number;
  reason: string;
} {
  if (record.episodes_billable <= 0) {
    return {
      kind: "release",
      amountUsd: 0,
      reason:
        record.episodes_run === 0
          ? "No episode executed, so there is no result to charge for."
          : `${record.episodes_run} episodes ran and none were billable: `
            + `${record.infrastructure_failures.length} lost to our own infrastructure.`,
    };
  }
  return {
    kind: "settle",
    amountUsd: billableAmountUsd(record),
    reason: `${record.episodes_billable} of ${record.episodes_run} episodes billable.`,
  };
}
