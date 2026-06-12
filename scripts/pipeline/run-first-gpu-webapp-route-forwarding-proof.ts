import express from "express";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import robotEvalJobRequestsRouter from "../../server/routes/robot-eval-job-requests";
import {
  buildRobotEvalJobRequest,
  validateRobotEvalJobRequest,
} from "../../server/utils/robotEvalJobRequests";

const SOURCE_KIND = "webapp_route_forwarding_proof";

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

function optionalArtifact(captureRoot: string, relativePath: string) {
  const candidate = artifact(captureRoot, relativePath);
  return fsSync.existsSync(candidate) ? candidate : undefined;
}

function readJsonArtifact(captureRoot: string, relativePath: string) {
  const candidate = artifact(captureRoot, relativePath);
  if (!fsSync.existsSync(candidate)) {
    return {};
  }
  try {
    return JSON.parse(fsSync.readFileSync(candidate, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

function objectCards(payload: Record<string, unknown>) {
  const cards = payload.cards;
  return Array.isArray(cards)
    ? cards.filter((card): card is Record<string, unknown> => Boolean(card && typeof card === "object"))
    : [];
}

function routeProofDatasetSelection(
  captureRoot: string,
  siteSlug: string,
  preferredTaskId?: string,
) {
  const taskCards = objectCards(
    readJsonArtifact(captureRoot, "pipeline/robot_eval_dataset/task_cards.json"),
  );
  const scenarioCards = objectCards(
    readJsonArtifact(captureRoot, "pipeline/robot_eval_dataset/scenario_cards.json"),
  );
  const taskId =
    preferredTaskId ||
    taskCards.map((card) => stringField(card, "task_id")).find(Boolean) ||
    "walk_to_target";
  const taskScenarios = scenarioCards.filter((card) => stringField(card, "task_id") === taskId);
  const scenarioPool = taskScenarios.length ? taskScenarios : scenarioCards;
  const humanoidScenario = scenarioPool.find((card) =>
    (stringField(card, "scenario_id") || "").toLowerCase().includes("humanoid"),
  );
  const scenarioId =
    stringField(humanoidScenario, "scenario_id") ||
    scenarioPool.map((card) => stringField(card, "scenario_id")).find(Boolean) ||
    `${siteSlug}_walk_to_target_pose`;
  return { taskId, scenarioId };
}

function routeProofPreflightSummary(captureRoot: string) {
  const gpuHandoff = readJsonArtifact(
    captureRoot,
    "pipeline/simulation_automation/gpu_handoff_packet.json",
  );
  const cpuPreflight = readJsonArtifact(
    captureRoot,
    "pipeline/simulation_automation/cpu_preflight_manifest.json",
  );
  const preGpuReadiness = readJsonArtifact(
    captureRoot,
    "pipeline/simulation_automation/pre_gpu_readiness_summary.json",
  );
  const cpuSimulatorPreflight = readJsonArtifact(
    captureRoot,
    "pipeline/simulation_automation/cpu_simulator_preflight_manifest.json",
  );
  return {
    readyForOwnerGpuPreflight:
      gpuHandoff.ready_for_owner_gpu_preflight === true ||
      gpuHandoff.status === "ready_for_owner_gpu_preflight_handoff" ||
      cpuPreflight.ready_for_owner_gpu_preflight === true ||
      preGpuReadiness.ready_for_owner_gpu_preflight === true,
    localCpuSmokeRan:
      cpuSimulatorPreflight.local_cpu_preflight_smoke_ran === true ||
      cpuSimulatorPreflight.cpu_simulator_preflight_ready === true ||
      cpuSimulatorPreflight.status === "completed_local_cpu_smoke",
  };
}

async function listen(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind local WebApp proof server");
  }
  return address.port;
}

async function close(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function buildRequest(args: Args) {
  const captureRoot = path.resolve(requiredArg(args, "capture-root"));
  const siteSlug = safeId(stringArg(args, "site-slug", "first-gpu-walkthrough-2"), "site-slug");
  const explicitTaskId = stringArg(args, "task-id");
  const datasetSelection = routeProofDatasetSelection(captureRoot, siteSlug, explicitTaskId);
  const taskId = explicitTaskId || datasetSelection.taskId;
  const scenarioId = stringArg(args, "scenario-id", datasetSelection.scenarioId);
  const robotProfileId = stringArg(args, "robot-profile-id", "unitree_g1_humanoid");
  const policyId = stringArg(args, "policy-id", "blueprint_default_walk_to_target_smoke_policy");
  const siteSubmissionId = safeId(requiredArg(args, "site-submission-id"), "site-submission-id");
  const captureJobId = safeId(requiredArg(args, "capture-job-id"), "capture-job-id");
  const captureId = safeId(requiredArg(args, "capture-id"), "capture-id");
  const buyerRequestId = safeId(requiredArg(args, "buyer-request-id"), "buyer-request-id");

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
      accessState: "webapp_route_forwarding_proof_only",
      artifactUris: {
        manifestUri: artifact(captureRoot, "pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json"),
        taskCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/task_cards.json"),
        scenarioCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/scenario_cards.json"),
        evalCardsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/eval_cards.json"),
        proofBoundariesUri: artifact(captureRoot, "pipeline/robot_eval_dataset/proof_boundaries.json"),
        taskThresholdsUri: artifact(captureRoot, "pipeline/robot_eval_dataset/task_thresholds.json"),
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
        colliderProxyPlanUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/collider_proxy_plan.json",
        ),
        cpuSceneProxyManifestUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_scene_proxy_manifest.json",
        ),
        cpuPreflightScorecardUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_preflight_scorecard.json",
        ),
        taskAnchorProposalManifestUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/task_anchor_proposal_manifest.json",
        ),
        episodeSpecManifestUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/episode_spec_manifest.json",
        ),
        episodeSpecsUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/episode_specs.json",
        ),
        spawnPoseValidationManifestUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/spawn_pose_validation_manifest.json",
        ),
        cpuPreflightManifestUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_preflight_manifest.json",
        ),
        preGpuReadinessSummaryUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/pre_gpu_readiness_summary.json",
        ),
        cpuSimulatorPreflightManifestUri: artifact(
          captureRoot,
          "pipeline/simulation_automation/cpu_simulator_preflight_manifest.json",
        ),
        gpuHandoffPacketUri: artifact(captureRoot, "pipeline/simulation_automation/gpu_handoff_packet.json"),
        gpuOwnerSystemProofSchemaUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/gpu_owner_system_proof_schema.json",
        ),
        gpuRunChecklistUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/gpu_run_checklist.md",
        ),
        ownerGpuSimulatorExecutionBlockedManifestUri: optionalArtifact(
          captureRoot,
          "pipeline/simulation_automation/owner_gpu_simulator_execution_blocked_manifest.json",
        ),
      },
      publication: {
        readyToEvaluatePublishable: false,
        publicationLabel: "WebApp route forwarding proof only",
      },
      preflightSummary: routeProofPreflightSummary(captureRoot),
    },
    selection: {
      taskId,
      scenarioId,
      robotProfileId,
      policyId,
    },
    robotTeam: {
      customerId: stringArg(args, "customer-id", "first-gpu-route-proof-robot-team"),
      companyName: stringArg(args, "company-name", "First GPU route proof robot team"),
      contactEmail: null,
    },
    entitlement: {
      accessState: "webapp_route_forwarding_proof_only",
      approved: false,
    },
    policySubmission: {
      high_level_skill_trace: {
        ordered_skill_sequence: ["walk_to_target"],
        skill_taxonomy_version: "blueprint_default_test_policy.v1",
        source_type: "repo_generated_default_smoke_policy",
        confidence_coverage_note:
          "Route forwarding proof only; does not prove robot-team policy execution.",
      },
    },
    source: {
      route: "/api/robot-eval/job-requests",
      surface: "webapp_route_forwarding_proof",
    },
  });

  const requestWithRouteEvidence = {
    ...jobRequest,
    source_kind: SOURCE_KIND,
    source: {
      ...(jobRequest.source as Record<string, unknown>),
      source_kind: SOURCE_KIND,
      generated_by:
        "Blueprint-WebApp/scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts",
      selection_state: {
        ...((jobRequest.source as { selection_state?: Record<string, unknown> }).selection_state ||
          {}),
        source_kind: SOURCE_KIND,
      },
    },
    proof_boundary: {
      ...(jobRequest.proof_boundary as Record<string, unknown>),
      local_rehearsal_only: false,
      webapp_request_built_by_webapp_code: true,
      local_webapp_route_forwarding_proof: true,
      production_live_webapp_forwarding_proven: false,
      simulator_execution_proven: false,
      robot_policy_execution_proven: false,
      robot_readiness_proven: false,
      public_claim_upgrade_allowed: false,
    },
  };

  const validation = validateRobotEvalJobRequest(requestWithRouteEvidence);
  if (!validation.ok) {
    throw new Error(`Generated route proof request failed validation: ${validation.errors.join(", ")}`);
  }
  return requestWithRouteEvidence;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const captureRoot = path.resolve(requiredArg(args, "capture-root"));
  const outputPath = path.resolve(requiredArg(args, "output"));
  const forwardUrl = requiredArg(args, "forward-url");
  const inboxDir = path.resolve(
    stringArg(
      args,
      "webapp-inbox-dir",
      path.join(captureRoot, "pipeline", "webapp_route_forwarding_proof", "webapp_inbox"),
    ),
  );
  const forwardTokenEnv = stringArg(args, "forward-token-env", "ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN");
  const forwardToken = process.env[forwardTokenEnv]?.trim();
  if (!forwardToken) {
    throw new Error(`Missing forwarding token environment variable ${forwardTokenEnv}`);
  }

  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL = forwardUrl;
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = forwardToken;
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED = "true";
  process.env.ROBOT_EVAL_JOB_REQUEST_INBOX_DIR = inboxDir;
  if (args["allow-firestore-write"] !== true) {
    process.env.ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE = "true";
  }

  const jobRequest = buildRequest(args);
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use("/api/robot-eval/job-requests", robotEvalJobRequestsRouter);
  const server = http.createServer(app);
  const generatedAt = new Date().toISOString();

  try {
    const port = await listen(server);
    const routeUrl = `http://127.0.0.1:${port}/api/robot-eval/job-requests`;
    const response = await fetch(routeUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jobRequest),
    });
    const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const pipelineForward = (responseBody.pipelineForward || {}) as Record<string, unknown>;
    const forwarded =
      response.status === 202 &&
      responseBody.ok === true &&
      pipelineForward.status === "forwarded" &&
      pipelineForward.performed === true &&
      pipelineForward.accepted === true &&
      pipelineForward.pipeline_status === "staged_for_control_plane";

    const proof = {
      schema_version: "blueprint_webapp_route_forwarding_proof.v1",
      generated_at: generatedAt,
      status: forwarded ? "forwarded_to_pipeline_intake" : "blocked",
      capture_root: captureRoot,
      webapp_route: {
        mounted_path: "/api/robot-eval/job-requests",
        local_http_route_exercised: true,
        http_status: response.status,
        route_submission_proven: response.status === 202,
        full_production_webapp_deployment_proven: false,
      },
      job_request: {
        schema_version: jobRequest.schema_version,
        job_id: jobRequest.job_id,
        buyer_request_id: jobRequest.buyer_request_id,
        site_package: {
          site_slug: (jobRequest.site_package as Record<string, unknown>).site_slug,
          site_submission_id: (jobRequest.site_package as Record<string, unknown>).site_submission_id,
          capture_job_id: (jobRequest.site_package as Record<string, unknown>).capture_job_id,
          capture_id: (jobRequest.site_package as Record<string, unknown>).capture_id,
          capture_root: (jobRequest.site_package as Record<string, unknown>).capture_root,
        },
        source_kind: SOURCE_KIND,
        local_rehearsal_only: false,
      },
      durable_store: responseBody.durableStore || null,
      pipeline_inbox: responseBody.pipelineInbox || null,
      pipeline_forward: pipelineForward,
      pipeline_intake: {
        accepted: pipelineForward.accepted === true,
        status: pipelineForward.pipeline_status || null,
        input_blockers: pipelineForward.input_blockers || [],
      },
      proof_boundary: {
        local_webapp_route_forwarding_proven: forwarded,
        production_live_webapp_forwarding_proven: false,
        pipeline_intake_staged_request_proven: forwarded,
        full_webapp_db_persistence_proven: false,
        simulator_execution_proven: false,
        robot_policy_execution_proven: false,
        real_robot_pov_evidence_proven: false,
        safety_validated: false,
        customer_delivery_readiness_proven: false,
        public_claim_upgrade_allowed: false,
      },
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    console.log(`[webapp-route-forwarding-proof] output=${outputPath}`);
    console.log(`[webapp-route-forwarding-proof] status=${proof.status}`);
    console.log(`[webapp-route-forwarding-proof] job_id=${jobRequest.job_id}`);
    if (!forwarded) {
      process.exitCode = 1;
    }
  } finally {
    await close(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
