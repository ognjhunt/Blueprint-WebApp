/**
 * What Blueprint charges, and how many episodes each round runs.
 *
 *   $2,500     a site pays once, per site-task. All-in.
 *   $0.50      a robot team pays per episode, and screening is the only
 *              thing a robot team buys.
 *
 * WHY THE SITE FEE IS ALL-IN. A site is buying a decision — which robot
 * deserves a physical pilot — not compute. "Episode" is a robot-team concept:
 * it exists so a vendor can control spend across its own checkpoints. Putting a
 * per-episode rate in front of a site operator means quoting them a bill they
 * cannot size in advance, and then returning mid-engagement to collect for a
 * finalist round they never budgeted for. So the finalist comparison is inside
 * the $2,500 and the site never sees a per-unit rate.
 *
 * WHY THE SITE FUNDS THE FINALIST ROUND RATHER THAN THE VENDORS. Two reasons.
 * A team that budgeted for screening and is then promoted would owe money it
 * did not plan for, at the exact moment the site is waiting on a result. And if
 * vendors funded their own finalist rounds, the team with the deepest pockets
 * would buy more statistical confidence than its rivals — which is not a
 * comparison. Blueprint funds and controls the finalist round so every finalist
 * gets the same episode count under the same conditions.
 *
 * WHY TWO ROUNDS AND NOT FOUR. A menu of budgets asks the buyer to solve a
 * statistics problem to pick a line item. Two fixed rounds answer it once:
 * screening removes candidates that are clearly worse, and the finalist round
 * separates the ones that are left.
 *
 * ON THE EPISODE COUNTS. These are Blueprint's operating budgets, chosen from
 * what each count can actually resolve, computed for a two-sided test at the
 * conventional 95% level:
 *
 *     episodes   smallest gap detectable   success-rate interval
 *     per policy  at 80% power              half-width at 70%
 *     ---------  -----------------------   ---------------------
 *         50            ~22 points               ~12 points
 *        100            ~17 points               ~9 points
 *        200            ~12 points               ~6 points
 *        500             ~8 points               ~4 points
 *
 * 50 is a screen and nothing more: it removes a candidate 30 points worse about
 * 88% of the time and one 40 points worse about 99% of the time, and it cannot
 * rank two close candidates. 500 is the smallest count that resolves a gap of
 * roughly 8 points, which is the size of difference a finalist round actually
 * has to settle. Below about 5 points even 500 episodes cannot call a winner,
 * and the result says so instead.
 *
 * There is no settled industry standard to defer to here. Published protocols
 * in 2025-2026 range from roughly 10 trials per task on real hardware to 500
 * per suite in simulation, and audits of that literature find most reported
 * improvements are not statistically separable at the counts used. So these
 * numbers are stated as our budgets and by what they resolve, never as a
 * standard someone else set.
 *
 * WHAT THE COUNTS DO NOT BUY. Simulated ranking is not real-world ranking, and
 * no episode count closes that gap. The finalist round narrows which candidate
 * deserves a physical pilot; it never certifies physical performance or safety.
 */

/** The episode is the billable unit. This sentence is the whole definition. */
export const episodeDefinition =
  "One episode is one run of one policy on one scenario, up to the task's published time limit, with a result.";

/** The two readings people get wrong, stated before they can get them wrong. */
export const episodeBoundaries = [
  "Six checkpoints attempting the same scenario is six episodes, not one.",
  "One robot driven by several models is still one episode. We count runs, not networks.",
] as const;

/** A robot team's rate. Non-standard workloads are quoted before they run. */
export const episodeRate = 0.5;

/**
 * Round one. The robot team pays for this, because it is the team's own
 * decision how many checkpoints are worth putting forward.
 */
export const screeningRound = {
  id: "screening",
  name: "Screening",
  episodes: 50,
  fundedBy: "robot-team",
  funder: "Paid by the robot team, per checkpoint entered.",
  purpose: "Cut a long list of checkpoints down to a shortlist.",
  resolves:
    "Removes a candidate roughly 30 points worse about 88% of the time, and one 40 points worse about 99% of the time.",
  limit:
    "It cannot rank two close candidates — at 50 episodes the smallest gap it reliably separates is about 22 points. Screening never names a winner.",
} as const;

/**
 * Round two. The site pays for this inside the assessment fee, so a promoted
 * team owes nothing and every finalist is measured identically.
 */
export const finalistRound = {
  id: "finalist",
  name: "Finalist comparison",
  episodes: 500,
  fundedBy: "site",
  funder: "Included in the site's assessment fee. The robot team pays nothing.",
  purpose: "Separate the shortlist and produce the pilot recommendation.",
  resolves:
    "Resolves a gap of about 8 points at the same confidence level — the smallest round that settles the differences a shortlist actually turns on.",
  limit:
    "Below about 5 points, 500 episodes still cannot call it. The result reports the comparison as too close to separate rather than naming a winner.",
  /** Bounded so "included" is a promise with a number behind it. */
  shortlist: 3,
} as const;

export const rounds = [screeningRound, finalistRound] as const;

/** A site's one charge. All-in, and never quoted per episode. */
export const siteAssessment = {
  amount: 2_500,
  unit: "one-time, per site-task",
  summary: "A scoped assessment of one task at one site.",
  covers: [
    "The task defined: objects, cycle, exceptions, and the pass mark everything is measured against.",
    "The site captured and rebuilt as the environment candidates are evaluated in.",
    "Candidates screened against Blueprint's four qualifying conditions.",
    "The finalist comparison run for every shortlisted candidate, at Blueprint's cost.",
    "A pilot recommendation, the expected failure points, and a physical test plan — or a clear reason to pause.",
  ],
  allIn:
    "One payment, agreed before any work starts. No per-episode charge, nothing to approve once the shortlist is set, and nothing per robot if a pilot goes ahead.",
  bounded: "Covers a shortlist of up to three finalists.",
} as const;

/** How a robot team pays. No plan, no seat, no listing fee. */
export const balanceModel = {
  summary: "Screening is the only thing a robot team buys.",
  detail:
    "Add funds, screen the checkpoints you want to put forward, top up when the balance gets low.",
  notCharged: [
    "No subscription and no monthly minimum.",
    "No listing fee, seat fee, or fee to apply.",
    "Nothing more if you are shortlisted — the finalist round is the site's.",
    "No percentage of whatever you sign with the site.",
  ],
} as const;

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
      "Checkpoints × 50 × the rate, reserved against your balance rather than charged. Episodes that never run are released.",
  },
  {
    rule: "Being shortlisted never costs you more.",
    detail:
      "The finalist round is funded and run by Blueprint as part of the site's assessment, so there is no top-up to make and no deadline to miss.",
  },
  {
    rule: "Top-ups and spend caps are separate settings.",
    detail:
      "Auto top-up is optional, the monthly cap is its own control, and a balance you bought carries over rather than expiring.",
  },
] as const;

/** What a team actually pays, for the checkpoint counts teams actually enter. */
export const quoteExamples = [
  { label: "One checkpoint", checkpoints: 1 },
  { label: "Three checkpoints", checkpoints: 3 },
  { label: "Six checkpoints", checkpoints: 6 },
] as const;

export type EpisodeQuote = {
  episodes: number;
  usd: number;
};

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Checkpoints × episodes each × the rate. There is no other term. */
export function quoteEpisodes(checkpoints: number, episodesEach: number): EpisodeQuote {
  const episodes = nonNegativeInteger(checkpoints) * nonNegativeInteger(episodesEach);
  return { episodes, usd: episodes * episodeRate };
}

/** What a robot team owes to screen `checkpoints` candidates. */
export function quoteScreening(checkpoints: number): EpisodeQuote {
  return quoteEpisodes(checkpoints, screeningRound.episodes);
}

/** What a balance buys, for the "$200 is 400 episodes" reading. */
export function episodesForBalance(usd: number): number {
  return Math.floor(Math.max(0, Number.isFinite(usd) ? usd : 0) / episodeRate);
}

/** Whole dollars stay whole; the rate itself keeps its cents. */
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
