/**
 * intake-loadtest.k6.js
 * -----------------------------------------------------------------------------
 * Load / soak harness scaffold for the Blueprint intake path.
 *
 * Audit finding R043 (P1): "No load/soak test, capacity model, or cost-per-
 * capture model exists in any repo." This is the runnable half of the fix; the
 * quantitative model lives at
 *   BlueprintCapturePipeline/docs/CAPACITY_AND_COST_MODEL_2026-07-08.md
 *
 * Target under test (WebApp intake):
 *   POST {BASE_URL}/api/robot-eval/job-requests/        (Authorization: Bearer <token>)
 *   GET  {BASE_URL}/api/robot-eval/job-requests/:id/status
 *   GET  {BASE_URL}/health                              (unauthenticated readiness)
 * Route auth + shape verified against:
 *   server/routes/robot-eval-job-requests.ts
 *   server/utils/robotEvalJobRequests.ts (validateRobotEvalJobRequest)
 *   server/middleware/verifyFirebaseToken.ts
 *
 * SAFETY MODEL — reads the room before it writes anything:
 *   - MODE defaults to "dry": it only performs read-only GETs (health) and
 *     builds the intake payload in-memory WITHOUT POSTing it. It cannot create
 *     records or trigger pipeline forwarding in dry mode.
 *   - To actually POST intake records you must set BOTH:
 *         MODE=submit  ALLOW_INTAKE_WRITES=1
 *   - Against a prod-looking https host, writes are refused unless ALLOW_PROD=1.
 *     Hosts containing localhost / 127.0.0.1 / staging / .local are treated as
 *     non-prod. This is a guard, not a guarantee — point it at staging.
 *
 * This file is a k6 script. Run it with `k6 run`, not `node`. It intentionally
 * parses cleanly under `node --check` (k6 globals such as __ENV/__VU are only
 * referenced at k6 runtime, guarded by typeof checks).
 *
 * See ./README.md for how to run it and read the results.
 * -----------------------------------------------------------------------------
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Environment helpers (k6 exposes config via __ENV)
// ---------------------------------------------------------------------------
function env(name, fallback) {
  const present = typeof __ENV !== "undefined" && __ENV[name] != null;
  const value = present ? __ENV[name] : undefined;
  return value === undefined || value === "" ? fallback : value;
}
function envInt(name, fallback) {
  const n = parseInt(env(name, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
function envFloat(name, fallback) {
  const n = parseFloat(env(name, ""));
  return Number.isFinite(n) ? n : fallback;
}
function envBool(name, fallback) {
  const v = String(env(name, "")).trim().toLowerCase();
  if (v === "") return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = env("BASE_URL", "http://localhost:5000").replace(/\/+$/, "");
const AUTH_TOKEN = env("AUTH_TOKEN", "");
const INTAKE_PATH = env("INTAKE_PATH", "/api/robot-eval/job-requests/");
const STATUS_PATH_TEMPLATE = env(
  "STATUS_PATH_TEMPLATE",
  "/api/robot-eval/job-requests/__JOB_ID__/status",
);
const HEALTH_PATH = env("HEALTH_PATH", "/health");

const MODE = String(env("MODE", "dry")).toLowerCase(); // "dry" | "submit"
const ALLOW_INTAKE_WRITES = envBool("ALLOW_INTAKE_WRITES", false);
const ALLOW_PROD = envBool("ALLOW_PROD", false);
const POLL_STATUS = envBool("POLL_STATUS", false);

// Thresholds (pass/fail criteria for the run)
const P95_MS = envInt("P95_MS", 800);
const ERROR_RATE_MAX = envFloat("ERROR_RATE_MAX", 0.01);

// Load shape (a ramped constant-VU test by default; SOAK=1 for a long flat hold)
const VUS = envInt("VUS", 10);
const TARGET_VUS = envInt("TARGET_VUS", VUS);
const DURATION = env("DURATION", "1m");
const RAMP_UP = env("RAMP_UP", "30s");
const RAMP_DOWN = env("RAMP_DOWN", "30s");
const SOAK = envBool("SOAK", false);
const SOAK_VUS = envInt("SOAK_VUS", 5);
const SOAK_DURATION = env("SOAK_DURATION", "1h");
const THINK_TIME_S = envFloat("THINK_TIME_S", 1);

// ---------------------------------------------------------------------------
// Safety guard: decide whether real intake writes are permitted
// ---------------------------------------------------------------------------
function looksLikeProd(url) {
  const u = String(url).toLowerCase();
  if (
    u.includes("localhost") ||
    u.includes("127.0.0.1") ||
    u.includes("staging") ||
    u.includes(".local") ||
    u.includes("dry-run")
  ) {
    return false;
  }
  // Any other https host is treated as potentially production.
  return /^https:\/\//.test(u);
}

const WRITES_ENABLED =
  MODE === "submit" &&
  ALLOW_INTAKE_WRITES &&
  (!looksLikeProd(BASE_URL) || ALLOW_PROD);

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
function buildStages() {
  if (SOAK) {
    return [
      { duration: RAMP_UP, target: SOAK_VUS },
      { duration: SOAK_DURATION, target: SOAK_VUS },
      { duration: RAMP_DOWN, target: 0 },
    ];
  }
  return [
    { duration: RAMP_UP, target: TARGET_VUS },
    { duration: DURATION, target: TARGET_VUS },
    { duration: RAMP_DOWN, target: 0 },
  ];
}

export const options = {
  stages: buildStages(),
  thresholds: {
    // Global HTTP health.
    http_req_failed: [`rate<${ERROR_RATE_MAX}`],
    http_req_duration: [`p(95)<${P95_MS}`],
    // Intake-specific (only populated in submit mode).
    intake_error_rate: [`rate<${ERROR_RATE_MAX}`],
    "intake_latency_ms{endpoint:intake}": [`p(95)<${P95_MS}`],
  },
  // Surface the four numbers the capacity model cares about.
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const intakeSubmitted = new Counter("intake_submitted");
const intakeErrors = new Counter("intake_errors");
const intakeErrorRate = new Rate("intake_error_rate");
const intakeLatency = new Trend("intake_latency_ms", true);

// ---------------------------------------------------------------------------
// Payload builder — a load-shaped facsimile of a robot_eval_job_request.v1.
// The canonical builder is BlueprintCapturePipeline-forwarded via the WebApp's
// server/utils/robotEvalJobRequests.ts buildRobotEvalJobRequest(); this mirrors
// the fields validateRobotEvalJobRequest() requires so submit mode can reach a
// 202 rather than bouncing on 400. Keep in sync if the schema changes.
// ---------------------------------------------------------------------------
function uid() {
  const rand = Math.random().toString(36).slice(2, 10);
  const vu = typeof __VU !== "undefined" ? __VU : 0;
  const iter = typeof __ITER !== "undefined" ? __ITER : 0;
  return `${Date.now().toString(36)}-${vu}-${iter}-${rand}`;
}

function buildExecutionRequest() {
  return {
    schema_version: "blueprint.robot_eval_execution_request.v1",
    webapp_role: "queue_and_forward_only",
    scheduler_owner: "BlueprintCapturePipeline",
    evaluation_scope: {
      mode: "virtual_policy_evaluation",
      public_label: "WAM/VLA policy evaluation",
      physical_robot_deployment_claim_allowed: false,
    },
    wam_evaluator_backend: "pipeline_selected",
    allowed_evaluator_backends: [
      "wam_policy_runtime",
      "vla_policy_runtime",
      "mujoco_policy_adapter",
      "isaac_policy_adapter",
      "newton_policy_adapter",
      "fixture_policy_adapter",
    ],
    optional_physics_state_authority: {
      mode: "optional_sanity_check",
      allowed_authorities: ["mujoco", "isaac", "newton"],
      required_for_request_acceptance: false,
      proof_role: "physics_state_sanity_check_only",
    },
    proof_boundaries: {
      virtual_evaluation_proves_evaluation_readiness: false,
      virtual_evaluation_proves_non_ranking_operational_claim: false,
      virtual_evaluation_is_policy_evidence_only: true,
      evaluation_readiness_requires_owner_system_proof: true,
      non_ranking_operational_claim_requires_separate_qualified_review: true,
    },
    scope: {
      mode: "simulator_only",
      label: "Unitree G1 MuJoCo simulator evaluation",
      physical_robot_deployment_claim_allowed: false,
    },
    queueing: {
      mode: "async_job",
      customer_response: "job_id_and_status_only",
      web_request_must_not_wait_for_simulator: true,
    },
    worker_selection: {
      mode: "blueprint_selects_fastest_cheapest_available_simulator_worker",
      customer_provider_choice_required: false,
      provider_complexity_hidden_by_default: true,
    },
    preflight: {
      cpu_preflight_required_before_gpu: true,
      blocks_gpu_when_missing: true,
      required_artifacts: [
        "scene_asset_inventory",
        "scene_asset_dependency_audit",
        "cpu_preflight_scorecard",
        "episode_spec_manifest",
        "gpu_handoff_packet",
      ],
    },
    simulator_routing: {
      requested_backend: "pipeline_selected",
      allowed_backends: ["mujoco", "isaac_sim", "isaac_lab_arena", "pybullet", "fixture"],
      default_first_pass_backend: "mujoco",
      default_first_gpu_backend: "mujoco",
      simulator_preference: "mujoco",
      selection_policy: {
        schema_version: "robot_eval_simulator_selection_policy.v1",
        mode: "mujoco_first_unless_proof_requires_isaac",
        first_pass_backend: "mujoco",
      },
      proof_boundaries: {
        webapp_request_selects_policy_not_execution: true,
        mujoco_proof_does_not_clear_isaac_sim_gate: true,
        simulator_policy_does_not_prove_rank_fidelity: true,
        virtual_evaluation_does_not_prove_evaluation_readiness: true,
        virtual_evaluation_does_not_prove_non_ranking_operational_claim: true,
      },
    },
    gpu_allocation: {
      mode: "on_demand_with_optional_warm_pool",
      allocation_owner: "BlueprintCapturePipeline_or_owner_gpu_worker",
      allocation_allowed_by_webapp: false,
      gpu_spend_approved: false,
      max_budget_usd: 0,
      hard_timeout_seconds: 120,
      idle_shutdown_required: true,
      persistent_cache_recommended: true,
    },
    artifact_contract: {
      expected_outputs: [
        "scenario_eval_matrix.json",
        "policy_ranking_scorecard.json",
        "candidate_selection_report.json",
        "wam_eval_claim_boundary.json",
        "post_training_data_package_export_manifest.json",
        "proof_boundary.json",
        "proof_boundaries.json",
      ],
      webapp_queues_and_forwards_only: true,
      pipeline_owns_execution_ranking_and_artifacts: true,
      startup_artifacts_are_advisory_until_owner_runtime_proof: true,
      ranking_outputs_are_advisory_until_owner_system_proof: true,
      ptdp_export_manifest_does_not_prove_delivery_or_training: true,
      simulator_execution_proven_by_webapp: false,
      public_claim_upgrade_allowed: false,
    },
  };
}

function buildJobRequest() {
  const suffix = uid();
  const jobId = `loadtest-intake-${suffix}`;
  const buyerRequestId = `loadtest-buyer-request-${suffix}`;
  const siteSlug = `loadtest-warehouse-${suffix}`;
  const captureRoot = `/synced-artifacts/loadtest/${siteSlug}`;
  return {
    schema_version: "robot_eval_job_request.v1",
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    customer: {
      id: `loadtest-customer-${suffix}`,
      name: "Load Test Robot Team",
      contact_email: null,
    },
    site_package: {
      site_slug: siteSlug,
      site_id: `loadtest-site-${suffix}`,
      site_submission_id: `loadtest-submission-${suffix}`,
      capture_job_id: `loadtest-capture-job-${suffix}`,
      capture_id: `loadtest-capture-${suffix}`,
      buyer_request_id: buyerRequestId,
      site_name: "Load Test Warehouse",
      capture_root: captureRoot,
      package_uri: `${captureRoot}/manifest.json`,
      access_state: "granted",
      publication_ready_to_evaluate: true,
      publication_label: "Ready to evaluate (sim/review-grade)",
      task_thresholds_uri: `${captureRoot}/task_thresholds.json`,
      publication_readiness_uri: `${captureRoot}/publication_readiness.json`,
    },
    requested_tasks: [
      {
        task_id: "loadtest-tote-transfer",
        scenario_ids: ["loadtest-scenario-1"],
        task_thresholds_uri: `${captureRoot}/task_thresholds.json`,
      },
    ],
    robot_profile: {
      robot_profile_id: "unitree_g1_humanoid",
      robot_name: "Unitree G1",
      embodiment: "humanoid",
      sensors: ["rgb", "depth", "proprioception"],
    },
    policy_package: {
      policy_api_endpoint: {
        endpoint_url: "https://policy.example.com/loadtest/act",
      },
    },
    entitlement: {
      access_state: "granted",
      entitlement_id: `loadtest-entitlement-${suffix}`,
      approved: true,
    },
    operation: "evaluate_only",
    evaluation_scope: {
      mode: "virtual_policy_evaluation",
      public_label: "WAM/VLA policy evaluation",
      physical_robot_deployment_claim_allowed: false,
    },
    wam_evaluator_backend: "pipeline_selected",
    allowed_evaluator_backends: [
      "wam_policy_runtime",
      "vla_policy_runtime",
      "mujoco_policy_adapter",
      "isaac_policy_adapter",
      "newton_policy_adapter",
      "fixture_policy_adapter",
    ],
    optional_physics_state_authority: {
      mode: "optional_sanity_check",
      allowed_authorities: ["mujoco", "isaac", "newton"],
      required_for_request_acceptance: false,
      proof_role: "physics_state_sanity_check_only",
    },
    simulator_scope: {
      mode: "simulator_only",
      robot: "Unitree G1",
      simulator: "MuJoCo",
      customer_label: "WAM/VLA policy evaluation with internal MuJoCo adapter",
      physical_robot_deployment_claim_allowed: false,
    },
    budget: { budget_usd: 0, timeout_seconds: 120 },
    execution_request: buildExecutionRequest(),
    proof_boundary: {
      simulator_execution_proven: false,
      rank_fidelity_result_proven: false,
      robot_policy_execution_proven: false,
      physics_contact_validated: false,
      non_ranking_operational_claim_validated: false,
      virtual_evaluation_proves_evaluation_readiness: false,
      virtual_evaluation_proves_non_ranking_operational_claim: false,
      public_claim_upgrade_allowed: false,
    },
  };
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function setup() {
  const banner = {
    harness: "intake-loadtest.k6.js",
    finding: "R043",
    mode: MODE,
    writes_enabled: WRITES_ENABLED,
    base_url: BASE_URL,
    intake_path: INTAKE_PATH,
    health_path: HEALTH_PATH,
    auth_token_present: Boolean(AUTH_TOKEN),
    soak: SOAK,
    target_vus: SOAK ? SOAK_VUS : TARGET_VUS,
    p95_ms_threshold: P95_MS,
    error_rate_max: ERROR_RATE_MAX,
  };
  console.log(`[intake-loadtest] config ${JSON.stringify(banner)}`);

  if (MODE === "submit" && !WRITES_ENABLED) {
    console.warn(
      "[intake-loadtest] MODE=submit requested but writes are DISABLED by the safety guard. " +
        "Set ALLOW_INTAKE_WRITES=1 (and ALLOW_PROD=1 for a non-local https host) to actually POST. " +
        "Running read-only.",
    );
  }
  if (WRITES_ENABLED && !AUTH_TOKEN) {
    console.warn(
      "[intake-loadtest] Writes enabled but AUTH_TOKEN is empty — intake will 401. " +
        "Provide a Firebase ID token (or a non-prod BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN value).",
    );
  }
  if (WRITES_ENABLED && looksLikeProd(BASE_URL) && ALLOW_PROD) {
    console.warn(
      "[intake-loadtest] ALLOW_PROD=1 against a prod-looking host — you are creating REAL intake records. " +
        "This should be staging.",
    );
  }

  // Read-only readiness probe.
  const res = http.get(`${BASE_URL}${HEALTH_PATH}`, { tags: { endpoint: "health" } });
  check(res, {
    "setup: health endpoint reachable": (r) => r.status === 200 || r.status === 503,
  });
  return { startedAt: new Date().toISOString(), writesEnabled: WRITES_ENABLED };
}

export default function () {
  // (1) Always exercise the read-only health path — safe in every mode.
  const health = http.get(`${BASE_URL}${HEALTH_PATH}`, { tags: { endpoint: "health" } });
  check(health, {
    "health 200 or 503": (r) => r.status === 200 || r.status === 503,
  });

  // (2) Build the intake payload every iteration (exercises the generator and,
  //     in dry mode, is the only thing that touches the payload — nothing is sent).
  const payload = buildJobRequest();
  check(payload, {
    "payload has job_id": (p) => Boolean(p.job_id),
    "payload buyer_request_id consistent": (p) =>
      p.buyer_request_id === p.site_package.buyer_request_id,
  });

  if (!WRITES_ENABLED) {
    // DRY MODE: do not POST. This is the default and it is production-safe.
    sleep(THINK_TIME_S);
    return;
  }

  // (3) SUBMIT MODE: POST the intake payload.
  const res = http.post(`${BASE_URL}${INTAKE_PATH}`, JSON.stringify(payload), {
    headers: authHeaders(),
    tags: { endpoint: "intake" },
  });
  intakeSubmitted.add(1);
  intakeLatency.add(res.timings.duration, { endpoint: "intake" });
  const accepted = res.status === 202 || res.status === 200;
  intakeErrorRate.add(!accepted);
  if (!accepted) {
    intakeErrors.add(1);
  }
  check(res, {
    "intake accepted (202/200)": (r) => r.status === 202 || r.status === 200,
    "intake not 5xx": (r) => r.status < 500,
    "intake not auth-rejected": (r) => r.status !== 401 && r.status !== 403,
  });

  // (4) Optionally poll the status read path (models buyer polling).
  if (POLL_STATUS && accepted) {
    const statusPath = STATUS_PATH_TEMPLATE.replace(
      "__JOB_ID__",
      encodeURIComponent(payload.job_id),
    );
    const statusRes = http.get(`${BASE_URL}${statusPath}`, {
      headers: authHeaders(),
      tags: { endpoint: "status" },
    });
    check(statusRes, {
      "status readable (200/403/404)": (r) =>
        r.status === 200 || r.status === 403 || r.status === 404,
    });
  }

  sleep(THINK_TIME_S);
}

export function teardown(data) {
  console.log(
    `[intake-loadtest] done. started=${data && data.startedAt} writes_enabled=${
      data && data.writesEnabled
    }`,
  );
}
