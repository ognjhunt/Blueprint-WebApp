const SPEND_CATEGORY_VALUES = [
  "creative",
  "outbound",
  "community",
  "field_ops",
  "travel",
  "tools",
  "other",
] as const;

type SpendCategory = (typeof SPEND_CATEGORY_VALUES)[number];

const SPEND_PROVIDER_VALUES = [
  "manual",
  "link_cli_test",
  "stripe_issuing_sandbox",
  "stripe_issuing_live",
] as const;

type SpendProvider = (typeof SPEND_PROVIDER_VALUES)[number];

export type AgentSpendToolRequestInput = {
  city: string;
  launchId: string | null;
  issueId: string | null;
  runId: string | null;
  requestedByAgent: string | null;
  requestedByRole: string | null;
  amountUsd: number;
  currency: string;
  category: SpendCategory;
  vendorName: string;
  vendorUrl: string | null;
  purpose: string;
  expectedOutcome: string | null;
  evidenceRefs: string[];
  provider: SpendProvider;
  allowedVendorNames: string[];
};

export type AgentSpendToolResultRecord = {
  id: string;
  status: string;
  amountUsd: number;
  vendorName: string;
  provider: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  return rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

function isCityLaunchBudgetCategory(value: unknown): value is SpendCategory {
  return SPEND_CATEGORY_VALUES.includes(String(value || "") as SpendCategory);
}

function normalizeAgentSpendProvider(value: unknown): SpendProvider {
  return SPEND_PROVIDER_VALUES.includes(String(value || "") as SpendProvider)
    ? String(value) as SpendProvider
    : "manual";
}

export function parseAgentSpendToolParams(
  params: Record<string, unknown>,
  fallbackAgentId: string | null,
): AgentSpendToolRequestInput {
  const city = asString(params.city);
  const amountUsd = asNumber(params.amountUsd);
  const category = asString(params.category);
  const vendorName = asString(params.vendorName);
  const purpose = asString(params.purpose);
  if (!city || amountUsd === null || !category || !vendorName || !purpose) {
    throw new Error("city, amountUsd, category, vendorName, and purpose are required");
  }
  if (!isCityLaunchBudgetCategory(category)) {
    throw new Error(`Unsupported spend category: ${category}`);
  }

  return {
    city,
    launchId: asString(params.launchId),
    issueId: asString(params.issueId),
    runId: asString(params.runId),
    requestedByAgent: asString(params.requestedByAgent) || fallbackAgentId,
    requestedByRole: asString(params.requestedByRole),
    amountUsd,
    currency: asString(params.currency) || "USD",
    category,
    vendorName,
    vendorUrl: asString(params.vendorUrl),
    purpose,
    expectedOutcome: asString(params.expectedOutcome),
    evidenceRefs: asStringArray(params.evidenceRefs),
    provider: normalizeAgentSpendProvider(params.provider),
    allowedVendorNames: asStringArray(params.allowedVendorNames),
  };
}

export function buildAgentSpendToolContent(record: AgentSpendToolResultRecord) {
  const amount = `$${record.amountUsd.toFixed(2)}`;
  if (record.status === "policy_approved") {
    return `Spend request ${record.id} is policy-approved for ${amount} to ${record.vendorName}. Provider ${record.provider} did not issue credentials.`;
  }
  if (record.status === "provider_requested") {
    return `Spend request ${record.id} is policy-approved and provider-requested for ${amount} to ${record.vendorName}. No raw payment credential was returned.`;
  }
  if (record.status === "requires_founder_approval") {
    return `Spend request ${record.id} requires founder approval before ${amount} can be spent with ${record.vendorName}.`;
  }
  if (record.status === "denied") {
    return `Spend request ${record.id} was denied for ${amount} to ${record.vendorName}.`;
  }
  return `Spend request ${record.id} is ${record.status} for ${amount} to ${record.vendorName}.`;
}
