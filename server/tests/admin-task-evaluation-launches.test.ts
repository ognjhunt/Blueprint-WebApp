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
