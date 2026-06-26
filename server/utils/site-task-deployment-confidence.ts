export const SITE_TASK_DEPLOYMENT_CONFIDENCE_SCHEMA_VERSION =
  "site_task_robot_deployment_confidence_package.v1";

export type SiteTaskConfidenceState =
  | "blocked"
  | "capture_review_ready"
  | "visual_world_model_review_ready"
  | "deployment_confidence_advisory"
  | "operational_deployment_ready";

export type ConfidenceEvidenceStatus = "present" | "missing" | "blocked" | "advisory";

export type SiteTaskClaimIntent =
  | "visual_review"
  | "capture_quality_eval"
  | "synthetic_data"
  | "robot_action_policy"
  | "contact_collision_eval"
  | "public_deployment_ready";

type EvidencePointer = boolean | string | null | undefined;

export interface SiteTaskIdentityInput {
  siteWorldId?: string | null;
  sceneId?: string | null;
  captureId?: string | null;
  siteSubmissionId?: string | null;
  buyerRequestId?: string | null;
  captureJobId?: string | null;
}

export interface CaptureProvenanceInput {
  rawManifestUri?: string | null;
  provenanceUri?: string | null;
  rightsConsentUri?: string | null;
  captureUploadCompleteUri?: string | null;
  hashesUri?: string | null;
  walkthroughVideoUri?: string | null;
  poseEvidence?: EvidencePointer;
  intrinsicsEvidence?: EvidencePointer;
  depthEvidence?: EvidencePointer;
  motionEvidence?: EvidencePointer;
  privacyStatus?: "privacy_safe" | "raw_only" | "unknown";
  rightsStatus?: "derived_generation_allowed" | "review_required" | "blocked" | "unknown";
  upstreamHandoffBlockers?: string[];
}

export interface PipelinePackageInput {
  packageManifestUri?: string | null;
  hostedSessionArtifactUri?: string | null;
  geometrySource?: "video_to_world" | "local_sfm" | "fallback_geometry" | "none" | "unknown" | null;
  fallbackGeometryUsed?: boolean;
  providerNativeGeometryReady?: boolean;
  siteReferenceManifestUri?: string | null;
  privacySafeMediaUri?: string | null;
}

export interface WorldModelEvalInput {
  claimPolicy?: string | null;
  providerJobsCalled?: boolean;
  modelDownloadRequired?: boolean;
  cosmos3ReadinessUri?: string | null;
  heldOutValidationUri?: string | null;
  actionEvidenceUri?: string | null;
  generatedOutputsLabeledDerived?: boolean;
  blockedClaims?: string[];
  robotEvalDataset?: RobotEvalDatasetEvidenceInput;
}

export interface RobotEvalDatasetEvidenceInput {
  manifestUri?: string | null;
  legacyManifestUri?: string | null;
  siteCardUri?: string | null;
  taskCardsUri?: string | null;
  scenarioCardsUri?: string | null;
  evalCardsUri?: string | null;
  annotationBacklogUri?: string | null;
  proofBoundariesUri?: string | null;
  datasetState?: string | null;
  datasetStatuses?: string[];
  simulatorExecutionProven?: boolean;
  physicsContactValidationProven?: boolean;
  robotPolicyExecutionProven?: boolean;
  safetyValidationProven?: boolean;
  realPilotOutcomeProven?: boolean;
}

export interface RobotTaskInput {
  taskId?: string | null;
  taskStatement?: string | null;
  robotProfileId?: string | null;
  scenarioId?: string | null;
  startStateId?: string | null;
}

export interface DeploymentEvidenceInput {
  simTraceUri?: string | null;
  actionLogUri?: string | null;
  robotTrialUri?: string | null;
  safetyReviewUri?: string | null;
  operatorApprovalUri?: string | null;
  rightsClearanceUri?: string | null;
  hostedRuntimeProofUri?: string | null;
}

export interface SiteTaskDeploymentConfidenceInput {
  identity: SiteTaskIdentityInput;
  captureProvenance: CaptureProvenanceInput;
  pipelinePackage?: PipelinePackageInput;
  worldModelEval?: WorldModelEvalInput;
  robotTask?: RobotTaskInput;
  deploymentEvidence?: DeploymentEvidenceInput;
  claimIntent?: SiteTaskClaimIntent[];
}

export interface EvidenceFamilySummary {
  status: ConfidenceEvidenceStatus;
  present: string[];
  missing: string[];
  blockers: string[];
  warnings: string[];
}

export interface SiteTaskDeploymentConfidencePackage {
  schema_version: typeof SITE_TASK_DEPLOYMENT_CONFIDENCE_SCHEMA_VERSION;
  generated_at: string;
  state: SiteTaskConfidenceState;
  identity: Required<SiteTaskIdentityInput>;
  confidence_scope: string[];
  evidence: {
    capture_provenance: EvidenceFamilySummary;
    pipeline_package: EvidenceFamilySummary;
    world_model_eval: EvidenceFamilySummary;
    robot_task: EvidenceFamilySummary;
    deployment_evidence: EvidenceFamilySummary;
  };
  blockers: string[];
  warnings: string[];
  allowed_claims: string[];
  forbidden_claims: string[];
  next_evidence_moves: string[];
  no_live_side_effects: {
    provider_jobs_called: false;
    model_download_required: false;
    deployments_started: false;
    sends_attempted: false;
    payments_attempted: false;
  };
}

export interface SiteTaskDeploymentConfidenceOptions {
  generatedAt?: string | Date;
}

const LIVE_SIDE_EFFECTS: SiteTaskDeploymentConfidencePackage["no_live_side_effects"] = {
  provider_jobs_called: false,
  model_download_required: false,
  deployments_started: false,
  sends_attempted: false,
  payments_attempted: false,
};

const BASE_FORBIDDEN_CLAIMS = [
  "live Cosmos or provider execution by the WebApp evaluator",
  "model download or model execution by the WebApp evaluator",
  "generated world-model output as ground truth",
  "policy ranking without linked action, rights, runtime proof, and ranking metrics",
  "contact, collision, or off-scope validation from visual plausibility alone",
  "real-site robot eval cards as simulator execution, robot trial, or off-scope validation proof",
  "rights, privacy, payment, payout, hosted-session, city coverage, or provider completion without owner-system records",
];

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEvidencePointer(value: EvidencePointer): boolean {
  return value === true || hasText(typeof value === "string" ? value : null);
}

function addUnique(target: string[], value: string | null | undefined) {
  if (!value) {
    return;
  }
  const normalized = value.trim();
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function addManyUnique(target: string[], values: Array<string | null | undefined>) {
  values.forEach((value) => addUnique(target, value));
}

function createFamily(): EvidenceFamilySummary {
  return {
    status: "missing",
    present: [],
    missing: [],
    blockers: [],
    warnings: [],
  };
}

function finalizeFamilyStatus(family: EvidenceFamilySummary) {
  if (family.blockers.length > 0) {
    family.status = "blocked";
  } else if (family.missing.length > 0) {
    family.status = family.present.length > 0 ? "advisory" : "missing";
  } else {
    family.status = "present";
  }
}

function recordUri(
  family: EvidenceFamilySummary,
  label: string,
  value: string | null | undefined,
  options: { blocker?: string } = {},
) {
  if (hasText(value)) {
    addUnique(family.present, label);
  } else {
    addUnique(family.missing, label);
    if (options.blocker) {
      addUnique(family.blockers, options.blocker);
    }
  }
}

function recordPointer(
  family: EvidenceFamilySummary,
  label: string,
  value: EvidencePointer,
  options: { blocker?: string; warning?: string } = {},
) {
  if (hasEvidencePointer(value)) {
    addUnique(family.present, label);
  } else {
    addUnique(family.missing, label);
    if (options.blocker) {
      addUnique(family.blockers, options.blocker);
    }
    if (options.warning) {
      addUnique(family.warnings, options.warning);
    }
  }
}

function normalizeGeneratedAt(value: string | Date | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (hasText(value)) {
    return value;
  }
  return new Date().toISOString();
}

function buildIdentity(identity: SiteTaskIdentityInput): Required<SiteTaskIdentityInput> {
  return {
    siteWorldId: identity.siteWorldId || "",
    sceneId: identity.sceneId || "",
    captureId: identity.captureId || "",
    siteSubmissionId: identity.siteSubmissionId || "",
    buyerRequestId: identity.buyerRequestId || "",
    captureJobId: identity.captureJobId || "",
  };
}

function evaluateCaptureProvenance(input: SiteTaskDeploymentConfidenceInput) {
  const family = createFamily();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const capture = input.captureProvenance;
  const identity = input.identity;

  const requiredIdentityEvidence: Array<[string, string | null | undefined]> = [
    ["scene_id", identity.sceneId],
    ["capture_id", identity.captureId],
  ];
  requiredIdentityEvidence.forEach(([label, value]) =>
    recordUri(family, label, value, {
      blocker: `${label} is required before this packet can name a site/task confidence scope.`,
    }),
  );

  recordUri(family, "raw_bundle_manifest", capture.rawManifestUri, {
    blocker: "Capture raw bundle manifest is required for site/task confidence.",
  });
  recordUri(family, "provenance_record", capture.provenanceUri, {
    blocker: "Capture provenance record is required for site/task confidence.",
  });
  recordUri(family, "rights_consent_record", capture.rightsConsentUri, {
    blocker: "Rights and consent record is required before buyer or rank-fidelity claims.",
  });
  recordUri(family, "capture_upload_complete", capture.captureUploadCompleteUri, {
    blocker: "Capture upload completion proof is required before downstream readiness.",
  });
  recordUri(family, "hashes_record", capture.hashesUri, {
    blocker: "Capture hashes are required before reusable confidence packaging.",
  });
  recordUri(family, "walkthrough_video", capture.walkthroughVideoUri, {
    blocker: "Walkthrough evidence is required before exact-site review claims.",
  });

  recordPointer(family, "pose_evidence", capture.poseEvidence, {
    warning: "Pose evidence is missing; world-model and robot-task confidence must remain narrow.",
  });
  recordPointer(family, "intrinsics_evidence", capture.intrinsicsEvidence, {
    warning: "Camera intrinsics are missing; geometry confidence must remain narrow.",
  });
  recordPointer(family, "depth_evidence", capture.depthEvidence, {
    warning: "Depth evidence is missing; contact, collision, and geometry claims must remain blocked.",
  });
  recordPointer(family, "motion_evidence", capture.motionEvidence, {
    warning: "Motion evidence is missing; task/action readiness must remain blocked.",
  });

  if (capture.privacyStatus === "privacy_safe") {
    addUnique(family.present, "privacy_status:privacy_safe");
  } else if (capture.privacyStatus === "raw_only") {
    addUnique(family.warnings, "Only raw media privacy status is present; buyer-facing package claims need privacy-safe media.");
  } else {
    addUnique(family.blockers, "Privacy status is unknown for the requested confidence package.");
  }

  if (capture.rightsStatus === "derived_generation_allowed") {
    addUnique(family.present, "rights_status:derived_generation_allowed");
  } else if (capture.rightsStatus === "review_required") {
    addUnique(family.warnings, "Rights require human review before public or operational deployment claims.");
  } else if (capture.rightsStatus === "blocked") {
    addUnique(family.blockers, "Rights are blocked for the requested use.");
  } else {
    addUnique(family.blockers, "Rights status is unknown for the requested use.");
  }

  (capture.upstreamHandoffBlockers || []).forEach((blocker) =>
    addUnique(family.blockers, `Capture upstream handoff blocker: ${blocker}`),
  );

  addManyUnique(blockers, family.blockers);
  addManyUnique(warnings, family.warnings);
  finalizeFamilyStatus(family);

  return { family, blockers, warnings };
}

function evaluatePipelinePackage(input: SiteTaskDeploymentConfidenceInput) {
  const family = createFamily();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const pipeline = input.pipelinePackage || {};
  const geometrySource = pipeline.geometrySource || "unknown";
  const fallbackGeometryUsed = pipeline.fallbackGeometryUsed === true || geometrySource === "fallback_geometry";

  recordUri(family, "package_manifest", pipeline.packageManifestUri);
  recordUri(family, "privacy_safe_media", pipeline.privacySafeMediaUri);
  recordUri(family, "site_reference_manifest", pipeline.siteReferenceManifestUri);

  if (hasText(pipeline.hostedSessionArtifactUri)) {
    addUnique(family.present, "hosted_session_artifact");
  } else {
    addUnique(family.missing, "hosted_session_artifact");
    addUnique(family.warnings, "Hosted-session artifact is not linked; hosted operational claims remain blocked.");
  }

  if (geometrySource === "video_to_world" || geometrySource === "local_sfm") {
    addUnique(family.present, `geometry_source:${geometrySource}`);
  } else {
    addUnique(family.missing, "non_fallback_geometry");
  }

  if (fallbackGeometryUsed) {
    addUnique(family.blockers, "Fallback geometry cannot support visual world-model or robot action confidence claims.");
  } else if (geometrySource === "none" || geometrySource === "unknown") {
    addUnique(family.warnings, "Non-fallback geometry is not linked; visual world-model readiness remains unavailable.");
  }

  if (pipeline.providerNativeGeometryReady === true) {
    addUnique(family.present, "provider_native_geometry_ready");
  } else {
    addUnique(family.warnings, "Provider-native geometry readiness is not proven by this local packet.");
  }

  addManyUnique(blockers, family.blockers);
  addManyUnique(warnings, family.warnings);
  finalizeFamilyStatus(family);

  return { family, blockers, warnings };
}

function evaluateWorldModel(input: SiteTaskDeploymentConfidenceInput) {
  const family = createFamily();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const worldModel = input.worldModelEval || {};
  const robotEval = worldModel.robotEvalDataset || {};

  recordUri(family, "cosmos3_or_world_model_readiness", worldModel.cosmos3ReadinessUri);
  recordUri(family, "held_out_validation", worldModel.heldOutValidationUri);
  recordUri(family, "action_evidence", worldModel.actionEvidenceUri);

  if (hasText(robotEval.manifestUri)) {
    addUnique(family.present, "robot_eval_dataset_manifest");
  }
  if (hasText(robotEval.siteCardUri)) {
    addUnique(family.present, "robot_eval_site_card");
  }
  if (hasText(robotEval.taskCardsUri)) {
    addUnique(family.present, "robot_eval_task_cards");
  }
  if (hasText(robotEval.scenarioCardsUri)) {
    addUnique(family.present, "robot_eval_scenario_cards");
  }
  if (hasText(robotEval.evalCardsUri)) {
    addUnique(family.present, "robot_eval_eval_cards");
  }
  if (hasText(robotEval.annotationBacklogUri)) {
    addUnique(family.present, "robot_eval_annotation_backlog");
  }
  if (hasText(robotEval.proofBoundariesUri)) {
    addUnique(family.present, "robot_eval_proof_boundaries");
  }
  if (
    hasText(robotEval.siteCardUri) &&
    hasText(robotEval.taskCardsUri) &&
    hasText(robotEval.scenarioCardsUri) &&
    hasText(robotEval.evalCardsUri)
  ) {
    addUnique(family.present, "robot_eval_card_family_complete");
  }
  (robotEval.datasetStatuses || []).forEach((status) =>
    addUnique(family.warnings, `Robot eval dataset status: ${status}`),
  );

  if (hasText(worldModel.claimPolicy)) {
    addUnique(family.present, `claim_policy:${worldModel.claimPolicy}`);
  } else {
    addUnique(family.missing, "claim_policy");
    addUnique(family.warnings, "World-model claim policy is not linked; generated-output claims must stay conservative.");
  }

  if (worldModel.providerJobsCalled === true) {
    addUnique(family.blockers, "Repo-local confidence packets must not rely on WebApp provider jobs.");
  } else {
    addUnique(family.present, "provider_jobs_called:false");
  }

  if (worldModel.modelDownloadRequired === true) {
    addUnique(family.blockers, "Repo-local confidence packets must not require model downloads.");
  } else {
    addUnique(family.present, "model_download_required:false");
  }

  if (worldModel.generatedOutputsLabeledDerived === true) {
    addUnique(family.present, "generated_outputs_labeled_derived");
  } else {
    addUnique(family.blockers, "Generated or world-model outputs must be labeled as derived, non-ground-truth artifacts.");
  }

  if (robotEval.simulatorExecutionProven === true) {
    addUnique(
      family.blockers,
      "WebApp advisory evaluator cannot upgrade robot-eval cards into simulator execution proof.",
    );
  }
  if (robotEval.physicsContactValidationProven === true) {
    addUnique(
      family.blockers,
      "WebApp advisory evaluator cannot upgrade robot-eval cards into physics/contact validation proof.",
    );
  }
  if (robotEval.robotPolicyExecutionProven === true) {
    addUnique(
      family.blockers,
      "WebApp advisory evaluator cannot upgrade robot-eval cards into robot policy execution proof.",
    );
  }
  if (robotEval.safetyValidationProven === true) {
    addUnique(
      family.blockers,
      "WebApp advisory evaluator cannot upgrade robot-eval cards into off-scope validation proof.",
    );
  }
  if (robotEval.realPilotOutcomeProven === true && !hasText(input.deploymentEvidence?.robotTrialUri)) {
    addUnique(
      family.blockers,
      "Real pilot outcome proof requires the owning robot-trial artifact, not only a dataset flag.",
    );
  }

  (worldModel.blockedClaims || []).forEach((claim) => addUnique(family.blockers, `World-model blocked claim: ${claim}`));

  addManyUnique(blockers, family.blockers);
  addManyUnique(warnings, family.warnings);
  finalizeFamilyStatus(family);

  return { family, blockers, warnings };
}

function evaluateRobotTask(input: SiteTaskDeploymentConfidenceInput) {
  const family = createFamily();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const task = input.robotTask || {};

  recordUri(family, "task_id", task.taskId);
  recordUri(family, "task_statement", task.taskStatement);
  recordUri(family, "robot_profile_id", task.robotProfileId);
  recordUri(family, "scenario_id", task.scenarioId);
  recordUri(family, "start_state_id", task.startStateId);

  if (family.missing.length > 0) {
    addUnique(
      family.warnings,
      "Robot task scope is incomplete; deployment confidence must stay at capture or visual review scope.",
    );
  }

  addManyUnique(blockers, family.blockers);
  addManyUnique(warnings, family.warnings);
  finalizeFamilyStatus(family);

  return { family, blockers, warnings };
}

function evaluateDeploymentEvidence(input: SiteTaskDeploymentConfidenceInput) {
  const family = createFamily();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const deployment = input.deploymentEvidence || {};

  recordUri(family, "sim_trace", deployment.simTraceUri);
  recordUri(family, "action_log", deployment.actionLogUri);
  recordUri(family, "robot_trial", deployment.robotTrialUri);
  recordUri(family, "safety_review", deployment.safetyReviewUri);
  recordUri(family, "operator_approval", deployment.operatorApprovalUri);
  recordUri(family, "rights_clearance", deployment.rightsClearanceUri);
  recordUri(family, "hosted_runtime_proof", deployment.hostedRuntimeProofUri);

  if (!hasText(deployment.simTraceUri) && !hasText(deployment.actionLogUri) && !hasText(deployment.robotTrialUri)) {
    addUnique(
      family.warnings,
      "No simulator trace, action log, or robot trial is linked; robot deployment confidence remains unavailable.",
    );
  }
  if (!hasText(deployment.safetyReviewUri)) {
    addUnique(family.warnings, "Safety review is not linked; contact, collision, and safety claims remain blocked.");
  }
  if (!hasText(deployment.rightsClearanceUri)) {
    addUnique(family.warnings, "Rights clearance is not linked; public or commercial deployment claims remain blocked.");
  }
  if (!hasText(deployment.hostedRuntimeProofUri)) {
    addUnique(family.warnings, "Hosted runtime proof is not linked; hosted operational claims remain blocked.");
  }

  addManyUnique(blockers, family.blockers);
  addManyUnique(warnings, family.warnings);
  finalizeFamilyStatus(family);

  return { family, blockers, warnings };
}

function hasAll(family: EvidenceFamilySummary, labels: string[]) {
  return labels.every((label) => family.present.includes(label));
}

function hasAnyText(values: Array<string | null | undefined>) {
  return values.some((value) => hasText(value));
}

function evaluateState(params: {
  capture: EvidenceFamilySummary;
  pipeline: EvidenceFamilySummary;
  worldModel: EvidenceFamilySummary;
  robotTask: EvidenceFamilySummary;
  deployment: EvidenceFamilySummary;
  input: SiteTaskDeploymentConfidenceInput;
}) {
  const criticalCaptureBlocked = params.capture.status === "blocked";
  const worldModelBlocked = params.worldModel.blockers.length > 0;
  const pipelineFallbackBlocked = params.pipeline.blockers.some((blocker) => blocker.includes("Fallback geometry"));
  const localExecutionBlocked = params.worldModel.blockers.some(
    (blocker) => blocker.includes("provider jobs") || blocker.includes("model downloads"),
  );

  if (criticalCaptureBlocked || worldModelBlocked || localExecutionBlocked) {
    return "blocked" satisfies SiteTaskConfidenceState;
  }

  const captureReviewReady = hasAll(params.capture, [
    "scene_id",
    "capture_id",
    "raw_bundle_manifest",
    "provenance_record",
    "rights_consent_record",
    "capture_upload_complete",
    "hashes_record",
    "walkthrough_video",
  ]);

  if (!captureReviewReady) {
    return "blocked" satisfies SiteTaskConfidenceState;
  }

  const pipelineReady =
    hasAll(params.pipeline, ["package_manifest", "privacy_safe_media", "site_reference_manifest"]) &&
    (params.pipeline.present.includes("geometry_source:video_to_world") ||
      params.pipeline.present.includes("geometry_source:local_sfm")) &&
    !pipelineFallbackBlocked;

  const visualReady =
    pipelineReady &&
    !worldModelBlocked &&
    hasAll(params.worldModel, [
      "generated_outputs_labeled_derived",
      "provider_jobs_called:false",
      "model_download_required:false",
    ]) &&
    (hasAll(params.worldModel, [
        "cosmos3_or_world_model_readiness",
        "held_out_validation",
      ]) ||
      hasAll(params.worldModel, [
        "robot_eval_dataset_manifest",
        "robot_eval_card_family_complete",
        "robot_eval_proof_boundaries",
      ]));

  if (!visualReady) {
    return "capture_review_ready" satisfies SiteTaskConfidenceState;
  }

  const taskReady = params.robotTask.status === "present";
  const actionReady = hasText(params.input.worldModelEval?.actionEvidenceUri);
  const advisoryRuntimeEvidence = hasAnyText([
    params.input.deploymentEvidence?.simTraceUri,
    params.input.deploymentEvidence?.actionLogUri,
    params.input.deploymentEvidence?.robotTrialUri,
  ]);
  const advisoryReady = taskReady && actionReady && advisoryRuntimeEvidence;

  if (!advisoryReady) {
    return "visual_world_model_review_ready" satisfies SiteTaskConfidenceState;
  }

  const operationalReady =
    hasText(params.input.deploymentEvidence?.actionLogUri) &&
    hasText(params.input.deploymentEvidence?.robotTrialUri) &&
    hasText(params.input.deploymentEvidence?.safetyReviewUri) &&
    hasText(params.input.deploymentEvidence?.operatorApprovalUri) &&
    hasText(params.input.deploymentEvidence?.rightsClearanceUri) &&
    hasText(params.input.deploymentEvidence?.hostedRuntimeProofUri);

  return operationalReady
    ? ("operational_deployment_ready" satisfies SiteTaskConfidenceState)
    : ("deployment_confidence_advisory" satisfies SiteTaskConfidenceState);
}

function buildClaims(state: SiteTaskConfidenceState, input: SiteTaskDeploymentConfidenceInput) {
  const allowed: string[] = [];
  const forbidden = [...BASE_FORBIDDEN_CLAIMS];
  const warnings: string[] = [];
  const claimIntent = new Set(input.claimIntent || []);

  if (state !== "blocked") {
    addUnique(allowed, "capture provenance packet is review-ready for the named site/task scope");
    addUnique(allowed, "readiness is assembled from supplied Capture, Pipeline, and deployment-evidence records");
  }

  if (
    state === "visual_world_model_review_ready" ||
    state === "deployment_confidence_advisory" ||
    state === "operational_deployment_ready"
  ) {
    addUnique(allowed, "capture-grounded visual world-model review package is ready for human inspection");
    addUnique(allowed, "generated outputs may be used as derived review artifacts when labeled non-ground-truth");
  } else {
    addUnique(forbidden, "visual world-model review readiness");
  }

  if (hasText(input.worldModelEval?.robotEvalDataset?.manifestUri)) {
    addUnique(allowed, "real-site robot evaluation card workflow is assembled for advisory review");
    addUnique(forbidden, "Site, Task, Scenario, or Eval Cards as operational robot proof");
  }

  if (state === "deployment_confidence_advisory" || state === "operational_deployment_ready") {
    addUnique(allowed, "site/task deployment confidence advisory is available for human review");
  } else {
    addUnique(forbidden, "robot action-policy readiness");
  }

  if (state === "operational_deployment_ready") {
    addUnique(allowed, "site/task operational generated-world rank fidelity with linked owner proof");
  } else {
    addUnique(forbidden, "public robot rank-fidelity-scored claim");
    addUnique(forbidden, "contact, collision, safety, or manipulation readiness claim");
  }

  if (input.pipelinePackage?.fallbackGeometryUsed || input.pipelinePackage?.geometrySource === "fallback_geometry") {
    addUnique(forbidden, "visual world-model or robot policy confidence from fallback geometry");
  }

  if (input.captureProvenance.rightsStatus !== "derived_generation_allowed") {
    addUnique(forbidden, "rights-cleared public or commercial deployment claim");
  }

  if (claimIntent.has("public_deployment_ready") && state !== "operational_deployment_ready") {
    addUnique(warnings, "Requested public rank-fidelity-scored intent is not supported by this packet.");
  }
  if (claimIntent.has("contact_collision_eval") && state !== "operational_deployment_ready") {
    addUnique(warnings, "Requested contact/collision intent needs owner runtime proof.");
  }
  if (claimIntent.has("robot_action_policy") && state === "visual_world_model_review_ready") {
    addUnique(warnings, "Requested robot action-policy intent needs action evidence and simulator or robot-trial proof.");
  }

  return { allowed, forbidden, warnings };
}

function buildConfidenceScope(state: SiteTaskConfidenceState) {
  switch (state) {
    case "operational_deployment_ready":
      return ["capture_provenance", "visual_world_model_review", "deployment_confidence_advisory", "operational_proof"];
    case "deployment_confidence_advisory":
      return ["capture_provenance", "visual_world_model_review", "deployment_confidence_advisory"];
    case "visual_world_model_review_ready":
      return ["capture_provenance", "visual_world_model_review"];
    case "capture_review_ready":
      return ["capture_provenance"];
    case "blocked":
    default:
      return [];
  }
}

function buildNextMoves(input: SiteTaskDeploymentConfidenceInput, evidence: SiteTaskDeploymentConfidencePackage["evidence"]) {
  const moves: string[] = [];

  if (evidence.capture_provenance.blockers.length > 0) {
    addUnique(moves, "Attach the missing Capture raw bundle, provenance, rights, upload-complete, hash, and walkthrough records.");
  }
  if (evidence.pipeline_package.missing.includes("package_manifest")) {
    addUnique(moves, "Attach the Pipeline package manifest for the exact scene/capture/task scope.");
  }
  if (
    evidence.pipeline_package.missing.includes("non_fallback_geometry") ||
    input.pipelinePackage?.geometrySource === "fallback_geometry"
  ) {
    addUnique(moves, "Replace fallback or missing geometry with labeled video_to_world or local_sfm geometry evidence.");
  }
  if (evidence.pipeline_package.missing.includes("privacy_safe_media")) {
    addUnique(moves, "Attach privacy-safe media before buyer-facing visual review claims.");
  }
  if (evidence.world_model_eval.missing.includes("held_out_validation")) {
    addUnique(moves, "Link held-out validation before world-model evaluation claims.");
  }
  if (evidence.world_model_eval.missing.includes("action_evidence")) {
    addUnique(moves, "Link task-specific action evidence before robot action-policy claims.");
  }
  const robotEval = input.worldModelEval?.robotEvalDataset;
  if (robotEval && !robotEval.manifestUri) {
    addUnique(moves, "Attach the robot-eval dataset manifest before displaying card-family readiness.");
  }
  if (
    robotEval &&
    (!robotEval.siteCardUri || !robotEval.taskCardsUri || !robotEval.scenarioCardsUri || !robotEval.evalCardsUri)
  ) {
    addUnique(moves, "Attach Site, Task, Scenario, and Eval Card artifacts before card-family advisory review.");
  }
  if (robotEval && !robotEval.proofBoundariesUri) {
    addUnique(moves, "Attach robot-eval proof boundaries before public card-family display.");
  }
  if (!input.deploymentEvidence?.simTraceUri && !input.deploymentEvidence?.actionLogUri && !input.deploymentEvidence?.robotTrialUri) {
    addUnique(moves, "Attach simulator traces, action logs, or robot-trial records before deployment confidence claims.");
  }
  if (!input.deploymentEvidence?.safetyReviewUri) {
    addUnique(moves, "Attach safety review before contact, collision, or operational deployment claims.");
  }
  if (!input.deploymentEvidence?.hostedRuntimeProofUri) {
    addUnique(moves, "Attach hosted runtime proof before hosted operational deployment claims.");
  }

  return moves;
}

export function buildSiteTaskDeploymentConfidencePackage(
  input: SiteTaskDeploymentConfidenceInput,
  options: SiteTaskDeploymentConfidenceOptions = {},
): SiteTaskDeploymentConfidencePackage {
  const capture = evaluateCaptureProvenance(input);
  const pipeline = evaluatePipelinePackage(input);
  const worldModel = evaluateWorldModel(input);
  const robotTask = evaluateRobotTask(input);
  const deployment = evaluateDeploymentEvidence(input);
  const state = evaluateState({
    capture: capture.family,
    pipeline: pipeline.family,
    worldModel: worldModel.family,
    robotTask: robotTask.family,
    deployment: deployment.family,
    input,
  });
  const claims = buildClaims(state, input);
  const evidence = {
    capture_provenance: capture.family,
    pipeline_package: pipeline.family,
    world_model_eval: worldModel.family,
    robot_task: robotTask.family,
    deployment_evidence: deployment.family,
  };
  const blockers = [
    ...capture.blockers,
    ...pipeline.blockers,
    ...worldModel.blockers,
    ...robotTask.blockers,
    ...deployment.blockers,
  ];
  const warnings = [
    ...capture.warnings,
    ...pipeline.warnings,
    ...worldModel.warnings,
    ...robotTask.warnings,
    ...deployment.warnings,
    ...claims.warnings,
  ];

  return {
    schema_version: SITE_TASK_DEPLOYMENT_CONFIDENCE_SCHEMA_VERSION,
    generated_at: normalizeGeneratedAt(options.generatedAt),
    state,
    identity: buildIdentity(input.identity),
    confidence_scope: buildConfidenceScope(state),
    evidence,
    blockers,
    warnings,
    allowed_claims: claims.allowed,
    forbidden_claims: claims.forbidden,
    next_evidence_moves: buildNextMoves(input, evidence),
    no_live_side_effects: LIVE_SIDE_EFFECTS,
  };
}
