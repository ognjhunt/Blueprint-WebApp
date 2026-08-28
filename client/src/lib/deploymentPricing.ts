/**
 * Blueprint's commercial model: free discovery -> prepaid evaluation credit ->
 * activation -> recurring robot-months.
 *
 * The design follows four rules, in this order:
 *
 *   1. Subsidise what costs us nothing at the margin and adds liquidity.
 *      Anonymous listings, automated screening and one standardised eval are
 *      customer acquisition, not product.
 *   2. Charge before someone consumes scarce manual work, site access, or
 *      identifiable opportunity information. Named-site detail is the line.
 *   3. Tie recurring revenue to an OBSERVABLE unit. An activated site and an
 *      active robot-month can be counted by both parties. A percentage of a
 *      confidential robot contract cannot be, which is what makes a pure
 *      success fee both disputable and easy to route around.
 *   4. Make the recurring fee buy something ongoing. If Blueprint's
 *      contribution ends at the introduction, bypassing Blueprint is the
 *      rational move and no contract language fixes that.
 *
 * ON THE NUMBERS BELOW. They are posted starting terms that Blueprint intends
 * to test, not market-clearing rates. No independent source establishes a
 * market price for this service — the robotics-data benchmarks that circulate
 * publicly are published by vendors selling data services, and the one
 * customer-paid deployment fee on the public record (roughly $20-25k, Agility
 * investor materials, June 2026) is an illustrative figure from a single
 * company's own model. Anything rendered from this file must therefore be
 * labelled as Blueprint's terms under test, never as an industry rate.
 */

export type PricingBasis = "posted" | "under-test";

/** What costs nothing, and why it is free rather than generous. */
export const freeTier = [
  {
    id: "anonymous-listings",
    label: "Anonymous opportunity listings",
    detail: "Task, vertical, area, measured baseline and acceptance bar — no operator identity.",
    rationale: "Near-zero marginal cost, and the listing is what makes the board worth reading.",
  },
  {
    id: "fit-screening",
    label: "Automated fit screening",
    detail: "Embodiment envelope, payload, reach, cycle-time headroom and gate compatibility.",
    rationale: "Runs on the captured record we already hold. Screening out a bad match costs us nothing and saves a site visit.",
  },
  {
    id: "standard-eval",
    label: "One standardised evaluation",
    detail: "A bounded run against the published twin on shared compute, scored on the listing rubric.",
    rationale: "The cheapest honest answer to 'is this doable at all'. Rationing it would slow the market more than it would earn.",
  },
  {
    id: "site-intake",
    label: "Site intake and qualification screen",
    detail: "The four screening conditions, with a written gap report when a site does not clear them.",
    rationale: "Supply is the harder side to originate. Charging to be told no would end the pipeline.",
  },
] as const;

/**
 * The evaluation credit. Charged before a robot team receives named-site
 * detail, full artefacts, or a bespoke run — and returned in full against the
 * deployment fee if that same team goes on to deploy.
 *
 * The credit mechanism is the point: a team that deploys pays nothing extra,
 * so the fee never taxes the outcome we want. A team that consumes site
 * access and walks away funds the capture pipeline it consumed.
 */
export const evaluationCredit = {
  low: 2_500,
  high: 5_000,
  unit: "per site-task, per team",
  basis: "under-test" as PricingBasis,
  creditedAgainst: "deployment activation and the first year of robot-months",
  triggers: [
    "Named site, operator contact and exact location",
    "Full capture artefacts: twin, demonstrations, object library, site conditions",
    "A bespoke or repeated evaluation run beyond the standardised screen",
  ],
  billedSeparately: [
    "Reserved or extended compute",
    "Model adaptation and custom engineering",
    "Data rights beyond the single-eval licence",
  ],
} as const;

/**
 * Nothing expensive happens on expressed interest alone. A capture visit
 * consumes an operator relationship and a slot on a real floor, so one of
 * these has to be true before Blueprint funds one.
 */
export const commitmentGate = [
  {
    id: "verified-budget",
    label: "Verified project budget",
    detail: "The site evidences an allocated automation budget and the owner of it.",
  },
  {
    id: "pilot-intent",
    label: "Signed pilot-intent document",
    detail: "A robot team commits to run the on-site week if the twin eval clears the bar.",
  },
  {
    id: "refundable-commitment",
    label: "Refundable commitment",
    detail: "Either side posts a deposit, refunded on the capture completing or the gate failing.",
  },
] as const;

/** The recurring unit. Both observable, both countable by either party. */
export const deploymentFees = {
  activation: {
    amount: 5_000,
    unit: "per activated site-task",
    basis: "under-test" as PricingBasis,
    detail: "Charged once, when a robot starts production work against the acceptance test.",
  },
  robotMonth: {
    low: 100,
    high: 300,
    unit: "per active robot, per month",
    basis: "under-test" as PricingBasis,
    detail: "Counted from the deployment record. A robot that stops working stops billing.",
  },
} as const;

/**
 * The revenue-share alternative, kept deliberately narrow. A percentage is
 * only collectable where Blueprint can actually observe the number, so it is
 * offered only where we control invoicing or receive contractual reporting —
 * and it is not the default.
 */
export const revenueShareAlternative = {
  firstYearLow: 0.01,
  firstYearHigh: 0.02,
  renewalNote: "Renewals price substantially below the first year.",
  condition:
    "Offered only where Blueprint controls invoicing or receives audited payment reporting. Where neither holds, the observable units above apply instead.",
  basis: "under-test" as PricingBasis,
} as const;

/** What the recurring fee actually buys, which is what makes bypass irrational. */
export const recurringValue = [
  {
    id: "maintained-testbed",
    label: "Maintained testbed",
    detail: "The twin is re-scanned and re-versioned as the workcell drifts.",
  },
  {
    id: "acceptance-versioning",
    label: "Acceptance-test versioning",
    detail: "The rubric both parties contracted on, kept under version control with a change log.",
  },
  {
    id: "re-evaluation",
    label: "Re-evaluation on change",
    detail: "A new robot revision, model version, SKU set or layout change is re-scored against the same bar.",
  },
  {
    id: "deployment-record",
    label: "Deployment record",
    detail: "Uptime, intervention and throughput history, held by a party with no stake in the result.",
  },
  {
    id: "expansion-eval",
    label: "Expansion evaluation",
    detail: "The second cell, the added shift and the sister site, screened against the proven configuration.",
  },
  {
    id: "incident-evidence",
    label: "Incident evidence",
    detail: "An independent record when something goes wrong and the contract is in dispute.",
  },
] as const;

/**
 * Before identifiable detail is released, both parties sign an
 * opportunity-specific acknowledgment. This is the backstop, not the defence:
 * the maintained product above is what makes staying worthwhile.
 */
export const attributionTerms = [
  "Attribution of the introduction to a named opportunity and date",
  "Reporting obligation on deployment start, robot count and status changes",
  "Audit right against the deployment record",
] as const;

export type DeploymentCostInput = {
  robots: number;
  months: number;
  /** Whether this team already paid an evaluation credit on this site-task. */
  evaluationCreditPaid: boolean;
  /** Which end of the posted bands to model. */
  bound?: "low" | "high";
};

export type DeploymentCostBreakdown = {
  activation: number;
  robotMonths: number;
  creditApplied: number;
  total: number;
  /** Total before the credit is returned, for showing what the credit is worth. */
  grossTotal: number;
};

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Year-one cost of a deployment under the posted terms. The evaluation credit
 * is returned against this total, so a team that deploys never pays it twice.
 */
export function calculateDeploymentCost({
  robots,
  months,
  evaluationCreditPaid,
  bound = "low",
}: DeploymentCostInput): DeploymentCostBreakdown {
  const safeRobots = Math.floor(nonNegative(robots));
  const safeMonths = Math.floor(nonNegative(months));
  const rate = bound === "high" ? deploymentFees.robotMonth.high : deploymentFees.robotMonth.low;

  const activation = safeRobots > 0 && safeMonths > 0 ? deploymentFees.activation.amount : 0;
  const robotMonths = safeRobots * safeMonths * rate;
  const grossTotal = activation + robotMonths;

  const creditValue = bound === "high" ? evaluationCredit.high : evaluationCredit.low;
  // The credit can only offset what is owed; it is never refunded as cash.
  const creditApplied = evaluationCreditPaid ? Math.min(creditValue, grossTotal) : 0;

  return {
    activation,
    robotMonths,
    creditApplied,
    grossTotal,
    total: grossTotal - creditApplied,
  };
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBand(low: number, high: number) {
  return `${formatUsd(low)}–${formatUsd(high)}`;
}
