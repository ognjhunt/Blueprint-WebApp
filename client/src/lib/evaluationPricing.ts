/**
 * Published prices for site assessment, invited evaluation, and optional
 * self-directed robot-team evaluation. An invited run is free within its
 * stated scope before any physical-pilot purchase decision.
 *
 *   $0    a site pays nothing to find out.
 *   $99   a robot team pays per entry.
 *
 * The provider quotes and contracts for its physical pilot. If the site buys
 * it, the site separately pays Blueprint's agreed coordination and measurement
 * fee. Invited evaluation remains free, and existing self-directed paid entries
 * retain their no-later-supplier-commission promise.
 *
 * WHAT AN ENTRY IS. One policy, running on one embodiment, against one task at
 * one site. Both halves are part of the unit: the same policy on a second
 * embodiment is a second entry, and a second policy on the same embodiment is
 * a second entry. A different embodiment running a different policy is still
 * one entry, because it is still one pair. Entries times tasks times $99 is the
 * whole bill, and there is no other term.
 *
 * WHY A FLAT PRICE RATHER THAN A METER. The page this replaced sold episodes:
 * $0.50 each, 50 to screen a checkpoint, a 500-episode finalist round Blueprint
 * funded, and roughly a thousand words explaining which gaps each count could
 * resolve. Every one of those words was true and none of them belonged to the
 * buyer. Choosing an episode count is a statistics problem, the honest answer
 * does not vary by customer, and we were asking each customer to solve it in
 * order to read a price. A flat entry price answers it once: we size the run,
 * we run it, the buyer reads one number.
 *
 * The episode counts did not go away — see the operating constants below. They
 * stopped being a dial the buyer turns, which is the only thing that changed
 * commercially.
 *
 * WHY THE SITE PAYS NOTHING. Not generosity. A price on the site side and a
 * ten-minute onboarding are mutually exclusive. Any figure — $2,500 or $250 —
 * means a purchase order, a budget owner and legal, which is weeks. Capture
 * takes forty-five seconds and reconstruction costs us the price of one
 * world-model generation, so the payment was the slowest and most expensive
 * step in a process built to be fast and cheap.
 *
 * It also fixes who we are subsidising. The scarce side of this market is real
 * rooms running real repeated tasks with permission to be captured — not funded
 * robot teams starved of deployment data.
 *
 * WHAT A SITE IS AND IS NOT GIVEN. Free covers a task brief, fit checks,
 * evaluation where useful, and a provider-backed offer if a provider commits.
 * A physical pilot is a real commitment with real cost. The site sees the
 * provider's price, Blueprint's fee, and the total before approving paid work.
 *
 * WHY BLUEPRINT STILL SETS THE RUN LENGTH. If a team could buy a longer run
 * than a rival, the team with the deepest pockets would buy more statistical
 * confidence than its rivals — which is not a comparison, it is an auction. So
 * funding and allocation stay separate: entry fees fill the pool, and Blueprint
 * decides how it is spent, giving every entry on a task the same run under the
 * same conditions. A flat price makes that easier to state, not harder: there
 * is nothing left to buy more of.
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

/** A robot team's price, per entry. The only number a team has to read. */
export const entryPrice = 99;

/** Starting Blueprint fee if the site accepts a scoped physical pilot. */
export const pilotServiceStartingFeeUsd = 5000;

/** The smallest top-up Stripe will charge. Mirrors `MIN_TOPUP_USD` on the server. */
export const minTopupUsd = entryPrice;

/** What a site pays for initial screening and evaluation: nothing. */
export const siteAssessment = {
  amount: 0,
  unit: "to find out",
  summary: "An assessment of one task at one site.",
  covers: [
    "The task defined: objects, cycle, exceptions, rough economics, timing, and the pass mark for a trial.",
    "A check of which providers can credibly support the job, with capture and free invited evaluation when useful.",
    "A clear answer: a provider-backed pilot offer, specific changes needed, or no credible fit yet.",
    "For a credible fit, the provider's scope, price, and success measures to approve before spending.",
  ],
  allIn:
    "No fee, no card, and nothing per run for the assessment above. You can start with a description and share phone footage when it helps.",
  bounded: "When a comparison is useful, it covers up to five candidates.",
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
    "Robot teams pay for optional self-directed evaluation runs. Invited teams evaluate a qualified task for free, even if no pilot is purchased. If you accept a physical pilot, you approve the provider's price and Blueprint's separate coordination and measurement fee in one itemized proposal. Robot teams never receive your recording — it can be reconstructed into a 3D scene for a controlled evaluation under the rights you grant at intake and nothing wider.",
  whatIsNotFree:
    "The physical pilot. The provider quotes installation and operation; Blueprint states its separate coordination and measurement fee. The site approves the total before paid work begins.",
} as const;

/** How a robot team pays. No plan, no seat, no listing fee, no meter. */
export const entryModel = {
  summary: "One price for each policy you put on a task.",
  detail:
    `Add funds (from $${minTopupUsd}), enter the policies you want evaluated, and top up when the balance gets low. There is no other charge.`,
  notCharged: [
    "No subscription and no monthly minimum.",
    "No listing fee, seat fee, or fee to apply.",
    "No percentage of whatever you sign with the site.",
    "Nothing more later, including if you are shortlisted.",
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
  "The comparison against every other entry on the same task.",
  "The result: where the entry holds up, where it fails, and where the evidence stops short of a call.",
] as const;

/**
 * Where the answer stops. On the page directly under `included`, because a
 * flat price is a promise about cost and not about certainty, and the line
 * between those two is the easiest thing for a buyer to misread.
 */
export const includedLimit =
  "A comparison can come back too close to separate. We report that rather than naming a winner, and a simulated ranking is still not a real-world ranking.";

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
  { label: "Three policies on one task", entries: 3, tasks: 1 },
  { label: "Three policies on two tasks", entries: 3, tasks: 2 },
  { label: "One policy on three tasks", entries: 1, tasks: 3 },
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
