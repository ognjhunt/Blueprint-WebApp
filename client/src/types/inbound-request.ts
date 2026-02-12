/**
 * Client-side types for the inbound request lead management system
 */

// Budget bucket options
export type BudgetBucket =
  | "<$50K"
  | "$50K-$300K"
  | "$300K-$1M"
  | ">$1M"
  | "Undecided/Unsure";

// Product interest options (what can we help with)
export type HelpWithOption =
  | "benchmark-packs"
  | "scene-library"
  | "dataset-packs"
  | "custom-capture"
  | "pilot-exchange-location-brief"
  | "pilot-exchange-policy-submission"
  | "pilot-exchange-data-licensing";

// Request status for lead tracking
export type RequestStatus =
  | "new"
  | "triaging"
  | "scheduled"
  | "qualified"
  | "disqualified"
  | "closed";

// Priority levels
export type RequestPriority = "low" | "normal" | "high";

// UTM tracking parameters
export interface UTMParams {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

// Context data captured with the request
export interface RequestContext {
  sourcePageUrl: string;
  referrer?: string | null;
  utm: UTMParams;
  userAgent?: string | null;
  timezoneOffset?: number | null;
  locale?: string | null;
}

// Request payload from frontend form submission
export interface InboundRequestPayload {
  requestId: string;
  firstName: string;
  lastName: string;
  company: string;
  roleTitle: string;
  email: string;
  budgetBucket: BudgetBucket;
  helpWith: HelpWithOption[];
  details?: string;
  context: RequestContext;
  honeypot?: string; // Anti-bot honeypot field
}

// Response from submitInboundRequest endpoint
export interface SubmitInboundRequestResponse {
  ok: boolean;
  requestId: string;
  status: RequestStatus;
  message?: string;
}

// Owner assignment
export interface RequestOwner {
  uid?: string | null;
  email?: string | null;
}

// Admin dashboard list item
export interface InboundRequestListItem {
  requestId: string;
  createdAt: string; // ISO string
  status: RequestStatus;
  priority: RequestPriority;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    roleTitle: string;
  };
  request: {
    budgetBucket: BudgetBucket;
    helpWith: HelpWithOption[];
    details?: string | null;
  };
  owner: RequestOwner;
}

// Full request detail for admin view
export interface InboundRequestDetail extends InboundRequestListItem {
  context: {
    sourcePageUrl: string;
    referrer?: string | null;
    utm: UTMParams;
  };
  enrichment: {
    companyDomain?: string | null;
    companySize?: string | null;
    geo?: string | null;
    notes?: string | null;
  };
  events: {
    confirmationEmailSentAt?: string | null;
    slackNotifiedAt?: string | null;
    crmSyncedAt?: string | null;
  };
  notes?: RequestNote[];
}

// Note attached to a request
export interface RequestNote {
  id: string;
  content: string;
  authorUid: string;
  authorEmail: string;
  createdAt: string; // ISO string
}

// Status update payload
export interface UpdateRequestStatusPayload {
  requestId: string;
  status: RequestStatus;
  note?: string;
}

// Owner assignment payload
export interface AssignRequestOwnerPayload {
  requestId: string;
  owner: RequestOwner;
}

// Add note payload
export interface AddRequestNotePayload {
  requestId: string;
  content: string;
}

// Status labels for UI
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  triaging: "Triaging",
  scheduled: "Scheduled",
  qualified: "Qualified",
  disqualified: "Disqualified",
  closed: "Closed",
};

// Priority labels for UI
export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

// Help with labels for UI
export const HELP_WITH_LABELS: Record<HelpWithOption, string> = {
  "benchmark-packs": "Benchmark Packs",
  "scene-library": "Scene Library",
  "dataset-packs": "Dataset Packs",
  "custom-capture": "Custom Scene",
  "pilot-exchange-location-brief": "Pilot Exchange: Location Brief",
  "pilot-exchange-policy-submission": "Pilot Exchange: Policy Submission",
  "pilot-exchange-data-licensing": "Pilot Exchange: Data Licensing",
};

// Budget bucket labels for UI
export const BUDGET_BUCKET_LABELS: Record<BudgetBucket, string> = {
  "<$50K": "Under $50K",
  "$50K-$300K": "$50K - $300K",
  "$300K-$1M": "$300K - $1M",
  ">$1M": "Over $1M",
  "Undecided/Unsure": "Undecided",
};
