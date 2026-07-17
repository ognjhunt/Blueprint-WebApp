// @vitest-environment node
import express from "express";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  collectionDocData: {} as Record<string, Record<string, Record<string, unknown>>>,
  collectionWrites: [] as Array<{
    collection: string;
    id: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>,
}));

const stripeState = vi.hoisted(() => ({
  sessionCreates: [] as Array<Record<string, unknown>>,
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
  authAdmin: {
    verifyIdToken: async (token: string) => ({ uid: token, email: `${token}@example.com` }),
  },
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          stripeState.sessionCreates.push(params);
          return {
            id: "cs_test_robot_eval",
            url: "https://checkout.stripe.com/pay/cs_test_robot_eval",
            livemode: false,
          };
        },
      },
    };

    constructor(_key: string, _options?: unknown) {}
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

const BUYER_UID = "robot-team-buyer";
const BUYER_EMAIL = "buyer@example.com";

async function startCheckoutRoute() {
  const { default: handler } = await import("../routes/api/create-checkout-session");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.post(
    "/api/create-checkout-session",
    (req, res, next) => {
      if (req.headers.authorization === `Bearer ${BUYER_UID}`) {
        res.locals.firebaseUser = { uid: BUYER_UID, email: BUYER_EMAIL };
      }
      next();
    },
    handler,
  );
  return startExpressServer(app);
}

async function postCheckout(
  route: StartedServer,
  body: Record<string, unknown>,
  authorized = true,
) {
  const response = await fetch(`${route.baseUrl}/api/create-checkout-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: `Bearer ${BUYER_UID}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, payload };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock_robot_eval_key");
  // The checkout module resolves success/cancel URLs against its allowed-origin
  // fallback chain; pin a concrete origin so ambient test env values (e.g.
  // BASE_URL="/") don't produce unparseable URLs.
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:5173");
  vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "10");
  vi.stubEnv("BLUEPRINT_BETA_COHORT_DAILY_LIMIT", "10");
});

afterEach(() => {
  firestoreState.collectionDocData = {};
  firestoreState.collectionWrites = [];
  stripeState.sessionCreates = [];
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robot-eval-run checkout session", () => {
  it("rejects unauthenticated buyers", async () => {
    const route = await startCheckoutRoute();
    try {
      const { response } = await postCheckout(
        route,
        { sessionType: "robot-eval-run", robotEvalRun: { siteSlug: "sw-chi-01" } },
        false,
      );
      expect(response.status).toBe(401);
      expect(firestoreState.collectionWrites).toEqual([]);
      expect(stripeState.sessionCreates).toEqual([]);
    } finally {
      await stopServer(route.server);
    }
  });

  it("rejects unknown sites and sites without a publication-ready eval package", async () => {
    const { siteLibrarySites } = await import("../../client/src/data/siteLibrary");
    const unpublishedSite = siteLibrarySites.find(
      (site) => !site.robotEvalPublication?.readyToEvaluatePublishable,
    );
    expect(unpublishedSite).toBeTruthy();

    const route = await startCheckoutRoute();
    try {
      const unknown = await postCheckout(route, {
        sessionType: "robot-eval-run",
        robotEvalRun: { siteSlug: "no-such-site" },
      });
      expect(unknown.response.status).toBe(404);

      const notReady = await postCheckout(route, {
        sessionType: "robot-eval-run",
        robotEvalRun: { siteSlug: unpublishedSite?.slug },
      });
      expect(notReady.response.status).toBe(409);

      expect(firestoreState.collectionWrites).toEqual([]);
      expect(stripeState.sessionCreates).toEqual([]);
    } finally {
      await stopServer(route.server);
    }
  });

  it("does not create an order or Stripe session when the beta cohort gate is closed", async () => {
    vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "0");
    const route = await startCheckoutRoute();
    try {
      const { response, payload } = await postCheckout(route, {
        sessionType: "robot-eval-run",
        robotEvalRun: { siteSlug: "sw-chi-01" },
      });
      expect(response.status).toBe(503);
      expect(payload).toEqual(
        expect.objectContaining({ code: "beta_intake_closed" }),
      );
      expect(firestoreState.collectionWrites).toEqual([]);
      expect(stripeState.sessionCreates).toEqual([]);
    } finally {
      await stopServer(route.server);
    }
  });

  it("creates a catalog-priced order + checkout session whose paid webhook provisions an entitlement the job-request route accepts", async () => {
    const { siteLibrarySites } = await import("../../client/src/data/siteLibrary");
    const { premiumCapabilities } = await import("../../client/src/data/content");
    const site = siteLibrarySites.find(
      (candidate) =>
        candidate.robotEvalPublication?.readyToEvaluatePublishable &&
        candidate.defaultRobotEvalSelection,
    );
    expect(site).toBeTruthy();
    if (!site) {
      return;
    }
    const catalogPrice = premiumCapabilities.find(
      (capability) => capability.slug === "policy-benchmarking",
    )?.price;
    expect(typeof catalogPrice).toBe("number");

    const route = await startCheckoutRoute();
    try {
      const { response, payload } = await postCheckout(route, {
        sessionType: "robot-eval-run",
        robotEvalRun: { siteSlug: site.slug },
      });

      expect(response.status).toBe(200);
      expect(payload).toEqual(
        expect.objectContaining({
          sessionId: "cs_test_robot_eval",
          sessionUrl: "https://checkout.stripe.com/pay/cs_test_robot_eval",
        }),
      );

      const orderWrite = firestoreState.collectionWrites.find(
        (write) => write.collection === "buyerOrders",
      );
      expect(orderWrite).toBeTruthy();
      const order = orderWrite?.payload as Record<string, any>;
      expect(order.buyer_user_id).toBe(BUYER_UID);
      expect(order.item.sku).toBe(`${site.slug}-robot-eval-run`);
      expect(order.item.item_type).toBe("robot_eval_run");
      // hosted_runtime is a provisionable delivery mode, so payment provisions
      // the entitlement without manual review and without hourly expiry.
      expect(order.item.delivery_mode).toBe("hosted_runtime");
      expect(order.pricing.unit_amount_cents).toBe(Math.round((catalogPrice as number) * 100));

      const sessionParams = stripeState.sessionCreates[0] as Record<string, any>;
      expect(sessionParams.mode).toBe("payment");
      expect(sessionParams.client_reference_id).toBe(order.id);
      expect(String(sessionParams.success_url)).toContain(
        `/sites/${site.slug}?robotEvalCheckout=success`,
      );
      expect(sessionParams.metadata.sessionKind).toBe("robot_eval_run");

      // Simulate the Stripe checkout.session.completed webhook.
      const { markBuyerOrderPaidFromCheckout } = await import("../utils/accounting");
      const paidOrder = await markBuyerOrderPaidFromCheckout({
        orderId: order.id,
        checkoutSessionId: "cs_test_robot_eval",
        paymentIntentId: "pi_test_robot_eval",
        customerId: "cus_test_robot_eval",
        livemode: false,
        eventId: "evt_test_robot_eval",
        eventType: "checkout.session.completed",
      });
      expect(paidOrder?.entitlement_id).toBeTruthy();

      const entitlement =
        firestoreState.collectionDocData.marketplaceEntitlements?.[
          String(paidOrder?.entitlement_id)
        ];
      expect(entitlement).toEqual(
        expect.objectContaining({
          buyer_user_id: BUYER_UID,
          sku: `${site.slug}-robot-eval-run`,
          access_state: "provisioned",
          expires_at: null,
        }),
      );

      // The provisioned entitlement must satisfy the job-request gate end to
      // end, including the HMAC-signed forward to the Pipeline intake stub.
      const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-checkout-inbox-"));
      const pipelineReceived: Array<Record<string, unknown>> = [];
      const pipelineApp = express();
      pipelineApp.use(express.json({ limit: "1mb" }));
      pipelineApp.post("/api/live-pipeline/job-requests", (req, res) => {
        pipelineReceived.push(req.body as Record<string, unknown>);
        res.status(200).json({
          accepted: true,
          status: "staged_for_control_plane",
          input_blockers: [],
        });
      });
      const pipelineStub = await startExpressServer(pipelineApp);
      vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_INBOX_DIR", inboxDir);
      vi.stubEnv(
        "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
        `${pipelineStub.baseUrl}/api/live-pipeline/job-requests`,
      );
      vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-forward-token");
      vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED", "true");
      const { buildRobotEvalJobRequest } = await import("../utils/robotEvalJobRequests");
      const captureRoot = path.join(inboxDir, "captures", site.slug);
      const lineage = site.captureLineage;
      const jobRequest = buildRobotEvalJobRequest({
        sitePackage: {
          siteSlug: site.slug,
          siteId: `site-${site.slug}`,
          siteName: site.name,
          siteSubmissionId: lineage?.siteSubmissionId || `site-submission-${site.slug}`,
          captureJobId: lineage?.captureJobId || `capture-job-${site.slug}`,
          captureId: lineage?.captureId || `capture-${site.slug}`,
          captureRoot,
          pipelinePrefix: `${captureRoot}/pipeline`,
          accessState: "request_gated",
          artifactUris: {
            manifestUri: `${captureRoot}/pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json`,
            taskCardsUri: `${captureRoot}/pipeline/robot_eval_dataset/task_cards.json`,
            scenarioCardsUri: `${captureRoot}/pipeline/robot_eval_dataset/scenario_cards.json`,
            evalCardsUri: `${captureRoot}/pipeline/robot_eval_dataset/eval_cards.json`,
            proofBoundariesUri: `${captureRoot}/pipeline/robot_eval_dataset/proof_boundaries.json`,
            taskThresholdsUri: `${captureRoot}/pipeline/robot_eval_dataset/task_thresholds.json`,
            publicationReadinessUri: `${captureRoot}/pipeline/robot_eval_dataset/publication_readiness.json`,
            sceneAssetInventoryUri: `${captureRoot}/pipeline/simulation_automation/scene_asset_inventory.json`,
            sceneAssetDependencyAuditUri: `${captureRoot}/pipeline/simulation_automation/scene_asset_dependency_audit.json`,
            cpuPreflightScorecardUri: `${captureRoot}/pipeline/simulation_automation/cpu_preflight_scorecard.json`,
            episodeSpecManifestUri: `${captureRoot}/pipeline/simulation_automation/episode_spec_manifest.json`,
            cpuSimulatorPreflightManifestUri: `${captureRoot}/pipeline/simulation_automation/cpu_simulator_preflight_manifest.json`,
            gpuHandoffPacketUri: `${captureRoot}/pipeline/simulation_automation/gpu_handoff_packet.json`,
          },
          publication: {
            readyToEvaluatePublishable: true,
            publicationLabel: "Ready to evaluate",
          },
        },
        selection: {
          taskId: site.defaultRobotEvalSelection?.taskId || "walk_to_target",
          scenarioId: site.defaultRobotEvalSelection?.scenarioId || "scenario_default",
          robotProfileId:
            site.defaultRobotEvalSelection?.robotProfileId || "mobile_manipulator_rgb_v1",
          policyId: site.defaultRobotEvalSelection?.policyId || "policy-api-fixture",
        },
        robotTeam: {
          customerId: BUYER_UID,
          companyName: "Robot Team Buyer",
          contactEmail: BUYER_EMAIL,
        },
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
        source: {
          route: `/sites/${site.slug}`,
          surface: "site-detail",
        },
      });

      const { default: jobRequestsRouter } = await import(
        "../routes/robot-eval-job-requests"
      );
      const jobApp = express();
      jobApp.use(express.json({ limit: "1mb" }));
      jobApp.use("/api/robot-eval/job-requests", jobRequestsRouter);
      const jobRoute = await startExpressServer(jobApp);
      try {
        const jobResponse = await fetch(`${jobRoute.baseUrl}/api/robot-eval/job-requests`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${BUYER_UID}`,
          },
          body: JSON.stringify(jobRequest),
        });
        const jobPayload = (await jobResponse.json()) as Record<string, any>;

        expect(jobResponse.status).toBe(202);
        expect(jobPayload).toEqual(
          expect.objectContaining({ ok: true, status: "queued_for_pipeline" }),
        );
        expect(jobPayload.entitlementProof).toEqual(
          expect.objectContaining({
            entitlement_id: String(paidOrder?.entitlement_id),
            access_state: "provisioned",
          }),
        );
        expect(jobPayload.pipelineForward).toEqual(
          expect.objectContaining({ status: "forwarded", performed: true, accepted: true }),
        );
        expect(pipelineReceived).toHaveLength(1);
        expect(pipelineReceived[0]).toEqual(
          expect.objectContaining({
            queue_contract: "robot_eval_job_request_inbox.v1",
            pipeline_consumer: "BlueprintCapturePipeline",
          }),
        );

        // A paid robot-eval-run entitlement covers exactly one accepted run:
        // the accepted request consumes it, and a replay is rejected.
        const consumedEntitlement =
          firestoreState.collectionDocData.marketplaceEntitlements?.[
            String(paidOrder?.entitlement_id)
          ];
        expect(consumedEntitlement).toEqual(
          expect.objectContaining({
            access_state: "consumed",
            consumed_by_job_id: jobRequest.job_id,
          }),
        );

        const replayResponse = await fetch(
          `${jobRoute.baseUrl}/api/robot-eval/job-requests`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${BUYER_UID}`,
            },
            body: JSON.stringify(jobRequest),
          },
        );
        const replayPayload = (await replayResponse.json()) as Record<string, unknown>;
        expect(replayResponse.status).toBe(403);
        expect(replayPayload).toEqual(
          expect.objectContaining({
            code: "robot_eval_provisioned_entitlement_not_found",
          }),
        );
        expect(pipelineReceived).toHaveLength(1);
      } finally {
        await stopServer(jobRoute.server);
        await stopServer(pipelineStub.server);
        await fs.rm(inboxDir, { recursive: true, force: true });
      }
    } finally {
      await stopServer(route.server);
    }
  });
});
