export const DEPLOYMENT_NETWORK_TIERS = [
  {
    key: "first_million",
    label: "First $1 million in the customer account year",
    rate: 0.05,
    lowerBound: 0,
    upperBound: 1_000_000,
  },
  {
    key: "one_to_ten_million",
    label: "Next $9 million in the customer account year",
    rate: 0.03,
    lowerBound: 1_000_000,
    upperBound: 10_000_000,
  },
  {
    key: "above_ten_million",
    label: "Annual customer volume above $10 million",
    rate: 0.015,
    lowerBound: 10_000_000,
    upperBound: Number.POSITIVE_INFINITY,
  },
] as const;

export const DEPLOYMENT_NETWORK_RENEWAL_RATE = 0.015;

export type DeploymentNetworkFeeBreakdown = {
  key: (typeof DEPLOYMENT_NETWORK_TIERS)[number]["key"];
  label: string;
  rate: number;
  applicableRevenue: number;
  fee: number;
};

export type DeploymentNetworkFee = {
  collectedRevenue: number;
  fee: number;
  effectiveRate: number;
  breakdown: DeploymentNetworkFeeBreakdown[];
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateDeploymentNetworkFee(
  collectedRevenue: number,
): DeploymentNetworkFee {
  const normalizedRevenue = finiteNonNegative(collectedRevenue);
  const breakdown = DEPLOYMENT_NETWORK_TIERS.map((tier) => {
    const tierCeiling = Math.min(normalizedRevenue, tier.upperBound);
    const applicableRevenue = Math.max(0, tierCeiling - tier.lowerBound);
    return {
      key: tier.key,
      label: tier.label,
      rate: tier.rate,
      applicableRevenue,
      fee: applicableRevenue * tier.rate,
    };
  }).filter((tier) => tier.applicableRevenue > 0);
  const fee = breakdown.reduce((total, tier) => total + tier.fee, 0);

  return {
    collectedRevenue: normalizedRevenue,
    fee,
    effectiveRate: normalizedRevenue > 0 ? fee / normalizedRevenue : 0,
    breakdown,
  };
}

export function calculateRenewalNetworkFee(collectedRevenue: number) {
  return finiteNonNegative(collectedRevenue) * DEPLOYMENT_NETWORK_RENEWAL_RATE;
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(finiteNonNegative(value));
}

export function formatPercent(value: number) {
  return `${(finiteNonNegative(value) * 100).toFixed((value * 100) % 1 === 0 ? 0 : 1)}%`;
}
