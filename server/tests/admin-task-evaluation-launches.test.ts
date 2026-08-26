// @vitest-environment node
import crypto from "crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_TASK_EVALUATION_ALLOCATOR } from "../utils/taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  buildTaskEvaluationLaunchSubmissionSignature,
  TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
} from "../utils/taskEvaluationLaunchSubmissionAuth";

const realFetch = globalThis.fetch.bind(globalThis);
const LAUNCH_SUBMIT_SECRET = "task-evaluation-launch-submit-secret-0123456789abcdef";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
  hangTransaction: false,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (id: string) => ({
    id,
    get: async () => {
      const record = state.records.get(id);
      return { exists: Boolean(record), data: () => record && structuredClone(record) };
    },
    set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
      state.records.set(id, options?.merge
        ? { ...(state.records.get(id) || {}), ...structuredClone(payload) }
        : structuredClone(payload));
    },
  });
  return {
    dbAdmin: {
      collection: () => ({ doc: reference }),
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => {
        if (state.hangTransaction) return new Promise<T>(() => undefined);
        return callback({
          get: async (ref: ReturnType<typeof reference>) => ref.get(),
          create: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>) => {
            state.records.set(ref.id, structuredClone(payload));
          },
          set: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>, options?: { merge?: boolean }) => {
            state.records.set(ref.id, options?.merge
              ? { ...(state.records.get(ref.id) || {}), ...structuredClone(payload) }
              : structuredClone(payload));
          },
        });
      },
    },
  };
});

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async () => true,
  resolveAccessContext: async () => ({
    uid: "founder-001", email: "founder@example.com", roles: ["admin"],
    isAdmin: true, isOps: true,
  }),
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true, status: 200, code: "ok", message: "ok" }),
}));

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function profile() {
  return {
    profile_id: "interiorgs-sage-franka-001",
    profile_digest: sha("a"),
    source_bundle: {
      bundle_id: "scene-001", source_kind: "interiorgs_sage",
      uri: "gs://blueprint-runs/scene-001.json", digest: sha("b"),
    },
    evaluation_run_spec: {
      uri: "gs://blueprint-runs/spec.json", digest: sha("c"),
    },
    required_controls: {
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      secret_profile_id: "canonical-vast-adp",
      watchdog_required: true,
      artifact_storage_required: true,
      teardown_required: true,
      provider_zero_required: true,
      webapp_status_sync_required: true,
      retry_cap: 0,
    },
    execution_admission: {
      live_enabled: true,
      readiness_receipt: { uri: "gs://blueprint-runs/readiness.json", digest: sha("e") },
      blockers: [],
    },
    claim_ceiling: "development_only",
  };
}

function launchInput() {
  return {
    launch_id: "launch-001",
    run_id: "run-001",
    profile_id: profile().profile_id,
    profile_digest: profile().profile_digest,
    authorization_issued_at: new Date(Date.now() - 1_000).toISOString(),
    rights: {
      scope: "interiorgs_sage_simulator_evaluation",
      evidence: { uri: "firestore://authorities/rights-001", digest: sha("d") },
    },
    spend: {
      max_spend_usd: 2,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
    confirm_execution: true,
  };
}

const immutableRef = (name: string, character = "f") => ({
  uri: `s3://blueprint-inputs/${name}.json`,
  digest: sha(character),
  size_bytes: 128,
});

function preparationInput() {
  const ref = (name: string) => immutableRef(name);
  return {
    schema_version: "task_evaluation_launch_preparation_request.v1",
    run_mode: "scene_configuration",
    expected_production_commit: "a".repeat(40),
    preparation_id: "prep-scene-001",
    team_namespace: "robot-team-001",
    run_id: "run-prep-001",
    scene: {
      mode: "configure_source_scene",
      identity: { id: "public-scene-001", version: "v1" },
      source_manifest: ref("source-manifest"),
      appearance: {
        kind: "interiorgs", representation: ref("appearance"),
        renderer_qualification: ref("renderer-qualification"),
      },
      geometry: {
        kind: "sage_derived", collision: ref("collision"), validation: ref("geometry-validation"),
      },
      registration: {
        metric_registration: ref("metric-registration"), support_plane: ref("support-plane"),
        robot_mount_interface: ref("robot-mount-interface"),
        workspace_clearance: ref("workspace-clearance"),
        camera_calibration: ref("camera-calibration"),
      },
      rights: {
        admission: ref("scene-rights"),
        evidence: [
          { role: "publisher_terms", artifact: ref("publisher-terms") },
          { role: "human_authority_record", artifact: ref("human-rights-authority") },
        ],
        source_bytes_redistributable: false,
        provider_disclosure_scope: "derived_only",
      },
    },
    construction: {
      mode: "production_recipe",
      recipe: ref("scene-construction-recipe"),
      output_identity: { id: "public-scene-001-configured", version: "v1" },
    },
    task: {
      identity: { id: "rigid-relocation", version: "v1" },
      binding_mode: "define_configuration_template",
      definition: ref("task-definition"),
      kind: "rigid_relocation", strategy: "planar_push",
      subject: {
        mode: "construct_from_scene_object",
        identity: { id: "source-mug-replacement", version: "v1" },
        representation_kind: "simready_usd",
        source_object: ref("task-source-object"),
        rights_admission: ref("task-subject-rights-admission"),
        provider_disclosure_allowed: true,
      },
      success_criteria: ref("success-criteria"), execution: ref("execution-spec"),
    },
    sensors: { configuration: ref("sensor-config") },
    runtime: {
      identity: { id: "native-arena", version: "v1" },
      oci_image: `registry.example/native-arena@${sha("e")}`,
      entrypoint: ["/app/run-task-evaluation"], health_protocol: ref("health-protocol"),
      requirements: { cpu_cores: 8, memory_gib: 32, gpu_count: 1, disk_gib: 80 },
      network: { default: "deny", allowlist: [] }, secret_refs: [],
      mounts: [
        { source: ref("input-bundle"), container_path: "/inputs", mode: "read_only" },
        { container_path: "/outputs", mode: "output" },
      ],
      output_limit_bytes: 1_073_741_824,
    },
    execution_adapter: {
      kind: "scene_configuration_pipeline", version: "v1",
      runtime_source_bundle: ref("runtime-source.zip"),
    },
    publication: {
      input_namespace: "robot-team-001-public-scene-001-v1",
      service_account_readback_required: true,
    },
    spend: {
      maximum_hourly_rate_usd: 0.8, hard_cap_usd: 2.25, hard_ttl_seconds: 3600,
      provider_compute_spend_cap_usd: 0.75,
      external_service_caps: {
        openai: {
          maximum_cost_usd: 1.5,
          maximum_requests: 32,
          stage_max_cost_usd: {
            artifixer_semantic_teacher: 0.4,
            artifixer_visual_review: 0.75,
            content_agents: 0.35,
          },
        },
      },
      retry_cap: 0, selected_provider: "vast", provider_allowlist: ["vast"],
    },
  };
}

function evaluationPreparationInput() {
  const input: any = preparationInput();
  input.run_mode = "episode_evaluation";
  input.preparation_id = "prep-scene-001-zero";
  input.run_id = "run-scene-001-zero";
  input.scene = {
    mode: "reuse_configured_revision",
    identity: { id: "public-scene-001", version: "v1" },
    configured_revision: immutableRef("configured-scene-revision", "8"),
  };
  input.construction = {
    mode: "reuse_configured_scene",
  };
  input.robot = {
    identity: { id: "fixed-arm", version: "v1" },
    configuration: immutableRef("robot-config"),
    kinematics: immutableRef("kinematics"),
    joint_bounds: immutableRef("joint-bounds"),
    base_registration: immutableRef("robot-base-registration"),
    controller_configuration: immutableRef("controller-config"),
  };
  input.controller = {
    identity: { id: "zero-action", version: "v1" },
    kind: "zero_action",
    configuration: immutableRef("zero-action-controller"),
  };
  input.task = {
    identity: { id: "rigid-relocation", version: "v1" },
    binding_mode: "reuse_configured_template",
    kind: "rigid_relocation",
    strategy: "planar_push",
    configured_scene_revision_digest: sha("8"),
    subject: {
    mode: "configured_scene_object",
    identity: { id: "source-mug-replacement", version: "v1" },
    physics_authority: "configured_scene_revision",
    },
  };
  input.execution_adapter.kind = "native_task_arena";
  delete input.spend.provider_compute_spend_cap_usd;
  delete input.spend.external_service_caps;
  return input;
}

function activationInput() {
  const preparation = preparationInput();
  return {
    schema_version: "task_evaluation_launch_activation_request.v1",
    expected_production_commit: preparation.expected_production_commit,
    activation_id: "activate-scene-001-construction",
    team_namespace: preparation.team_namespace,
    lane: "native_task_arena_construction",
    preparation: {
      preparation_id: preparation.preparation_id,
      request_digest: canonicalArtifactDigest(preparation, "request_digest"),
      result_digest: sha("9"),
    },
    release_window: immutableRef("release-window", "1"),
    lineage: {
      kind: "initial_project",
      project_spend_reconciliation: immutableRef("project-spend-reconciliation", "2"),
      initial_provider_zero: immutableRef("initial-provider-zero", "3"),
    },
    authorization: {
      reference: "founder approval 2026-08-25",
      authorized_by: "founder-001",
      authorized_on: "2026-08-25T16:00:00.000Z",
      standing_authorization_expires_at: "2026-08-25T17:00:00.000Z",
      profile_revision: "scene-001-construction-r1",
    },
    requested_mutations: {
      profile_publication: true,
      catalog_synchronization: true,
      standing_authorization: true,
    },
  };
}

function terminalBlockedLaunchRecord() {
  const requestDigest = sha("a");
  return {
    schema_version: "task_evaluation_launch_web_record.v1",
    launch_id: "launch-001",
    run_id: "run-001",
    request_digest: requestDigest,
    state: "control_plane_terminal_blocked",
    terminal_receipt_present: false,
    provider_mutation_observed: false,
    paid_execution_retry_performed: false,
    control_plane_terminal_blocker: {
      schema_version: "task_evaluation_launch_control_plane_blocker.v1",
      status: "blocked",
      code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      spend_authority_expires_at: "2026-08-10T12:30:00.000Z",
      observed_at_iso: "2026-08-10T12:31:00.000Z",
      pipeline_terminal_receipt_observed: false,
      provider_mutation_performed_by_webapp: false,
      paid_execution_retry_performed: false,
      execution_result: "not_observed",
      scripted_positive_controls_result: "not_observed",
      learned_policy_result: "not_observed",
    },
  };
}

async function startServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/admin-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.firebaseUser = { uid: "founder-001", admin: true };
    next();
  });
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startInternalServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/internal-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startSubmissionServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/internal-task-evaluation-launch-submissions");
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }));
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startPreparationSubmissionServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import(
    "../routes/internal-task-evaluation-launch-preparations"
  );
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }));
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function signedSubmissionHeaders(body: string, idempotencyKey = "launch-001") {
  const timestamp = new Date().toISOString();
  const nonce = `test-nonce-${crypto.randomUUID()}`;
  return {
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
    "x-blueprint-launch-timestamp": timestamp,
    "x-blueprint-launch-client-id": TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
    "x-blueprint-launch-nonce": nonce,
    "x-blueprint-launch-signature": buildTaskEvaluationLaunchSubmissionSignature({
      secret: LAUNCH_SUBMIT_SECRET,
      timestamp,
      clientId: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
      nonce,
      body,
    }),
  };
}

beforeEach(() => {
  state.records.clear();
  state.hangTransaction = false;
  process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = JSON.stringify([profile()]);
  process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/launches";
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "forward-secret";
  process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET = LAUNCH_SUBMIT_SECRET;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("http://127.0.0.1:")) {
      return realFetch(url, init);
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles") {
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_profile_catalog.v1",
        profiles: [profile()],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations") {
      const request = JSON.parse(String(init?.body || "{}"));
      const receipt: Record<string, unknown> = {
        schema_version: "task_evaluation_launch_preparation_intake_receipt.v1",
        status: "queued_for_no_spend_preparation",
        accepted: true,
        already_exists: false,
        preparation_id: request.preparation_id,
        run_id: request.run_id,
        team_namespace: request.team_namespace,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        expected_production_commit: request.expected_production_commit,
        provider_mutation_performed_inside_http_request: false,
        catalog_mutation_performed_inside_http_request: false,
        paid_execution_requested: false,
        canonical_allocator_required_for_later_execution: true,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations/prep-scene-001") {
      const request = preparationInput();
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_preparation_status.v1",
        status: "materialized",
        preparation_id: request.preparation_id,
        run_mode: request.run_mode,
        run_id: request.run_id,
        team_namespace: request.team_namespace,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        worker_status: "queued_for_production_scene_configuration",
        construction_orchestration_id: request.preparation_id,
        construction_queue_envelope_digest: sha("8"),
        automatic_progression_required: true,
        source_commit: request.expected_production_commit,
        result_digest: sha("9"),
        reference_count: 24,
        full_byte_service_account_readback_passed: true,
        blockers: [],
        provider_mutation_performed_by_status_read: false,
        provider_mutation_performed_by_worker: false,
        catalog_mutation_performed_by_worker: false,
        paid_execution_requested: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations") {
      const request = JSON.parse(String(init?.body || "{}"));
      const receipt: Record<string, unknown> = {
        schema_version: "task_evaluation_launch_activation_intake_receipt.v1",
        status: "queued_for_authority_gated_activation",
        accepted: true,
        already_exists: false,
        activation_id: request.activation_id,
        preparation_id: request.preparation.preparation_id,
        team_namespace: request.team_namespace,
        lane: request.lane,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        provider_mutation_performed_inside_http_request: false,
        catalog_mutation_performed_inside_http_request: false,
        standing_authorization_published_inside_http_request: false,
        paid_execution_requested: false,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations/activate-scene-001-construction") {
      const request = activationInput();
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_activation_status.v1",
        status: "prepared",
        activation_id: request.activation_id,
        preparation_id: request.preparation.preparation_id,
        team_namespace: request.team_namespace,
        lane: request.lane,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        worker_status: "profile_authority_materialized_no_execution",
        result_digest: sha("4"),
        profile_id: "scene-001-construction-r1",
        profile_digest: sha("5"),
        profile_publication_receipt_digest: sha("6"),
        standing_authorization_digest: sha("7"),
        blockers: [],
        provider_mutation_performed_by_status_read: false,
        provider_mutation_performed_by_worker: false,
        paid_execution_requested: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const request = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({
      schema_version: "task_evaluation_launch_intake_receipt.v1",
      status: "accepted",
      provider_mutation_performed_inside_http_request: false,
      queue: {
        schema_version: "task_evaluation_launch_queue_receipt.v1",
        status: "queued",
        launch_id: request.launch_id,
        run_id: request.run_id,
        request_digest: request.request_digest,
        provider_mutation_performed: false,
      },
    }), { status: 202, headers: { "content-type": "application/json" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON;
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL;
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  delete process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS;
  delete process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET;
});

describe("admin Task Evaluation launch route", () => {
  it("starts a production scene-configuration run without an evaluation controller", async () => {
    const { server, url } = await startServer();
    const input = preparationInput();
    try {
      const response = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      const receipt = await response.json();
      expect(response.status).toBe(202);
      expect(receipt).toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
        status: "queued_for_no_spend_preparation",
        preparation_id: input.preparation_id,
        run_id: input.run_id,
        team_namespace: input.team_namespace,
        expected_production_commit: input.expected_production_commit,
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
        submission_channel: "production_webapp_browser",
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "queued_for_no_spend_preparation",
        request_digest: receipt.request_digest,
        provider_mutation_observed: false,
        catalog_mutation_observed: false,
        paid_execution_requested: false,
        request: {
          run_mode: "scene_configuration",
          scene: { identity: input.scene.identity },
          construction: { mode: "production_recipe" },
          task: { identity: input.task.identity },
          runtime: { identity: input.runtime.identity },
        },
      });

      const replay = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({ already_exists: true });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      const status = await fetch(`${url}/preparations/${input.preparation_id}`);
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({
        state: "materialized",
        preparation_id: input.preparation_id,
        pipeline: {
          worker_status: "queued_for_production_scene_configuration",
          construction_orchestration_id: input.preparation_id,
          automatic_progression_required: true,
          full_byte_service_account_readback_passed: true,
        },
        paid_execution_requested: false,
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "materialized",
        pipeline_status: { result_digest: sha("9") },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("accepts an episode evaluation only with configured scene, robot, and controller bindings", async () => {
    const { server, url } = await startServer();
    const input = evaluationPreparationInput();
    try {
      const response = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(202);
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "queued_for_no_spend_preparation",
        request: {
          run_mode: "episode_evaluation",
          scene: { configured_revision: input.scene.configured_revision },
          construction: { mode: "reuse_configured_scene" },
          robot: { identity: input.robot.identity },
          controller: { kind: "zero_action" },
        },
      });

      const invalid = evaluationPreparationInput();
      invalid.preparation_id = "prep-scene-001-invalid";
      delete invalid.scene.configured_revision;
      const rejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invalid),
      });
      expect(rejected.status).toBe(400);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects unsafe or conflicting preparation inputs before Pipeline forwarding", async () => {
    const { server, url } = await startServer();
    try {
      const unsafe = preparationInput();
      unsafe.scene.source_manifest.uri = "/var/lib/blueprint/source.json";
      const rejected = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(unsafe),
      });
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toMatchObject({
        code: "task_evaluation_launch_preparation_input_invalid",
        paid_execution_requested: false,
      });
      expect(state.records.size).toBe(0);

      const unauthorizedProvider = preparationInput();
      unauthorizedProvider.spend.selected_provider = "runpod";
      const providerRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unauthorizedProvider),
      });
      expect(providerRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const overcommittedServices = preparationInput();
      overcommittedServices.spend.hard_cap_usd = 2;
      const overcommittedRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(overcommittedServices),
      });
      expect(overcommittedRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const missingServiceAuthority = preparationInput();
      delete missingServiceAuthority.spend.external_service_caps;
      const missingServiceAuthorityRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(missingServiceAuthority),
      });
      expect(missingServiceAuthorityRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const firstInput = preparationInput();
      const first = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(firstInput),
      });
      expect(first.status).toBe(202);
      const changed = preparationInput();
      changed.run_id = "different-run";
      const conflict = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed),
      });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({
        code: "task_evaluation_launch_preparation_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("activates one verified preparation exactly once without requesting paid execution", async () => {
    const { server, url } = await startServer();
    const preparation = preparationInput();
    const input = activationInput();
    state.records.set(preparation.preparation_id, {
      schema_version: "task_evaluation_launch_preparation_web_record.v1",
      preparation_id: preparation.preparation_id,
      run_id: preparation.run_id,
      team_namespace: preparation.team_namespace,
      expected_production_commit: preparation.expected_production_commit,
      request_digest: input.preparation.request_digest,
      state: "materialized",
      pipeline_status: {
        result_digest: input.preparation.result_digest,
        full_byte_service_account_readback_passed: true,
      },
    });
    try {
      const response = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_launch_activation_web_receipt.v1",
        status: "queued_for_authority_gated_activation",
        already_exists: false,
        activation_id: input.activation_id,
        preparation_id: input.preparation.preparation_id,
        provider_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        activation_is_not_execution: true,
      });
      expect(state.records.get(input.activation_id)).toMatchObject({
        state: "queued_for_authority_gated_activation",
        request_digest: canonicalArtifactDigest(input, "request_digest"),
        provider_mutation_observed: false,
        paid_execution_requested: false,
      });

      const replay = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations",
      )).toHaveLength(1);

      const status = await fetch(`${url}/activations/${input.activation_id}`);
      expect(status.status).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        state: "prepared",
        pipeline: {
          worker_status: "profile_authority_materialized_no_execution",
          profile_id: "scene-001-construction-r1",
          provider_mutation_performed_by_worker: false,
          paid_execution_requested: false,
        },
        activation_is_not_execution: true,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects activation when preparation verification or immutable identity differs", async () => {
    const { server, url } = await startServer();
    const preparation = preparationInput();
    const input = activationInput();
    state.records.set(preparation.preparation_id, {
      preparation_id: preparation.preparation_id,
      team_namespace: preparation.team_namespace,
      expected_production_commit: preparation.expected_production_commit,
      request_digest: input.preparation.request_digest,
      state: "materialized",
      pipeline_status: {
        result_digest: sha("8"),
        full_byte_service_account_readback_passed: true,
      },
    });
    try {
      const unverified = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(unverified.status).toBe(409);
      await expect(unverified.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_activation_preparation_not_verified",
        paid_execution_requested: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations",
      )).toHaveLength(0);

      state.records.set(preparation.preparation_id, {
        ...state.records.get(preparation.preparation_id),
        pipeline_status: {
          result_digest: input.preparation.result_digest,
          full_byte_service_account_readback_passed: true,
        },
      });
      const accepted = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(accepted.status).toBe(202);
      const changed = {
        ...input,
        authorization: { ...input.authorization, reference: "different authority" },
      };
      const conflict = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed),
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_activation_immutable_conflict",
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("authenticates and validates an exact launch without persisting or forwarding", async () => {
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = "[]";
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL =
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles";
    const { server, url } = await startSubmissionServer();
    const body = JSON.stringify(launchInput());
    try {
      const unsigned = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(unsigned.status).toBe(401);

      const missingTimestampBody = JSON.stringify({
        ...launchInput(),
        authorization_issued_at: undefined,
      });
      const missingTimestamp = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: signedSubmissionHeaders(missingTimestampBody) as HeadersInit,
        body: missingTimestampBody,
      });
      expect(missingTimestamp.status).toBe(400);
      await expect(missingTimestamp.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_authorization_timestamp_required",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const response = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      const receipt = await response.json();
      expect(response.status).toBe(200);
      expect(receipt).toMatchObject({
        schema_version: "task_evaluation_launch_web_preflight_receipt.v1",
        status: "ready",
        launch_id: "launch-001",
        run_id: "run-001",
        profile_id: profile().profile_id,
        profile_digest: profile().profile_digest,
        authorization_issued_at: expect.any(String),
        authenticated_client_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
        submission_channel: "production_webapp_service_api",
        webapp_store_available: true,
        webapp_record_persisted: false,
        pipeline_request_forwarded: false,
        pipeline_queue_created: false,
        provider_mutation_performed_inside_web_request: false,
        preflight_is_not_execution: true,
      });
      expect(receipt.receipt_digest).toBe(
        canonicalArtifactDigest(receipt, "receipt_digest"),
      );
      expect(state.records.size).toBe(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target)
          === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles",
      )).toHaveLength(1);

      const submitted = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(submitted.status).toBe(202);
      expect(state.records.get("launch-001")?.request_digest).toBe(
        receipt.candidate_request_digest,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("submits through the launch-only HMAC API exactly once", async () => {
    const { server, url } = await startSubmissionServer();
    const body = JSON.stringify(launchInput());
    try {
      const adminRead = await fetch(`${url}/profiles`);
      expect(adminRead.status).toBe(404);
      const terminalRelease = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(terminalRelease.status).toBe(404);
      expect(state.records.size).toBe(0);

      const missingIdempotency = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "") as HeadersInit,
        body,
      });
      expect(missingIdempotency.status).toBe(400);
      expect(await missingIdempotency.json()).toMatchObject({
        code: "task_evaluation_launch_submit_idempotency_key_missing",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const mismatch = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "different-launch") as HeadersInit,
        body,
      });
      expect(mismatch.status).toBe(409);
      expect(await mismatch.json()).toMatchObject({
        code: "task_evaluation_launch_submit_idempotency_key_mismatch",
      });
      expect(state.records.size).toBe(0);

      const first = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      const firstReceipt = await first.json();
      expect(first.status).toBe(202);
      expect(firstReceipt).toMatchObject({
        schema_version: "task_evaluation_launch_web_receipt.v1",
        status: "queued_in_pipeline",
        already_exists: false,
        submission_channel: "production_webapp_service_api",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        submission: {
          channel: "production_webapp_service_api",
          service_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          idempotency_key: "launch-001",
        },
        request: {
          authorization: {
            actor: { id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID, role: "ops" },
          },
          idempotency_key: "launch-001",
        },
      });

      const replay = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({
        already_exists: true,
        request_digest: firstReceipt.request_digest,
        submission_channel: "production_webapp_service_api",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);

      const changed = JSON.stringify({ ...launchInput(), run_id: "run-002" });
      const conflict = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(changed) as HeadersInit,
        body: changed,
      });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({
        code: "task_evaluation_launch_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("submits one immutable no-spend preparation through the service HMAC API", async () => {
    const { server, url } = await startPreparationSubmissionServer();
    const input = preparationInput();
    const body = JSON.stringify(input);
    const headers = () => signedSubmissionHeaders(body, input.preparation_id) as HeadersInit;
    try {
      const unsigned = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(unsigned.status).toBe(401);
      expect(state.records.size).toBe(0);

      const missingIdempotency = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "") as HeadersInit,
        body,
      });
      expect(missingIdempotency.status).toBe(400);
      await expect(missingIdempotency.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_idempotency_key_missing",
        paid_execution_requested: false,
      });
      expect(state.records.size).toBe(0);

      const mismatch = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "different-preparation") as HeadersInit,
        body,
      });
      expect(mismatch.status).toBe(409);
      await expect(mismatch.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_idempotency_key_mismatch",
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const first = await fetch(url, { method: "POST", headers: headers(), body });
      expect(first.status).toBe(202);
      const firstReceipt = await first.json();
      expect(firstReceipt).toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
        status: "queued_for_no_spend_preparation",
        already_exists: false,
        preparation_id: input.preparation_id,
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
        submission_channel: "production_webapp_service_api",
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        request_digest: firstReceipt.request_digest,
        submission: {
          channel: "production_webapp_service_api",
          actor_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          actor_role: "ops",
          service_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          idempotency_key: input.preparation_id,
        },
        provider_mutation_observed: false,
        catalog_mutation_observed: false,
        paid_execution_requested: false,
      });

      const replay = await fetch(url, { method: "POST", headers: headers(), body });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        already_exists: true,
        request_digest: firstReceipt.request_digest,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      const unsignedStatus = await fetch(`${url}/${input.preparation_id}`);
      expect(unsignedStatus.status).toBe(401);
      const status = await fetch(`${url}/${input.preparation_id}`, {
        headers: signedSubmissionHeaders("", input.preparation_id) as HeadersInit,
      });
      expect(status.status).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_status.v1",
        preparation_id: input.preparation_id,
        state: "materialized",
        pipeline: {
          status: "materialized",
          full_byte_service_account_readback_passed: true,
        },
        provider_mutation_performed_by_status_read: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
      });

      const changed = JSON.stringify({ ...input, run_id: "different-run" });
      const conflict = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(changed, input.preparation_id) as HeadersInit,
        body: changed,
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      expect((await fetch(`${url}/profiles`)).status).toBe(401);
      expect((await fetch(`${url}/preparations/${input.preparation_id}`)).status).toBe(404);
      expect((await fetch(`${url}/activations`, {
        method: "POST",
        headers: headers(),
        body,
      })).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps an unreachable Pipeline profile catalog typed and fail-closed", async () => {
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = "[]";
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL = "https://pipeline.example/profiles";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) return realFetch(url, init);
      throw new DOMException("request timed out", "AbortError");
    }));
    const { server, url } = await startServer();
    try {
      const response = await fetch(`${url}/profiles`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        schema_version: "task_evaluation_launch_profile_catalog.v1",
        error: "Published Pipeline launch profiles are unavailable",
        code: "task_evaluation_launch_profile_catalog_timeout",
        profiles: [],
      });
      expect(state.records.size).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed with an unknown persistence state when Firestore stalls", async () => {
    state.hangTransaction = true;
    process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS = "250";
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(launchInput()),
      });
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        code: "task_evaluation_launch_store_timeout",
        launch_id: "launch-001",
        persistence_state: "unknown",
        retryable: true,
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("durably records authority before forwarding the exact published profile", async () => {
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(launchInput()),
      });
      const body = await response.json();
      expect(response.status).toBe(202);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        launch_id: "launch-001",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        state: "queued_in_pipeline",
        request_digest: body.request_digest,
        provider_mutation_observed: false,
        request: {
          launch_profile_id: profile().profile_id,
          required_controls: {
            canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
            retry_cap: 0,
          },
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns an existing queued launch without forwarding the website intent again", async () => {
    const { server, url } = await startServer();
    const input = launchInput();
    try {
      const first = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(first.status).toBe(202);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);

      const replay = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await replay.json();
      expect(replay.status).toBe(200);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        already_exists: true,
        provider_mutation_performed_inside_web_request: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);
      expect(state.records.get("launch-001")?.forward_attempt_count).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("persists and forwards one explicit release-only recovery without reopening the launch", async () => {
    state.records.set("launch-001", terminalBlockedLaunchRecord());
    vi.stubGlobal("fetch", vi.fn(async (target: string, init?: RequestInit) => {
      if (target.startsWith("http://127.0.0.1:")) return realFetch(target, init);
      expect(target).toBe("https://pipeline.example/api/live-pipeline/task-evaluation-terminal-resource-releases");
      const request = JSON.parse(String(init?.body || "{}"));
      expect(request).toMatchObject({
        provider: "vast",
        instance_id: "47508030",
        expected_label: "blueprint-adp009d-1786496624",
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_terminal_resource_release_intake_receipt.v1",
        status: "accepted",
        provider_mutation_performed_inside_http_request: false,
        queue: {
          schema_version: "task_evaluation_terminal_resource_release_queue_receipt.v1",
          status: "queued",
          release_id: request.release_id,
          terminal_resource_release_digest: request.terminal_resource_release_digest,
          provider_mutation_performed: false,
        },
      }), { status: 202, headers: { "content-type": "application/json" } });
    }));
    const { server, url } = await startServer();
    const input = {
      provider: "vast",
      instance_id: "47508030",
      expected_label: "blueprint-adp009d-1786496624",
      confirm_terminal_resource_release: true,
    };
    try {
      const first = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      const body = await first.json();
      expect(first.status).toBe(202);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        launch_id: "launch-001",
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        state: "control_plane_terminal_blocked",
        terminal_resource_release: {
          state: "queued_in_pipeline",
          provider_mutation_observed: false,
          automatic_retry_performed: false,
          request: { instance_id: "47508030" },
        },
      });

      // A replay forwards the identical request again rather than echoing the
      // stored receipt. The WebApp never observes whether the Pipeline blocked
      // the release, so only the Pipeline can decide whether it may be
      // re-armed; echoing here left a Pipeline-blocked release unretryable.
      const replay = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(202);
      expect(await replay.json()).toMatchObject({
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target).startsWith("https://pipeline.example/"),
      )).toHaveLength(2);

      // A different instance under the same launch stays an immutable conflict
      // and must never reach the Pipeline.
      const conflict = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          ...input, instance_id: "47508031",
        }),
      });
      expect(conflict.status).toBe(409);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target).startsWith("https://pipeline.example/"),
      )).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("lets a delayed digest-bound Pipeline terminal receipt supersede a control-plane blocker", async () => {
    const requestDigest = sha("a");
    state.records.set("launch-001", {
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      state: "control_plane_terminal_blocked",
      control_plane_terminal_blocker: {
        code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
        execution_result: "not_observed",
      },
    });
    const receipt: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "completed",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 0,
      execute_requested: true,
      provider_mutation_attempted: true,
      terminal_evidence: { status: "passed" },
      blockers: [],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    const { server, url } = await startInternalServer();
    try {
      const response = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(receipt),
      });
      expect(response.status).toBe(201);
      expect(state.records.get("launch-001")).toMatchObject({
        state: "completed",
        terminal_receipt_digest: receipt.receipt_digest,
        terminal_receipt: { terminal_evidence: { status: "passed" } },
        control_plane_terminal_blocker: { execution_result: "not_observed" },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
