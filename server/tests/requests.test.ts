// @vitest-environment node
import { createServer } from "http";
import express from "express";
import type { Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

const requestDoc = vi.hoisted(() => ({
  data: {
    requestId: "req-1",
    site_submission_id: "req-1",
    createdAt: { toDate: () => new Date("2026-04-01T00:00:00Z") },
    status: "submitted",
    qualification_state: "submitted",
    opportunity_state: "not_applicable",
    priority: "normal",
    owner: {},
    contact: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      roleTitle: "Ops",
      company: "Analytical Engines",
    },
    request: {
      siteName: "Durham Facility",
      siteLocation: "Durham, NC",
      taskStatement: "Review a picking workflow.",
      workflowContext: "Backroom to staging handoff.",
      operatingConstraints: "Two shifts, restricted loading dock access.",
      privacySecurityConstraints: "No cameras in employee locker area.",
      knownBlockers: "Tight turn near the dock.",
      requestedLanes: [],
      buyerType: "robot_team",
    },
    context: {
      sourcePageUrl: "https://example.com",
      referrer: null,
      demandCity: null,
      buyerChannelSource: null,
      buyerChannelSourceCaptureMode: null,
      buyerChannelSourceRaw: null,
      utm: {},
    },
    enrichment: {},
    events: {},
    buyer_review_access: null,
    ops: null,
    pipeline: null,
    derived_assets: null,
    deployment_readiness: null,
  },
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => requestDoc.data,
        }),
      }),
    }),
  },
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (value: Record<string, unknown>) => value,
}));

vi.mock("../utils/request-review-auth", () => ({
  getRequestReviewCookieName: () => "request_review",
  verifyRequestReviewToken: () => true,
}));

vi.mock("../utils/hosted-session-ui-auth", () => ({
  parseCookies: () => ({}),
}));

async function startRouterServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: requestsRouter } = await import("../routes/requests");
  const app = express();
  app.use(express.json());
  app.use("/", requestsRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind requests test server");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

afterEach(() => {
  vi.resetModules();
});

describe("requests route", () => {
  it("defaults missing requested lanes based on buyer type when rendering a request", async () => {
    const { server, baseUrl } = await startRouterServer();

    try {
      const response = await fetch(`${baseUrl}/req-1?access=token`);

      expect(response.status).toBe(200);

      const json = (await response.json()) as {
        request?: { requestedLanes?: string[]; buyerType?: string };
      };

      expect(json.request?.buyerType).toBe("robot_team");
      expect(json.request?.requestedLanes).toEqual(["deeper_evaluation"]);
    } finally {
      await stopServer(server);
    }
  });
});
