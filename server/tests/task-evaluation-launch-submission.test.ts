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
  blobs: new Map<string, Buffer>(),
  launchProfiles: null as Record<string, any>[] | null,
  launchForwardFailuresRemaining: 0,
  preparationForwardFailuresRemaining: 0,
  hangTransaction: false,
  isOps: true,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (id: string): any => ({
    id,
    collection: (name: string) => ({ doc: (child: string) => reference(`${id}/${name}/${child}`) }),
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
      collection: () => ({
        doc: reference,
        where: (field: string, operator: string, value: unknown) => ({
          limit: () => ({
            get: async () => ({
              docs: Array.from(state.records.entries())
                .filter(([, record]) => operator === "in" && Array.isArray(value)
                  ? value.includes(record[field])
                  : record[field] === value)
                .map(([id, record]) => ({
                  id,
                  data: () => structuredClone(record),
                })),
            }),
          }),
        }),
      }),
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
    storageAdmin: {
      bucket: (bucket: string) => ({
        file: (objectPath: string) => ({
          download: async () => {
            const value = state.blobs.get(`${bucket}/${objectPath}`);
            if (!value) throw new Error("fixture_blob_missing");
            return [value];
          },
        }),
      }),
    },
  };
});

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function profile() {
  return {
    profile_id: "interiorgs-sage-franka-001",
    profile_digest: sha("a"),
    source_commit: "b".repeat(40),
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
    task_evaluation_run: {
      run_mode: "scene_configuration",
      team_namespace: "robot-team-001",
      scene_id: "public-scene-001",
      task_id: "rigid-relocation",
      configuration_run_id: "scene-run-001",
      evaluation_episode_executed: false,
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
      maximum_hourly_rate_usd: 0.8, hard_cap_usd: 12, hard_ttl_seconds: 27_000,
      provider_compute_spend_cap_usd: 6,
      external_service_caps: {
        openai: {
          maximum_cost_usd: 6,
          maximum_requests: 32,
          stage_max_cost_usd: {
            artifixer_semantic_teacher: 4.8,
            artifixer_visual_review: 0.96,
            content_agents: 0.2,
          },
        },
      },
      retry_cap: 0, selected_provider: "vast", provider_allowlist: ["vast"],
    },
  };
}

async function startLaunchServer(): Promise<{ server: Server; url: string }> {
  // The founder's browser channel, with the context the admin launch route passed.
  const { submitTaskEvaluationLaunch } = await import("../utils/taskEvaluationLaunchSubmission");
  const app = express();
  app.use(express.json());
  app.post("/", (req, res) => submitTaskEvaluationLaunch(req, res, {
    actorId: "founder-001",
    actorRole: "admin",
    channel: "production_webapp_browser",
    serviceId: null,
    idempotencyKey: String(req.body?.launch_id || ""),
  }));
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
  state.blobs.clear();
  state.launchProfiles = null;
  state.launchForwardFailuresRemaining = 0;
  state.preparationForwardFailuresRemaining = 0;
  state.hangTransaction = false;
  state.isOps = true;
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
        profiles: state.launchProfiles || [profile()],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations") {
      if (state.preparationForwardFailuresRemaining > 0) {
        state.preparationForwardFailuresRemaining -= 1;
        return new Response(JSON.stringify({ error: "fixture-forward-unavailable" }), { status: 503 });
      }
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
    if (
      url === "https://pipeline.example/launches"
      && state.launchForwardFailuresRemaining > 0
    ) {
      state.launchForwardFailuresRemaining -= 1;
      return new Response(JSON.stringify({ error: "temporary intake refusal" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
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

describe("website Task Evaluation launch submission", () => {
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

  it("fails closed with an unknown persistence state when Firestore stalls", async () => {
    state.hangTransaction = true;
    process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS = "250";
    const { server, url } = await startLaunchServer();
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
    const { server, url } = await startLaunchServer();
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
    const { server, url } = await startLaunchServer();
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
});
