import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildRobotEvalJobRequest,
  validateRobotEvalJobRequest,
} from "../../server/utils/robotEvalJobRequests";

type SharedRobotEvalContract = {
  ROBOT_EVAL_JOB_REQUEST_SCHEMA_VERSION: string;
  ROBOT_EVAL_JOB_REQUEST_INBOX_CONTRACT: string;
  POLICY_MODALITIES: readonly string[];
  REQUIRED_SITE_PACKAGE_FIELDS: readonly string[];
  REQUIRED_ARTIFACT_CONTRACT_OUTPUTS: readonly string[];
  validateRobotEvalJobRequestConstants: (payload: unknown) => string[];
  robotEvalJobRequestSchema: () => Record<string, unknown>;
  robotEvalJobRequestInboxSchema: () => Record<string, unknown>;
};

const DEFAULT_SIBLING_MODULE = "../BlueprintContracts/js/robot-eval-job-request.mjs";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedRecord(payload: Record<string, unknown>, ...keys: string[]) {
  let current: unknown = payload;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadModuleFromFile(filePath: string) {
  const resolved = path.resolve(filePath);
  if (!(await fileExists(resolved))) {
    throw new Error(`shared contract module not found at ${resolved}`);
  }
  return import(pathToFileURL(resolved).href);
}

async function loadSharedContract(explicitSpecifier?: string): Promise<{
  source: string;
  module: SharedRobotEvalContract;
}> {
  if (explicitSpecifier) {
    const module = explicitSpecifier.endsWith(".mjs") || explicitSpecifier.startsWith(".")
      ? await loadModuleFromFile(explicitSpecifier)
      : await import(explicitSpecifier);
    return { source: explicitSpecifier, module: module as SharedRobotEvalContract };
  }

  try {
    const packageSpecifier = "@blueprint/contracts/robot-eval-job-request";
    const module = await import(packageSpecifier);
    return { source: packageSpecifier, module: module as SharedRobotEvalContract };
  } catch {
    const sibling = path.resolve(DEFAULT_SIBLING_MODULE);
    const module = await loadModuleFromFile(sibling);
    return { source: sibling, module: module as SharedRobotEvalContract };
  }
}

function buildFixtureRequest() {
  return buildRobotEvalJobRequest({
    sitePackage: {
      siteSlug: "sw-chi-01",
      siteId: "site-sw-chi-01",
      siteName: "Test Fixture Grocery Distribution Annex",
      siteSubmissionId: "site-submission-sw-chi-01",
      captureJobId: "capture-job-sw-chi-01",
      captureId: "capture-sw-chi-01",
      captureRoot: "gs://blueprint/site-packages/sw-chi-01",
      pipelinePrefix: "gs://blueprint/site-packages/sw-chi-01/pipeline",
      accessState: "request_gated",
      artifactUris: {
        manifestUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json",
        taskThresholdsUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_thresholds.json",
        publicationReadinessUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/publication_readiness.json",
        sceneAssetInventoryUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/scene_asset_inventory.json",
        cpuPreflightScorecardUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_preflight_scorecard.json",
        episodeSpecManifestUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/episode_spec_manifest.json",
        gpuHandoffPacketUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/gpu_handoff_packet.json",
      },
      publication: {
        readyToEvaluatePublishable: true,
        publicationLabel: "Ready to evaluate",
      },
      preflightSummary: {
        readyForOwnerGpuPreflight: true,
        localCpuSmokeRan: true,
      },
    },
    selection: {
      taskId: "place_return_in_bin",
      scenarioId: "scenario_place_return_in_bin_mobile",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "policy-api-fixture",
    },
    robotTeam: {
      customerId: "robot-team-a",
      companyName: "Robot Team A",
      contactEmail: "robot-team@example.com",
    },
    entitlement: {
      accessState: "request_gated",
      entitlementId: "entitlement-sw-chi-01",
      approved: true,
    },
    policySubmission: {
      policy_api_endpoint: {
        endpoint_url: "https://robot-team.example/policy",
        observation_schema_ref: "gs://robot-team/schemas/obs.json",
        action_schema_ref: "gs://robot-team/schemas/action.json",
      },
    },
    source: {
      route: "/sites/sw-chi-01",
      surface: "sites",
    },
  }) as Record<string, unknown>;
}

function compareList(name: string, actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  const missing = expected.filter((item) => !actualSet.has(item));
  return missing.map((item) => `${name} missing ${item}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const explicitModule =
    args.get("contracts-module") ||
    process.env.BLUEPRINT_CONTRACTS_ROBOT_EVAL_JS ||
    process.env.BLUEPRINT_CONTRACTS_ROBOT_EVAL_MODULE;
  const { source, module: shared } = await loadSharedContract(explicitModule);

  const request = buildFixtureRequest();
  const localValidation = validateRobotEvalJobRequest(request);
  const sharedErrors = shared.validateRobotEvalJobRequestConstants(request);
  const requestSchema = shared.robotEvalJobRequestSchema();
  const inboxSchema = shared.robotEvalJobRequestInboxSchema();
  const artifactContract = nestedRecord(request, "execution_request", "artifact_contract");
  const expectedOutputs = Array.isArray(artifactContract?.expected_outputs)
    ? artifactContract.expected_outputs.map(String)
    : [];

  const blockers: string[] = [];
  if (shared.ROBOT_EVAL_JOB_REQUEST_SCHEMA_VERSION !== "robot_eval_job_request.v1") {
    blockers.push("shared_schema_version_mismatch");
  }
  if (shared.ROBOT_EVAL_JOB_REQUEST_INBOX_CONTRACT !== "robot_eval_job_request_inbox.v1") {
    blockers.push("shared_inbox_contract_mismatch");
  }
  if (
    nestedRecord(requestSchema, "properties", "schema_version")?.const !==
    "robot_eval_job_request.v1"
  ) {
    blockers.push("shared_schema_file_version_mismatch");
  }
  if (
    nestedRecord(inboxSchema, "properties", "queue_contract")?.const !==
    "robot_eval_job_request_inbox.v1"
  ) {
    blockers.push("shared_inbox_schema_file_contract_mismatch");
  }
  if (!localValidation.ok) {
    blockers.push(...localValidation.errors.map((error) => `local_validator:${error}`));
  }
  blockers.push(...sharedErrors.map((error) => `shared_contract:${error}`));
  blockers.push(
    ...compareList(
      "shared_artifact_outputs",
      expectedOutputs,
      shared.REQUIRED_ARTIFACT_CONTRACT_OUTPUTS,
    ),
  );
  blockers.push(
    ...compareList(
      "shared_site_package_fields",
      Object.keys((request.site_package as Record<string, unknown>) || {}),
      shared.REQUIRED_SITE_PACKAGE_FIELDS,
    ),
  );

  const invalid = structuredClone(request) as Record<string, unknown>;
  invalid.schema_version = "wrong";
  const proofBoundary = invalid.proof_boundary as Record<string, unknown>;
  proofBoundary.simulator_execution_proven = true;
  const executionRequest = invalid.execution_request as Record<string, unknown>;
  executionRequest.scheduler_owner = "Blueprint-WebApp";
  const invalidSharedErrors = shared.validateRobotEvalJobRequestConstants(invalid);
  for (const expectedError of [
    "schema_version must be robot_eval_job_request.v1",
    "proof_boundary.simulator_execution_proven must be false",
    "execution_request.scheduler_owner must be BlueprintCapturePipeline",
  ]) {
    if (!invalidSharedErrors.includes(expectedError)) {
      blockers.push(`shared_contract_missing_negative_case:${expectedError}`);
    }
  }

  const report = {
    schema_version: "blueprint.webapp.robot_eval_job_request_contract_parity.v1",
    status: blockers.length === 0 ? "passed" : "blocked",
    shared_contract_source: source,
    local_validator: localValidation,
    shared_contract_errors: sharedErrors,
    negative_case_errors: invalidSharedErrors,
    blockers,
  };

  const outputPath = args.get("output");
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));
  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    schema_version: "blueprint.webapp.robot_eval_job_request_contract_parity.v1",
    status: "blocked",
    blockers: ["shared_contract_load_failed"],
    error: message,
  }, null, 2));
  process.exitCode = 1;
});
