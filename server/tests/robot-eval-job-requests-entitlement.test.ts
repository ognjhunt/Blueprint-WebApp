// @vitest-environment node
import express from "express";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRobotEvalJobRequest } from "../utils/robotEvalJobRequests";

// R030: the POST "/" handler must verify a real marketplace entitlement for the
// (buyer uid, site) before persisting/forwarding, and must never trust the
// client-supplied entitlement.approved. This suite runs with Firestore present
// (the sibling robot-eval-job-requests-route.test.ts runs with dbAdmin: null and
// covers the db-not-configured tolerance path).
const state = vi.hoisted(() => ({
  entitlements: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ collection: string; id: string; data: Record<string, unknown> }>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const dbAdmin = {
    collection: (name: string) => ({
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: (name === "marketplaceEntitlements" ? state.entitlements : [])
            .filter(
              (ent) =>
                String((ent as Record<string, unknown>)[field] ?? "") ===
                String(value ?? ""),
            )
            .map((ent) => ({
              id: String((ent as Record<string, unknown>).id || ""),
              data: () => ent,
            })),
        }),
      }),
      doc: (id: string) => ({
        get: async () => ({ exists: false, data: () => undefined }),
        set: async (data: Record<string, unknown>) => {
          state.writes.push({ collection: name, id, data });
        },
      }),
    }),
  };
  return {
    default: {
      firestore: { FieldValue: { serverTimestamp: () => ({ mocked: true }) } },
    },
    dbAdmin,
    authAdmin: {
      verifyIdToken: async (token: string) => ({ uid: token }),
    },
  };
});

type StartedServer = { baseUrl: string; server: Server };

async function startExpressServer(app: express.Express): Promise<StartedServer> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
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

async function startPipelineStub() {
  const received: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.post("/api/live-pipeline/job-requests", (req, res) => {
    received.push(req.body);
    res.status(200).json({ accepted: true, status: "staged_for_control_plane", input_blockers: [] });
  });
  return { ...(await startExpressServer(app)), received };
}

function buildRequest(captureRoot: string, entitlementOverride?: Record<string, unknown>) {
  const jobRequest = buildRobotEvalJobRequest({
    sitePackage: {
      siteSlug: "sw-chi-01",
      siteId: "site-sw-chi-01",
      siteName: "Harborview Grocery Distribution Annex",
      siteSubmissionId: "site-submission-sw-chi-01",
      captureJobId: "capture-job-sw-chi-01",
      captureId: "capture-sw-chi-01",
      captureRoot,
      pipelinePrefix: `${captureRoot}/pipeline`,
      accessState: "request_gated",
      artifactUris: {
        manifestUri: `${captureRoot}/pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json`,
        taskThresholdsUri: `${captureRoot}/pipeline/robot_eval_dataset/task_thresholds.json`,
        publicationReadinessUri: `${captureRoot}/pipeline/robot_eval_dataset/publication_readiness.json`,
      },
      publication: {
        readyToEvaluatePublishable: true,
        publicationLabel: "Ready to evaluate",
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
    // Client-supplied entitlement: a forged "approved" claim that must be ignored.
    entitlement: {
      accessState: "request_gated",
      approved: true,
    },
    policySubmission: {
      policy_api_endpoint: {
        endpoint_url: "https://robot-team.example/policy",
        observation_schema_ref: "schemas/obs-v1.json",
        action_schema_ref: "schemas/action-v1.json",
      },
    },
    source: { route: "/sites/sw-chi-01", surface: "sites" },
  }) as Record<string, unknown>;
  if (entitlementOverride) {
    jobRequest.entitlement = entitlementOverride;
  }
  return jobRequest;
}

function provisionedEntitlement(overrides: Record<string, unknown> = {}) {
  return {
    id: "ent-real-1",
    buyer_user_id: "robot-team-a",
    sku: "robot-eval-capture-sw-chi-01",
    access_state: "provisioned",
    ...overrides,
  };
}

async function stubForwardingEnv(inboxDir: string, pipelineBaseUrl: string) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
  vi.stubEnv(
    "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
    `${pipelineBaseUrl}/api/live-pipeline/job-requests`,
  );
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-forward-token");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED", "true");
}

afterEach(() => {
  state.entitlements.length = 0;
  state.writes.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robot-eval job request route entitlement enforcement (R030)", () => {
  it("rejects an authed buyer with no provisioned entitlement for the site (403, no forward/write)", async () => {
    // Buyer holds a provisioned entitlement, but for a DIFFERENT site.
    state.entitlements.push(
      provisionedEntitlement({ id: "ent-other", sku: "robot-eval-some-other-site" }),
    );
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-ent-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    const pipeline = await startPipelineStub();
    const route = await startRobotEvalRoute();
    await stubForwardingEnv(inboxDir, pipeline.baseUrl);

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer robot-team-a" },
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.code).toBe("no_entitlement_for_site");
      // No job was forwarded to the Pipeline and no Firestore record was written.
      expect(pipeline.received).toHaveLength(0);
      expect(state.writes).toHaveLength(0);
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });

  it("rejects when the only site entitlement is revoked, despite client approved=true (403)", async () => {
    state.entitlements.push(provisionedEntitlement({ access_state: "revoked" }));
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-ent-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    const pipeline = await startPipelineStub();
    const route = await startRobotEvalRoute();
    await stubForwardingEnv(inboxDir, pipeline.baseUrl);

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer robot-team-a" },
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.code).toBe("no_entitlement_for_site");
      expect(pipeline.received).toHaveLength(0);
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });

  it("proceeds with a provisioned entitlement and ignores the client-supplied entitlement.approved", async () => {
    state.entitlements.push(provisionedEntitlement());
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-ent-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    // Client forges an entitlement block: a bogus approved flag + fake id/state.
    const jobRequest = buildRequest(captureRoot, {
      access_state: "totally-bogus-client-state",
      entitlement_id: "client-forged-999",
      approved: true,
    });
    const pipeline = await startPipelineStub();
    const route = await startRobotEvalRoute();
    await stubForwardingEnv(inboxDir, pipeline.baseUrl);

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer robot-team-a" },
        body: JSON.stringify(jobRequest),
      });
      const payload = await response.json();

      expect(response.status).toBe(202);
      expect(payload.status).toBe("queued_for_pipeline");
      expect(pipeline.received).toHaveLength(1);

      // The entitlement block that was forwarded/persisted is server-derived, not
      // the client's forged one.
      const forwardedEntitlement = (
        pipeline.received[0].job_request as Record<string, unknown>
      ).entitlement as Record<string, unknown>;
      expect(forwardedEntitlement).toEqual(
        expect.objectContaining({
          access_state: "provisioned",
          entitlement_id: "ent-real-1",
          approved: true,
          buyer_user_id: "robot-team-a",
          sku: "robot-eval-capture-sw-chi-01",
          verified_by: "server_marketplace_entitlement_check",
        }),
      );
      // The client's forged identifiers were stripped.
      expect(forwardedEntitlement.entitlement_id).not.toBe("client-forged-999");
      expect(forwardedEntitlement.access_state).not.toBe("totally-bogus-client-state");
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });

  it("matches an entitlement by a direct site_submission_id link (not only by sku)", async () => {
    state.entitlements.push(
      provisionedEntitlement({
        id: "ent-direct",
        sku: "unrelated-sku",
        site_submission_id: "site-submission-sw-chi-01",
      }),
    );
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-ent-"));
    const captureRoot = path.join(inboxDir, "captures", "sw-chi-01");
    const jobRequest = buildRequest(captureRoot);
    const pipeline = await startPipelineStub();
    const route = await startRobotEvalRoute();
    await stubForwardingEnv(inboxDir, pipeline.baseUrl);

    try {
      const response = await fetch(`${route.baseUrl}/api/robot-eval/job-requests`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer robot-team-a" },
        body: JSON.stringify(jobRequest),
      });

      expect(response.status).toBe(202);
      expect(pipeline.received).toHaveLength(1);
      const forwardedEntitlement = (
        pipeline.received[0].job_request as Record<string, unknown>
      ).entitlement as Record<string, unknown>;
      expect(forwardedEntitlement.entitlement_id).toBe("ent-direct");
    } finally {
      await stopServer(route.server);
      await stopServer(pipeline.server);
    }
  });
});
