import type { EncryptableString } from "./field-encryption";

/**
 * Types for the qualification-first submission and review system.
 */

// Budget bucket options
export type BudgetBucket =
  | "<$50K"
  | "$50K-$300K"
  | "$300K-$1M"
  | ">$1M"
  | "Undecided/Unsure";

export type BuyerType = "site_operator" | "robot_team";

export type RequestedLane =
  | "qualification"
  | "deeper_evaluation"
  | "managed_tuning";

// Legacy compatibility aliases accepted on read and write during migration.
export type HelpWithOption =
  | "benchmark-packs"
  | "scene-library"
  | "dataset-packs"
  | "custom-capture"
  | "pilot-exchange-location-brief"
  | "pilot-exchange-policy-submission"
  | "pilot-exchange-data-licensing";

export type QualificationState =
  | "submitted"
  | "capture_requested"
  | "qa_passed"
  | "needs_more_evidence"
  | "in_review"
  | "qualified_ready"
  | "qualified_risky"
  | "not_ready_yet";

export type OpportunityState =
  | "not_applicable"
  | "handoff_ready"
  | "escalated_to_geometry"
  | "escalated_to_validation";

// Request status is retained as a compatibility mirror of qualification state.
export type RequestStatus = QualificationState;

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
  ipHash?: string | null;
}

// Contact information
export interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  roleTitle: string;
  company: string;
}

// The actual request details
export interface RequestDetails {
  budgetBucket: BudgetBucket;
  requestedLanes: RequestedLane[];
  helpWith: HelpWithOption[];
  details?: string | null;
  buyerType: BuyerType;
  siteName: string;
  siteLocation: string;
  taskStatement: string;
  workflowContext?: string | null;
  operatingConstraints?: string | null;
  privacySecurityConstraints?: string | null;
  knownBlockers?: string | null;
  targetRobotTeam?: string | null;
}

// Owner assignment
export interface RequestOwner {
  uid?: string | null;
  email?: string | null;
}

// Enrichment data (can be added later)
export interface EnrichmentData {
  companyDomain?: string | null;
  companySize?: string | null;
  geo?: string | null;
  notes?: string | null;
}

// Event timestamps for tracking automations
export interface RequestEvents {
  confirmationEmailSentAt?: FirebaseFirestore.Timestamp | null;
  slackNotifiedAt?: FirebaseFirestore.Timestamp | null;
  crmSyncedAt?: FirebaseFirestore.Timestamp | null;
}

// The full inbound request document stored in Firestore
export interface InboundRequest {
  requestId: string;
  site_submission_id: string;
  createdAt: FirebaseFirestore.Timestamp;
  status: RequestStatus;
  qualification_state: QualificationState;
  opportunity_state: OpportunityState;
  priority: RequestPriority;
  owner: RequestOwner;
  contact: ContactInfo;
  request: RequestDetails;
  context: RequestContext;
  enrichment: EnrichmentData;
  events: RequestEvents;
  debug: {
    schemaVersion: number;
  };
}

export interface ContactInfoStored {
  firstName: EncryptableString;
  lastName: EncryptableString;
  email: EncryptableString;
  roleTitle: EncryptableString;
  company: EncryptableString;
}

export interface RequestDetailsStored {
  budgetBucket: BudgetBucket;
  requestedLanes: RequestedLane[];
  helpWith: HelpWithOption[];
  details?: EncryptableString | null;
  buyerType: BuyerType;
  siteName: EncryptableString;
  siteLocation: EncryptableString;
  taskStatement: EncryptableString;
  workflowContext?: EncryptableString | null;
  operatingConstraints?: EncryptableString | null;
  privacySecurityConstraints?: EncryptableString | null;
  knownBlockers?: EncryptableString | null;
  targetRobotTeam?: EncryptableString | null;
}

export interface InboundRequestStored
  extends Omit<InboundRequest, "contact" | "request"> {
  contact: ContactInfoStored;
  request: RequestDetailsStored;
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
  requestedLanes?: RequestedLane[];
  helpWith?: HelpWithOption[];
  buyerType?: BuyerType;
  siteName?: string;
  siteLocation?: string;
  taskStatement?: string;
  workflowContext?: string;
  operatingConstraints?: string;
  privacySecurityConstraints?: string;
  knownBlockers?: string;
  targetRobotTeam?: string;
  details?: string;
  context: {
    sourcePageUrl: string;
    referrer?: string;
    utm: UTMParams;
    timezoneOffset?: number;
    locale?: string;
    userAgent?: string;
  };
  honeypot?: string; // Anti-bot honeypot field
}

// Note attached to a request
export interface RequestNote {
  id?: string;
  content: string;
  authorUid: string;
  authorEmail: string;
  createdAt: FirebaseFirestore.Timestamp;
}

// Lead routing configuration
export interface LeadRoutingRule {
  id: string;
  name: string;
  conditions: {
    budgetBuckets?: BudgetBucket[];
    helpWith?: HelpWithOption[];
    emailDomains?: string[];
  };
  assignTo: RequestOwner;
  priority?: RequestPriority;
  enabled: boolean;
}

// Response from submitInboundRequest endpoint
export interface SubmitInboundRequestResponse {
  ok: boolean;
  requestId: string;
  siteSubmissionId?: string;
  status: RequestStatus;
  message?: string;
}

// Admin dashboard list item (subset of full InboundRequest)
export interface InboundRequestListItem {
  requestId: string;
  site_submission_id: string;
  createdAt: string; // ISO string for client
  status: RequestStatus;
  qualification_state: QualificationState;
  opportunity_state: OpportunityState;
  priority: RequestPriority;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
  };
  request: {
    budgetBucket: BudgetBucket;
    requestedLanes: RequestedLane[];
    helpWith: HelpWithOption[];
    buyerType: BuyerType;
    siteName: string;
    siteLocation: string;
    taskStatement: string;
  };
  owner: RequestOwner;
}

export interface UpdateRequestStatusPayload {
  requestId: string;
  qualification_state: QualificationState;
  opportunity_state?: OpportunityState;
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
