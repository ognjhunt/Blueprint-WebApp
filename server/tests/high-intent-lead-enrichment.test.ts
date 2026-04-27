// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const setCalls = vi.hoisted(() => [] as Array<{ collection: string; id: string; payload: any }>);
const activations = vi.hoisted(() => [] as any[]);

const fakeDb = {
  collection: vi.fn((collection: string) => ({
    doc: vi.fn((id: string) => ({
      set: vi.fn((payload: any) => {
        setCalls.push({ collection, id, payload });
        return Promise.resolve();
      }),
    })),
  })),
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: fakeDb,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/paperclip", () => ({
  createPaperclipIssueComment: vi.fn(),
  resetPaperclipAgentSession: vi.fn(),
  upsertPaperclipIssue: vi.fn(),
  wakePaperclipAgent: vi.fn(),
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchActivations: vi.fn(() => Promise.resolve(activations)),
}));

afterEach(() => {
  setCalls.length = 0;
  activations.length = 0;
  fakeDb.collection.mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function baseInbound(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-1",
    site_submission_id: "req-1",
    queue_key: "inbound_request_review",
    growth_wedge: null,
    queue_tags: [],
    createdAt: "timestamp",
    status: "submitted",
    qualification_state: "submitted",
    opportunity_state: "not_applicable",
    priority: "normal",
    owner: {},
    contact: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@robotco.com",
      roleTitle: "Robotics Lead",
      company: "RobotCo",
    },
    request: {
      budgetBucket: "$50K-$300K",
      requestedLanes: ["qualification"],
      helpWith: [],
      buyerType: "robot_team",
      siteName: "",
      siteLocation: "",
      taskStatement: "Evaluate mobile manipulation in grocery backrooms.",
      targetSiteType: "Grocery backroom",
      proofPathPreference: "need_guidance",
      existingStackReviewWorkflow: null,
      humanGateTopics: null,
      workflowContext: null,
      operatingConstraints: null,
      privacySecurityConstraints: null,
      knownBlockers: null,
      targetRobotTeam: null,
      captureRights: null,
      derivedScenePermission: null,
      datasetLicensingPermission: null,
      payoutEligibility: null,
      details: null,
    },
    context: {
      sourcePageUrl: "https://tryblueprint.io/for-robot-teams",
      utm: {},
    },
    enrichment: {},
    events: {},
    ops_automation: {
      status: "pending",
      queue: "inbound_request_review",
      intent: "inbound_qualification",
    },
    debug: { schemaVersion: 3 },
    ...overrides,
  } as any;
}

describe("high-intent lead enrichment", () => {
  it("skips low-signal inbound requests", async () => {
    vi.stubEnv("BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED", "0");
    const { runHighIntentLeadEnrichmentForRequest } = await import("../utils/highIntentLeadEnrichment");

    const result = await runHighIntentLeadEnrichmentForRequest(baseInbound());

    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("high-intent");
    expect(setCalls).toEqual([]);
  });

  it("creates a draft-only dossier for high-intent robot-team requests", async () => {
    vi.stubEnv("BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED", "0");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://robotco.com",
      text: async () => '<html><head><title>RobotCo Robotics</title><meta name="description" content="Warehouse autonomy systems"></head></html>',
    })));
    const { runHighIntentLeadEnrichmentForRequest } = await import("../utils/highIntentLeadEnrichment");

    const result = await runHighIntentLeadEnrichmentForRequest(
      baseInbound({
        growth_wedge: "exact_site_hosted_review",
        queue_key: "exact_site_hosted_review_queue",
        request: {
          ...baseInbound().request,
          requestedLanes: ["deeper_evaluation"],
          proofPathPreference: "exact_site_required",
        },
        ops_automation: {
          status: "pending",
          queue: "exact_site_hosted_review_queue",
          intent: "inbound_qualification",
        },
      }),
    );

    expect(result.status).toBe("draft_ready");
    expect(result.ownerAgent).toBe("buyer-solutions-agent");

    const dossierWrite = setCalls.find((call) => call.collection === "leadEnrichmentDossiers");
    expect(dossierWrite?.payload).toMatchObject({
      classification: "robot_team_buyer",
      status: "draft_ready",
      owner_agent: "buyer-solutions-agent",
      draft_follow_up: {
        requires_human_approval: true,
      },
    });
    expect(dossierWrite?.payload.guardrails).toContain("No invented contacts or guessed email addresses.");
    expect(dossierWrite?.payload.public_research_plan).toMatchObject({
      mode: "company_domain_only",
      blocked_person_research: true,
    });
    expect(dossierWrite?.payload.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "public_company_page",
          label: "evidence",
          url: "https://robotco.com",
        }),
      ]),
    );

    const inboundWrite = setCalls.find((call) => call.collection === "inboundRequests");
    expect(inboundWrite?.payload.lead_enrichment).toMatchObject({
      status: "draft_ready",
      classification: "robot_team_buyer",
      no_live_send: true,
      draft_requires_human_approval: true,
    });
  });

  it("routes specific site-operator requests to the site-operator partnership lane", async () => {
    const { evaluateInboundLeadEnrichment } = await import("../utils/highIntentLeadEnrichment");

    const decision = evaluateInboundLeadEnrichment(
      baseInbound({
        contact: {
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@facilityco.com",
          roleTitle: "Facilities Director",
          company: "FacilityCo",
        },
        request: {
          ...baseInbound().request,
          buyerType: "site_operator",
          requestedLanes: ["data_licensing"],
          siteName: "FacilityCo DC-1",
          siteLocation: "Austin, TX",
          captureRights: "We control access and need to discuss commercialization rights.",
          proofPathPreference: "need_guidance",
        },
      }),
    );

    expect(decision.eligible).toBe(true);
    expect(decision.classification).toBe("site_operator");
    expect(decision.ownerAgent).toBe("site-operator-partnership-agent");
    expect(decision.noLiveSend).toBe(true);
  });

  it("aggregates waitlist city interest when the market is not active or near activation", async () => {
    vi.stubEnv("BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED", "0");
    activations.push({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      status: "planning",
      founderApproved: false,
      rootIssueId: "BLU-CHICAGO",
    });
    const { runWaitlistLeadSignalRouting } = await import("../utils/highIntentLeadEnrichment");

    const result = await runWaitlistLeadSignalRouting({
      submissionId: "wait-1",
      email: "operator@example.com",
      market: "Chicago, IL",
      role: "robot team",
      locationType: "warehouse",
      device: "",
      company: "Example Robotics",
      notes: "Interested in Blueprint when Chicago is ready.",
      source: "website_waitlist",
    });

    expect(result.status).toBe("aggregate_only");
    expect(setCalls.find((call) => call.collection === "leadEnrichmentDossiers")).toBeUndefined();
    expect(setCalls.find((call) => call.collection === "waitlistSubmissions")?.payload.city_demand_signal).toMatchObject({
      status: "aggregated_only",
      classification: "robot_team_buyer",
      no_live_send: true,
    });
  });

  it("routes strong capturer supply from an active city without live-send approval", async () => {
    vi.stubEnv("BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED", "0");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://captureco.com",
      text: async () => '<html><head><title>CaptureCo</title></head></html>',
    })));
    activations.push({
      city: "Austin, TX",
      citySlug: "austin-tx",
      status: "executing",
      founderApproved: true,
      rootIssueId: "BLU-AUSTIN",
    });
    const { runWaitlistLeadSignalRouting } = await import("../utils/highIntentLeadEnrichment");

    const result = await runWaitlistLeadSignalRouting({
      submissionId: "wait-2",
      email: "lead@captureco.com",
      market: "Austin, TX",
      role: "capturer",
      locationType: "commercial warehouse districts",
      device: "iPhone 16 Pro with LiDAR",
      company: "CaptureCo",
      notes: "Can capture commercial warehouses and facility exteriors in Austin.",
      source: "capture_app_private_beta",
    });

    expect(result.status).toBe("draft_ready");
    expect(result.ownerAgent).toBe("intake-agent");
    const dossierWrite = setCalls.find((call) => call.collection === "leadEnrichmentDossiers");
    expect(dossierWrite?.payload).toMatchObject({
      classification: "capturer_supply",
      owner_agent: "intake-agent",
      draft_follow_up: {
        requires_human_approval: true,
      },
    });
    expect(setCalls.find((call) => call.collection === "waitlistSubmissions")?.payload.lead_enrichment).toMatchObject({
      no_live_send: true,
      draft_requires_human_approval: true,
    });
  });
});
