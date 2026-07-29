// @vitest-environment node
import express from "express";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validDecisionRequest } from "./helpers/decision-evidence-fixtures";

const firestoreState = vi.hoisted(() => ({
  collectionDocData: {} as Record<string, Record<string, Record<string, unknown>>>,
  collectionWrites: [] as Array<{
    collection: string;
    id: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>,
}));

function buildQuery(
  name: string,
  filters: Array<{ field: string; value: unknown }> = [],
): {
  where: (field: string, op: string, value: unknown) => ReturnType<typeof buildQuery>;
  limit: (_limit: number) => ReturnType<typeof buildQuery>;
  get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
} {
  return {
    where: (field: string, _op: string, value: unknown) =>
      buildQuery(name, [...filters, { field, value }]),
    limit: (_limit: number) => buildQuery(name, filters),
    get: async () => ({
      docs: Object.entries(firestoreState.collectionDocData[name] || {})
        .filter(([, data]) =>
          filters.every((filter) => data[filter.field] === filter.value),
        )
        .map(([id, data]) => ({
          id,
          data: () => data,
        })),
    }),
  };
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ mocked: true }),
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = firestoreState.collectionDocData[name]?.[id];
          return {
            exists: Boolean(data),
            id,
            data: () => data || {},
          };
        },
        set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
          firestoreState.collectionWrites.push({ collection: name, id, payload, options });
          firestoreState.collectionDocData[name] = firestoreState.collectionDocData[name] || {};
          firestoreState.collectionDocData[name][id] = options?.merge
            ? {
                ...(firestoreState.collectionDocData[name][id] || {}),
                ...payload,
              }
            : { ...payload };
        },
      }),
      where: (field: string, _op: string, value: unknown) =>
        buildQuery(name, [{ field, value }]),
    }),
  },
  // WEB-02: POST now requires an authenticated buyer (verifyFirebaseToken).
  authAdmin: {
    verifyIdToken: async (token: string) => ({ uid: token }),
  },
}));

type StartedServer = {
  baseUrl: string;
  server: Server;
};

async function startExpressServer(app: express.Express): Promise<StartedServer> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function startRobotEvalRoute() {
  const { default: router } = await import("../routes/robot-eval-job-requests");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/robot-eval/job-requests", router);
  return startExpressServer(app);
}

async function startPipelineStub(
  handler: (body: Record<string, unknown>, headers: Headers) => {
    status: number;
    body: Record<string, unknown>;
  },
) {
  const received: Array<{
    body: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
  }> = [];
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.post("/api/live-pipeline/job-requests", (req, res) => {
    received.push({ body: req.body, headers: req.headers });
    const response = handler(req.body, new Headers(req.headers as Record<string, string>));
    res.status(response.status).json(response.body);
  });
  return {
    ...(await startExpressServer(app)),
    received,
  };
}

function buildRequest(_captureRoot: string) {
  return validDecisionRequest({
    owner: { user_id: "robot-team-a", authenticated_by: "firebase" },
    authorization: { entitlement_id: "ent-sw-chi-01" },
  });
}

const csrfHeaders = {
  "content-type": "application/json",
  authorization: "Bearer robot-team-a",
  cookie: "csrf_token=route-test-token",
  "x-csrf-token": "route-test-token",
};

function seedProvisionedEntitlement(overrides: Record<string, unknown> = {}) {
  firestoreState.collectionDocData.marketplaceEntitlements = {
    "ent-sw-chi-01": {
      id: "ent-sw-chi-01",
      buyer_user_id: "robot-team-a",
      sku: "testbed-001",
      access_state: "provisioned",
      site_id: "site-001",
      ...overrides,
    },
  };
}

beforeEach(() => {
  // Buyer intake is beta-cohort gated (fail-closed); give the tests explicit
  // open capacity so they exercise entitlement/forwarding behavior.
  vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "10");
  vi.stubEnv("BLUEPRINT_BETA_COHORT_DAILY_LIMIT", "10");
});

afterEach(() => {
  firestoreState.collectionDocData = {};
  firestoreState.collectionWrites = [];
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robot-eval job request route forwarding", () => {
  it("requires CSRF protection on authenticated browser intake", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-run-route-inbox-"));
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    const route = await startRobotEvalRoute();
    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer robot-team-a" },
        body: JSON.stringify(buildRequest(inboxDir)),
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "Invalid CSRF token" });
      expect(firestoreState.collectionWrites).toHaveLength(0);
    } finally {
      await stopServer(route.server);
      await fs.rm(inboxDir, { recursive: true, force: true });
    }
  });

  it("durably records an unentitled request as awaiting authorization and is idempotent", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-run-route-inbox-"));
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    const request = buildRequest(inboxDir);
    delete request.authorization;
    const route = await startRobotEvalRoute();
    try {
      const first = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(request),
      });
      expect(first.status).toBe(202);
      await expect(first.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          status: "awaiting_authorization",
          pipelineForward: expect.objectContaining({
            performed: false,
            blockers: ["authorization_required_before_pipeline_submission"],
          }),
        }),
      );
      const second = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(request),
      });
      expect(second.status).toBe(200);
      await expect(second.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          already_exists: true,
          status: "awaiting_authorization",
          idempotency_key: request.idempotency.key,
        }),
      );
    } finally {
      await stopServer(route.server);
      await fs.rm(inboxDir, { recursive: true, force: true });
    }
  });

  it("fails closed when a local entitlement proof omits access_state", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const jobRequest = buildRequest(path.join(inboxDir, "captures", "sw-chi-01"));
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    vi.stubEnv(
      "BLUEPRINT_LOCAL_ROBOT_EVAL_ENTITLEMENT_PROOF_JSON",
      JSON.stringify({
        buyer_user_id: "robot-team-a",
        sku: "testbed-001",
        site_id: "site-001",
      }),
    );
    const route = await startRobotEvalRoute();

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload).toEqual(
        expect.objectContaining({
          ok: false,
          status: "awaiting_authorization",
          code: "invalid_local_robot_eval_entitlement_proof",
          error: expect.stringContaining("must explicitly include access_state"),
        }),
      );
      expect(firestoreState.collectionWrites).toHaveLength(0);
    } finally {
      await stopServer(route.server);
    }
  });

  it("blocks buyer robot-eval access before entitlement checks, inbox writes, or forwarding when beta is paused", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    vi.stubEnv("BLUEPRINT_BETA_KILL_SWITCH", "1");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    const route = await startRobotEvalRoute();

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload).toEqual(
        expect.objectContaining({
          ok: false,
          status: "beta_cohort_denied",
          code: "beta_kill_switch_active",
          beta_cohort_policy: expect.objectContaining({
            allowed: false,
            reason: "beta_kill_switch_active",
            kill_switch_active: true,
          }),
        }),
      );
      await expect(fs.readdir(inboxDir)).resolves.toEqual([]);
      expect(firestoreState.collectionWrites).toEqual([]);
    } finally {
      await stopServer(route.server);
      await fs.rm(inboxDir, { recursive: true, force: true });
    }
  });

  it("returns 403 and does not write the inbox when no provisioned buyer entitlement matches", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    const route = await startRobotEvalRoute();

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload).toEqual(
        expect.objectContaining({
          ok: false,
          status: "awaiting_authorization",
          code: "robot_eval_provisioned_entitlement_not_found",
        }),
      );
      await expect(fs.readdir(inboxDir)).resolves.toEqual([]);
      expect(firestoreState.collectionWrites).toEqual([]);
    } finally {
      await stopServer(route.server);
      await fs.rm(inboxDir, { recursive: true, force: true });
    }
  });

  it("keeps the durable inbox and returns 502 when Pipeline forwarding is not configured", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    seedProvisionedEntitlement();
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL", "");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE", "true");
    const route = await startRobotEvalRoute();

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload.status).toBe("blocked");
      expect(payload.error).toMatch(/forwarding is not configured/i);
      expect(payload.durableStore).toEqual(
        expect.objectContaining({
          status: "pipeline_inbox_only",
          performed: false,
          firestore: expect.objectContaining({
            status: "disabled",
            performed: false,
          }),
          pipeline_inbox: expect.objectContaining({
            status: "stored",
            performed: true,
            queue_contract: "blueprint.decision_evidence_request_inbox.v1",
          }),
          pipeline_forward: expect.objectContaining({
            status: "not_configured",
            performed: false,
            required: true,
          }),
        }),
      );
      expect(payload.pipelineForward).toEqual(
        expect.objectContaining({
          status: "not_configured",
          performed: false,
          endpoint_configured: false,
          required: true,
        }),
      );
      await expect(fs.access(payload.pipelineInbox.job_request_path)).resolves.toBeUndefined();
      expect(payload.entitlementProof).toEqual(
        expect.objectContaining({
          entitlement_id: "ent-sw-chi-01",
          access_state: "provisioned",
        }),
      );
    } finally {
      await stopServer(route.server);
    }
  });

  it("writes the durable inbox and returns 202 when required Pipeline forwarding succeeds", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    seedProvisionedEntitlement();
    const pipeline = await startPipelineStub(() => ({
      status: 200,
      body: {
        accepted: true,
        status: "staged_for_control_plane",
        input_blockers: [],
      },
    }));
    const route = await startRobotEvalRoute();
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    vi.stubEnv(
      "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
      `${pipeline.baseUrl}/api/live-pipeline/job-requests`,
    );
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-forward-token");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED", "true");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE", "true");

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(202);
      expect(payload.status).toBe("submitted");
      expect(payload.durableStore).toEqual(
        expect.objectContaining({
          status: "pipeline_inbox_only",
          performed: false,
          firestore: expect.objectContaining({
            status: "disabled",
            performed: false,
            collection: "robotEvalJobRequests",
            doc_id: jobRequest.request_id,
          }),
          pipeline_inbox: expect.objectContaining({
            status: "stored",
            performed: true,
            queue_contract: "blueprint.decision_evidence_request_inbox.v1",
          }),
          pipeline_forward: expect.objectContaining({
            status: "forwarded",
            performed: true,
            accepted: true,
            required: true,
            pipeline_status: "staged_for_control_plane",
          }),
        }),
      );
      expect(payload.pipelineForward).toEqual(
        expect.objectContaining({
          status: "forwarded",
          performed: true,
          required: true,
          accepted: true,
          pipeline_status: "staged_for_control_plane",
        }),
      );
      expect(payload.pipelineInbox.queue_contract).toBe(
        "blueprint.decision_evidence_request_inbox.v1",
      );
      await expect(fs.access(payload.pipelineInbox.job_request_path)).resolves.toBeUndefined();
      expect(pipeline.received).toHaveLength(1);
      expect(pipeline.received[0].headers.authorization).toBeUndefined();
      expect(pipeline.received[0].headers["x-blueprint-pipeline-signature"]).toEqual(
        expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
      );
      expect(pipeline.received[0].headers["x-blueprint-pipeline-timestamp"]).toEqual(
        expect.any(String),
      );
      expect(pipeline.received[0].headers["x-blueprint-pipeline-nonce"]).toEqual(
        expect.any(String),
      );
      expect(pipeline.received[0].body).toEqual(
        expect.objectContaining({
          queue_contract: "blueprint.decision_evidence_request_inbox.v1",
          pipeline_consumer: "BlueprintCapturePipeline",
          request_id: jobRequest.request_id,
        }),
      );
      expect(
        (pipeline.received[0].body.decision_request as Record<string, unknown>).authorization,
      ).toEqual(
        expect.objectContaining({
          entitlement_id: "ent-sw-chi-01",
          access_state: "provisioned",
          verified_by: "server_marketplace_entitlement",
        }),
      );
      expect(payload.entitlementProof).toEqual(
        expect.objectContaining({
          entitlement_id: "ent-sw-chi-01",
          access_state: "provisioned",
        }),
      );
      expect(JSON.stringify(payload)).not.toContain("test-forward-token");
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });

  it("keeps the durable inbox and returns 502 when required Pipeline forwarding fails closed", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-route-inbox-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    seedProvisionedEntitlement();
    const pipeline = await startPipelineStub(() => ({
      status: 422,
      body: {
        detail: {
          accepted: false,
          status: "blocked",
          input_blockers: [
            "webapp:request_capture_root_does_not_match_control_plane",
          ],
        },
      },
    }));
    const route = await startRobotEvalRoute();
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
    vi.stubEnv(
      "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
      `${pipeline.baseUrl}/api/live-pipeline/job-requests`,
    );
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-forward-token");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED", "true");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE", "true");

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload.status).toBe("blocked");
      expect(payload.error).toMatch(/capture root does not match/i);
      expect(payload.durableStore).toEqual(
        expect.objectContaining({
          status: "pipeline_inbox_only",
          performed: false,
          firestore: expect.objectContaining({
            status: "disabled",
            performed: false,
            collection: "robotEvalJobRequests",
            doc_id: jobRequest.request_id,
          }),
          pipeline_inbox: expect.objectContaining({
            status: "stored",
            performed: true,
            queue_contract: "blueprint.decision_evidence_request_inbox.v1",
          }),
          pipeline_forward: expect.objectContaining({
            status: "failed",
            performed: false,
            accepted: false,
            required: true,
          }),
        }),
      );
      expect(payload.pipelineForward).toEqual(
        expect.objectContaining({
          status: "failed",
          performed: false,
          required: true,
          http_status: 422,
          input_blockers: [
            "webapp:request_capture_root_does_not_match_control_plane",
          ],
        }),
      );
      expect(payload.pipelineInbox.queue_contract).toBe(
        "blueprint.decision_evidence_request_inbox.v1",
      );
      await expect(fs.access(payload.pipelineInbox.job_request_path)).resolves.toBeUndefined();
      expect(pipeline.received).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toContain("test-forward-token");
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });
});
