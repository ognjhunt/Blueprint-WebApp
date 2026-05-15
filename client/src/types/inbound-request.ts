/**
 * Client-side types for the site-specific intake and review system.
 */
import {
  COMMERCIAL_REQUEST_PATH_LABELS as SHARED_COMMERCIAL_REQUEST_PATH_LABELS,
  HELP_WITH_LABELS as SHARED_HELP_WITH_LABELS,
  OPPORTUNITY_STATE_LABELS as SHARED_OPPORTUNITY_STATE_LABELS,
  REQUESTED_LANE_LABELS as SHARED_REQUESTED_LANE_LABELS,
} from "@/lib/requestTaxonomy";
import type {
  BuyerChannelSource,
  BuyerChannelSourceCaptureMode,
} from "@/lib/demandAttribution";
import type { DemandCityKey } from "@/lib/cityDemandMessaging";

// Budget bucket options
export type BudgetBucket =
  | "<$50K"
  | "$50K-$300K"
  | "$300K-$1M"
  | ">$1M"
  | "Undecided/Unsure";

export type BuyerType = "site_operator" | "robot_team";

export type CommercialRequestPath =
  | "world_model"
  | "hosted_evaluation"
  | "capture_access"
  | "site_claim";

export type ProofPathPreference =
  | "exact_site_required"
  | "adjacent_site_acceptable"
  | "need_guidance";

export type RequestQueueKey =
  | "inbound_request_review"
  | "exact_site_hosted_review_queue";

export type GrowthWedgeKey = "exact_site_hosted_review";

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
  | "needs_refresh"
  | "not_ready_yet";

export type OpportunityState =
  | "not_applicable"
  | "handoff_ready"
  | "escalated_to_geometry"
  | "escalated_to_validation";

export type RequestStatus = QualificationState;

export interface PlaceLocationMetadata {
  source?: "google_places" | "manual" | string | null;
  placeId?: string | null;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export type DisplayAdvisoryScanHint =
  | "slow_down"
  | "hold_steady"
  | "turn_left"
  | "turn_right"
  | "capture_doorway"
  | "scan_corners"
  | "finish_when_complete";

export interface DisplayCaptureMetadata {
  targetName?: string | null;
  addressLabel?: string | null;
  requestId?: string | null;
  captureJobId?: string | null;
  captureBrief?: string | null;
  privacyReminder?: string | null;
  allowedAdvisoryHints?: DisplayAdvisoryScanHint[];
}

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
  demandCity?: DemandCityKey | null;
  buyerChannelSource?: BuyerChannelSource | null;
  buyerChannelSourceCaptureMode?: BuyerChannelSourceCaptureMode | null;
  buyerChannelSourceRaw?: string | null;
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
  commercialRequestPath?: CommercialRequestPath;
  siteName?: string;
  siteLocation?: string;
  siteLocationMetadata?: PlaceLocationMetadata | null;
  taskStatement?: string;
  targetSiteType?: string;
  proofPathPreference?: ProofPathPreference;
  existingStackReviewWorkflow?: string;
  humanGateTopics?: string;
  workflowContext?: string;
  operatingConstraints?: string;
  privacySecurityConstraints?: string;
  knownBlockers?: string;
  targetRobotTeam?: string;
  captureRights?: string;
  derivedScenePermission?: string;
  datasetLicensingPermission?: string;
  payoutEligibility?: string;
  displayCaptureMetadata?: DisplayCaptureMetadata | null;
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
  qualification_summary_uri?: string | null;
  capture_quality_summary_uri?: string | null;
  rights_and_compliance_summary_uri?: string | null;
  capturer_payout_recommendation_uri?: string | null;
  privacy_processed_video_uri?: string | null;
  world_model_video_uri?: string | null;
  privacy_processing_manifest_uri?: string | null;
  privacy_verification_report_uri?: string | null;
  provider_run_manifest_uri?: string | null;
  preview_manifest_uri?: string | null;
  worldlabs_request_manifest_uri?: string | null;
  worldlabs_input_manifest_uri?: string | null;
  worldlabs_input_video_uri?: string | null;
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
  launch_gate_summary_uri?: string | null;
  scene_memory_manifest_uri?: string | null;
  scene_memory_readiness_uri?: string | null;
  conditioning_bundle_uri?: string | null;
  preview_simulation_manifest_uri?: string | null;
  presentation_world_manifest_uri?: string | null;
  runtime_demo_manifest_uri?: string | null;
  authoritative_runtime_render_manifest_uri?: string | null;
  site_world_spec_uri?: string | null;
  site_world_registration_uri?: string | null;
  site_world_health_uri?: string | null;
  site_normalization_package_uri?: string | null;
  benchmark_suite_manifest_uri?: string | null;
  compatibility_matrix_uri?: string | null;
  recapture_diff_uri?: string | null;
  launchable_export_bundle_uri?: string | null;
}

export interface OpsAutomationEnvelope {
  status?: string;
  queue?: RequestQueueKey | string;
  queue_label?: string | null;
  intent?: string;
  wedge_key?: GrowthWedgeKey | null;
  filter_tags?: string[];
  next_action?: string | null;
  recommended_path?: string | null;
  confidence?: number | null;
  requires_human_review?: boolean | null;
  provider?: string | null;
  runtime?: string | null;
  model?: string | null;
  last_error?: string | null;
  last_attempt_at?: string | null;
  processed_at?: string | null;
}

export type CalendarDisposition =
  | "not_needed_yet"
  | "eligible_optional"
  | "recommended"
  | "required_before_next_step";

export type StructuredIntakeMode =
  | "structured_intake_first"
  | "calendar_accelerated";

export type ProofPathOutcome =
  | "exact_site"
  | "adjacent_site"
  | "scoped_follow_up"
  | "operator_handoff";

export type ProofReadyOutcome =
  | "proof_ready_intake"
  | "needs_clarification"
  | "operator_handoff";

export type SiteOperatorClaimOutcome =
  | "not_site_operator"
  | "site_claim_needs_detail"
  | "site_claim_needs_access_boundary"
  | "site_claim_access_boundary_ready";

export type AccessBoundaryOutcome =
  | "not_applicable"
  | "needs_access_rules"
  | "needs_privacy_security_boundary"
  | "access_boundary_defined";

export interface StructuredIntakeSummary {
  mode: StructuredIntakeMode;
  primary_cta: string;
  secondary_cta: string;
  calendar_disposition: CalendarDisposition;
  calendar_reasons: string[];
  missing_structured_fields: string[];
  missing_structured_field_labels: string[];
  owner_lane: string;
  recommended_path: string;
  next_action: string;
  routing_summary: string;
  calendar_summary: string;
  proof_path_summary: string;
  proof_ready_outcome: ProofReadyOutcome;
  proof_path_outcome: ProofPathOutcome;
  proof_readiness_score: number;
  proof_ready_criteria: string[];
  missing_proof_ready_fields: string[];
  site_operator_claim_outcome: SiteOperatorClaimOutcome;
  access_boundary_outcome: AccessBoundaryOutcome;
  site_claim_readiness_score: number;
  site_claim_criteria: string[];
  missing_site_claim_fields: string[];
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

export interface ProofPathMilestones {
  exact_site_requested_at?: string | null;
  qualified_inbound_at?: string | null;
  proof_pack_delivered_at?: string | null;
  proof_pack_reviewed_at?: string | null;
  hosted_review_ready_at?: string | null;
  hosted_review_started_at?: string | null;
  hosted_review_follow_up_at?: string | null;
  artifact_handoff_delivered_at?: string | null;
  artifact_handoff_accepted_at?: string | null;
  human_commercial_handoff_at?: string | null;
}

export type ProofPathMilestoneKey =
  | "proof_pack_delivered"
  | "proof_pack_reviewed"
  | "hosted_review_ready"
  | "hosted_review_started"
  | "hosted_review_follow_up"
  | "artifact_handoff_delivered"
  | "artifact_handoff_accepted"
  | "human_commercial_handoff";

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
  token_issued_at?: string | null;
  last_sent_at?: string | null;
}

export interface OpsSummary {
  assigned_region_id?: string | null;
  rights_status?: RequestRightsStatus;
  capture_policy_tier?: RequestCapturePolicyTier;
  capture_status?: RequestCaptureStatus;
  recapture_reason?: string | null;
  quote_status?: RequestQuoteStatus;
  next_step?: string | null;
  last_buyer_ready_at?: string | null;
  proof_path?: ProofPathMilestones | null;
}

export interface DeploymentReadinessSummary {
  qualification_state?: QualificationState;
  opportunity_state?: OpportunityState;
  capture_source?: string | null;
  capture_modality?: string | null;
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
  native_world_model_status?: "primary_ready" | "not_ready" | null;
  native_world_model_primary?: boolean | null;
  provider_fallback_preview_status?: "fallback_available" | "not_requested" | null;
  provider_fallback_only?: boolean | null;
  runtime_health_status?: string | null;
  runtime_launchable?: boolean | null;
  runtime_registration_status?: string | null;
  evaluation_prep_summary?: Record<string, unknown> | null;
  alpha_readiness?: Record<string, unknown> | null;
  preview_status?: ProviderRunStatus | "preview_unavailable" | null;
  provider_run?: ProviderRunSummary | null;
}

import type {
  ArtifactExplorerSummary,
  RobotProfile,
  RuntimeManifestSummary,
  ScenarioCatalogEntry,
  StartStateCatalogEntry,
  TaskCatalogEntry,
} from "./hostedSession";

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
  buyer_request_id?: string | null;
  capture_job_id?: string | null;
  scene_id: string;
  capture_id: string;
  pipeline_prefix: string;
  artifacts: PipelineArtifacts;
  synced_at?: string | null;
}

export interface PublicSiteWorldRecord {
  id: string;
  siteCode: string;
  siteName: string;
  siteAddress: string;
  sceneId: string;
  captureId: string;
  siteSubmissionId: string;
  pipelinePrefix: string;
  category: string;
  industry: string;
  taskLane: string;
  tone: string;
  accent: string;
  thumbnailKind: string;
  summary: string;
  bestFor: string;
  startStates: string[];
  runtime: string;
  defaultRuntimeBackend: string;
  availableRuntimeBackends: string[];
  sampleRobot: string;
  sampleRobotProfile: RobotProfile;
  sampleTask: string;
  samplePolicy: string;
  scenarioVariants: string[];
  exportArtifacts: string[];
  runtimeManifest?: RuntimeManifestSummary;
  taskCatalog: TaskCatalogEntry[];
  scenarioCatalog: ScenarioCatalogEntry[];
  startStateCatalog: StartStateCatalogEntry[];
  robotProfiles: RobotProfile[];
  exportModes: string[];
  packages: Array<{
    name: string;
    summary: string;
    priceLabel: string;
    payerLabel: string;
    actionLabel: string;
    actionHref: string;
    deliverables: string[];
    emphasis?: "default" | "recommended";
  }>;
  dataSource?: "static" | "pipeline";
  deploymentReadiness?: DeploymentReadinessSummary;
  presentationDemoReadiness?: {
    launchable: boolean;
    blockers: string[];
    presentationWorldManifestUri?: string | null;
    runtimeDemoManifestUri?: string | null;
    status?:
      | "artifact_explorer_ready"
      | "presentation_ui_unconfigured"
      | "presentation_ui_live"
      | "presentation_assets_missing";
    uiBaseUrl?: string | null;
  };
  worldLabsPreview?: {
    status: "not_requested" | "queued" | "processing" | "ready" | "failed";
    model?: string | null;
    operationId?: string | null;
    worldId?: string | null;
    launchUrl?: string | null;
    thumbnailUrl?: string | null;
    panoUrl?: string | null;
    caption?: string | null;
    spzUrls?: string[];
    colliderMeshUrl?: string | null;
    worldManifestUri?: string | null;
    operationManifestUri?: string | null;
    requestManifestUri?: string | null;
    lastUpdatedAt?: string | null;
    failureReason?: string | null;
    generationSourceType?: string | null;
  };
  artifactExplorer?: ArtifactExplorerSummary | null;
  runtimeReferenceImageUrl?: string | null;
  presentationReferenceImageUrl?: string | null;
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  siteWorldSpecUri?: string | null;
  siteWorldRegistrationUri?: string | null;
  siteWorldHealthUri?: string | null;
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
  buyer_request_id?: string | null;
  queue_key?: RequestQueueKey | null;
  growth_wedge?: GrowthWedgeKey | null;
  queue_tags?: string[];
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
    commercialRequestPath?: CommercialRequestPath | null;
    siteName: string;
    siteLocation: string;
    siteLocationMetadata?: PlaceLocationMetadata | null;
    taskStatement: string;
    details?: string | null;
    proofPathPreference?: ProofPathPreference | null;
    displayCaptureMetadata?: DisplayCaptureMetadata | null;
  };
  owner: RequestOwner;
  ops_automation?: OpsAutomationEnvelope;
  structured_intake?: StructuredIntakeSummary;
  buyer_review_access?: BuyerReviewAccess;
  ops?: OpsSummary;
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
  deployment_readiness?: DeploymentReadinessSummary;
}

// Full request detail for admin view
export interface InboundRequestDetail extends InboundRequestListItem {
  context: {
    sourcePageUrl: string;
    referrer?: string | null;
    demandCity?: DemandCityKey | null;
    buyerChannelSource?: BuyerChannelSource | null;
    buyerChannelSourceCaptureMode?: BuyerChannelSourceCaptureMode | null;
    buyerChannelSourceRaw?: string | null;
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
  ops_automation?: OpsAutomationEnvelope;
  buyer_review_access?: BuyerReviewAccess;
  ops?: OpsSummary;
  notes?: RequestNote[];
  pipeline?: PipelineAttachment;
  derived_assets?: DerivedAssetsAttachment;
  request: InboundRequestListItem["request"] & {
    targetSiteType?: string | null;
    siteLocationMetadata?: PlaceLocationMetadata | null;
    proofPathPreference?: ProofPathPreference | null;
    existingStackReviewWorkflow?: string | null;
    humanGateTopics?: string | null;
    workflowContext?: string | null;
    operatingConstraints?: string | null;
    privacySecurityConstraints?: string | null;
    knownBlockers?: string | null;
    targetRobotTeam?: string | null;
    captureRights?: string | null;
    derivedScenePermission?: string | null;
    datasetLicensingPermission?: string | null;
    payoutEligibility?: string | null;
    displayCaptureMetadata?: DisplayCaptureMetadata | null;
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

export interface UpdateRequestOpsPayload {
  requestId: string;
  assigned_region_id?: string | null;
  rights_status?: RequestRightsStatus;
  capture_policy_tier?: RequestCapturePolicyTier;
  capture_status?: RequestCaptureStatus;
  recapture_reason?: string | null;
  quote_status?: RequestQuoteStatus;
  next_step?: string | null;
  proof_path_stage?: ProofPathMilestoneKey | null;
  proof_path_stage_action?: "mark" | "clear";
  note?: string;
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
  needs_refresh: "Needs Refresh",
  not_ready_yet: "Not Ready Yet",
};

// Priority labels for UI
export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const PROOF_PATH_PREFERENCE_LABELS: Record<ProofPathPreference, string> = {
  exact_site_required: "Exact-site proof required",
  adjacent_site_acceptable: "Adjacent-site proof is acceptable",
  need_guidance: "Need guidance on the proof path",
};

export const DISPLAY_ADVISORY_SCAN_HINT_LABELS: Record<DisplayAdvisoryScanHint, string> = {
  slow_down: "Slow down",
  hold_steady: "Hold steady",
  turn_left: "Turn left",
  turn_right: "Turn right",
  capture_doorway: "Capture doorway",
  scan_corners: "Scan corners",
  finish_when_complete: "Finish when complete",
};

export const REQUEST_RIGHTS_STATUS_LABELS: Record<RequestRightsStatus, string> = {
  unknown: "Unknown",
  verified: "Verified",
  permission_required: "Permission Required",
  blocked: "Blocked",
};

export const REQUEST_CAPTURE_POLICY_LABELS: Record<RequestCapturePolicyTier, string> = {
  approved_capture: "Approved Capture",
  review_required: "Review Required",
  permission_required: "Permission Required",
  not_allowed: "Not Allowed",
};

export const REQUEST_CAPTURE_STATUS_LABELS: Record<RequestCaptureStatus, string> = {
  not_requested: "Not Requested",
  capture_requested: "Capture Requested",
  under_review: "Under Review",
  approved: "Approved",
  needs_recapture: "Needs Recapture",
  paid: "Paid",
};

export const REQUEST_QUOTE_STATUS_LABELS: Record<RequestQuoteStatus, string> = {
  not_started: "Not Started",
  buyer_ready: "Buyer Ready",
  quoted: "Quoted",
  paid: "Paid",
};

export const PROOF_PATH_MILESTONE_LABELS: Record<keyof ProofPathMilestones, string> = {
  exact_site_requested_at: "Exact-site request",
  qualified_inbound_at: "Qualified inbound",
  proof_pack_delivered_at: "Proof pack delivered",
  proof_pack_reviewed_at: "Proof pack reviewed",
  hosted_review_ready_at: "Hosted review ready",
  hosted_review_started_at: "Hosted review started",
  hosted_review_follow_up_at: "Hosted review follow-up",
  artifact_handoff_delivered_at: "Artifact handoff delivered",
  artifact_handoff_accepted_at: "Artifact handoff accepted",
  human_commercial_handoff_at: "Human commercial handoff",
};

// Help with labels for UI
export const HELP_WITH_LABELS: Record<HelpWithOption, string> = {
  ...SHARED_HELP_WITH_LABELS,
};

export const REQUESTED_LANE_LABELS: Record<RequestedLane, string> = {
  ...SHARED_REQUESTED_LANE_LABELS,
};

export const COMMERCIAL_REQUEST_PATH_LABELS: Record<CommercialRequestPath, string> = {
  ...SHARED_COMMERCIAL_REQUEST_PATH_LABELS,
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
