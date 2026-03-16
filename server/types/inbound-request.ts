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
  | "preview_simulation"
  | "deeper_evaluation"
  | "managed_tuning"
  | "data_licensing";

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
  | "needs_refresh"
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
  captureRights?: string | null;
  derivedScenePermission?: string | null;
  datasetLicensingPermission?: string | null;
  payoutEligibility?: string | null;
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

export interface PipelineArtifacts {
  readiness_decision_uri?: string | null;
  readiness_report_uri?: string | null;
  qualification_quality_report_uri?: string | null;
  qualification_summary_uri?: string | null;
  capture_quality_summary_uri?: string | null;
  rights_and_compliance_summary_uri?: string | null;
  privacy_processed_video_uri?: string | null;
  world_model_video_uri?: string | null;
  privacy_processing_manifest_uri?: string | null;
  privacy_verification_report_uri?: string | null;
  provider_run_manifest_uri?: string | null;
  preview_manifest_uri?: string | null;
  worldlabs_request_manifest_uri?: string | null;
  worldlabs_operation_manifest_uri?: string | null;
  worldlabs_world_manifest_uri?: string | null;
  worldlabs_preview_thumbnail_uri?: string | null;
  worldlabs_preview_pano_uri?: string | null;
  worldlabs_spz_manifest_uri?: string | null;
  worldlabs_collider_mesh_uri?: string | null;
  worldlabs_launch_url?: string | null;
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
  presentation_world_manifest_uri?: string | null;
  runtime_demo_manifest_uri?: string | null;
  site_world_spec_uri?: string | null;
  site_world_registration_uri?: string | null;
  site_world_health_uri?: string | null;
  site_normalization_package_uri?: string | null;
  benchmark_suite_manifest_uri?: string | null;
  compatibility_matrix_uri?: string | null;
  recapture_diff_uri?: string | null;
  launchable_export_bundle_uri?: string | null;
}

export type ProviderRunStatus =
  | "not_requested"
  | "queued"
  | "submitted"
  | "processing"
  | "succeeded"
  | "failed";

export interface ProviderRunSummary {
  provider_name?: string | null;
  provider_model?: string | null;
  provider_run_id?: string | null;
  status?: ProviderRunStatus | null;
  preview_manifest_uri?: string | null;
  operation_id?: string | null;
  world_id?: string | null;
  worldlabs_launch_url?: string | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  failure_reason?: string | null;
  provenance?: Record<string, unknown> | null;
}

export interface BuyerTrustScore {
  score: number;
  band: "high" | "medium" | "low";
  reasons: string[];
}

export interface RobotCapabilityEnvelope {
  embodiment_type?: string | null;
  minimum_path_width_m?: number | null;
  maximum_reach_m?: number | null;
  maximum_payload_kg?: number | null;
  sensor_requirements?: string[];
  controller_interface_assumptions?: string[];
  safety_envelope?: string[];
  facility_constraints?: string[];
}

export interface RightsAndComplianceSummary {
  consent_scope?: string[];
  export_entitlements?: string[];
  customer_specific_sharing?: string[];
  audit_trail_uri?: string | null;
  retention_policy?: string | null;
}

export type RequestCapturePolicyTier =
  | "approved_capture"
  | "review_required"
  | "permission_required"
  | "not_allowed";

export type RequestRightsStatus =
  | "unknown"
  | "verified"
  | "permission_required"
  | "blocked";

export type RequestQuoteStatus =
  | "not_started"
  | "buyer_ready"
  | "quoted"
  | "paid";

export type RequestCaptureStatus =
  | "not_requested"
  | "capture_requested"
  | "under_review"
  | "approved"
  | "needs_recapture"
  | "paid";

export interface BuyerReviewAccess {
  buyer_review_url?: string | null;
  token_issued_at?: FirebaseFirestore.Timestamp | string | null;
  last_sent_at?: FirebaseFirestore.Timestamp | string | null;
}

export interface OpsSummary {
  assigned_region_id?: string | null;
  rights_status?: RequestRightsStatus;
  capture_policy_tier?: RequestCapturePolicyTier;
  capture_status?: RequestCaptureStatus;
  recapture_reason?: string | null;
  quote_status?: RequestQuoteStatus;
  next_step?: string | null;
  last_buyer_ready_at?: FirebaseFirestore.Timestamp | string | null;
}

export interface PrivacyProcessingSummary {
  status?: string | null;
  mode?: string | null;
  fallback_used?: boolean | null;
  people_detected?: number | null;
  people_removed?: number | null;
  face_anonymized_segments?: string[];
  raw_retained?: boolean | null;
  fail_closed?: boolean | null;
}

export interface DeploymentReadinessSummary {
  qualification_state?: QualificationState;
  opportunity_state?: OpportunityState;
  buyer_trust_score?: BuyerTrustScore;
  qualification_summary?: Record<string, unknown> | null;
  capture_quality_summary?: Record<string, unknown> | null;
  benchmark_coverage_status?: "missing" | "partial" | "ready" | null;
  benchmark_task_count?: number | null;
  export_readiness_status?: "missing" | "partial" | "ready" | null;
  recapture_status?: "not_requested" | "no_prior_baseline" | "unchanged" | "changed" | "review_required" | null;
  recapture_required?: boolean | null;
  freshness_date?: string | null;
  missing_evidence?: string[];
  privacy_processing?: PrivacyProcessingSummary;
  capability_envelope?: RobotCapabilityEnvelope;
  rights_and_compliance?: RightsAndComplianceSummary;
  exports_available?: string[];
  task_categories?: string[];
  runtime_label?: string | null;
  preview_status?: ProviderRunStatus | "preview_unavailable" | null;
  provider_run?: ProviderRunSummary | null;
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
  updated_at?: FirebaseFirestore.Timestamp | string | null;
}

export interface DerivedAssetsAttachment {
  scene_memory?: DerivedAssetEntry;
  preview_simulation?: DerivedAssetEntry;
  validation_package?: DerivedAssetEntry;
  dataset_package?: DerivedAssetEntry;
  synced_at?: FirebaseFirestore.Timestamp | string | null;
}

export interface PipelineAttachment {
  buyer_request_id?: string | null;
  capture_job_id?: string | null;
  scene_id: string;
  capture_id: string;
  pipeline_prefix: string;
  artifacts: PipelineArtifacts;
  synced_at?: FirebaseFirestore.Timestamp | string | null;
}

// The full inbound request document stored in Firestore
export interface InboundRequest {
  requestId: string;
  site_submission_id: string;
  buyer_request_id?: string | null;
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
  buyer_review_access?: BuyerReviewAccess;
  ops?: OpsSummary;
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
  deployment_readiness?: DeploymentReadinessSummary;
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
  captureRights?: EncryptableString | null;
  derivedScenePermission?: EncryptableString | null;
  datasetLicensingPermission?: EncryptableString | null;
  payoutEligibility?: EncryptableString | null;
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
  captureRights?: string;
  derivedScenePermission?: string;
  datasetLicensingPermission?: string;
  payoutEligibility?: string;
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

// Admin dashboard list item (subset of full InboundRequest)
export interface InboundRequestListItem {
  requestId: string;
  site_submission_id: string;
  buyer_request_id?: string | null;
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
  buyer_review_access?: BuyerReviewAccess;
  ops?: OpsSummary;
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
  deployment_readiness?: DeploymentReadinessSummary;
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

export interface UpdateRequestOpsPayload {
  requestId: string;
  assigned_region_id?: string | null;
  rights_status?: RequestRightsStatus;
  capture_policy_tier?: RequestCapturePolicyTier;
  capture_status?: RequestCaptureStatus;
  recapture_reason?: string | null;
  quote_status?: RequestQuoteStatus;
  next_step?: string | null;
  note?: string;
}
