/**
 * Client-side types for the qualification-first submission and review system.
 */
import {
  HELP_WITH_LABELS as SHARED_HELP_WITH_LABELS,
  OPPORTUNITY_STATE_LABELS as SHARED_OPPORTUNITY_STATE_LABELS,
  REQUESTED_LANE_LABELS as SHARED_REQUESTED_LANE_LABELS,
} from "@/lib/requestTaxonomy";

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
  | "preview_simulation"
  | "deeper_evaluation"
  | "managed_tuning"
  | "data_licensing";

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
  captureRights?: string;
  derivedScenePermission?: string;
  datasetLicensingPermission?: string;
  payoutEligibility?: string;
  details?: string;
  context: RequestContext;
  honeypot?: string; // Anti-bot honeypot field
}

// Response from submitInboundRequest endpoint
export interface SubmitInboundRequestResponse {
  ok: boolean;
  requestId: string;
  siteSubmissionId?: string;
  status: RequestStatus;
  message?: string;
}

// Owner assignment
export interface RequestOwner {
  uid?: string | null;
  email?: string | null;
}

export interface PipelineArtifacts {
  readiness_decision_uri?: string | null;
  readiness_report_uri?: string | null;
  qualification_quality_report_uri?: string | null;
  opportunity_handoff_uri?: string | null;
  human_actions_required_uri?: string | null;
  agent_review_bundle_uri?: string | null;
  agent_readiness_memo_uri?: string | null;
  dashboard_summary_uri?: string | null;
  scene_deployment_summary_uri?: string | null;
  scene_memory_manifest_uri?: string | null;
  scene_memory_readiness_uri?: string | null;
  conditioning_bundle_uri?: string | null;
  preview_simulation_manifest_uri?: string | null;
}

export type DerivedAssetStatus =
  | "not_requested"
  | "prep_ready"
  | "generating"
  | "generated"
  | "failed"
  | "review_required";

export interface DerivedAssetEntry {
  status: DerivedAssetStatus;
  manifest_uri?: string | null;
  artifact_uri?: string | null;
  updated_at?: string | null;
}

export interface DerivedAssetsAttachment {
  scene_memory?: DerivedAssetEntry;
  preview_simulation?: DerivedAssetEntry;
  validation_package?: DerivedAssetEntry;
  dataset_package?: DerivedAssetEntry;
  synced_at?: string | null;
}

export interface PipelineAttachment {
  scene_id: string;
  capture_id: string;
  pipeline_prefix: string;
  artifacts: PipelineArtifacts;
  synced_at?: string | null;
}

export interface SceneDashboardTask {
  task_text: string;
  capture_id: string;
  status: string;
  next_action: "advance to human signoff" | "recapture" | "redesign" | "defer";
  themes: string[];
  memo_path: string;
  memo_uri: string;
}

export interface SceneDashboardCategory {
  counts: {
    ready: number;
    risky: number;
    not_ready_yet: number;
  };
  tasks: SceneDashboardTask[];
}

export interface SceneDashboardSummary {
  schema_version: "v1";
  scene: string;
  whole_home: {
    capture_id: string;
    status: string;
    confidence: number | null;
    memo_path: string;
    memo_uri: string;
  };
  categories: {
    pick: SceneDashboardCategory;
    open_close: SceneDashboardCategory;
    navigate: SceneDashboardCategory;
  };
  theme_counts: Record<string, number>;
  action_counts: Record<string, number>;
  deployment_summary: {
    total_tasks: number;
    ready_now: number;
    needs_redesign: number;
    outside_robot_envelope: number;
  };
}

// Admin dashboard list item
export interface InboundRequestListItem {
  requestId: string;
  site_submission_id: string;
  createdAt: string; // ISO string
  status: RequestStatus;
  qualification_state: QualificationState;
  opportunity_state: OpportunityState;
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
    requestedLanes: RequestedLane[];
    helpWith: HelpWithOption[];
    buyerType: BuyerType;
    siteName: string;
    siteLocation: string;
    taskStatement: string;
    details?: string | null;
  };
  owner: RequestOwner;
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
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
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
  request: InboundRequestListItem["request"] & {
    workflowContext?: string | null;
    operatingConstraints?: string | null;
    privacySecurityConstraints?: string | null;
    knownBlockers?: string | null;
    targetRobotTeam?: string | null;
    captureRights?: string | null;
    derivedScenePermission?: string | null;
    datasetLicensingPermission?: string | null;
    payoutEligibility?: string | null;
  };
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

// Status labels for UI
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  capture_requested: "Capture Requested",
  qa_passed: "QA Passed",
  needs_more_evidence: "Needs More Evidence",
  in_review: "In Review",
  qualified_ready: "Qualified Ready",
  qualified_risky: "Qualified Risky",
  not_ready_yet: "Not Ready Yet",
};

// Priority labels for UI
export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

// Help with labels for UI
export const HELP_WITH_LABELS: Record<HelpWithOption, string> = {
  ...SHARED_HELP_WITH_LABELS,
};

export const REQUESTED_LANE_LABELS: Record<RequestedLane, string> = {
  ...SHARED_REQUESTED_LANE_LABELS,
};

export const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  site_operator: "Site Operator",
  robot_team: "Robot Team",
};

export const OPPORTUNITY_STATE_LABELS: Record<OpportunityState, string> = {
  ...SHARED_OPPORTUNITY_STATE_LABELS,
};

// Budget bucket labels for UI
export const BUDGET_BUCKET_LABELS: Record<BudgetBucket, string> = {
  "<$50K": "Under $50K",
  "$50K-$300K": "$50K - $300K",
  "$300K-$1M": "$300K - $1M",
  ">$1M": "Over $1M",
  "Undecided/Unsure": "Undecided",
};
