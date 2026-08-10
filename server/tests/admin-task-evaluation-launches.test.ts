// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_TASK_EVALUATION_ALLOCATOR } from "../utils/taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const realFetch = globalThis.fetch.bind(globalThis);

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
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
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => callback({
        get: async (ref: ReturnType<typeof reference>) => ref.get(),
        create: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>) => {
          state.records.set(ref.id, structuredClone(payload));
        },
        set: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          state.records.set(ref.id, options?.merge
            ? { ...(state.records.get(ref.id) || {}), ...structuredClone(payload) }
            : structuredClone(payload));
        },
      }),
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

beforeEach(() => {
  state.records.clear();
  process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = JSON.stringify([profile()]);
  process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/launches";
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "forward-secret";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("http://127.0.0.1:")) {
      return realFetch(url, init);
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
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
});

describe("admin Task Evaluation launch route", () => {
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
        String(target).startsWith("https://pipeline.example/"),
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
        String(target).startsWith("https://pipeline.example/"),
      )).toHaveLength(1);
      expect(state.records.get("launch-001")?.forward_attempt_count).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("stores a digest-bound Pipeline terminal receipt on the same launch record", async () => {
    const requestDigest = sha("a");
    state.records.set("launch-001", {
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      state: "queued_in_pipeline",
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
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
