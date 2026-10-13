/**
 * The beta is free for everyone (founder decision, 2026-10-13).
 *
 * Sites pay nothing to submit a job, have it screened, have robot teams
 * evaluate it in simulation, receive Blueprint's recommendation, or book the
 * recommended pilot. Robot teams pay nothing to evaluate a job they are invited
 * to. There are no balances, top-ups, private paid evaluations or checkout
 * during the beta, and no future price is announced here.
 *
 * The physical pilot that follows a booking is agreed directly between the
 * site and the robot team. Blueprint takes no cut of it and charges nothing
 * for it.
 */

/**
 * Historical paid-run planning price.
 *
 * @deprecated historical; not charged during the free beta. Kept only because
 * server-side cost accounting (`cohortEconomics.ts`, `teamEvalCandidates.ts`)
 * still prices the compute behind an evaluation against it. No public surface
 * may quote it.
 */
export const entryPrice = 99;

/**
 * Historical smallest Stripe top-up. Mirrors `MIN_TOPUP_USD` on the server.
 *
 * @deprecated historical; not charged during the free beta. Top-ups are
 * disabled; this stays only so preserved historical balances reconcile.
 */
export const minTopupUsd = entryPrice;

/** What Blueprint charges anyone during the beta. */
export const betaFeeUsd = 0;

/**
 * Owner-approved remedy for a robot team changing its confirmed scope. There
 * is no Blueprint fee during the beta, so there is nothing to refund.
 */
export const pilotReplacementPolicy =
  "If the recommended team withdraws or materially changes its confirmed scope before the pilot starts, we recommend a replacement whose evaluation on the same job passed, if one fits. Blueprint charges no fee during the beta, so there is no fee to refund.";

/** What a site pays for screening, evaluation, a recommendation and booking: nothing. */
export const siteAssessment = {
  amount: betaFeeUsd,
  unit: "during the beta",
  summary: "An evaluated recommendation for one job at one site.",
  covers: [
    "The job defined: objects, cycle, exceptions, timing, and the pass mark for an evaluation.",
    "Invited robot teams evaluate the job in a simulation built from your capture, free.",
    "One recommended robot team whose evaluation on your job passed, or a plain answer that no team has passed yet.",
    "For a recommended pilot: the team, what it tests, what you provide, and one button to book it.",
  ],
  allIn:
    "Free during the beta. Submitting a job, screening, evaluation, our recommendation and booking the recommended pilot cost nothing.",
  bounded: "One recommended pilot: a robot team whose evaluation on your job passed. You do not have to compare teams.",
  /**
   * Precise about what a robot team actually receives, because the loose
   * version — "they get your footage" — is both wrong and alarming. What they
   * run against is the 3D scene reconstructed from the walkthrough; the
   * walkthrough itself is an input we hold, not something we hand over.
   *
   * Pinned by `privacy-promise-consistency.test.ts` against the capture privacy
   * annex, so the two surfaces cannot promise different things.
   */
  whatWeGetFromIt:
    "Invited robot teams evaluate a qualified job for free during the beta, and the site pays nothing to receive or book the recommended pilot. Robot teams never receive your recording — it can be reconstructed into a 3D scene for a controlled evaluation under the rights you grant at intake and nothing wider.",
  whatIsNotFree:
    "Nothing Blueprint does costs the site during the beta. The physical pilot is agreed directly between the site and the robot team, and Blueprint takes no cut of it.",
} as const;

/* -------------------------------------------------------------------------
 * Operating constants.
 *
 * Below this line is how we run an evaluation, not what anyone is charged.
 * Nobody is charged during the beta and we size the run, so these numbers are
 * ours to set and ours to change. They stay here rather than in the scheduler
 * because `cohortEconomics.ts` prices the compute behind an evaluation, and the
 * scheduler and that ledger must read the same counts.
 *
 * What each count resolves, for a two-sided test at the conventional 95%
 * level:
 *
 *     episodes   smallest gap detectable   success-rate interval
 *     per policy  at 80% power              half-width at 70%
 *     ---------  -----------------------   ---------------------
 *         50            ~22 points               ~12 points
 *        500             ~8 points                ~4 points
 *
 * 50 is a screen and nothing more: it cuts only a candidate it can actually
 * rule out, roughly 20 points behind the leader, and everything closer
 * advances. 500 is the smallest count that resolves a gap of roughly 8 points,
 * which is the size of difference a final comparison actually has to settle.
 * Below about 5 points even 500 episodes cannot call a winner, and the result
 * says so instead.
 * ---------------------------------------------------------------------- */

/** One run of one policy on one scenario, up to the task's time limit. */
export const screeningRound = {
  id: "screening",
  name: "Screening",
  episodes: 50,
  purpose: "Cut the field to a shortlist, without cutting anything it cannot rule out.",
} as const;

export const finalistRound = {
  id: "finalist",
  name: "Final comparison",
  episodes: 500,
  purpose: "Separate the shortlist and produce the pilot recommendation.",
  /** Bounded so `siteAssessment.bounded` is a promise with a number behind it. */
  shortlist: 5,
} as const;

/**
 * How the shortlist is set. A fixed shortlist of three drops the genuinely best
 * candidate about a third of the time when the field is tight, because at 50
 * episodes a tight field is exactly the case screening cannot rank. Advancing
 * everyone screening cannot rule out fixes that without charging anybody more.
 *
 * The floor matters as much as the cap: a final comparison exists to *separate*
 * candidates, so with one credible candidate there is nothing to separate and
 * no comparison to run.
 */
export const shortlistRule = {
  cap: 5,
  floor: 2,
  statement:
    "Everything screening cannot separate from the leader goes forward, up to five — when there is more than one candidate to separate.",
  detail:
    "Screening only cuts a candidate it can rule out. A close field therefore carries more candidates into the final comparison, and a clearly separated one carries fewer. Nobody is cut on a difference screening cannot establish. A field of one is not a comparison, so it is reported as the single candidate it is rather than run against nobody.",
} as const;

/**
 * Whether a final comparison has anything to do.
 *
 * Kept next to the rule so the scheduler and the economics ledger read the same
 * function rather than two implementations of "enough candidates".
 */
export function finalistRoundRuns(shortlistedCandidates: number): {
  runs: boolean;
  reason: string;
} {
  if (shortlistedCandidates >= shortlistRule.floor) {
    return {
      runs: true,
      reason: `${shortlistedCandidates} candidates to separate, at ${finalistRound.episodes} episodes each.`,
    };
  }
  if (shortlistedCandidates === 1) {
    return {
      runs: false,
      reason:
        "One candidate is not a comparison. The screening result stands on its own and is "
        + "reported as a single candidate rather than as a winner.",
    };
  }
  return {
    runs: false,
    reason: "No candidate survived screening, so there is nothing to compare.",
  };
}

/** Episodes one entry is run for, across both rounds, when it goes the distance. */
export function episodesPerEntry(reachedFinal: boolean): number {
  return screeningRound.episodes + (reachedFinal ? finalistRound.episodes : 0);
}

/** Whole dollars stay whole; anything with cents keeps them. */
export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
