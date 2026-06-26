import fs from "node:fs/promises";
import path from "node:path";

import {
  buildRobotEvalJobRequest,
  validateRobotEvalJobRequest,
} from "../../server/utils/robotEvalJobRequests";

const LOCAL_REHEARSAL_SOURCE_KIND = "local_first_gpu_rehearsal_request";

type Args = Record<string, string | true>;

function parseArgs(argv: string[]) {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${item}`);
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function stringArg(args: Args, key: string, fallback = "") {
  const value = args[key];
  if (value === true || value === undefined) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function requiredArg(args: Args, key: string) {
  const value = stringArg(args, key);
  if (!value) {
    throw new Error(`Missing required --${key}`);
  }
  return value;
}

function safeId(value: string, field: string) {
  const text = value.trim();
  if (!text || text === "." || text === ".." || text.includes("/") || text.includes("\\")) {
    throw new Error(`${field} must be a path-safe identifier`);
  }
  return text;
}

function artifact(captureRoot: string, relativePath: string) {
  return path.join(captureRoot, relativePath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const captureRoot = path.resolve(requiredArg(args, "capture-root"));
  const outputPath = path.resolve(requiredArg(args, "output"));
  const siteSlug = safeId(requiredArg(args, "site-slug"), "site-slug");
  const taskId = stringArg(args, "task-id", "walk_to_target");
  const scenarioId = stringArg(args, "scenario-id", "walk_to_target_pose");
  const robotProfileId = stringArg(args, "robot-profile-id", "unitree_g1_humanoid");
  const policyId = stringArg(args, "policy-id", "blueprint_default_walk_to_target_smoke_policy");
  const siteSubmissionId = safeId(requiredArg(args, "site-submission-id"), "site-submission-id");
  const captureJobId = safeId(requiredArg(args, "capture-job-id"), "capture-job-id");
  const captureId = safeId(requiredArg(args, "capture-id"), "capture-id");
  const buyerRequestId = safeId(requiredArg(args, "buyer-request-id"), "buyer-request-id");
  const generatedAt = new Date().toISOString();

  const jobRequest = buildRobotEvalJobRequest({
    buyerRequestId,
    sitePackage: {
      siteSlug,
      siteId: stringArg(args, "site-id", `site-${siteSlug}`),
      siteName: stringArg(args, "site-name", siteSlug),
      siteSubmissionId,
      captureJobId,
      captureId,
      captureRoot,
      pipelinePrefix: path.join(captureRoot, "pipeline"),
      accessState: "local_rehearsal_only",
      artifactUris: {
        manifestUri: artifact(
          captureRoot,
          "pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json",
        ),
        taskCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/task_cards.json"),
        scenarioCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/scenario_cards.json"),
        evalCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/eval_cards.json"),
        proofBoundariesUri: artifact(
          captureRoot,
          "pipeline/robot_eval_dataset/proof_boundaries.json",
        ),
        taskThresholdsUri: artifact(
          captureRoot,
          "pipeline/robot_eval_dataset/task_thresholds.json",
        ),
        publicationReadinessUri: artifact(
          captureRoot,
          "pipeline/robot_eval_dataset/publication_readiness.json",
        ),
        sceneAssetInventoryUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/scene_asset_inventory.json",
        ),
        sceneAssetDependencyAuditUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/scene_asset_dependency_audit.json",
        ),
        sceneAssetPreflightUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/scene_asset_preflight.json",
        ),
        sceneAssetInspectionUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/scene_asset_inspection.json",
        ),
        cpuPreflightScorecardUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_preflight_scorecard.json",
        ),
        episodeSpecManifestUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/episode_spec_manifest.json",
        ),
        cpuSimulatorPreflightManifestUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_simulator_preflight_manifest.json",
        ),
        gpuHandoffPacketUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/gpu_handoff_packet.json",
        ),
      },
      publication: {
        readyToEvaluatePublishable: true,
        publicationLabel: "Local rehearsal request only",
      },
      preflightSummary: {
        readyForOwnerGpuPreflight: false,
        localCpuSmokeRan: false,
      },
    },
    selection: {
      taskId,
      scenarioId,
      robotProfileId,
      policyId,
    },
    robotTeam: {
      customerId: stringArg(args, "customer-id", "local-first-gpu-rehearsal-robot-team"),
      companyName: stringArg(args, "company-name", "Local first GPU rehearsal robot team"),
      contactEmail: null,
    },
    entitlement: {
      accessState: "local_rehearsal_only",
      approved: false,
    },
    policySubmission: {
      high_level_skill_trace: {
        ordered_skill_sequence: ["walk_to_target"],
        skill_taxonomy_version: "blueprint_default_test_policy.v1",
        source_type: "repo_generated_default_smoke_policy",
        confidence_coverage_note:
          "Local rehearsal request only; does not prove robot-team policy execution.",
      },
    },
    source: {
      route: stringArg(args, "route", `/sites/${siteSlug}`),
      surface: "sites",
    },
  });

  const requestWithBoundary = {
    ...jobRequest,
    source_kind: LOCAL_REHEARSAL_SOURCE_KIND,
    local_rehearsal_only: true,
    source: {
      ...(jobRequest.source as Record<string, unknown>),
      source_kind: LOCAL_REHEARSAL_SOURCE_KIND,
      generated_by: "Blueprint-WebApp/scripts/pipeline/export-first-gpu-webapp-rehearsal-request.ts",
      selection_state: {
        ...((jobRequest.source as { selection_state?: Record<string, unknown> }).selection_state ||
          {}),
        source_kind: LOCAL_REHEARSAL_SOURCE_KIND,
      },
    },
    proof_boundary: {
      ...(jobRequest.proof_boundary as Record<string, unknown>),
      local_rehearsal_only: true,
      webapp_request_built_by_webapp_code: true,
      webapp_route_submission_proven: false,
      live_webapp_forwarding_proven: false,
      simulator_execution_proven: false,
      rank_fidelity_result_proven: false,
      public_claim_upgrade_allowed: false,
    },
  };

  const validation = validateRobotEvalJobRequest(requestWithBoundary);
  if (!validation.ok) {
    throw new Error(`Generated request failed WebApp validation: ${validation.errors.join(", ")}`);
  }

  const envelope = {
    queue_contract: "robot_eval_job_request_inbox.v1",
    source_kind: LOCAL_REHEARSAL_SOURCE_KIND,
    local_rehearsal_only: true,
    status: "queued_for_pipeline_local_rehearsal",
    generated_at_iso: generatedAt,
    generated_by:
      "Blueprint-WebApp/scripts/pipeline/export-first-gpu-webapp-rehearsal-request.ts",
    job_id: requestWithBoundary.job_id,
    buyer_request_id: requestWithBoundary.buyer_request_id,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_consumer: "BlueprintCapturePipeline",
    job_request: requestWithBoundary,
    proof_boundary: {
      local_rehearsal_only: true,
      webapp_request_built_by_webapp_code: true,
      webapp_route_submission_proven: false,
      live_webapp_forwarding_proven: false,
      simulator_execution_proven: false,
      robot_policy_execution_proven: false,
      rank_fidelity_result_proven: false,
      public_claim_upgrade_allowed: false,
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  console.log(`[webapp-rehearsal-request] output=${outputPath}`);
  console.log(`[webapp-rehearsal-request] job_id=${requestWithBoundary.job_id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
