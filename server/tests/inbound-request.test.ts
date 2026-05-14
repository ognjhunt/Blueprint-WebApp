// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";

const sendEmail = vi.hoisted(() => vi.fn());
const notifySlackInboundRequest = vi.hoisted(() => vi.fn());
const logGrowthEvent = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, persisted: false }));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/email", () => ({
  sendEmail,
}));

vi.mock("../utils/slack", () => ({
  notifySlackInboundRequest,
}));

vi.mock("../utils/growth-events", () => ({
  logGrowthEvent,
}));

vi.mock("../utils/rate-limit-redis", () => ({
  getRateLimitRedisClient: () => null,
}));

const devLogPath = path.join(os.tmpdir(), "blueprint-dev-inbound-requests.jsonl");
const originalNodeEnv = process.env.NODE_ENV;

function buildPayload(requestId: string, email: string) {
  return {
    requestId,
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines",
    roleTitle: "Operations Lead",
    email,
    budgetBucket: "$50K-$300K",
    requestedLanes: ["qualification"],
    buyerType: "site_operator",
    commercialRequestPath: "site_claim",
    siteName: "Durham Facility",
    siteLocation: "Durham, NC",
    siteLocationMetadata: {
      source: "google_places",
      placeId: "place-durham-facility",
      formattedAddress: "Durham Facility, Durham, NC 27701, USA",
      lat: 35.994,
      lng: -78.8986,
      city: "Durham",
      state: "NC",
      country: "US",
      postalCode: "27701",
    },
    taskStatement: "Review a picking workflow.",
    workflowContext: "Backroom to staging handoff.",
    operatingConstraints: "Two shifts, restricted loading dock access.",
    privacySecurityConstraints: "No cameras in employee locker area.",
    knownBlockers: "Tight turn near the dock.",
    targetRobotTeam: "General humanoid team",
    details: "Need a fast feasibility read.",
    context: {
      sourcePageUrl: "http://localhost:5001/contact",
      referrer: "http://localhost:5001/",
      utm: {},
      timezoneOffset: 240,
      locale: "en-US",
      userAgent: "vitest",
    },
  };
}

function buildRobotTeamPayload(requestId: string, email: string) {
  return {
    requestId,
    firstName: "Grace",
    lastName: "Hopper",
    company: "Compiler Robotics",
    roleTitle: "Autonomy Lead",
    email,
    budgetBucket: "$50K-$300K",
    requestedLanes: ["qualification"],
    buyerType: "robot_team",
    commercialRequestPath: "world_model",
    siteName: "",
    siteLocation: "",
    taskStatement: "Can Blueprint show a proof path for pallet putaway in a warehouse?",
    targetSiteType: "Warehouse pallet putaway",
    proofPathPreference: "adjacent_site_acceptable",
    existingStackReviewWorkflow: "We review hosted artifacts before simulator ingestion.",
    humanGateTopics: "Raise rights, delivery scope, and security review early.",
    context: {
      sourcePageUrl: "http://localhost:5001/contact?persona=robot-team",
      referrer: "http://localhost:5001/",
      utm: {},
      timezoneOffset: 240,
      locale: "en-US",
      userAgent: "vitest",
    },
  };
}

async function startRouterServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: inboundRequestRouter } = await import("../routes/inbound-request");
  const app = express();
  app.use(express.json());
  app.use("/", inboundRequestRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind inbound request test server");
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
  process.env.NODE_ENV = originalNodeEnv;
  sendEmail.mockReset();
  notifySlackInboundRequest.mockReset();
  logGrowthEvent.mockReset();
  logGrowthEvent.mockResolvedValue({ ok: true, persisted: false });

  if (fs.existsSync(devLogPath)) {
    fs.unlinkSync(devLogPath);
  }
});

describe("inbound request route", () => {
  it("uses the dev fallback when Firebase Admin is unavailable outside production", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `dev-${Date.now()}`;
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(requestId, `ada+${Date.now()}@example.com`)),
      });

      expect(response.status).toBe(201);

      const json = (await response.json()) as {
        ok: boolean;
        requestId: string;
        siteSubmissionId?: string;
        status: string;
        message?: string;
      };

      expect(json.ok).toBe(true);
      expect(json.requestId).toBe(requestId);
      expect(json.siteSubmissionId).toBe(requestId);
      expect(json.message).toMatch(/Development mode/i);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(notifySlackInboundRequest).not.toHaveBeenCalled();
      expect(fs.existsSync(devLogPath)).toBe(true);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          request?: {
            commercialRequestPath?: string;
            siteLocationMetadata?: {
              source?: string;
              placeId?: string;
              formattedAddress?: string;
              lat?: number;
              lng?: number;
              city?: string;
              state?: string;
              country?: string;
              postalCode?: string;
            };
          };
          debug?: { mode?: string };
          structured_intake?: { calendar_disposition?: string; recommended_path?: string };
          ops_automation?: { recommended_path?: string };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest).toBeDefined();
      expect(savedRequest?.request?.siteLocationMetadata).toMatchObject({
        source: "google_places",
        placeId: "place-durham-facility",
        formattedAddress: "Durham Facility, Durham, NC 27701, USA",
        lat: 35.994,
        lng: -78.8986,
        city: "Durham",
        state: "NC",
        country: "US",
        postalCode: "27701",
      });
      expect(savedRequest?.request?.commercialRequestPath).toBe("site_claim");
      expect(savedRequest?.debug?.mode).toBe("dev_fallback");
      expect(savedRequest?.structured_intake?.calendar_disposition).toBe("required_before_next_step");
      expect(savedRequest?.ops_automation?.recommended_path).toBe("intake_then_required_scoping_call");
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("still fails in production when Firebase Admin is unavailable", async () => {
    process.env.NODE_ENV = "production";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(`prod-${Date.now()}`, `ada+prod-${Date.now()}@example.com`)),
      });

      expect(response.status).toBe(500);

      const json = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      expect(json.ok).toBe(false);
      expect(json.message).toMatch(/Internal server error/i);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(notifySlackInboundRequest).not.toHaveBeenCalled();
      expect(fs.existsSync(devLogPath)).toBe(false);
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("accepts robot-team proof-path intake without a named site when site type is provided", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `robot-${Date.now()}`;
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildRobotTeamPayload(requestId, `grace+${Date.now()}@example.com`)
        ),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          request?: Record<string, unknown>;
          structured_intake?: { calendar_disposition?: string; owner_lane?: string };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request?.targetSiteType).toBe("Warehouse pallet putaway");
      expect(savedRequest?.request?.commercialRequestPath).toBe("world_model");
      expect(savedRequest?.request?.proofPathPreference).toBe("adjacent_site_acceptable");
      expect(savedRequest?.request?.siteName).toBe("");
      expect(savedRequest?.structured_intake?.calendar_disposition).toBe("not_needed_yet");
      expect(savedRequest?.structured_intake?.owner_lane).toBe("intake-agent");
    } finally {
      await stopServer(server);
    }
  });

  it("persists and measures the robot-team proof-ready intake outcome", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `robot-proof-ready-${Date.now()}`;
      const payload = {
        ...buildRobotTeamPayload(requestId, `proof-ready+${Date.now()}@example.com`),
        requestedLanes: ["deeper_evaluation"],
        siteName: "Durham fulfillment center",
        siteLocation: "Durham, NC",
        targetRobotTeam: "AMR fleet",
        targetSiteType: "Warehouse",
        proofPathPreference: "exact_site_required",
      };

      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          structured_intake?: {
            proof_ready_outcome?: string;
            proof_path_outcome?: string;
            proof_readiness_score?: number;
            missing_proof_ready_fields?: string[];
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.structured_intake).toMatchObject({
        proof_ready_outcome: "proof_ready_intake",
        proof_path_outcome: "exact_site",
        proof_readiness_score: 100,
        missing_proof_ready_fields: [],
      });
      expect(logGrowthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "robot_team_fit_checked",
          source: "server:inbound_request",
          properties: expect.objectContaining({
            request_id: requestId,
            exact_site_classification: "exact_site",
            commercial_request_path: "world_model",
            adjacent_site_allowed: false,
            proof_path_preference: "exact_site_required",
            proof_ready_outcome: "proof_ready_intake",
            proof_readiness_score: 100,
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("marks operator rights and privacy boundaries as requiring a calendar checkpoint before movement", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `operator-rights-${Date.now()}`;
      const payload = {
        ...buildPayload(requestId, `operator+${Date.now()}@example.com`),
        privacySecurityConstraints: "No cameras in private storage, faces must be redacted.",
        derivedScenePermission: "Keep private until owner review.",
      };
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          structured_intake?: {
            calendar_disposition?: string;
            calendar_reasons?: string[];
            owner_lane?: string;
          };
          human_review_required?: boolean;
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.structured_intake?.calendar_disposition).toBe("required_before_next_step");
      expect(savedRequest?.structured_intake?.calendar_reasons).toContain(
        "operator_named_rights_privacy_or_commercialization_boundary",
      );
      expect(savedRequest?.human_review_required).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("persists and measures the site-operator claim and access-boundary outcome", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `operator-claim-${Date.now()}`;
      const payload = {
        ...buildPayload(requestId, `operator-claim+${Date.now()}@example.com`),
        taskStatement: "Claim this facility for a controlled robot-team evaluation.",
        operatingConstraints: "Escorted access on weekdays, no capture near the cash office.",
        privacySecurityConstraints: "No employee-only rooms and redact faces.",
      };
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          structured_intake?: {
            site_operator_claim_outcome?: string;
            access_boundary_outcome?: string;
            site_claim_readiness_score?: number;
            missing_site_claim_fields?: string[];
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.structured_intake).toMatchObject({
        site_operator_claim_outcome: "site_claim_access_boundary_ready",
        access_boundary_outcome: "access_boundary_defined",
        site_claim_readiness_score: 100,
        missing_site_claim_fields: [],
      });
      expect(logGrowthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "site_operator_claim_checked",
          source: "server:inbound_request",
          properties: expect.objectContaining({
            request_id: requestId,
            site_operator_claim_outcome: "site_claim_access_boundary_ready",
            access_boundary_outcome: "access_boundary_defined",
            site_claim_readiness_score: 100,
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
