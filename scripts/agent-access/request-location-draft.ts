import {
  buildAgentInboundRequestDraft,
  buildContactRequestUrl,
  type ContactRequestUrlInput,
} from "../../client/src/lib/contactRequestPrefill";
import type {
  BudgetBucket,
  InboundRequestPayload,
} from "../../client/src/types/inbound-request";

export type AgentRequestLocationDraftInput = ContactRequestUrlInput & {
  requestId?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  roleTitle?: string;
  email?: string;
  budgetBucket?: BudgetBucket | string;
  sourcePageUrl?: string;
  submit?: boolean;
};

export type AgentRequestLocationDraftPayload = {
  mode: "dry_run";
  action: "request_location_draft";
  contactUrl: string;
  inboundRequestDraft: Partial<InboundRequestPayload> & {
    context: Partial<InboundRequestPayload["context"]>;
  };
  missingRequiredFields: string[];
  submitInstructions: {
    explicitSubmitRequired: true;
    defaultWrites: false;
    directSubmitAvailable: false;
    endpoint: "/api/inbound-request";
    method: "POST";
    completeContactFieldsRequired: true;
    currentPayloadIsSubmitReady: boolean;
    message: string;
  };
  truthBoundaries: string[];
};

const VALID_BUDGET_BUCKETS = new Set<BudgetBucket>([
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
]);

function clean(value: unknown): string {
  return String(value || "").trim();
}

function optional(value: unknown) {
  const normalized = clean(value);
  return normalized || undefined;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  ) as Partial<T>;
}

function normalizeBudgetBucket(value: unknown): BudgetBucket | undefined {
  const normalized = clean(value) as BudgetBucket;
  return VALID_BUDGET_BUCKETS.has(normalized) ? normalized : undefined;
}

function buildDraftInput(input: AgentRequestLocationDraftInput): ContactRequestUrlInput {
  const location = clean(input.location || input.siteLocation || input.address || input.city);
  return {
    ...input,
    buyerType: "robot_team",
    requestPath: "new-capture",
    commercialRequestPath: "capture_access",
    source: clean(input.source) || "agent-request-location",
    location,
    siteLocation: location,
    query: clean(input.query || input.primaryNeed || input.siteName || location),
    targetSiteType: clean(input.targetSiteType || input.siteClass),
    proofPathPreference: "exact_site_required",
  };
}

function requiredInboundFields(
  draft: AgentRequestLocationDraftPayload["inboundRequestDraft"],
) {
  const missing: string[] = [];
  if (!clean(draft.requestId)) missing.push("requestId");
  if (!clean(draft.firstName)) missing.push("firstName");
  if (!clean(draft.lastName)) missing.push("lastName");
  if (!clean(draft.company)) missing.push("company");
  if (!clean(draft.roleTitle)) missing.push("roleTitle");
  if (!clean(draft.email)) missing.push("email");
  if (!draft.budgetBucket) missing.push("budgetBucket");
  if (!clean(draft.taskStatement)) missing.push("taskStatement");
  if (!clean(draft.targetSiteType) && !clean(draft.siteName) && !clean(draft.siteLocation)) {
    missing.push("targetSiteTypeOrSiteNameOrLocation");
  }
  if (!clean(draft.proofPathPreference)) missing.push("proofPathPreference");
  return missing;
}

export function buildAgentRequestLocationDraft(
  input: AgentRequestLocationDraftInput = {},
): AgentRequestLocationDraftPayload {
  const draftInput = buildDraftInput(input);
  const contactUrl = buildContactRequestUrl(draftInput);
  const requestDraft = buildAgentInboundRequestDraft({
    ...draftInput,
    sourcePageUrl: input.sourcePageUrl || contactUrl,
  });
  const inboundRequestDraft = {
    ...requestDraft,
    ...compact({
      requestId: optional(input.requestId),
      firstName: optional(input.firstName),
      lastName: optional(input.lastName),
      company: optional(input.company),
      roleTitle: optional(input.roleTitle),
      email: optional(input.email),
      budgetBucket: normalizeBudgetBucket(input.budgetBucket),
    }),
  };
  const missingRequiredFields = requiredInboundFields(inboundRequestDraft);

  return {
    mode: "dry_run",
    action: "request_location_draft",
    contactUrl,
    inboundRequestDraft,
    missingRequiredFields,
    submitInstructions: {
      explicitSubmitRequired: true,
      defaultWrites: false,
      directSubmitAvailable: false,
      endpoint: "/api/inbound-request",
      method: "POST",
      completeContactFieldsRequired: true,
      currentPayloadIsSubmitReady: missingRequiredFields.length === 0,
      message:
        missingRequiredFields.length > 0
          ? "This draft is not submit-ready. Fill every missing field before an explicit inbound-request POST or use the contactUrl for human review."
          : "This draft has the required inbound-request fields, but this CLI/MCP draft tool still does not submit. Submit only through an explicit POST or the contactUrl.",
    },
    truthBoundaries: [
      "This is a local dry-run draft. It does not scrape /contact and does not write an inbound request.",
      "The draft records a new site scan intake interest only. It does not grant entitlement, payment, rights clearance, provider execution, fulfillment, package access, private artifacts, or hosted-session availability.",
      "Direct submission is outside this draft tool. A submitter must explicitly post complete contact fields to /api/inbound-request or route a human through contactUrl.",
    ],
  };
}
