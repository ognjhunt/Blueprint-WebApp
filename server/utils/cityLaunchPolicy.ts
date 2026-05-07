export const CITY_LAUNCH_BUDGET_TIER_VALUES = [
  "zero_budget",
  "low_budget",
  "funded",
  "lean",
  "standard",
  "aggressive",
] as const;

export type CityLaunchBudgetTier = (typeof CITY_LAUNCH_BUDGET_TIER_VALUES)[number];

export type CityLaunchBudgetPolicy = {
  tier: CityLaunchBudgetTier;
  label: string;
  maxTotalApprovedUsd: number;
  operatorAutoApproveUsd: number;
  allowPaidAcquisition: boolean;
  allowReferralRewards: boolean;
  allowTravelReimbursement: boolean;
  founderApprovalRequiredAboveUsd: number;
  founderApprovalTriggers: string[];
  operatorLane: "growth-lead" | "ops-lead";
};

export type CityLaunchWideningGuard = {
  mode: "single_city_until_proven";
  wideningAllowed: boolean;
  reasons: string[];
};

const DEFAULT_FOUNDER_TRIGGERS = [
];

export function normalizeCityLaunchBudgetTier(
  value: unknown,
): CityLaunchBudgetTier | null {
  const normalized = String(value || "").trim().toLowerCase();
  return CITY_LAUNCH_BUDGET_TIER_VALUES.includes(normalized as CityLaunchBudgetTier)
    ? (normalized as CityLaunchBudgetTier)
    : null;
}

function resolveMaxTotalApprovedUsd(
  value: number | null | undefined,
  fallback: number,
) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed);
  }
  return fallback;
}

function resolveOperatorAutoApproveUsd(
  value: number | null | undefined,
  fallback: number,
  maxTotalApprovedUsd: number,
) {
  if (maxTotalApprovedUsd <= 0) {
    return 0;
  }
  if (value === null || value === undefined) {
    return Math.max(0, Math.min(fallback, maxTotalApprovedUsd));
  }
  const parsed = Number(value);
  const requested = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(0, Math.min(requested, maxTotalApprovedUsd));
}

export function buildCityLaunchBudgetPolicy(input?: {
  tier?: CityLaunchBudgetTier | null;
  maxTotalApprovedUsd?: number | null;
  operatorAutoApproveUsd?: number | null;
}) {
  const tier = normalizeCityLaunchBudgetTier(input?.tier) || "zero_budget";

  if (tier === "aggressive" || tier === "funded") {
    const maxTotalApprovedUsd = resolveMaxTotalApprovedUsd(
      input?.maxTotalApprovedUsd,
      25_000,
    );
    const operatorAutoApproveUsd = resolveOperatorAutoApproveUsd(
      input?.operatorAutoApproveUsd,
      2_500,
      maxTotalApprovedUsd,
    );

    return {
      tier,
      label: tier === "aggressive" ? "Aggressive" : "Funded",
      maxTotalApprovedUsd,
      operatorAutoApproveUsd,
      allowPaidAcquisition: true,
      allowReferralRewards: true,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: maxTotalApprovedUsd,
      founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
      operatorLane: "growth-lead",
    } satisfies CityLaunchBudgetPolicy;
  }

  if (tier === "standard") {
    const maxTotalApprovedUsd = resolveMaxTotalApprovedUsd(
      input?.maxTotalApprovedUsd,
      10_000,
    );
    const operatorAutoApproveUsd = resolveOperatorAutoApproveUsd(
      input?.operatorAutoApproveUsd,
      1_000,
      maxTotalApprovedUsd,
    );

    return {
      tier,
      label: "Standard",
      maxTotalApprovedUsd,
      operatorAutoApproveUsd,
      allowPaidAcquisition: true,
      allowReferralRewards: true,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: maxTotalApprovedUsd,
      founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
      operatorLane: "growth-lead",
    } satisfies CityLaunchBudgetPolicy;
  }

  if (tier === "lean" || tier === "low_budget") {
    const maxTotalApprovedUsd = resolveMaxTotalApprovedUsd(
      input?.maxTotalApprovedUsd,
      2_500,
    );
    const operatorAutoApproveUsd = resolveOperatorAutoApproveUsd(
      input?.operatorAutoApproveUsd,
      500,
      maxTotalApprovedUsd,
    );

    return {
      tier,
      label: tier === "lean" ? "Lean" : "Low Budget",
      maxTotalApprovedUsd,
      operatorAutoApproveUsd,
      allowPaidAcquisition: true,
      allowReferralRewards: false,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: maxTotalApprovedUsd,
      founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
      operatorLane: "growth-lead",
    } satisfies CityLaunchBudgetPolicy;
  }

  return {
    tier: "zero_budget",
    label: "Zero Budget",
    maxTotalApprovedUsd: resolveMaxTotalApprovedUsd(input?.maxTotalApprovedUsd, 0),
    operatorAutoApproveUsd: 0,
    allowPaidAcquisition: false,
    allowReferralRewards: false,
    allowTravelReimbursement: false,
    founderApprovalRequiredAboveUsd: Math.max(0, input?.maxTotalApprovedUsd ?? 0),
    founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
    operatorLane: "growth-lead",
  } satisfies CityLaunchBudgetPolicy;
}

export function buildCityLaunchWideningGuard(input: {
  proofReadyListings: number;
  hostedReviewsStarted: number;
  approvedCapturers: number;
  onboardedCapturers: number;
  metricsReady?: boolean;
  metricBlockers?: string[];
}) {
  const reasons: string[] = [];

  if (input.proofReadyListings < 1) {
    reasons.push("At least one proof-ready city asset must exist before widening.");
  }
  if (input.hostedReviewsStarted < 1) {
    reasons.push("At least one hosted review must run end to end before widening.");
  }
  if (input.approvedCapturers < 3) {
    reasons.push("At least three approved capturers are required before widening.");
  }
  if (input.onboardedCapturers < 2) {
    reasons.push("At least two capturers must reach onboarded status before widening.");
  }
  if (input.metricsReady === false) {
    reasons.push(
      ...(input.metricBlockers?.length
        ? input.metricBlockers
        : ["Required proof-motion analytics are not yet tracked and verified end to end."]),
    );
  }

  return {
    mode: "single_city_until_proven",
    wideningAllowed: reasons.length === 0,
    reasons,
  } satisfies CityLaunchWideningGuard;
}
