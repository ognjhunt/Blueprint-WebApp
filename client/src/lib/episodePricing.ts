/**
 * What Blueprint charges. Two prices, paid by two different parties.
 *
 *   $2,500     a site pays once, per site-task, for the scoped assessment.
 *   $0.50      a robot team pays per episode, out of a prepaid balance.
 *
 * WHY THE TWO SIDES ARE PRICED SEPARATELY. Preparing a site — defining the
 * task and its pass mark, capturing it, screening candidates, writing the
 * pilot recommendation — is work done once, whether one team evaluates or ten.
 * Running an episode is work done per attempt. Billing them as one number
 * would either overcharge the first team or undercharge the tenth.
 *
 * WHY EPISODES RATHER THAN PACKAGES. A "comparative evaluation" is not a fixed
 * quantity of work: six checkpoints at 500 episodes is sixty times the
 * execution of one checkpoint at 50. Priced as a package, the same invoice
 * covers wildly different workloads, and a team that only wants to screen six
 * checkpoints cheaply has to buy a deep comparison it did not ask for. Priced
 * per episode, the bill follows the work and a team can start at $25.
 *
 * WHY A PREPAID BALANCE RATHER THAN A SUBSCRIPTION. A monthly fee has to be
 * justified by repeat demand that has not been demonstrated yet, and a plan
 * that includes "four evaluations" for four times the overage price is a
 * minimum spend wearing a discount's clothes. A balance a team tops up needs
 * no plan tiers, no included-usage arithmetic, and no forecast of how much
 * testing a team will want next month. If committed spend ever earns a real
 * discount, it can be added on top of this without repricing anything.
 *
 * ON THE NUMBERS. These are starting prices Blueprint intends to test with
 * buyers. They are not a market rate: no independent source establishes one
 * for site-task robot evaluation, and neither price is derived from a
 * published benchmark. The episode budgets below are likewise Blueprint's own
 * operating budgets, not a standard — the count that separates two close
 * candidates depends on how small a difference matters, not on a number a
 * paper happened to use.
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

/** A site's one charge. Nothing recurring, and nothing per robot afterwards. */
export const siteAssessment = {
  amount: 2_500,
  unit: "one-time, per site-task",
  summary: "A scoped assessment of one task at one site.",
  covers: [
    "The task defined: objects, cycle, exceptions, and the pass mark everything is measured against.",
    "The site captured and rebuilt as the environment candidates are evaluated in.",
    "Candidates screened against Blueprint's four qualifying conditions.",
    "A pilot recommendation, the expected failure points, and a physical test plan — or a clear reason to pause.",
  ],
  evaluationBudget:
    "An evaluation budget is agreed as part of the scope, at the same $0.50 per episode, before any work starts.",
  notCharged: "Nothing recurring. Nothing per robot once a pilot goes ahead.",
} as const;

/** How a robot team pays. No plan, no seat, no listing fee. */
export const balanceModel = {
  summary: "Add funds, run episodes, top up when the balance gets low.",
  notCharged: [
    "No subscription and no monthly minimum.",
    "No listing fee, seat fee, or fee to apply.",
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
      "Checkpoints × episodes × the rate, reserved against your balance rather than charged. Episodes that never run are released.",
  },
  {
    rule: "Top-ups and spend caps are separate settings.",
    detail:
      "Auto top-up is optional, the monthly cap is its own control, and a balance you bought carries over rather than expiring.",
  },
  {
    rule: "Anything non-standard gets its own visible rate.",
    detail:
      "A longer time limit or an unusual sensing setup is quoted per episode before it runs. We do not quietly count one run as three episodes.",
  },
] as const;

/** Quote shapes teams actually ask for, priced straight off the rate. */
export const quoteExamples = [
  { label: "Screen one checkpoint", checkpoints: 1, episodesEach: 50 },
  { label: "Compare one finalist deeply", checkpoints: 1, episodesEach: 200 },
  { label: "Screen six checkpoints", checkpoints: 6, episodesEach: 50 },
  { label: "Run six checkpoints deep", checkpoints: 6, episodesEach: 500 },
] as const;

/**
 * Blueprint's starting budgets per stage — not an industry standard, and not a
 * claim that any of these counts settles a close comparison. The point of the
 * ladder is that a clearly weak checkpoint should be eliminated for $25 rather
 * than tested to the same depth as a contender.
 */
export const episodeBudgets = [
  {
    stage: "Integration check",
    episodes: "10–20",
    each: [10, 20] as const,
    purpose: "Catch broken observation and action mappings before spending anything real.",
  },
  {
    stage: "Screening",
    episodes: "50",
    each: [50, 50] as const,
    purpose: "Eliminate the obviously weak candidates and see where the failures cluster.",
  },
  {
    stage: "Finalist comparison",
    episodes: "100–200",
    each: [100, 200] as const,
    purpose: "Fresh held-out scenarios, same conditions for every finalist.",
  },
  {
    stage: "Deeper testing",
    episodes: "500+",
    each: [500, null] as const,
    purpose: "Close contenders, wider operating conditions, or a reliability question worth the spend.",
  },
] as const;

/** Screen six, then take two forward — against testing all six to depth. */
export const stagedExample = {
  staged: { label: "Screen six at 50, compare two finalists at 200", episodes: 6 * 50 + 2 * 200 },
  flat: { label: "Run all six at 500", episodes: 6 * 500 },
} as const;

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
