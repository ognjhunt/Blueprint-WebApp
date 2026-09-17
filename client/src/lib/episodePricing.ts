/**
 * What Blueprint charges, and how many episodes each round runs.
 *
 *   $0         a site pays nothing to find out.
 *   $0.50      a robot team pays per episode, and screening is the only
 *              thing a robot team buys.
 *
 * WHY THE SITE PAYS NOTHING. Not generosity, and not because sites are poor.
 * A price on the site side and a ten-minute onboarding are mutually exclusive.
 * Any figure — $2,500 or $250 — means a purchase order, a budget owner and
 * legal, which is weeks. Capture takes forty-five seconds and reconstruction
 * costs us the price of one world-model generation, so the payment was the
 * slowest and most expensive step in a process built to be fast and cheap.
 * Removing it is what makes "film it now, know by this afternoon" true rather
 * than aspirational.
 *
 * It also fixes who we are subsidising. The scarce side of this market is real
 * rooms running real repeated tasks with permission to be captured — not
 * funded robot teams starved of deployment data. You subsidise the constrained
 * side, and that is supply.
 *
 * WHAT A SITE IS AND IS NOT GIVEN. Free covers finding out: the capture, the
 * reconstruction, the screening, and the answer about who clears their
 * constraints. It does not cover acting on it. A physical pilot is a real
 * commitment with real cost, and that is where a site's money belongs — at the
 * point there is something to buy rather than something to learn.
 *
 * WHY VENDORS STILL DO NOT FUND THEIR OWN FINALIST ROUNDS. This constraint
 * survives the change and is the reason "robot teams pay for everything" is
 * not quite the model. If a vendor bought its own finalist episodes, the team
 * with the deepest pockets would buy more statistical confidence than its
 * rivals — which is not a comparison, it is an auction. So funding and
 * allocation stay separate: robot-team money fills the pool, and Blueprint
 * decides how it is spent, giving every finalist the same episode count under
 * the same conditions.
 *
 * And a team is never billed at promotion. Being shortlisted mid-evaluation
 * and owing money nobody planned for, at the exact moment the site is waiting
 * on a result, is the same surprise bill the old site fee was designed to
 * avoid. A team's bill stays what it always was: checkpoints × 50 × the rate,
 * sized before anything runs.
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
 * 50 is a screen and nothing more. It is not used to rank: it only cuts a
 * candidate it can actually rule out, roughly 20 points behind the leader, and
 * everything closer advances. 500 is the smallest count that resolves a gap of
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
  purpose: "Cut the field to a shortlist, without cutting anything it cannot rule out.",
  resolves:
    "Every candidate screening cannot separate from the leader goes forward, up to five. At 50 episodes a candidate is only cut once it is roughly 20 points behind — so a close field advances intact rather than being thinned on noise.",
  limit:
    "It never names a winner, and it is not a ranking. Screening decides one thing: whether a candidate is far enough behind to rule out.",
} as const;

/**
 * Round two. Blueprint funds and runs it, so a promoted team owes nothing and
 * every finalist is measured identically.
 *
 * `fundedBy: "blueprint"` is the load-bearing part, not an accounting detail.
 * A finalist round bought by its own contestant is an auction, because the
 * richest entrant buys the longest run and therefore the tightest interval.
 * Blueprint setting the count is what makes the comparison a comparison.
 */
export const finalistRound = {
  id: "finalist",
  name: "Finalist comparison",
  episodes: 500,
  fundedBy: "blueprint",
  funder:
    "Funded and run by Blueprint under the offer you enter. Neither the site nor the robot team is billed for it, and no team can buy a longer run than another.",
  /**
   * Said out loud because the economics are not established.
   *
   * A finalist is ten unpaid episodes for every paid screening episode, and
   * the shortlist rule advances a close field intact. Whether that is
   * sustainable depends on our real per-episode cost, which is being metered
   * (`cohortEconomics.ts`) and is not yet known. Presenting it as a settled
   * permanent feature would be claiming a fact we do not have.
   *
   * So it is a current offer, honoured for whoever enters under it. If the
   * measured economics force a change it applies to later cohorts and is
   * stated, not applied quietly to people who already accepted these terms.
   */
  commitment:
    "This is Blueprint's current offer rather than a permanent entitlement. A team that enters under it keeps it; if the economics force a change, it changes for later rounds and we say so before anyone enters one.",
  purpose: "Separate the shortlist and produce the pilot recommendation.",
  resolves:
    "Resolves a gap of about 8 points at the same confidence level — the smallest round that settles the differences a shortlist actually turns on.",
  limit:
    "Below about 5 points, 500 episodes still cannot call it. The result reports the comparison as too close to separate rather than naming a winner.",
  /** Bounded so "included" is a promise with a number behind it. */
  shortlist: 5,
} as const;

export const rounds = [screeningRound, finalistRound] as const;

/**
 * How the shortlist is set. A fixed shortlist of three drops the genuinely best
 * candidate about a third of the time when the field is tight, because at 50
 * episodes a tight field is exactly the case screening cannot rank. Advancing
 * everyone screening cannot rule out fixes that without charging anybody more:
 * the rule spends finalist episodes where the evidence is ambiguous and saves
 * them where it is not. Simulated over fifteen candidates, the best candidate
 * survives screening about 83% of the time on a twenty-point field and about
 * 98% on a forty-point one, against 66% for a fixed three.
 */
export const shortlistRule = {
  cap: 5,
  /**
   * And a floor, which the rule did not have.
   *
   * ## The arithmetic that forced this
   *
   * A finalist is 500 episodes at Blueprint's cost against a screening entry
   * of 50 at the team's. So every candidate that advances carries ten unpaid
   * episodes for each paid one — and the rule above says a *close* field
   * advances intact, which is exactly the field screening cannot separate.
   *
   * At three indistinguishable entrants that means $75 of revenue against
   * 1,650 executed episodes: break-even needs an average episode cost under
   * 4.6¢ before a penny of site preparation. At fifteen entrants and five
   * finalists the same sum allows 11.5¢. The least liquid sites are the least
   * profitable ones, even when execution is cheap, and a cold start is nothing
   * but least-liquid sites.
   *
   * ## Why a floor rather than a different payer
   *
   * The obvious fix is to charge finalists. But a mandatory fee lands at the
   * moment a team has just been told it made the shortlist, which is the worst
   * place available to put a new purchase decision — and it would change terms
   * somebody already accepted.
   *
   * A floor changes nothing anyone was promised. A finalist round exists to
   * *separate* candidates; with one credible candidate there is nothing to
   * separate and no comparison to fund. So the round runs when it has a job to
   * do, and a site with a single candidate gets its assessment without one.
   */
  floor: 2,
  statement:
    "Everything screening cannot separate from the leader goes forward, up to five — when there is more than one candidate to separate.",
  detail:
    "Screening only cuts a candidate it can rule out — at 50 episodes, one roughly 20 points behind the leader. A close field therefore carries more candidates into the finalist round, and a clearly separated one carries fewer. Nobody is cut on a difference screening cannot establish. A field of one is not a comparison, so it is reported as the single candidate it is rather than run as a finalist round against nobody.",
} as const;

/**
 * Whether a finalist round has anything to do.
 *
 * Kept next to the rule so the pricing page and any scheduler read the same
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

/** What a site pays to find out: nothing. */
export const siteAssessment = {
  amount: 0,
  unit: "to find out",
  summary: "An assessment of one task at one site.",
  covers: [
    "The task defined: objects, cycle, exceptions, and the pass mark everything is measured against.",
    "The site captured and rebuilt as the environment candidates are evaluated in.",
    "Candidates screened against Blueprint's four qualifying conditions.",
    "The finalist comparison run for every shortlisted candidate.",
    "A pilot recommendation, the expected failure points, and a physical test plan — or a clear reason to pause.",
  ],
  allIn:
    "No fee, no per-episode charge, and no card. You record one walkthrough on a phone; nothing is invoiced for any of the work above.",
  bounded:
    "Covers a shortlist of up to five finalists. Screening decides how many that is: only candidates it can rule out are cut, so a close field carries more candidates forward and a clearly separated one carries fewer.",
  /**
   * Stated rather than implied. A site that pays nothing is not the customer,
   * and pretending otherwise is the dishonest version of this model.
   */
  /**
   * Precise about what a robot team actually receives, because the loose
   * version — "they buy your footage" — is both wrong and alarming. They buy
   * evaluation runs. What they run against is the 3D scene reconstructed from
   * the walkthrough; the walkthrough itself is an input we hold, not a product
   * we resell.
   */
  whatWeGetFromIt:
    "Robot teams pay for evaluation runs, and that is what funds this. They never receive your recording — it is reconstructed into a 3D scene, and the scene is what their robots are tested in, under the rights you grant at intake and nothing wider.",
  whatIsNotFree:
    "A physical pilot. That is a real commitment with real cost, quoted when there is something to buy rather than something to learn.",
} as const;

/** How a robot team pays. No plan, no seat, no listing fee. */
export const balanceModel = {
  summary: "Screening is the only thing a robot team buys.",
  detail:
    "Add funds, screen the checkpoints you want to put forward, top up when the balance gets low.",
  notCharged: [
    "No subscription and no monthly minimum.",
    "No listing fee, seat fee, or fee to apply.",
    "Nothing more if you are shortlisted — the finalist round is Blueprint's to fund and run.",
    "No percentage of whatever you sign with the site.",
  ],
  /**
   * The thing a team should check before believing the comparison. Funding and
   * allocation are separate on purpose: a vendor buying its own finalist
   * episodes would be buying confidence, and the team with the deepest pockets
   * would win an auction rather than a comparison.
   */
  fairness:
    "You cannot buy more episodes than a rival. Blueprint sets the finalist episode count and runs every finalist at it, under the same conditions, whoever they are.",
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
      "Blueprint funds and runs the finalist round under the offer you entered, so there is no top-up to make and no deadline to miss. It is also why you cannot buy your way to a longer run than a rival: the episode count is ours to set, and every finalist gets the same one. A finalist round runs when there is more than one candidate to separate — a single surviving candidate is reported as that rather than run against nobody.",
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
