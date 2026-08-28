/**
 * Blueprint charges two things. That is the whole model.
 *
 *   1. Evaluation fee — $1,000 per site-task, paid by every robot team that
 *      runs a real evaluation.
 *   2. Deployment fee — paid by the winning robot team only: the GREATER of
 *      $10,000 per activated site-task or $2,000 per robot deployed on it.
 *
 * The site pays nothing. It contributes the thing that is hardest to get —
 * the floor, the operational access, and the task data — so charging it would
 * tax the scarce side and suppress the supply the whole market needs.
 *
 * WHY THERE IS NO PERCENTAGE. A share of contract value is not reliably
 * collectible unless Blueprint controls invoicing. A robot company can
 * understate the contract, split hardware, software and services into
 * separate agreements, or transact off-platform entirely — and high-value,
 * low-frequency deals are exactly where that pressure is strongest. Robot
 * count is different: it is visible in the deployment and acceptance record,
 * and both the site and Blueprint can verify it independently.
 *
 * If a percentage is ever wanted, it needs a payment rail first — robot-company
 * invoices running through something like Stripe Connect, which can withhold an
 * application fee automatically. Direct charges there also leave refunds and
 * chargebacks with the robot company rather than with Blueprint. Until that
 * infrastructure is mandatory, the company is not based on reported contract
 * value.
 *
 * ON THE NUMBERS. These are posted starting terms Blueprint intends to test,
 * not market-clearing rates. No independent source establishes a market price
 * for this service: the robotics-data benchmarks that circulate publicly are
 * published by vendors selling data services, and the one customer-paid
 * deployment fee on the public record (roughly $20-25k, Agility investor
 * materials, June 2026) is an illustrative figure inside a single company's
 * own model. Nothing rendered from this file may present them as an industry
 * rate.
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

/**
 * The evaluation fee. Every robot team running a real evaluation pays it —
 * this is not a GPU markup, it is access to a captured task, a standardised
 * test and a scored result.
 */
export const evaluationFee = {
  amount: 1_000,
  unit: "per site-task, per team",
  basis: "under-test" as PricingBasis,
  includes: [
    "Up to 500 episodes against the captured twin",
    "Analysis and the scored result on the listing rubric",
    "The full capture package: object library, demonstrations, site conditions",
  ],
  /** Only the winning task's fee is credited. Losing evaluations are not refunded. */
  creditRule:
    "Credited against the deployment fee only for the task that actually deploys. Evaluations on tasks a team does not win are not credited.",
} as const;

/**
 * The deployment fee. Greater-of, so a small pilot still covers the work and a
 * large rollout pays proportionately — without anyone disclosing a contract.
 */
export const deploymentFee = {
  floor: 10_000,
  perRobot: 2_000,
  unit: "per activated site-task",
  basis: "under-test" as PricingBasis,
  rule: "The greater of $10,000 per activated site-task or $2,000 per robot deployed on it.",
  verifiable:
    "Robot count is visible in the deployment and acceptance record. Both the site and Blueprint can check it, so nothing rests on a reported contract value.",
  cumulative:
    "The fee is a running total on the task. Expanding the same task later tops up to the new total rather than starting again.",
  whoPays:
    "The winning robot team. Blueprint delivered a qualified revenue opportunity and replaced its presales and site-scoping work.",
} as const;

/**
 * A robot company paying a site to host a pilot is a real and supported
 * arrangement. It is a separate payment for access, disruption or data, and it
 * does not touch Blueprint's fee in either direction.
 */
export const vendorFundedPilots = {
  label: "Vendor-funded pilots are fine",
  detail:
    "If a robot team pays the site to host — for access, disruption or data — that is between them, fully supported, and separate from Blueprint's fee.",
} as const;

/**
 * Who invoices whom, for now. Blueprint bills its own fees; the commercial
 * agreement stays between the two parties.
 */
export const settlement = {
  today:
    "The site and the robot team contract and pay each other directly. Blueprint invoices its own two fees separately.",
  later:
    "Taking a percentage would require robot-company invoicing to run through a payment rail that can withhold an application fee automatically. Until that is in place, Blueprint does not price on reported contract value.",
} as const;

/** The one case where a site pays: it is not the open marketplace. */
export const privateProcurement = {
  label: "The one time a site pays",
  detail:
    "Only when a site separately hires Blueprint to run a private, exclusive procurement. That is a different engagement from the open board, and it is priced on its own.",
} as const;

export type DeploymentFeeInput = {
  /** Robots deployed on this site-task. */
  robots: number;
  /** Whether this team paid the evaluation fee on the task it won. */
  wonAfterEvaluating: boolean;
  /**
   * Cash already paid to Blueprint on this task, for an expansion top-up.
   * Excludes the evaluation credit — that is a one-time offset against the
   * running total and is applied here, not counted as a payment.
   */
  alreadyPaid?: number;
};

export type DeploymentFeeBreakdown = {
  /** max(floor, perRobot * robots) */
  total: number;
  /** Which side of the greater-of is binding, for showing the reader why. */
  basis: "floor" | "per-robot";
  creditApplied: number;
  alreadyPaid: number;
  /** What is owed right now. */
  dueNow: number;
};

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateDeploymentFee({
  robots,
  wonAfterEvaluating,
  alreadyPaid = 0,
}: DeploymentFeeInput): DeploymentFeeBreakdown {
  const safeRobots = Math.floor(nonNegative(robots));
  const paid = nonNegative(alreadyPaid);

  if (safeRobots === 0) {
    return { total: 0, basis: "floor", creditApplied: 0, alreadyPaid: paid, dueNow: 0 };
  }

  const perRobotTotal = safeRobots * deploymentFee.perRobot;
  const total = Math.max(deploymentFee.floor, perRobotTotal);
  // The credit offsets the running total once. Expansion tops up against that
  // same total, so applying it again per top-up would refund it repeatedly.
  const credit = wonAfterEvaluating ? Math.min(evaluationFee.amount, total) : 0;

  return {
    total,
    basis: perRobotTotal > deploymentFee.floor ? "per-robot" : "floor",
    creditApplied: credit,
    alreadyPaid: paid,
    dueNow: Math.max(0, total - credit - paid),
  };
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
