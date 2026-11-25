/**
 * The beta is free for everyone (founder decision, 2026-10-13).
 *
 * Sites pay nothing to submit a job, have Blueprint simulate it and run the
 * candidates, or see the result. Technology providers pay nothing to give
 * Blueprint access to a policy or an integration. There are no balances,
 * top-ups, private paid evaluations or checkout during the beta, and no future
 * price is announced here.
 *
 * Any physical pilot is agreed directly between the site and the deployment
 * company. Blueprint takes no cut of it and charges nothing for it.
 */

/*
 * No price lives here. The old $99 entry price and the Stripe top-up minimum
 * were removed on 2026-11-19: nothing read them (`cohortEconomics.ts` and
 * `MIN_TOPUP_USD` no longer exist), and a price a public page can import is a
 * price it can quote. Deployment companies will pay; how is not decided, and
 * no price is stated anywhere (owner, 2026-11-12).
 */

/** What Blueprint charges anyone during the beta. */
export const betaFeeUsd = 0;

/**
 * What a site can do when a company it was introduced to drops out (Terms 2026-11-21.1, owner approval of 2026-11-21;
 * in the words of Terms 2026-11-25.2, owner, 2026-11-25). No person at Blueprint reviews a replacement: the site accepts
 * any other company that applied (or whose stored answer is "Tested it: can do"), with no limit per job
 * (`server/utils/jobIntroductions.ts`).
 * The Terms write this sentence out as `REPLACEMENT_SENTENCE`, so their digest covers it; a test keeps the two the same.
 */
export const pilotReplacementPolicy =
  "If a company you were introduced to drops out, you can accept another company that applied.";

/** What a site pays for the simulation, the evaluation and its result: nothing. */
export const siteAssessment = {
  amount: betaFeeUsd,
  unit: "during the beta",
  summary: "One job packet for one recurring job at one site: a first look at which robots could fit and a simulation of the site.",
  covers: [
    "Your sentence for the job, drafted from your video if you leave it empty.",
    "A first look on paper: the robot most likely to fit, from published specifications and where it has been used.",
    "A simulation of your site, built from your video, whatever the kind of job.",
    "With your permission, a summary of your job shared with deployment companies we approve; any work is agreed between you and the company.",
  ],
  allIn:
    "Free for sites. Nothing is charged today.",
  bounded: "A bounded estimate for your job, with its evidence limits; it never certifies physical performance or safety. You choose and approve any pilot terms.",
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
    "Sites pay nothing. The deployment companies we approve see your job, with your video without its sound, only to decide whether they can do it. Sharing a job does not give anyone permission to train on it.",
  whatIsNotFree:
    "Blueprint assessment and coordination are free during the beta. Physical pilot costs are quoted by the deployment company and agreed directly with the site. Blueprint takes no cut of the pilot.",
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
