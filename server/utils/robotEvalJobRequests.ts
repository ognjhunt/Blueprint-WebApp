import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const JOB_REQUEST_SCHEMA_VERSION = "robot_eval_job_request.v1";
const JOB_REQUEST_QUEUE_CONTRACT = "robot_eval_job_request_inbox.v1";
const DEFAULT_FORWARD_TIMEOUT_MS = 10000;

const CLAIM_BOUNDARY = {
  simulator_execution_proven: false,
  robot_readiness_proven: false,
  robot_policy_execution_proven: false,
  physics_contact_validated: false,
  safety_validated: false,
  public_claim_upgrade_allowed: false,
};

const POLICY_MODALITIES = [
  "policy_api_endpoint",
  "docker_container",
  "recorded_action_trace",
  "high_level_skill_trace",
  "teleop_demo",
  "sim_controller_plugin",
] as const;

type PolicyModality = (typeof POLICY_MODALITIES)[number];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fingerprint(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 10);
}

function orderedPolicyPackage(policySubmission: Record<string, unknown>) {
  return POLICY_MODALITIES.reduce<Record<PolicyModality, unknown>>((acc, modality) => {
    acc[modality] = policySubmission[modality] || {};
    return acc;
  }, {} as Record<PolicyModality, unknown>);
}

function hasObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeFileStem(value: string) {
  return slugify(value).slice(0, 160) || "robot-eval-job-request";
}

export function buildRobotEvalJobRequest(input: {
  buyerRequestId?: string | null;
  sitePackage: {
    siteSlug: string;
    siteId: string;
    siteName: string;
    siteSubmissionId?: string | null;
    captureJobId?: string | null;
    captureId?: string | null;
    captureRoot: string;
    pipelinePrefix?: string | null;
    accessState: string;
    artifactUris: {
      manifestUri?: string;
      taskCardsUri?: string;
      scenarioCardsUri?: string;
      evalCardsUri?: string;
      proofBoundariesUri?: string;
      taskThresholdsUri?: string;
      publicationReadinessUri?: string;
      sceneAssetInventoryUri?: string;
      sceneAssetDependencyAuditUri?: string;
      sceneAssetPreflightUri?: string;
      sceneAssetInspectionUri?: string;
      sceneFrameEstimateUri?: string;
      colliderProxyPlanUri?: string;
      cpuSceneProxyManifestUri?: string;
      cpuPreflightScorecardUri?: string;
      taskAnchorProposalManifestUri?: string;
      episodeSpecManifestUri?: string;
      episodeSpecsUri?: string;
      spawnPoseValidationManifestUri?: string;
      cpuPreflightManifestUri?: string;
      preGpuReadinessSummaryUri?: string;
      cpuSimulatorPreflightManifestUri?: string;
      gpuHandoffPacketUri?: string;
      gpuOwnerSystemProofSchemaUri?: string;
      gpuRunChecklistUri?: string;
      ownerGpuSimulatorExecutionBlockedManifestUri?: string;
    };
    publication: {
      readyToEvaluatePublishable: boolean;
      publicationLabel: string;
    };
  };
  selection: {
    taskId: string;
    scenarioId: string;
    robotProfileId: string;
    policyId: string;
  };
  robotTeam: {
    customerId: string;
    companyName: string;
    contactEmail?: string | null;
  };
  entitlement: {
    accessState: string;
    entitlementId?: string | null;
    approved: boolean;
  };
  policySubmission: Record<string, unknown>;
  source: {
    route: string;
    surface: string;
  };
}) {
  const jobBase = [
    "robot-eval",
    slugify(input.sitePackage.siteSlug),
    slugify(input.selection.taskId),
  ].join("-");
  const buyerRequestId =
    input.buyerRequestId ||
    `buyer-request-${slugify(input.sitePackage.siteSlug)}-${slugify(input.selection.taskId)}-${fingerprint({
      scenario: input.selection.scenarioId,
      policy: input.selection.policyId,
      customer: input.robotTeam.customerId,
    })}`;
  const jobId = `${jobBase}-${fingerprint({
    site: input.sitePackage.siteSlug,
    task: input.selection.taskId,
    scenario: input.selection.scenarioId,
    policy: input.selection.policyId,
    customer: input.robotTeam.customerId,
  })}`;

  return {
    schema_version: JOB_REQUEST_SCHEMA_VERSION,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    customer: {
      id: input.robotTeam.customerId,
      name: input.robotTeam.companyName,
      contact_email: input.robotTeam.contactEmail || null,
    },
    site_package: {
      site_slug: input.sitePackage.siteSlug,
      site_id: input.sitePackage.siteId,
      site_submission_id: input.sitePackage.siteSubmissionId || null,
      capture_job_id: input.sitePackage.captureJobId || null,
      capture_id: input.sitePackage.captureId || null,
      buyer_request_id: buyerRequestId,
      pipeline_prefix: input.sitePackage.pipelinePrefix || null,
      site_name: input.sitePackage.siteName,
      capture_root: input.sitePackage.captureRoot,
      package_uri: input.sitePackage.artifactUris.manifestUri || null,
      access_state: input.sitePackage.accessState,
      publication_ready_to_evaluate: input.sitePackage.publication.readyToEvaluatePublishable,
      publication_label: input.sitePackage.publication.publicationLabel,
      task_cards_uri: input.sitePackage.artifactUris.taskCardsUri || null,
      scenario_cards_uri: input.sitePackage.artifactUris.scenarioCardsUri || null,
      eval_cards_uri: input.sitePackage.artifactUris.evalCardsUri || null,
      proof_boundaries_uri: input.sitePackage.artifactUris.proofBoundariesUri || null,
      task_thresholds_uri: input.sitePackage.artifactUris.taskThresholdsUri || null,
      publication_readiness_uri:
        input.sitePackage.artifactUris.publicationReadinessUri || null,
      scene_asset_inventory_uri:
        input.sitePackage.artifactUris.sceneAssetInventoryUri || null,
      scene_asset_dependency_audit_uri:
        input.sitePackage.artifactUris.sceneAssetDependencyAuditUri || null,
      scene_asset_preflight_uri:
        input.sitePackage.artifactUris.sceneAssetPreflightUri || null,
      scene_asset_inspection_uri:
        input.sitePackage.artifactUris.sceneAssetInspectionUri || null,
      scene_frame_estimate_uri:
        input.sitePackage.artifactUris.sceneFrameEstimateUri || null,
      collider_proxy_plan_uri:
        input.sitePackage.artifactUris.colliderProxyPlanUri || null,
      cpu_scene_proxy_manifest_uri:
        input.sitePackage.artifactUris.cpuSceneProxyManifestUri || null,
      cpu_preflight_scorecard_uri:
        input.sitePackage.artifactUris.cpuPreflightScorecardUri || null,
      task_anchor_proposal_manifest_uri:
        input.sitePackage.artifactUris.taskAnchorProposalManifestUri || null,
      episode_spec_manifest_uri:
        input.sitePackage.artifactUris.episodeSpecManifestUri || null,
      episode_specs_uri:
        input.sitePackage.artifactUris.episodeSpecsUri || null,
      spawn_pose_validation_manifest_uri:
        input.sitePackage.artifactUris.spawnPoseValidationManifestUri || null,
      cpu_preflight_manifest_uri:
        input.sitePackage.artifactUris.cpuPreflightManifestUri || null,
      pre_gpu_readiness_summary_uri:
        input.sitePackage.artifactUris.preGpuReadinessSummaryUri || null,
      cpu_simulator_preflight_manifest_uri:
        input.sitePackage.artifactUris.cpuSimulatorPreflightManifestUri || null,
      gpu_handoff_packet_uri:
        input.sitePackage.artifactUris.gpuHandoffPacketUri || null,
      gpu_owner_system_proof_schema_uri:
        input.sitePackage.artifactUris.gpuOwnerSystemProofSchemaUri || null,
      gpu_run_checklist_uri:
        input.sitePackage.artifactUris.gpuRunChecklistUri || null,
      owner_gpu_simulator_execution_blocked_manifest_uri:
        input.sitePackage.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri || null,
    },
    requested_tasks: [
      {
        task_id: input.selection.taskId,
        scenario_ids: [input.selection.scenarioId],
        task_thresholds_uri: input.sitePackage.artifactUris.taskThresholdsUri || null,
      },
    ],
    robot_profile: {
      robot_profile_id: input.selection.robotProfileId,
    },
    policy_package: orderedPolicyPackage(input.policySubmission),
    entitlement: {
      access_state: input.entitlement.accessState,
      entitlement_id: input.entitlement.entitlementId || null,
      approved: input.entitlement.approved,
    },
    operation: "evaluate_only",
    simulator_preference: "fixture",
    cosmos_training_preference: { mode: "export_only" },
    pipeline_trigger: {
      status: "queued_for_pipeline",
      command: "blueprint-run-robot-eval-job",
      default_provisioner: "fixture_local",
      default_simulator: "fixture",
      cpu_pre_gpu_preflight: {
        scene_asset_inventory_uri:
          input.sitePackage.artifactUris.sceneAssetInventoryUri || null,
        scene_asset_dependency_audit_uri:
          input.sitePackage.artifactUris.sceneAssetDependencyAuditUri || null,
        scene_asset_preflight_uri:
          input.sitePackage.artifactUris.sceneAssetPreflightUri || null,
        scene_asset_inspection_uri:
          input.sitePackage.artifactUris.sceneAssetInspectionUri || null,
        collider_proxy_plan_uri:
          input.sitePackage.artifactUris.colliderProxyPlanUri || null,
        cpu_scene_proxy_manifest_uri:
          input.sitePackage.artifactUris.cpuSceneProxyManifestUri || null,
        cpu_preflight_scorecard_uri:
          input.sitePackage.artifactUris.cpuPreflightScorecardUri || null,
        task_anchor_proposal_manifest_uri:
          input.sitePackage.artifactUris.taskAnchorProposalManifestUri || null,
        episode_spec_manifest_uri:
          input.sitePackage.artifactUris.episodeSpecManifestUri || null,
        episode_specs_uri:
          input.sitePackage.artifactUris.episodeSpecsUri || null,
        spawn_pose_validation_manifest_uri:
          input.sitePackage.artifactUris.spawnPoseValidationManifestUri || null,
        cpu_preflight_manifest_uri:
          input.sitePackage.artifactUris.cpuPreflightManifestUri || null,
        pre_gpu_readiness_summary_uri:
          input.sitePackage.artifactUris.preGpuReadinessSummaryUri || null,
        cpu_simulator_preflight_manifest_uri:
          input.sitePackage.artifactUris.cpuSimulatorPreflightManifestUri || null,
        gpu_handoff_packet_uri:
          input.sitePackage.artifactUris.gpuHandoffPacketUri || null,
        gpu_owner_system_proof_schema_uri:
          input.sitePackage.artifactUris.gpuOwnerSystemProofSchemaUri || null,
        gpu_run_checklist_uri:
          input.sitePackage.artifactUris.gpuRunChecklistUri || null,
        owner_gpu_simulator_execution_blocked_manifest_uri:
          input.sitePackage.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri || null,
        ready_for_owner_gpu_preflight: true,
        owner_gpu_simulator_execution_proven: false,
        local_cpu_preflight_smoke_ran: false,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      },
    },
    rights_privacy_scope: {
      status: input.entitlement.approved ? "cleared_for_robot_eval" : "review_required",
      external_use_allowed: input.entitlement.approved,
      privacy_scope: "derived_deidentified_environment",
    },
    owner_system: {
      name: "Blueprint-WebApp",
      request_id: jobId,
      buyer_request_id: buyerRequestId,
      site_submission_id: input.sitePackage.siteSubmissionId || null,
      capture_job_id: input.sitePackage.captureJobId || null,
      capture_id: input.sitePackage.captureId || null,
    },
    source: {
      system: "Blueprint-WebApp",
      route: input.source.route,
      surface: input.source.surface,
      selection_state: {
        buyer_request_id: buyerRequestId,
        site_slug: input.sitePackage.siteSlug,
        site_submission_id: input.sitePackage.siteSubmissionId || null,
        capture_job_id: input.sitePackage.captureJobId || null,
        capture_id: input.sitePackage.captureId || null,
        task_id: input.selection.taskId,
        scenario_id: input.selection.scenarioId,
        policy_id: input.selection.policyId,
      },
    },
    proof_boundary: CLAIM_BOUNDARY,
  };
}

export function validateRobotEvalJobRequest(value: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!hasObject(value)) {
    return { ok: false, errors: ["request must be an object"] };
  }
  if (value.schema_version !== JOB_REQUEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${JOB_REQUEST_SCHEMA_VERSION}`);
  }
  const jobId = String(value.job_id || "").trim();
  const buyerRequestId = String(value.buyer_request_id || "").trim();
  if (!jobId) errors.push("job_id is required");
  if (!buyerRequestId) errors.push("buyer_request_id is required");

  const sitePackage = value.site_package;
  if (!hasObject(sitePackage)) {
    errors.push("site_package is required");
  } else {
    for (const field of [
      "site_slug",
      "site_id",
      "site_submission_id",
      "capture_job_id",
      "capture_id",
      "buyer_request_id",
      "package_uri",
      "task_thresholds_uri",
      "publication_readiness_uri",
    ]) {
      if (!String(sitePackage[field] || "").trim()) {
        errors.push(`site_package.${field} is required`);
      }
    }
    if (String(sitePackage.buyer_request_id || "").trim() !== buyerRequestId) {
      errors.push("site_package.buyer_request_id must match buyer_request_id");
    }
  }

  const policyPackage = value.policy_package;
  if (!hasObject(policyPackage)) {
    errors.push("policy_package is required");
  } else {
    for (const modality of POLICY_MODALITIES) {
      if (!hasObject(policyPackage[modality])) {
        errors.push(`policy_package.${modality} is required`);
      }
    }
  }

  const proofBoundary = value.proof_boundary;
  if (!hasObject(proofBoundary)) {
    errors.push("proof_boundary is required");
  } else {
    for (const key of Object.keys(CLAIM_BOUNDARY) as (keyof typeof CLAIM_BOUNDARY)[]) {
      if (proofBoundary[key] !== false) {
        errors.push(`proof_boundary.${key} must be false until owner-system proof exists`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isRobotEvalJobRequest(value: unknown): value is Record<string, unknown> {
  return validateRobotEvalJobRequest(value).ok;
}

export async function writeRobotEvalJobRequestInbox(params: {
  rootDir: string;
  jobRequest: Record<string, unknown>;
  queuedAt: string;
}) {
  const jobId = String(params.jobRequest.job_id || "").trim();
  const buyerRequestId = String(params.jobRequest.buyer_request_id || "").trim();
  const fileName = `${sanitizeFileStem(jobId)}.json`;
  const jobPath = path.join(params.rootDir, fileName);
  const indexPath = path.join(params.rootDir, "index.jsonl");
  const exportEnvelope = {
    queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    status: "queued_for_pipeline",
    queued_at_iso: params.queuedAt,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_consumer: "BlueprintCapturePipeline",
    job_request: params.jobRequest,
  };

  await fs.mkdir(params.rootDir, { recursive: true });
  await fs.writeFile(jobPath, `${JSON.stringify(exportEnvelope, null, 2)}\n`, "utf8");
  await fs.appendFile(
    indexPath,
    `${JSON.stringify({
      queued_at_iso: params.queuedAt,
      job_id: jobId,
      buyer_request_id: buyerRequestId,
      path: jobPath,
      schema_version: JOB_REQUEST_SCHEMA_VERSION,
      queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    })}\n`,
    "utf8",
  );

  return {
    queue_contract: "robot_eval_job_request_inbox.v1",
    job_request_path: jobPath,
    index_path: indexPath,
  };
}

export type RobotEvalJobRequestForwardResult = {
  status: "not_configured" | "blocked" | "forwarded" | "failed";
  performed: boolean;
  endpoint_configured: boolean;
  required: boolean;
  http_status?: number;
  accepted?: boolean;
  pipeline_status?: unknown;
  input_blockers?: unknown;
  blockers?: string[];
  error_name?: string;
  error_message?: string;
};

function truthy(value: string | undefined) {
  return String(value || "").trim().toLowerCase() === "true";
}

function intEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function forwardRobotEvalJobRequestToPipeline(params: {
  jobRequest: Record<string, unknown>;
  queuedAt: string;
  endpointUrl?: string;
  token?: string;
  required?: boolean;
  timeoutMs?: number;
}): Promise<RobotEvalJobRequestForwardResult> {
  const endpoint =
    params.endpointUrl?.trim() ||
    String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL || "").trim();
  const required =
    params.required ?? truthy(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED);
  if (!endpoint) {
    return {
      status: "not_configured",
      performed: false,
      endpoint_configured: false,
      required,
    };
  }

  const token = params.token ?? String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "");
  if (!token.trim()) {
    return {
      status: "blocked",
      performed: false,
      endpoint_configured: true,
      required,
      blockers: ["missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN"],
    };
  }

  const jobId = String(params.jobRequest.job_id || "").trim();
  const buyerRequestId = String(params.jobRequest.buyer_request_id || "").trim();
  const envelope = {
    queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    status: "queued_for_pipeline",
    queued_at_iso: params.queuedAt,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_consumer: "BlueprintCapturePipeline",
    job_request: params.jobRequest,
  };
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    params.timeoutMs ??
      intEnv(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS, DEFAULT_FORWARD_TIMEOUT_MS),
  );
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      payload = hasObject(parsed) ? parsed : {};
    } catch {
      payload = {};
    }
    const detail = hasObject(payload.detail) ? payload.detail : payload;
    const result: RobotEvalJobRequestForwardResult = {
      status: response.ok ? "forwarded" : "failed",
      performed: response.ok,
      endpoint_configured: true,
      required,
      http_status: response.status,
    };
    if (typeof detail.accepted === "boolean") {
      result.accepted = detail.accepted;
    }
    if (detail.status !== undefined) {
      result.pipeline_status = detail.status;
    }
    if (detail.input_blockers !== undefined) {
      result.input_blockers = detail.input_blockers;
    }
    return result;
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      endpoint_configured: true,
      required,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : "Unknown forwarding error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
