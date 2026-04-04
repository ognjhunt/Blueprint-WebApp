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
    siteName: "Durham Facility",
    siteLocation: "Durham, NC",
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
        .map((line) => JSON.parse(line) as { requestId: string; debug?: { mode?: string } })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest).toBeDefined();
      expect(savedRequest?.debug?.mode).toBe("dev_fallback");
    } finally {
      await stopServer(server);
    }
  });

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
  });

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
        .map((line) => JSON.parse(line) as { requestId: string; request?: Record<string, unknown> })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request?.targetSiteType).toBe("Warehouse pallet putaway");
      expect(savedRequest?.request?.proofPathPreference).toBe("adjacent_site_acceptable");
      expect(savedRequest?.request?.siteName).toBe("");
    } finally {
      await stopServer(server);
    }
  });

  it("defaults robot-team requests without requestedLanes to hosted evaluation", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `robot-default-${Date.now()}`;
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildRobotTeamPayload(requestId, `grace.default+${Date.now()}@example.com`),
          requestedLanes: undefined,
        }),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as { requestId: string; request?: Record<string, unknown> })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request?.requestedLanes).toEqual(["deeper_evaluation"]);
    } finally {
      await stopServer(server);
    }
  });

  it("defaults site-operator requests without requestedLanes to site review", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `site-operator-default-${Date.now()}`;
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildPayload(requestId, `ada.operator+${Date.now()}@example.com`),
          requestedLanes: undefined,
        }),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as { requestId: string; request?: Record<string, unknown> })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request?.requestedLanes).toEqual(["qualification"]);
    } finally {
      await stopServer(server);
    }
  });
});
