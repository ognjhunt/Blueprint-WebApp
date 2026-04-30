import {
  buildCityLaunchBudgetPolicy,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
} from "./cityLaunchPolicy";
import {
  CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
  type CityLaunchBudgetCategory,
} from "./cityLaunchResearchContracts";

export const AGENT_SPEND_PROVIDER_VALUES = [
  "manual",
  "link_cli_test",
  "stripe_issuing_sandbox",
  "stripe_issuing_live",
] as const;

export type AgentSpendProvider = (typeof AGENT_SPEND_PROVIDER_VALUES)[number];

export const AGENT_SPEND_STATUS_VALUES = [
  "requested",
  "policy_approved",
  "provider_requested",
  "credential_issued",
  "paid",
  "reconciled",
  "denied",
  "expired",
  "requires_founder_approval",
] as const;

export type AgentSpendStatus = (typeof AGENT_SPEND_STATUS_VALUES)[number];

export type AgentSpendPolicyDecisionStatus =
  | "policy_approved"
  | "denied"
  | "requires_founder_approval";

export type AgentSpendPolicyDecision = {
  status: AgentSpendPolicyDecisionStatus;
  withinPolicy: boolean;
  founderApprovalRequired: boolean;
  reasons: string[];
  blockers: string[];
  budgetPolicy: CityLaunchBudgetPolicy;
  projectedCommittedSpendUsd: number;
  existingCommittedSpendUsd: number;
  perTransactionCapUsd: number;
  vendorAllowed: boolean;
  categoryAllowed: boolean;
  provenanceSatisfied: boolean;
  evidenceRequired: boolean;
  evidenceSatisfied: boolean;
};

export type AgentSpendRequestPolicyInput = {
  city: string;
  amountUsd: number;
  currency?: string | null;
  category: CityLaunchBudgetCategory | string;
  vendorName: string;
  purpose: string;
  issueId?: string | null;
  runId?: string | null;
  evidenceRefs?: string[] | null;
  provider?: AgentSpendProvider | string | null;
  budgetPolicy?: CityLaunchBudgetPolicy | null;
  budgetTier?: CityLaunchBudgetTier | null;
  maxTotalApprovedUsd?: number | null;
  operatorAutoApproveUsd?: number | null;
  existingCommittedSpendUsd?: number | null;
  allowedVendorNames?: string[] | null;
  founderApprovedBudgetEnvelope?: boolean | null;
};

const DEFAULT_ALLOWED_VENDOR_TOKENS_BY_CATEGORY: Record<CityLaunchBudgetCategory, string[]> = {
  creative: [
    "adobe",
    "canva",
    "figma",
    "openai",
    "runway",
    "sora",
  ],
  outbound: [
    "google workspace",
    "linkedin",
    "paperclip",
    "sendgrid",
  ],
  community: [
    "eventbrite",
    "linkedin",
    "meetup",
  ],
  field_ops: [],
  travel: [],
  tools: [
    "firebase",
    "github",
    "google",
    "link",
    "notion",
    "openai",
    "paperclip",
    "render",
    "sendgrid",
    "stripe",
    "vercel",
  ],
  other: [],
};

const EVIDENCE_REQUIRED_CATEGORIES = new Set<CityLaunchBudgetCategory>([
  "community",
  "field_ops",
  "outbound",
  "travel",
]);

export function isAgentSpendProvider(value: unknown): value is AgentSpendProvider {
  return AGENT_SPEND_PROVIDER_VALUES.includes(String(value || "") as AgentSpendProvider);
}

export function normalizeAgentSpendProvider(value: unknown): AgentSpendProvider {
  return isAgentSpendProvider(value) ? value : "manual";
}

export function isAgentSpendStatus(value: unknown): value is AgentSpendStatus {
  return AGENT_SPEND_STATUS_VALUES.includes(String(value || "") as AgentSpendStatus);
}

export function normalizeAgentSpendStatus(value: unknown): AgentSpendStatus | null {
  return isAgentSpendStatus(value) ? value : null;
}

export function isCityLaunchBudgetCategory(value: unknown): value is CityLaunchBudgetCategory {
  return CITY_LAUNCH_BUDGET_CATEGORY_VALUES.includes(
    String(value || "") as CityLaunchBudgetCategory,
  );
}

export function isLiveAgentSpendProvider(provider: AgentSpendProvider) {
  return provider === "stripe_issuing_live";
}

export function isCommittedAgentSpendStatus(status: AgentSpendStatus) {
  return [
    "policy_approved",
    "provider_requested",
    "credential_issued",
    "paid",
  ].includes(status);
}

function normalizeVendorToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeEvidenceRefs(value: string[] | null | undefined) {
  return (value || [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function isCategoryAllowed(
  category: CityLaunchBudgetCategory,
  budgetPolicy: CityLaunchBudgetPolicy,
) {
  if (budgetPolicy.tier === "zero_budget") {
    return false;
  }
  if (category === "travel") {
    return budgetPolicy.allowTravelReimbursement;
  }
  if (category === "outbound" || category === "community") {
    return budgetPolicy.allowPaidAcquisition;
  }
  if (category === "field_ops") {
    return budgetPolicy.maxTotalApprovedUsd > 0;
  }
  return budgetPolicy.maxTotalApprovedUsd > 0;
}

function isVendorAllowed(input: {
  vendorName: string;
  category: CityLaunchBudgetCategory;
  allowedVendorNames?: string[] | null;
}) {
  const vendorName = normalizeVendorToken(input.vendorName);
  const configuredTokens = (input.allowedVendorNames || [])
    .map(normalizeVendorToken)
    .filter(Boolean);
  const defaultTokens = DEFAULT_ALLOWED_VENDOR_TOKENS_BY_CATEGORY[input.category];
  const allowedTokens = configuredTokens.length > 0 ? configuredTokens : defaultTokens;
  if (allowedTokens.length === 0) {
    return false;
  }
  return allowedTokens.some((token) => vendorName === token || vendorName.includes(token));
}

export function resolveAgentSpendBudgetPolicy(input: AgentSpendRequestPolicyInput) {
  if (input.budgetPolicy) {
    return input.budgetPolicy;
  }
  return buildCityLaunchBudgetPolicy({
    tier: input.budgetTier || undefined,
    maxTotalApprovedUsd: input.maxTotalApprovedUsd ?? undefined,
    operatorAutoApproveUsd: input.operatorAutoApproveUsd ?? undefined,
  });
}

export function evaluateAgentSpendPolicy(
  input: AgentSpendRequestPolicyInput,
): AgentSpendPolicyDecision {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const budgetPolicy = resolveAgentSpendBudgetPolicy(input);
  const amountUsd = Number(input.amountUsd);
  const currency = String(input.currency || "USD").trim().toUpperCase();
  const provider = normalizeAgentSpendProvider(input.provider);
  const existingCommittedSpendUsd = Math.max(0, input.existingCommittedSpendUsd ?? 0);
  const projectedCommittedSpendUsd = existingCommittedSpendUsd + (Number.isFinite(amountUsd) ? amountUsd : 0);
  const category = isCityLaunchBudgetCategory(input.category) ? input.category : null;
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  const evidenceRequired = category ? EVIDENCE_REQUIRED_CATEGORIES.has(category) : false;
  const evidenceSatisfied = !evidenceRequired || evidenceRefs.length > 0;
  const provenanceSatisfied = Boolean(input.issueId || input.runId);
  const categoryAllowed = category ? isCategoryAllowed(category, budgetPolicy) : false;
  const vendorAllowed = category
    ? isVendorAllowed({
        vendorName: input.vendorName,
        category,
        allowedVendorNames: input.allowedVendorNames,
      })
    : false;

  if (!String(input.city || "").trim()) {
    blockers.push("city is required");
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    blockers.push("amountUsd must be a positive finite number");
  }
  if (currency !== "USD") {
    blockers.push("only USD spend requests are currently supported");
  }
  if (!category) {
    blockers.push("category must be a supported city launch budget category");
  }
  if (!String(input.vendorName || "").trim()) {
    blockers.push("vendorName is required");
  }
  if (!String(input.purpose || "").trim()) {
    blockers.push("purpose is required");
  }
  if (!provenanceSatisfied) {
    blockers.push("issueId or runId provenance is required");
  }
  if (isLiveAgentSpendProvider(provider)) {
    blockers.push("stripe_issuing_live is disabled until Stripe access, webhooks, sandbox tests, and kill switches are verified");
  }

  if (blockers.length > 0) {
    return {
      status: "denied",
      withinPolicy: false,
      founderApprovalRequired: false,
      reasons,
      blockers,
      budgetPolicy,
      projectedCommittedSpendUsd,
      existingCommittedSpendUsd,
      perTransactionCapUsd: budgetPolicy.operatorAutoApproveUsd,
      vendorAllowed,
      categoryAllowed,
      provenanceSatisfied,
      evidenceRequired,
      evidenceSatisfied,
    };
  }

  if (input.founderApprovedBudgetEnvelope === false && budgetPolicy.maxTotalApprovedUsd > 0) {
    reasons.push("city budget envelope is not founder-approved yet");
  }
  if (budgetPolicy.tier === "zero_budget") {
    reasons.push("city is operating under a zero-budget envelope");
  }
  if (!categoryAllowed) {
    reasons.push(`category ${category} is outside the written ${budgetPolicy.label} policy`);
  }
  if (!vendorAllowed) {
    reasons.push(`vendor ${input.vendorName.trim()} is not on the spend allowlist for ${category}`);
  }
  if (!evidenceSatisfied) {
    reasons.push(`category ${category} requires a rights/access/recipient/proof evidence reference`);
  }
  if (amountUsd > budgetPolicy.operatorAutoApproveUsd) {
    reasons.push(
      `amount $${amountUsd.toFixed(2)} exceeds the per-transaction operator cap of $${budgetPolicy.operatorAutoApproveUsd.toFixed(2)}`,
    );
  }
  if (projectedCommittedSpendUsd > budgetPolicy.maxTotalApprovedUsd) {
    reasons.push(
      `projected committed spend $${projectedCommittedSpendUsd.toFixed(2)} exceeds the city envelope of $${budgetPolicy.maxTotalApprovedUsd.toFixed(2)}`,
    );
  }

  if (reasons.length > 0) {
    return {
      status: "requires_founder_approval",
      withinPolicy: false,
      founderApprovalRequired: true,
      reasons,
      blockers,
      budgetPolicy,
      projectedCommittedSpendUsd,
      existingCommittedSpendUsd,
      perTransactionCapUsd: budgetPolicy.operatorAutoApproveUsd,
      vendorAllowed,
      categoryAllowed,
      provenanceSatisfied,
      evidenceRequired,
      evidenceSatisfied,
    };
  }

  return {
    status: "policy_approved",
    withinPolicy: true,
    founderApprovalRequired: false,
    reasons: ["request is inside the city budget envelope, per-transaction cap, category/vendor allowlist, and provenance requirements"],
    blockers,
    budgetPolicy,
    projectedCommittedSpendUsd,
    existingCommittedSpendUsd,
    perTransactionCapUsd: budgetPolicy.operatorAutoApproveUsd,
    vendorAllowed,
    categoryAllowed,
    provenanceSatisfied,
    evidenceRequired,
    evidenceSatisfied,
  };
}
