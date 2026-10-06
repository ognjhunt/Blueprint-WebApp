/**
 * Sites pay $2,500 per task only when they book the pilot Blueprint
 * recommends; invited pilot evaluations are free and shared with the site.
 * Robot teams pay $99 for a private evaluation of one policy/configuration on
 * one reconstructed site task. Private results are excluded from site updates
 * and pilot recommendations. Blueprint sets the run length. Physical pilots
 * are agreed separately.
 */

/** The billable unit, and the whole of its definition. */
export const entryDefinition =
  "One entry is one policy, running on one embodiment, against one task at one site.";

/**
 * The three readings a team could get wrong, stated before it can get them
 * wrong. Both halves of the pair count, and a pair is still only ever one
 * entry.
 */
export const entryBoundaries = [
  "The same policy on a second embodiment is a second entry.",
  "A second policy on the same embodiment is a second entry.",
  "A different embodiment running a different policy is one new entry, not two.",
] as const;

/** Historical paid-run planning price. Paid entrypoints are disabled for the free beta. */
export const entryPrice = 99;

/**
 * A site's fee, once per task and only when it books the pilot Blueprint
 * recommends. The server records the booking against this same number, so
 * the page and the record cannot quote different fees.
 */
export const pilotFeeUsd = 2500;

/**
 * The one approval a site gives: shown next to the "Book this pilot" button.
 * Booking and the fee are the same decision, so there is no earlier fee step.
 */
export const pilotBookingAuthorization =
  `I am authorized to book this pilot for my site and agree to Blueprint's ${formatPrice(pilotFeeUsd)} fee for this job, due when the pilot is booked.`;

/** Owner-approved remedy for a provider changing its confirmed offer. */
export const pilotReplacementPolicy =
  "If the recommended team withdraws or materially changes its confirmed price or scope before the pilot starts, we recommend a replacement that meets the same agreed requirements. If none fits, we refund your fee.";

/** The smallest top-up Stripe will charge. Mirrors `MIN_TOPUP_USD` on the server. */
export const minTopupUsd = entryPrice;

/** What a site pays for screening, evaluation and a recommendation: nothing. A booked pilot is `pilotFeeUsd`. */
export const siteAssessment = {
  amount: 0,
  unit: "to find out",
  summary: "An assessment of one job at one site.",
  covers: [
    "The job defined: objects, cycle, exceptions, rough economics, timing, and the pass mark for a trial.",
    "A check of which robot teams can credibly support the job, with capture and free invited evaluation when useful.",
    "A clear answer: one recommended pilot, specific changes needed, or no credible fit yet.",
    "For a recommended pilot: the team, what it tests, what you provide, the cost and dates, and one button to book it.",
  ],
  allIn:
    "No pilot, no fee. Submitting a job, screening, evaluation and our recommendation are free. When you book the pilot we recommend, the fee is $2,500 per job.",
  bounded: "We pick one recommended pilot, and add an alternative only when it is meaningfully different.",
  /**
   * Precise about what a robot team actually receives, because the loose
   * version — "they buy your footage" — is both wrong and alarming. They buy
   * evaluation runs. What they run against is the 3D scene reconstructed from
   * the walkthrough; the walkthrough itself is an input we hold, not a product
   * we resell.
   *
   * Pinned by `privacy-promise-consistency.test.ts` against the capture privacy
   * annex, so the two surfaces cannot promise different things.
   */
  whatWeGetFromIt:
    "Invited robot teams evaluate a qualified job for free during the beta. A site pays Blueprint $2,500 per job only when it books the pilot we recommend. Robot teams never receive your recording — it can be reconstructed into a 3D scene for a controlled evaluation under the rights you grant at intake and nothing wider.",
  whatIsNotFree:
    "The physical pilot, which the robot team prices and runs. Blueprint takes no cut of the pilot; its only site fee is $2,500 per job when you book the pilot we recommend.",
} as const;

/** How a robot team pays. No plan, no seat, no listing fee, no meter. */
export const entryModel = {
  summary: "One price for a private test on a reconstructed site job.",
  detail:
    `Add funds (from $${minTopupUsd}), enter the policies you want evaluated, and top up when the balance gets low. There is no other charge.`,
  notCharged: [
    "No subscription and no monthly minimum.",
    "No listing fee, seat fee, or fee to apply.",
    "No percentage of whatever you sign with the site.",
    "Private results do not enter a shortlist.",
  ],
  /**
   * The thing a team should check before believing the comparison. Funding and
   * allocation are separate on purpose: a team buying its own longer run would
   * be buying confidence, and the team with the deepest pockets would win an
   * auction rather than a comparison.
   */
  fairness:
    "You cannot buy a longer run than a rival. Blueprint sets how much evaluation an entry gets and runs every entry on a task at it, under the same conditions, whoever they are.",
} as const;

/**
 * What the flat price buys, in place of the budget menu it replaced.
 *
 * The point of each line is that it is our problem rather than the buyer's.
 */
export const included = [
  "How much evaluation an entry gets, and under what conditions. We size it, and it is the same for every entry on the task.",
  "The screen against Blueprint's four conditions for a site a robot can work in, listed below.",
  "Private results for your team; no site visibility or pilot recommendations.",
  "The result: where the entry holds up, where it fails, and where the evidence stops short of a call.",
] as const;

/**
 * Where the answer stops. On the page directly under `included`, because a
 * flat price is a promise about cost and not about certainty, and the line
 * between those two is the easiest thing for a buyer to misread.
 */
export const includedLimit =
  "A private simulated evaluation does not establish physical performance or qualify you for a pilot.";

/** The billing rules that decide who eats a failure, in plain terms. */
export const billingRules = [
  {
    rule: "A failed attempt is billable. A failure of ours is not.",
    detail:
      "The robot dropping the box is a result, and you pay for it. An environment that will not launch is not a result, and you do not.",
  },
  {
    rule: "You see the quote before the run.",
    detail:
      "The quote is held against your balance rather than charged. Anything that never runs is released.",
  },
  {
    rule: "Top-ups and spend caps are separate settings.",
    detail:
      `The smallest top-up is $${minTopupUsd}. Auto top-up is optional, the monthly cap is its own control, and a balance you bought carries over rather than expiring.`,
  },
] as const;

/** What a team actually pays, for the shapes teams actually enter. */
export const quoteExamples = [
  { label: "Three policies on one job", entries: 3, tasks: 1 },
  { label: "Three policies on two jobs", entries: 3, tasks: 2 },
  { label: "One policy on three jobs", entries: 1, tasks: 3 },
] as const;

export type EvaluationQuote = {
  /** Billed units: entries × tasks. */
  units: number;
  usd: number;
};

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Entries × tasks × the entry price. There is no other term. */
export function quoteEntries(entries: number, tasks = 1): EvaluationQuote {
  const units = nonNegativeInteger(entries) * nonNegativeInteger(tasks);
  return { units, usd: units * entryPrice };
}

/** How many entries a balance covers, for the "$500 is five entries" reading. */
export function entriesForBalance(usd: number): number {
  return Math.floor(Math.max(0, Number.isFinite(usd) ? usd : 0) / entryPrice);
}

/* -------------------------------------------------------------------------
 * Operating constants.
 *
 * Below this line is how we run an evaluation, not what anyone is charged. It
 * is deliberately absent from the pricing page: a buyer pays per entry and we
 * size the run, so these numbers are ours to set and ours to change. They stay
 * here rather than in the scheduler because `cohortEconomics.ts` has to price
 * the execution behind an entry against the revenue an entry brings in, and
 * those two facts drifting apart is how a flat price quietly stops covering
 * its own cost.
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
 * says so instead — which is what `includedLimit` promises publicly.
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
