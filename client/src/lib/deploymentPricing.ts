/**
 * Blueprint charges two numbers. That is the entire model.
 *
 *   $1,000   to evaluate a site-task. Every robot team that runs a real
 *            evaluation pays it.
 *   $10,000  total for a site-task you win — so $9,000 more once you are
 *            selected for the pilot or deployment.
 *
 * A team that loses pays $1,000. A team that wins pays $10,000. The site pays
 * nothing. There is nothing else: no percentage, no per-robot rate, no
 * recurring charge, and no fee on expansion.
 *
 * WHY NO PERCENTAGE. A share of contract value is not reliably collectible
 * unless Blueprint controls invoicing. A robot company can understate the
 * contract, split hardware, software and services into separate agreements, or
 * transact off-platform — and high-value, low-frequency deals are exactly
 * where that pressure is strongest. Two flat numbers need no visibility into
 * anyone's contract at all.
 *
 * If a percentage is ever wanted it needs a payment rail first: robot-company
 * invoices running through something like Stripe Connect, which can withhold
 * an application fee automatically, and which leaves refunds and chargebacks
 * with the robot company rather than with Blueprint. Until that is mandatory,
 * the company is not priced on reported contract value.
 *
 * ON THE NUMBERS. Posted starting terms Blueprint intends to test, not
 * market-clearing rates. No independent source establishes a market price for
 * this service: the robotics-data benchmarks that circulate publicly are
 * published by vendors selling data services, and the one customer-paid
 * deployment fee on the public record (roughly $20-25k, Agility investor
 * materials, June 2026) is illustrative inside a single company's own model.
 */

export type PricingBasis = "posted" | "under-test";

/** Free because it costs nothing at the margin and it builds the market. */
export const freeTier = [
  {
    id: "anonymous-listings",
    label: "Anonymous opportunity listings",
    detail: "Task, vertical, area, measured baseline and acceptance bar — no operator identity.",
    rationale: "Near-zero marginal cost, and the listing is what makes the board worth reading.",
  },
  {
    id: "envelope-screen",
    label: "Envelope screen",
    detail: "Payload, reach, cycle-time headroom and gate compatibility, checked against the captured record.",
    rationale: "Screening out a bad match costs us nothing and saves everyone a site visit.",
  },
  {
    id: "site-everything",
    label: "Everything, for the site",
    detail: "Intake, qualification, capture, listing, and the whole evaluation process.",
    rationale:
      "The site contributes the floor, the access and the task data. Charging the scarce side would suppress the supply this market runs on.",
  },
] as const;

/** Charge one. Paid by every team that runs a real evaluation. */
export const evaluationFee = {
  amount: 1_000,
  unit: "per site-task, per team",
  basis: "under-test" as PricingBasis,
  includes: [
    "Up to 500 episodes against the captured twin",
    "Analysis and the scored result on the listing rubric",
    "The full capture package: object library, demonstrations, site conditions",
  ],
  note: "Not a compute markup. It buys a captured task, a standardised test and a scored result.",
} as const;

/** Charge two. Paid only by the team selected for the pilot or deployment. */
export const deploymentFee = {
  /** What a won site-task costs in total, evaluation fee included. */
  total: 10_000,
  unit: "total, per site-task won",
  basis: "under-test" as PricingBasis,
  rule: "A team that loses pays $1,000. A team that wins pays $10,000 — the same $1,000 plus $9,000 on selection.",
  whoPays:
    "The selected robot team. Blueprint delivered a qualified revenue opportunity and replaced its presales and site-scoping work.",
  noExtras:
    "No percentage, no per-robot rate, no recurring charge. Growing the deployment later costs nothing further.",
} as const;

/** Everything a robot team can owe, in one place. */
export const chargeSummary = [
  { id: "lose", label: "You evaluate and do not win", amount: 1_000 },
  { id: "win", label: "You evaluate and win the task", amount: 10_000 },
  { id: "site", label: "The site, in every case", amount: 0 },
] as const;

/**
 * A robot company paying a site to host a pilot is real, common and supported.
 * It is a separate payment for access, disruption or data.
 */
export const vendorFundedPilots = {
  label: "Vendor-funded pilots are fine",
  detail:
    "If a robot team pays the site to host — for access, disruption or data — that is between them, fully supported, and separate from Blueprint's fee.",
} as const;

export const settlement = {
  today:
    "The site and the robot team contract and pay each other directly. Blueprint invoices its two fees separately.",
  later:
    "Taking a percentage would require robot-company invoicing to run through a payment rail that can withhold an application fee automatically. Until that is in place, Blueprint does not price on reported contract value.",
} as const;

/** The one case where a site pays: it is not the open marketplace. */
export const privateProcurement = {
  label: "The one time a site pays",
  detail:
    "Only when a site separately hires Blueprint to run a private, exclusive procurement. That is a different engagement from the open board, and it is priced on its own.",
} as const;

export type TeamCostInput = {
  /** Site-tasks this team evaluated. */
  evaluated: number;
  /** How many of those it won. */
  won: number;
};

export type TeamCostBreakdown = {
  evaluations: number;
  /** The top-up owed on each task won: $10,000 less the $1,000 already paid. */
  selectionTopUp: number;
  total: number;
};

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * What a robot team owes Blueprint in total. A team cannot win more tasks than
 * it evaluated, so `won` is clamped to `evaluated`.
 */
export function calculateTeamCost({ evaluated, won }: TeamCostInput): TeamCostBreakdown {
  const safeEvaluated = nonNegative(evaluated);
  const safeWon = Math.min(nonNegative(won), safeEvaluated);

  const evaluations = safeEvaluated * evaluationFee.amount;
  const selectionTopUp = safeWon * (deploymentFee.total - evaluationFee.amount);

  return { evaluations, selectionTopUp, total: evaluations + selectionTopUp };
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
