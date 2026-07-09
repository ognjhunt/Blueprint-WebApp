// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../client/src/lib/legalAcceptance";

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
    accountSignup: true,
    acceptedTerms: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
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
    displayCaptureMetadata: {
      targetName: "Dock A",
      addressLabel: "11 Warehouse Way",
      captureJobId: "capture-job-123",
      captureBrief: "Capture the dock doors and staging handoff.",
      privacyReminder: "Capture only approved areas.",
      allowedAdvisoryHints: ["hold_steady", "scan_corners", "unsupported_hint"],
    },
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
    accountSignup: true,
    acceptedTerms: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    budgetBucket: "$50K-$300K",
    requestedLanes: ["qualification"],
    buyerType: "robot_team",
    commercialRequestPath: "world_model",
    siteName: "",
    siteLocation: "",
    taskStatement: "Can Blueprint show a proof path for pallet putaway in a warehouse?",
    targetSiteType: "Warehouse pallet putaway",
    proofPathPreference: "adjacent_site_acceptable",
    realSiteRobotEvalFit: {
      siteCardInput: {
        siteType: "Warehouse pallet putaway",
        knownGeometryAssets: "CAD for storage lanes exists.",
        visualConditions: "Reflective pallet wrap and mixed overhead lighting.",
        dynamicConditions: "Forklifts and workers cross the route.",
        safetyConstraints: "Forklift lane exclusion and pallet-rack clearance.",
        robotRelevantMetadata: "48 inch aisle with dock-edge no-go zone.",
      },
      taskCardInput: {
        task: "Pallet putaway from receiving to rack staging.",
        startState: "Robot starts at receiving lane with pallet localized.",
        successDefinition: "Pallet reaches staging without human intervention.",
        failureDefinition: "Dropped pallet, blocked route, or human recovery.",
        requiredMetrics: "95% success, under 90 seconds, fewer than 1 intervention per shift.",
      },
      scenarioCardInput: {
        normalScenario: "Clear route from receiving to staging.",
        variation: "Forklift blocks the cross aisle.",
        edgeCase: "Worker enters the staging lane.",
        knownRisk: "Pallet wrap glare affects perception.",
      },
      evalCardInput: {
        robotOrPolicyTested: "Humanoid policy container",
        preferredReviewPath: "Hosted review first.",
        resultsValidationExpectations: "Simulator traces, action logs, and human demo.",
        predictedVsActualHistory: "No actual pilot yet.",
      },
    },
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
            displayCaptureMetadata?: {
              targetName?: string;
              addressLabel?: string;
              requestId?: string;
              captureJobId?: string;
              captureBrief?: string;
              privacyReminder?: string;
              allowedAdvisoryHints?: string[];
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
      expect(savedRequest?.request?.displayCaptureMetadata).toMatchObject({
        targetName: "Dock A",
        addressLabel: "11 Warehouse Way",
        requestId,
        captureJobId: "capture-job-123",
        captureBrief: "Capture the dock doors and staging handoff.",
        privacyReminder: "Capture only approved areas.",
        allowedAdvisoryHints: ["hold_steady", "scan_corners"],
      });
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
          structured_intake?: {
            calendar_disposition?: string;
            owner_lane?: string;
            missing_structured_fields?: string[];
            missing_structured_field_labels?: string[];
            routing_summary?: string;
            proof_ready_criteria?: string[];
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request?.targetSiteType).toBe("Warehouse pallet putaway");
      expect(savedRequest?.request?.commercialRequestPath).toBe("world_model");
      expect(savedRequest?.request?.proofPathPreference).toBe("adjacent_site_acceptable");
      expect(savedRequest?.request?.realSiteRobotEvalFit).toMatchObject({
        taskCardInput: {
          requiredMetrics: "95% success, under 90 seconds, fewer than 1 intervention per shift.",
        },
        evalCardInput: {
          robotOrPolicyTested: "Humanoid policy container",
        },
      });
      expect(savedRequest?.request?.siteName).toBe("");
      expect(savedRequest?.structured_intake?.calendar_disposition).toBe("eligible_optional");
      expect(savedRequest?.structured_intake?.owner_lane).toBe("buyer-solutions-agent");
      expect(savedRequest?.structured_intake?.missing_structured_fields).toEqual([]);
      expect(savedRequest?.structured_intake?.missing_structured_field_labels).toEqual([]);
      expect(savedRequest?.structured_intake?.proof_ready_criteria).toEqual(
        expect.arrayContaining([
          "robot_or_stack",
          "metric_thresholds",
          "safety_constraints",
          "evidence_validation_needs",
        ]),
      );
      expect(savedRequest?.structured_intake?.routing_summary).toMatch(/buyer-solutions-agent/i);
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
        realSiteRobotEvalFit: {
          ...buildRobotTeamPayload(requestId, `unused-${Date.now()}@example.com`).realSiteRobotEvalFit,
          evalCardInput: {
            robotOrPolicyTested: "AMR fleet policy API",
            preferredReviewPath: "Hosted review first.",
            resultsValidationExpectations: "Simulator traces and robot action logs.",
            predictedVsActualHistory: "Prior pilot was slower than expected.",
          },
        },
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
            proof_ready_criteria?: string[];
            missing_proof_ready_fields?: string[];
            missing_structured_field_labels?: string[];
            proof_path_summary?: string;
            calendar_summary?: string;
          };
          ops_automation?: { recommended_path?: string; next_action?: string };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.structured_intake).toMatchObject({
        proof_ready_outcome: "proof_ready_intake",
        proof_path_outcome: "exact_site",
        proof_readiness_score: 100,
        missing_proof_ready_fields: [],
        missing_structured_field_labels: [],
      });
      expect(savedRequest?.structured_intake?.proof_ready_criteria).toEqual(
        expect.arrayContaining([
          "metric_thresholds",
          "safety_constraints",
          "evidence_validation_needs",
        ]),
      );
      expect(savedRequest?.structured_intake?.proof_path_summary).toMatch(/exact-site proof path/i);
      expect(savedRequest?.structured_intake?.calendar_summary).toMatch(/recommended/i);
      expect(savedRequest?.ops_automation?.recommended_path).toBe("intake_then_recommended_scoping_call");
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
            has_metric_thresholds: true,
            has_safety_constraints: true,
            has_evidence_validation_needs: true,
          }),
          user: null,
        }),
      );
      const fitEvent = logGrowthEvent.mock.calls
        .map(([event]) => event)
        .find((event) => event.event === "robot_team_fit_checked");
      expect(JSON.stringify(fitEvent?.properties)).not.toContain("AMR fleet");
      expect(JSON.stringify(fitEvent?.properties)).not.toContain("Simulator traces");
    } finally {
      await stopServer(server);
    }
  });

  it("accepts an agent-friendly location-only robot-team request without granting access", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `robot-location-${Date.now()}`;
      const payload = {
        ...buildRobotTeamPayload(requestId, `location-agent+${Date.now()}@example.com`),
        requestedLanes: ["deeper_evaluation"],
        commercialRequestPath: "hosted_evaluation",
        siteName: "",
        siteLocation: "123 Unknown St",
        targetSiteType: "",
        taskStatement: "warehouse tote",
        targetRobotTeam: "robot-team agent",
        proofPathPreference: "exact_site_required",
        realSiteRobotEvalFit: {
          siteCardInput: {
            safetyConstraints: "No-go zones around handoff.",
          },
          taskCardInput: {
            requiredMetrics: "95% success and one intervention per shift.",
          },
          evalCardInput: {
            robotOrPolicyTested: "robot-team agent",
            resultsValidationExpectations: "Simulator traces and action logs.",
          },
        },
        context: {
          sourcePageUrl:
            "http://localhost:5001/contact?source=site-worlds&buyerType=robot_team&path=hosted-review&location=123%20Unknown%20St&workflow=warehouse%20tote",
          referrer: "http://localhost:5001/world-models",
          utm: {},
          timezoneOffset: 240,
          locale: "en-US",
          userAgent: "vitest",
        },
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
          request?: Record<string, unknown>;
          ops?: {
            proof_path?: Record<string, unknown>;
            capture_status?: string;
            quote_status?: string;
          };
          structured_intake?: {
            proof_ready_outcome?: string;
            proof_path_outcome?: string;
            missing_structured_fields?: string[];
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.request).toMatchObject({
        buyerType: "robot_team",
        commercialRequestPath: "hosted_evaluation",
        siteName: "",
        siteLocation: "123 Unknown St",
        taskStatement: "warehouse tote",
        targetRobotTeam: "robot-team agent",
      });
      expect(savedRequest?.structured_intake).toMatchObject({
        proof_ready_outcome: "proof_ready_intake",
        proof_path_outcome: "exact_site",
        missing_structured_fields: [],
      });
      expect(savedRequest?.ops?.capture_status).toBe("not_requested");
      expect(savedRequest?.ops?.quote_status).toBe("not_started");
      expect(savedRequest?.ops?.proof_path?.hosted_review_started_at).toBeNull();
      expect(savedRequest?.ops?.proof_path?.proof_pack_delivered_at).toBeNull();
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
            site_operator_claim_outcome?: string;
            access_boundary_outcome?: string;
            site_claim_readiness_score?: number;
            missing_site_claim_fields?: string[];
            routing_summary?: string;
            calendar_summary?: string;
            proof_path_summary?: string;
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.structured_intake).toMatchObject({
        site_operator_claim_outcome: "site_claim_access_boundary_ready",
        access_boundary_outcome: "access_boundary_defined",
        site_claim_readiness_score: 100,
        missing_site_claim_fields: [],
      });
      expect(savedRequest?.structured_intake?.routing_summary).toMatch(/site-operator-partnership-agent/i);
      expect(savedRequest?.structured_intake?.calendar_summary).toMatch(/required/i);
      expect(savedRequest?.structured_intake?.proof_path_summary).toMatch(/operator/i);
      expect(logGrowthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "site_operator_claim_checked",
          source: "server:inbound_request",
          properties: expect.objectContaining({
            request_id: requestId,
            site_operator_claim_outcome: "site_claim_access_boundary_ready",
            access_boundary_outcome: "access_boundary_defined",
            site_claim_readiness_score: 100,
            has_access_rules: true,
            has_privacy_security_boundary: true,
            has_commercialization_boundary: true,
          }),
          user: null,
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  // R047: buyers/operators must accept Terms of Service + Privacy Policy at signup,
  // and the acceptance must be recorded server-side.
  it("rejects a buyer/operator signup that does not accept Terms and Privacy", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `no-consent-${Date.now()}`;
      // Keeps accountSignup: true (from buildPayload) but drops the acceptance,
      // reproducing a buyer/operator signup attempt without consent.
      const payload = buildPayload(requestId, `no-consent+${Date.now()}@example.com`) as Record<
        string,
        unknown
      >;
      delete payload.acceptedTerms;

      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(400);

      const json = (await response.json()) as { ok: boolean; message?: string };
      expect(json.ok).toBe(false);
      expect(json.message).toMatch(/Terms of Service and Privacy Policy/i);

      // No consent means no persisted record is written for this request.
      const persisted = fs.existsSync(devLogPath)
        ? fs
            .readFileSync(devLogPath, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as { requestId: string })
            .find((entry) => entry.requestId === requestId)
        : undefined;
      expect(persisted).toBeUndefined();
    } finally {
      await stopServer(server);
    }
  });

  it("records server-derived Terms and Privacy acceptance on the persisted request", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `consent-${Date.now()}`;
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Client-reported version values are intentionally stale; the server
          // must record its own current version constants, not these.
          ...buildPayload(requestId, `consent+${Date.now()}@example.com`),
          termsVersion: "client-supplied-stale",
          privacyVersion: "client-supplied-stale",
        }),
      });

      expect(response.status).toBe(201);

      const lines = fs.readFileSync(devLogPath, "utf8").trim().split("\n");
      const savedRequest = lines
        .map((line) => JSON.parse(line) as {
          requestId: string;
          terms_acceptance?: {
            accepted_terms?: boolean;
            terms_version?: string;
            privacy_version?: string;
            terms_url?: string;
            privacy_url?: string;
            accepted_at?: string;
            accepted_from_ip_hash?: string | null;
          };
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest?.terms_acceptance).toBeDefined();
      expect(savedRequest?.terms_acceptance?.accepted_terms).toBe(true);
      expect(savedRequest?.terms_acceptance?.terms_version).toBe(TERMS_VERSION);
      expect(savedRequest?.terms_acceptance?.privacy_version).toBe(PRIVACY_VERSION);
      // Server records its own constants, ignoring the stale client-supplied values.
      expect(savedRequest?.terms_acceptance?.terms_version).not.toBe("client-supplied-stale");
      expect(savedRequest?.terms_acceptance?.terms_url).toBe("/terms");
      expect(savedRequest?.terms_acceptance?.privacy_url).toBe("/privacy");
      expect(typeof savedRequest?.terms_acceptance?.accepted_at).toBe("string");
      expect(Number.isNaN(Date.parse(savedRequest?.terms_acceptance?.accepted_at ?? ""))).toBe(false);
      expect(savedRequest?.terms_acceptance?.accepted_from_ip_hash).toBeTruthy();
    } finally {
      await stopServer(server);
    }
  });

  it("still accepts a non-signup lead submission (contact/pilot) without acceptance", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { server, baseUrl } = await startRouterServer();

    try {
      const requestId = `lead-${Date.now()}`;
      // Shared lead forms reuse this route without the account-signup marker or
      // acceptance; they must keep working and record no acceptance.
      const payload = buildPayload(requestId, `lead+${Date.now()}@example.com`) as Record<
        string,
        unknown
      >;
      delete payload.accountSignup;
      delete payload.acceptedTerms;

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
          terms_acceptance?: unknown;
        })
        .find((entry) => entry.requestId === requestId);

      expect(savedRequest).toBeDefined();
      expect(savedRequest?.terms_acceptance ?? null).toBeNull();
    } finally {
      await stopServer(server);
    }
  });
});
