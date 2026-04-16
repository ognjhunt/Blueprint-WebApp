/**
 * Pipeline State Machine — Production Bridge
 *
 * Centralizes the logic for translating pipeline artifact outputs into
 * inbound request state transitions, milestone stamps, and ops envelope updates.
 *
 * This module ensures that pipeline outputs (readiness reports, world models,
 * preview manifests, etc.) drive request state progression deterministically and
 * transparently, without mutating request records in ad-hoc ways.
 *
 * Design principles:
 * - Pipeline outputs are evidence; they inform state transitions.
 * - State transitions are explicit and auditable.
 * - Milestones are stamped at most once (idempotent).
 * - The bridge never overwrites capture truth or provenance truth.
 */

import * as admin from "firebase-admin";
import type {
  PipelineArtifacts,
  PipelineAttachment,
  DerivedAssetsAttachment,
  DerivedAssetEntry,
  DeploymentReadinessSummary,
  QualificationState,
  OpportunityState,
  ProofPathMilestones,
  OpsAutomationEnvelope,
  ProviderRunStatus,
} from "../types/inbound-request";

// ────────────────────────────────────────────────
// Milestone-to-growth-event mapping
// ────────────────────────────────────────────────

const MILESTONE_TO_GROWTH_EVENT: Partial<Record<keyof ProofPathMilestones, string>> = {
  proof_pack_delivered_at: "proof_pack_delivered",
  hosted_review_ready_at: "hosted_review_ready",
  hosted_review_started_at: "hosted_review_started",
  hosted_review_follow_up_at: "hosted_review_follow_up_sent",
  human_commercial_handoff_at: "human_commercial_handoff_started",
};

export function growthEventsForStamps(stampedThisSync: (keyof ProofPathMilestones)[]): string[] {
  const events: string[] = [];
  for (const stamp of stampedThisSync) {
    const event = MILESTONE_TO_GROWTH_EVENT[stamp];
    if (event) events.push(event);
  }
  return events;
}

// ────────────────────────────────────────────────
// Artifact presence detection
// ────────────────────────────────────────────────

function hasArtifact(artifacts: PipelineArtifacts | undefined, key: keyof PipelineArtifacts): boolean {
  return !!(artifacts && (artifacts[key] as string | null | undefined));
}

function countPresentArtifacts(artifacts: PipelineArtifacts | undefined): number {
  if (!artifacts) return 0;
  return Object.values(artifacts).filter(v => v !== null && v !== undefined && v !== "").length;
}

// Core artifact groups that signal meaningful pipeline progress
const CORE_ARTIFACT_GROUPS = {
  capture_and_qa: [
    "qualification_quality_report_uri",
    "qualification_summary_uri",
    "capture_quality_summary_uri",
  ] as (keyof PipelineArtifacts)[],
  privacy_and_rights: [
    "rights_and_compliance_summary_uri",
    "privacy_processing_manifest_uri",
    "privacy_verification_report_uri",
  ] as (keyof PipelineArtifacts)[],
  world_model_outputs: [
    "worldlabs_world_manifest_uri",
    "worldlabs_input_manifest_uri",
    "worldlabs_operation_manifest_uri",
    "preview_manifest_uri",
  ] as (keyof PipelineArtifacts)[],
  evaluation_artifacts: [
    "launch_gate_summary_uri",
    "scene_deployment_summary_uri",
    "dashboard_summary_uri",
  ] as (keyof PipelineArtifacts)[],
  runtime_artifacts: [
    "authoritative_runtime_render_manifest_uri",
    "runtime_demo_manifest_uri",
    "presentation_world_manifest_uri",
  ] as (keyof PipelineArtifacts)[],
  commercial_artifacts: [
    "opportunity_handoff_uri",
    "capturer_payout_recommendation_uri",
    "launchable_export_bundle_uri",
  ] as (keyof PipelineArtifacts)[],
} as const;

function artifactsInGroup(artifacts: PipelineArtifacts | undefined, group: readonly (keyof PipelineArtifacts)[]): number {
  if (!artifacts) return 0;
  return group.filter(k => hasArtifact(artifacts, k)).length;
}

// ────────────────────────────────────────────────
// Derived asset status helpers
// ────────────────────────────────────────────────

const DERIVED_ASSET_KEYS: (keyof DerivedAssetsAttachment)[] = [
  "scene_memory",
  "preview_simulation",
  "validation_package",
  "dataset_package",
];

function getDerivedAssetStatus(derivedAssets: DerivedAssetsAttachment | undefined, key: keyof DerivedAssetsAttachment): string | null {
  const entry = derivedAssets?.[key] as DerivedAssetEntry | undefined;
  return entry?.status ?? null;
}

function allDerivedAssetsComplete(derivedAssets: DerivedAssetsAttachment | undefined): boolean {
  if (!derivedAssets) return false;
  return DERIVED_ASSET_KEYS.every(key => {
    const entry = derivedAssets[key] as DerivedAssetEntry | undefined;
    return entry?.status === "generated";
  });
}

// ────────────────────────────────────────────────
// Qualification state inference from pipeline artifacts
// ────────────────────────────────────────────────

/**
 * Infer qualification state based on available pipeline artifacts and
 * deployment readiness data. This only applies when the authoritative_state_update
 * flag was NOT provided (meaning the pipeline is reporting evidence but not
 * making a formal state declaration).
 */
export function inferQualificationStateFromArtifacts(args: {
  artifacts?: PipelineArtifacts;
  deploymentReadiness?: DeploymentReadinessSummary;
  derivedAssets?: DerivedAssetsAttachment;
  current?: QualificationState;
}): QualificationState {
  // If there's an explicit readiness state, respect it
  if (args.deploymentReadiness) {
    const explicitState = args.deploymentReadiness.qualification_state;
    if (explicitState && isQualificationState(explicitState)) {
      return explicitState;
    }
  }

  const { artifacts } = args;
  if (!artifacts) return args.current || "submitted";

  // Check for quality report evidence
  const hasQualityReport = hasArtifact(artifacts, "qualification_quality_report_uri") 
    || hasArtifact(artifacts, "qualification_summary_uri");
  const hasCaptureQuality = hasArtifact(artifacts, "capture_quality_summary_uri");
  const hasRightsReport = hasArtifact(artifacts, "rights_and_compliance_summary_uri");
  const hasPrivacyManifest = hasArtifact(artifacts, "privacy_processing_manifest_uri");
  const hasWorldModelOutput = hasArtifact(artifacts, "worldlabs_world_manifest_uri")
    || hasArtifact(artifacts, "preview_manifest_uri");
  const hasLaunchGate = hasArtifact(artifacts, "launch_gate_summary_uri");
  const hasOpportunityHandoff = hasArtifact(artifacts, "opportunity_handoff_uri");

  // If we have an opportunity handoff, this is essentially ready
  if (hasOpportunityHandoff) {
    return "in_review";
  }

  // Launch gate summary signals a concrete readiness decision
  if (hasLaunchGate) {
    return "qa_passed";
  }

  // World model output means we have a functional site world
  if (hasWorldModelOutput && hasCaptureQuality && hasRightsReport) {
    return "qualified_ready";
  }

  // Quality report exists but some pieces are missing
  if (hasQualityReport && hasCaptureQuality) {
    return "qualified_risky";
  }

  // Only minimal processing done
  if (hasPrivacyManifest || hasRightsReport) {
    return "in_review";
  }

  return args.current || "submitted";
}

// ────────────────────────────────────────────────
// Opportunity state inference
// ────────────────────────────────────────────────

export function inferOpportunityState(args: {
  qualificationState: QualificationState;
  artifacts?: PipelineArtifacts;
  deploymentReadiness?: DeploymentReadinessSummary;
}): OpportunityState {
  // Explicit readiness state wins
  if (args.deploymentReadiness?.opportunity_state) {
    const explicitState = args.deploymentReadiness.opportunity_state;
    if (isOpportunityState(explicitState)) {
      return explicitState;
    }
  }

  // Derived from qualification state
  switch (args.qualificationState) {
    case "qualified_ready":
    case "qualified_risky":
      // Check if we have escalation artifacts
      if (
        hasArtifact(args.artifacts, "site_world_health_uri") &&
        hasArtifact(args.artifacts, "recapture_diff_uri")
      ) {
        return "escalated_to_validation";
      }
      if (hasArtifact(args.artifacts, "compatibility_matrix_uri")) {
        return "escalated_to_geometry";
      }
      return "handoff_ready";
    case "needs_more_evidence":
    case "needs_refresh":
      return "not_applicable";
    default:
      return "not_applicable";
  }
}

// ────────────────────────────────────────────────
// Proof path milestone stamping
// ────────────────────────────────────────────────

export interface MilestoneStampResult {
  proofPath: ProofPathMilestones;
  stampedThisSync: (keyof ProofPathMilestones)[];
}

export function stampProofPathMilestones(args: {
  currentProofPath: ProofPathMilestones;
  artifacts?: PipelineArtifacts;
  qualificationState?: QualificationState;
  derivedAssets?: DerivedAssetsAttachment;
}): MilestoneStampResult {
  const proofPath = { ...args.currentProofPath };
  const stampedThisSync: (keyof ProofPathMilestones)[] = [];
  const now = admin.firestore.FieldValue.serverTimestamp() as unknown as string;

  const stampIfApplicable = (
    key: keyof ProofPathMilestones,
    alreadyStamped: boolean,
    condition: boolean
  ) => {
    if (!alreadyStamped && condition) {
      (proofPath as Record<string, unknown>)[key] = now;
      stampedThisSync.push(key);
    }
  };

  // qualified_inband stamp: when a robot_team request becomes qualified
  const shouldStampQualifiedInbound =
    !proofPath.qualified_inbound_at &&
    (args.qualificationState === "qualified_ready" ||
      args.qualificationState === "qualified_risky");
  if (shouldStampQualifiedInbound) {
    proofPath.qualified_inbound_at = now as never;
    stampedThisSync.push("qualified_inbound_at");
  }

  stampIfApplicable(
    "proof_pack_delivered_at",
    !!proofPath.proof_pack_delivered_at,
    artifactsInGroup(args.artifacts, CORE_ARTIFACT_GROUPS.world_model_outputs) >= 2
  );

  stampIfApplicable(
    "proof_pack_reviewed_at",
    !!proofPath.proof_pack_reviewed_at,
    artifactsInGroup(args.artifacts, CORE_ARTIFACT_GROUPS.evaluation_artifacts) >= 2
  );

  stampIfApplicable(
    "hosted_review_ready_at",
    !!proofPath.hosted_review_ready_at,
    checkHostedReviewReadiness({
      artifacts: args.artifacts,
      derivedAssets: args.derivedAssets,
    }).ready
  );

  stampIfApplicable(
    "hosted_review_started_at",
    !!proofPath.hosted_review_started_at,
    (hasArtifact(args.artifacts, "worldlabs_launch_url") && 
     hasArtifact(args.artifacts, "runtime_demo_manifest_uri"))
  );

  stampIfApplicable(
    "artifact_handoff_delivered_at",
    !!proofPath.artifact_handoff_delivered_at,
    hasArtifact(args.artifacts, "opportunity_handoff_uri") ||
    hasArtifact(args.artifacts, "launchable_export_bundle_uri")
  );

  stampIfApplicable(
    "artifact_handoff_accepted_at",
    !!proofPath.artifact_handoff_accepted_at,
    args.qualificationState === "qualified_ready" &&
    hasArtifact(args.artifacts, "launchable_export_bundle_uri")
  );

  // hosted_review_follow_up_at: stamp when hosted review was started and
  // a follow-up trigger is present (evaluation artifacts indicate review
  // progressed far enough to warrant a follow-up nudge)
  stampIfApplicable(
    "hosted_review_follow_up_at",
    !!proofPath.hosted_review_follow_up_at,
    !!proofPath.hosted_review_started_at &&
    artifactsInGroup(args.artifacts, CORE_ARTIFACT_GROUPS.evaluation_artifacts) >= 1
  );

  // human_commercial_handoff_at: stamp when the pipeline determines the
  // request is ready for commercial handoff (opportunity handoff artifact
  // present, or qualified with launchable export)
  stampIfApplicable(
    "human_commercial_handoff_at",
    !!proofPath.human_commercial_handoff_at,
    hasArtifact(args.artifacts, "opportunity_handoff_uri") ||
    (args.qualificationState === "qualified_ready" &&
     hasArtifact(args.artifacts, "launchable_export_bundle_uri"))
  );

  return { proofPath, stampedThisSync };
}

// ────────────────────────────────────────────────
// Ops automation envelope update
// ────────────────────────────────────────────────

export interface OpsEnvelopeUpdate {
  opsAutomation: OpsAutomationEnvelope;
  capturePolicyTier?: string;
  rightsStatus?: string;
  captureStatus?: string;
  quoteStatus?: string;
  recaptureRequired?: boolean;
  nextStep?: string;
}

export function computeOpsEnvelopeFromPipeline(args: {
  artifacts?: PipelineArtifacts;
  deploymentReadiness?: DeploymentReadinessSummary;
  qualificationState?: QualificationState;
  currentOps?: Record<string, unknown>;
}): OpsEnvelopeUpdate {
  const result: OpsEnvelopeUpdate = {
    opsAutomation: {
      status: "pending",
      queue: "inbound_request_review",
      filter_tags: [],
      next_action: "await_pipeline_artifacts",
      requires_human_review: true,
    },
  };

  const { artifacts, deploymentReadiness } = args;
  const totalArtifacts = countPresentArtifacts(artifacts);
  const coreCount = artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.capture_and_qa) +
    artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.privacy_and_rights) +
    artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.world_model_outputs);

  // Tag the request based on what's available
  if (totalArtifacts > 0) {
    result.opsAutomation.filter_tags!.push("pipeline_synced");
  }
  if (artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.capture_and_qa) > 0) {
    result.opsAutomation.filter_tags!.push("qa_artifacts_present");
  }
  if (artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.privacy_and_rights) > 0) {
    result.opsAutomation.filter_tags!.push("privacy_compliance_processed");
  }
  if (artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.world_model_outputs) > 0) {
    result.opsAutomation.filter_tags!.push("world_model_artifacts_present");
  }
  if (hasArtifact(artifacts, "opportunity_handoff_uri")) {
    result.opsAutomation.filter_tags!.push("handoff_ready");
    result.opsAutomation.next_action = "human_commercial_handoff";
    result.opsAutomation.requires_human_review = true;
    result.opsAutomation.status = "ready";
  }
  if (hasArtifact(artifacts, "launch_gate_summary_uri")) {
    result.opsAutomation.filter_tags!.push("launch_gate_evaluated");
    result.opsAutomation.next_action = "review_launch_gate_decision";
    result.opsAutomation.requires_human_review = true;
  }
  if (hasArtifact(artifacts, "preview_manifest_uri") && hasArtifact(artifacts, "worldlabs_launch_url")) {
    result.opsAutomation.queue = "exact_site_hosted_review_queue";
    result.opsAutomation.queue_label = "Exact Site Hosted Review";
    result.opsAutomation.next_action = "buyer_hosted_review";
    result.opsAutomation.requires_human_review = false;
    result.opsAutomation.status = "hosted_ready";
  }

  // Capture policy inference from pipeline outputs
  if (hasArtifact(artifacts, "rights_and_compliance_summary_uri")) {
    result.rightsStatus = "verified";
  }
  
  if (hasArtifact(artifacts, "qualification_quality_report_uri") || 
      hasArtifact(artifacts, "capture_quality_summary_uri")) {
    result.captureStatus = "approved";
    result.capturePolicyTier = "approved_capture";
  } else if (totalArtifacts > 0) {
    result.captureStatus = "under_review";
    result.capturePolicyTier = "review_required";
  }

  // Recapture required?
  if (deploymentReadiness?.recapture_required) {
    result.recaptureRequired = true;
    result.captureStatus = "needs_recapture";
    result.nextStep = "Capture quality insufficient — review recapture_diff and request re-capture.";
    result.opsAutomation.next_action = "recapture";
  }

  // Confidence scoring based on artifact coverage
  if (coreCount >= 4 && totalArtifacts >= 6) {
    result.opsAutomation.confidence = 0.9;
  } else if (coreCount >= 2 && totalArtifacts >= 3) {
    result.opsAutomation.confidence = 0.6;
  } else if (totalArtifacts >= 1) {
    result.opsAutomation.confidence = 0.3;
  }

  // Determine recommended path
  if (hasArtifact(artifacts, "opportunity_handoff_uri")) {
    result.opsAutomation.recommended_path = "commercial_handoff";
  } else if (args.qualificationState === "qualified_ready" || args.qualificationState === "qualified_risky") {
    result.opsAutomation.recommended_path = "hosted_review";
  } else if (args.qualificationState === "capture_requested") {
    result.opsAutomation.recommended_path = "capture_pending";
  } else {
    result.opsAutomation.recommended_path = "qualification";
  }

  return result;
}

// ────────────────────────────────────────────────
// Deployment readiness summary enrichment
// ────────────────────────────────────────────────

export function enrichDeploymentReadinessFromArtifacts(
  current: DeploymentReadinessSummary | undefined,
  artifacts: PipelineArtifacts | undefined,
  derivedAssets: DerivedAssetsAttachment | undefined
): DeploymentReadinessSummary | undefined {
  if (!artifacts && !derivedAssets) return current;

  const enriched: DeploymentReadinessSummary = {
    ...(current || {}),
  };

  // Link specific artifact URIs into the readiness summary
  if (hasArtifact(artifacts, "qualification_quality_report_uri")) {
    enriched.qualification_summary = enriched.qualification_summary || {};
  }
  if (hasArtifact(artifacts, "capture_quality_summary_uri")) {
    enriched.capture_quality_summary = enriched.capture_quality_summary || {};
  }
  if (hasArtifact(artifacts, "rights_and_compliance_summary_uri")) {
    // This artifact indicates rights evaluation is available as evidence
  }
  if (hasArtifact(artifacts, "compatibility_matrix_uri")) {
    enriched.benchmark_coverage_status = enriched.benchmark_coverage_status || "partial";
  }
  if (hasArtifact(artifacts, "benchmark_suite_manifest_uri")) {
    enriched.benchmark_coverage_status = "ready";
  }
  if (hasArtifact(artifacts, "recapture_diff_uri")) {
    enriched.recapture_status = "changed";
  }
  if (hasArtifact(artifacts, "worldlabs_world_manifest_uri")) {
    enriched.native_world_model_status = "primary_ready";
    enriched.native_world_model_primary = true;
    enriched.runtime_health_status = "manifest_present";
  }
  if (hasArtifact(artifacts, "runtime_demo_manifest_uri")) {
    enriched.runtime_launchable = true;
    enriched.runtime_registration_status = "registered";
  }
  if (hasArtifact(artifacts, "provider_run_manifest_uri")) {
    enriched.provider_fallback_preview_status = "fallback_available";
    enriched.provider_fallback_only = !hasArtifact(artifacts, "worldlabs_world_manifest_uri");
  }
  if (hasArtifact(artifacts, "preview_manifest_uri")) {
    enriched.preview_status = "preview_unavailable";
  }

  // Derived asset status mapping
  if (derivedAssets) {
    const simStatus = getDerivedAssetStatus(derivedAssets, "preview_simulation");
    if (simStatus === "generated") {
      enriched.preview_status = "succeeded" as ProviderRunStatus;
    } else if (simStatus === "generating") {
      enriched.preview_status = "processing" as ProviderRunStatus;
    } else if (simStatus === "failed") {
      enriched.preview_status = "failed" as ProviderRunStatus;
    }

    const sceneMemStatus = getDerivedAssetStatus(derivedAssets, "scene_memory");
    if (sceneMemStatus === "generated") {
      enriched.exports_available = [...(enriched.exports_available || []), "scene_memory"];
    }

    const valStatus = getDerivedAssetStatus(derivedAssets, "validation_package");
    if (valStatus === "generated") {
      enriched.evaluation_prep_summary = enriched.evaluation_prep_summary || {};
    }
  }

  return enriched;
}

// ────────────────────────────────────────────────
// Main state transition function — the "bridge"
// ────────────────────────────────────────────────

export interface PipelineStateTransition {
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  opsUpdate: OpsEnvelopeUpdate;
  proofPathUpdate: MilestoneStampResult;
  deploymentReadiness: DeploymentReadinessSummary | undefined;
  requiresHumanReview: boolean;
  recommendedAction: string;
  artifactCount: { total: number; core: number };
  proofMotionStalled: boolean;
  stallReason: string | null;
}

/**
 * Compute the full state transition given a pipeline sync payload and the
 * current request state. This is the central function that the
 * `/api/internal/pipeline/attachments` endpoint (and future endpoints) use
 * to translate pipeline outputs into request state updates.
 */
export function computePipelineStateTransition(args: {
  artifacts?: PipelineArtifacts;
  derivedAssets?: DerivedAssetsAttachment;
  deploymentReadiness?: DeploymentReadinessSummary;
  authoritativeStateUpdate: boolean;
  explicitQualificationState?: string;
  explicitOpportunityState?: string;
  currentQualificationState?: QualificationState;
  currentOpportunityState?: OpportunityState;
  currentProofPath?: ProofPathMilestones;
  currentOps?: Record<string, unknown>;
  currentDerivedAssets?: DerivedAssetsAttachment;
  currentDeploymentReadiness?: DeploymentReadinessSummary;
}): PipelineStateTransition {
  const { artifacts, derivedAssets, deploymentReadiness, authoritativeStateUpdate } = args;

  // Step 1: Determine qualification state
  let qualificationState: QualificationState;
  if (authoritativeStateUpdate && args.explicitQualificationState) {
    qualificationState = isQualificationState(args.explicitQualificationState)
      ? args.explicitQualificationState
      : (args.currentQualificationState || "submitted");
  } else {
    qualificationState = inferQualificationStateFromArtifacts({
      artifacts,
      deploymentReadiness,
      derivedAssets,
      current: args.currentQualificationState,
    });
  }

  // Step 2: Determine opportunity state
  const opportunityState = authoritativeStateUpdate && args.explicitOpportunityState
    ? (isOpportunityState(args.explicitOpportunityState)
      ? args.explicitOpportunityState
      : inferOpportunityState({ qualificationState, artifacts, deploymentReadiness }))
    : inferOpportunityState({ qualificationState, artifacts, deploymentReadiness });

  // Step 3: Enrich deployment readiness
  const currentDR = deploymentReadiness || args.currentDeploymentReadiness;
  const enrichedDR = enrichDeploymentReadinessFromArtifacts(
    currentDR,
    artifacts,
    derivedAssets
  );

  // Step 4: Stamp proof path milestones
  const currentProofPath: ProofPathMilestones = args.currentProofPath || {
    exact_site_requested_at: null,
    qualified_inbound_at: null,
    proof_pack_delivered_at: null,
    proof_pack_reviewed_at: null,
    hosted_review_ready_at: null,
    hosted_review_started_at: null,
    hosted_review_follow_up_at: null,
    artifact_handoff_delivered_at: null,
    artifact_handoff_accepted_at: null,
    human_commercial_handoff_at: null,
  };

  const proofPathUpdate = stampProofPathMilestones({
    currentProofPath,
    artifacts,
    qualificationState,
    derivedAssets,
  });

  // Step 5: Compute ops envelope
  const opsUpdate = computeOpsEnvelopeFromPipeline({
    artifacts,
    deploymentReadiness: enrichedDR,
    qualificationState,
    currentOps: args.currentOps,
  });

  // Step 6: Determine actionability
  const totalArtifacts = countPresentArtifacts(artifacts);
  const coreGroupCount = artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.capture_and_qa) +
    artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.privacy_and_rights) +
    artifactsInGroup(artifacts, CORE_ARTIFACT_GROUPS.world_model_outputs);

  let recommendedAction = "await_pipeline_artifacts";
  if (totalArtifacts === 0) {
    recommendedAction = "await_initial_sync";
  } else if (hasArtifact(artifacts, "opportunity_handoff_uri")) {
    recommendedAction = "commercial_handoff";
  } else if (hasArtifact(artifacts, "launch_gate_summary_uri")) {
    recommendedAction = "evaluate_launch_gate";
  } else if (qualificationState === "needs_refresh" || opsUpdate.recaptureRequired) {
    recommendedAction = "recapture";
  } else if (qualificationState === "qualified_ready" || qualificationState === "qualified_risky") {
    recommendedAction = "buyer_review";
  } else if (coreGroupCount >= 3) {
    recommendedAction = "review_pipeline_artifacts";
  }

  // Stall detection: pipeline has progressed but qualification regressed or blocked
  let proofMotionStalled = false;
  let stallReason: string | null = null;
  const STALL_QUALIFICATION_STATES: readonly string[] = [
    "needs_more_evidence",
    "needs_refresh",
    "not_ready_yet",
  ];
  if (STALL_QUALIFICATION_STATES.includes(qualificationState)) {
    proofMotionStalled = true;
    stallReason = qualificationState;
  } else if (opsUpdate.recaptureRequired) {
    proofMotionStalled = true;
    stallReason = "recapture_required";
  } else if (
    deploymentReadiness?.recapture_required &&
    !opsUpdate.recaptureRequired
  ) {
    proofMotionStalled = true;
    stallReason = "recapture_required_from_readiness";
  }

  return {
    qualificationState,
    opportunityState,
    opsUpdate,
    proofPathUpdate,
    deploymentReadiness: enrichedDR,
    requiresHumanReview: opsUpdate.opsAutomation.requires_human_review ?? true,
    recommendedAction,
    artifactCount: {
      total: totalArtifacts,
      core: coreGroupCount,
    },
    proofMotionStalled,
    stallReason,
  };
}

// ────────────────────────────────────────────────
// Utility: check if pipeline data is sufficient for hosted review
// ────────────────────────────────────────────────

export interface HostedReviewReadiness {
  ready: boolean;
  blockers: string[];
  artifactCount: number;
}

export function checkHostedReviewReadiness(args: {
  artifacts?: PipelineArtifacts;
  derivedAssets?: DerivedAssetsAttachment;
}): HostedReviewReadiness {
  const blockers: string[] = [];

  if (!hasArtifact(args.artifacts, "preview_manifest_uri")) {
    blockers.push("preview_manifest_uri");
  }
  if (!hasArtifact(args.artifacts, "worldlabs_launch_url")) {
    blockers.push("worldlabs_launch_url (runtime access)");
  }
  if (!hasArtifact(args.artifacts, "worldlabs_world_manifest_uri")) {
    // WorldLabs 3D mesh not yet available — preview-only mode
    // blockers.push("worldlabs_world_manifest_uri (optional for preview)");
  }

  const simStatus = getDerivedAssetStatus(args.derivedAssets, "preview_simulation");
  if (simStatus !== "generated" && !hasArtifact(args.artifacts, "worldlabs_launch_url")) {
    blockers.push("preview_simulation asset or worldlabs access");
  }

  return {
    ready: blockers.length === 0,
    blockers,
    artifactCount: countPresentArtifacts(args.artifacts),
  };
}

// ────────────────────────────────────────────────
// Type guards
// ────────────────────────────────────────────────

const QUALIFICATION_STATES: readonly string[] = [
  "submitted", "capture_requested", "qa_passed", "needs_more_evidence",
  "in_review", "qualified_ready", "qualified_risky", "needs_refresh",
  "not_ready_yet",
];

const OPPORTUNITY_STATES: readonly string[] = [
  "not_applicable", "handoff_ready", "escalated_to_geometry",
  "escalated_to_validation",
];

function isQualificationState(value: string): value is QualificationState {
  return QUALIFICATION_STATES.includes(value);
}

function isOpportunityState(value: string): value is OpportunityState {
  return OPPORTUNITY_STATES.includes(value);
}
