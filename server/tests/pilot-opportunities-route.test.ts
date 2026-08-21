// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  requests: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (id: string) => ({
            get: async () => ({
              exists: state.users.has(id),
              data: () => state.users.get(id),
            }),
          }),
        };
      }
      return {
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              docs: [...state.requests.entries()].map(([id, data]) => ({
                id,
                data: () => data,
              })),
            }),
          }),
        }),
      };
    },
  },
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (record: Record<string, unknown>) => record,
}));

function opportunityRecord(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "opportunity-1",
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    request: {
      buyerType: "site_operator",
      siteName: "North line",
      siteLocation: "Chicago, IL",
      targetSiteType: "Fulfillment center",
      taskStatement: "Transfer packed totes.",
      pilotOpportunity: {
        requested: true,
        visibility: "anonymized",
        approvedRobotTeamEmails: [],
        anonymizedSummary: "Packed-tote transfer between automation islands.",
        benchmarkProfile: "Rigid totes, 97% success, 42 second throughput target.",
        objectProfile: "Rigid totes, 8-18 kg.",
        operationalProfile: "42 second cycle, two shifts.",
        integrationEnvironment: "WMS task API and Wi-Fi.",
        rolloutReadiness: "Named owner and six similar lines.",
        dataUsePermissions: {
          evaluateExistingPolicy: "granted",
          siteSpecificAdaptation: "not_granted",
          retainImprovements: "not_granted",
          generalModelTraining: "not_granted",
        },
      },
    },
    structured_intake: {
      site_operator_claim_outcome: "site_claim_access_boundary_ready",
      access_boundary_outcome: "access_boundary_defined",
      pilot_opportunity_outcome: "evaluation_candidate",
      missing_pilot_opportunity_fields: [],
    },
    ops: { rights_status: "verified", capture_status: "approved" },
    ...overrides,
  };
}

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/pilot-opportunities");
  const app = express();
  app.use((req, res, next) => {
    res.locals.firebaseUser = {
      uid: String(req.headers["x-test-uid"] || ""),
      email: String(req.headers["x-test-email"] || ""),
      email_verified: req.headers["x-test-email-verified"] === "true",
    };
    next();
  });
  app.use("/api/pilot-opportunities", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  state.users.clear();
  state.requests.clear();
  vi.resetModules();
});

describe("private pilot opportunities route", () => {
  it("returns only gate-passed projections to an authenticated robot-team account", async () => {
    state.users.set("robot-1", { buyerType: "robot_team", email: "lead@robot.ai" });
    state.requests.set("qualified", opportunityRecord());
    state.requests.set(
      "missing",
      opportunityRecord({
        requestId: "opportunity-2",
        qualification_state: "needs_more_evidence",
      }),
    );
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/pilot-opportunities`, {
        headers: {
          "x-test-uid": "robot-1",
          "x-test-email": "lead@robot.ai",
          "x-test-email-verified": "true",
        },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.opportunities).toHaveLength(1);
      expect(body.opportunities[0]).toEqual(
        expect.objectContaining({
          opportunity_id: "opportunity-1",
          access_level: "anonymized",
          site_name: null,
          deployment_readiness: "not_established",
          underlying_site_files: "hosted_not_downloadable",
        }),
      );
      expect(body.opportunities[0]).not.toHaveProperty("artifact_uri");
      expect(body.opportunities[0]).not.toHaveProperty("download_url");
      expect(body.proof_boundary).toMatch(/does not establish deployment readiness/i);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects site-operator accounts from the robot-team feed", async () => {
    state.users.set("operator-1", { buyerType: "site_operator", email: "ops@site.com" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/pilot-opportunities`, {
        headers: {
          "x-test-uid": "operator-1",
          "x-test-email": "ops@site.com",
          "x-test-email-verified": "true",
        },
      });
      expect(response.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });
});
