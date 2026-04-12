export type CityLaunchBudgetTier = "zero_budget" | "low_budget" | "funded";

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
  "new city activation",
  "posture-changing public claims",
  "rights or privacy exceptions that set precedent",
  "non-standard commercial commitments",
];

export function buildCityLaunchBudgetPolicy(input?: {
  tier?: CityLaunchBudgetTier | null;
  maxTotalApprovedUsd?: number | null;
  operatorAutoApproveUsd?: number | null;
}) {
  const tier = input?.tier || "zero_budget";

  if (tier === "funded") {
    const maxTotalApprovedUsd = Math.max(5_000, input?.maxTotalApprovedUsd ?? 25_000);
    const operatorAutoApproveUsd = Math.max(
      250,
      Math.min(input?.operatorAutoApproveUsd ?? 2_500, maxTotalApprovedUsd),
    );

    return {
      tier,
      label: "Funded",
      maxTotalApprovedUsd,
      operatorAutoApproveUsd,
      allowPaidAcquisition: true,
      allowReferralRewards: true,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: operatorAutoApproveUsd,
      founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
      operatorLane: "growth-lead",
    } satisfies CityLaunchBudgetPolicy;
  }

  if (tier === "low_budget") {
    const maxTotalApprovedUsd = Math.max(500, input?.maxTotalApprovedUsd ?? 2_500);
    const operatorAutoApproveUsd = Math.max(
      100,
      Math.min(input?.operatorAutoApproveUsd ?? 500, maxTotalApprovedUsd),
    );

    return {
      tier,
      label: "Low Budget",
      maxTotalApprovedUsd,
      operatorAutoApproveUsd,
      allowPaidAcquisition: true,
      allowReferralRewards: false,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: operatorAutoApproveUsd,
      founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
      operatorLane: "growth-lead",
    } satisfies CityLaunchBudgetPolicy;
  }

  return {
    tier: "zero_budget",
    label: "Zero Budget",
    maxTotalApprovedUsd: Math.max(0, input?.maxTotalApprovedUsd ?? 0),
    operatorAutoApproveUsd: 0,
    allowPaidAcquisition: false,
    allowReferralRewards: false,
    allowTravelReimbursement: false,
    founderApprovalRequiredAboveUsd: 0,
    founderApprovalTriggers: DEFAULT_FOUNDER_TRIGGERS,
    operatorLane: "growth-lead",
  } satisfies CityLaunchBudgetPolicy;
}

export function buildCityLaunchWideningGuard(input: {
  proofReadyListings: number;
  hostedReviewsStarted: number;
  approvedCapturers: number;
  onboardedCapturers: number;
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

  return {
    mode: "single_city_until_proven",
    wideningAllowed: reasons.length === 0,
    reasons,
  } satisfies CityLaunchWideningGuard;
}
