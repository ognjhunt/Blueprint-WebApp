// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const collectionGet = vi.fn();
const collectionLimit = vi.fn(() => ({ get: collectionGet }));
const collectionOrderBy = vi.fn(() => ({ limit: collectionLimit, get: collectionGet }));
const collectionWhere = vi.fn(() => ({ get: collectionGet }));
const collectionDocGet = vi.fn();
const collectionDoc = vi.fn(() => ({ get: collectionDocGet }));
const dbCollection = vi.fn((name: string) => {
  if (name === "stats") {
    return { doc: collectionDoc };
  }
  return {
    limit: collectionLimit,
    get: collectionGet,
    orderBy: collectionOrderBy,
    where: collectionWhere,
    doc: collectionDoc,
  };
});

const decryptInboundRequestForAdmin = vi.hoisted(() => vi.fn());
const summarizeCityLaunchLedgers = vi.hoisted(() => vi.fn());
const readCityLaunchActivation = vi.hoisted(() => vi.fn());
const resolveCityLaunchPlanningState = vi.hoisted(() => vi.fn());
const loadAndParseCityLaunchResearchArtifact = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: dbCollection,
  },
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin,
}));

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    summarizeCityLaunchLedgers,
    readCityLaunchActivation,
  };
});

vi.mock("../utils/cityLaunchPlanningState", () => ({
  resolveCityLaunchPlanningState,
}));

vi.mock("../utils/cityLaunchResearchParser", async () => {
  const actual = await vi.importActual("../utils/cityLaunchResearchParser");
  return {
    ...actual,
    loadAndParseCityLaunchResearchArtifact,
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("city launch scorecard", () => {
  it("surfaces activation payload blockers and verifies metrics from growth events", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 2,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 1,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: ["cityLaunchProspects"],
    });
    readCityLaunchActivation.mockResolvedValue({
      founderApproved: false,
      status: "planning",
      rootIssueId: null,
      budgetTier: "zero_budget",
    });
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      status: "completed",
      reportsRoot: "/tmp",
      cityReportsRoot: "/tmp/austin-tx",
      canonicalPlaybookPath: "/tmp/playbook.md",
      runDirectory: "/tmp/austin-tx/run-1",
      manifestPath: "/tmp/austin-tx/run-1/manifest.json",
      latestArtifactPath: "/tmp/austin-tx/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/austin-tx/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      activationPayload: {
        cityThesis: "Austin proof thesis",
        primarySiteLane: "industrial_warehouse",
        primaryWorkflowLane: "dock handoff",
        primaryBuyerProofPath: "exact_site",
        lawfulAccessModes: ["buyer_requested_site"],
        validationBlockers: [
          {
            key: "stack-fit",
            summary: "Verify stack fit before outreach.",
            severity: "high",
            validationRequired: true,
            ownerLane: "buyer-solutions-agent",
            sourceUrls: [],
          },
        ],
        metricsDependencies: [
          {
            key: "robot_team_inbound_captured",
            kind: "event",
            status: "required_not_tracked",
            ownerLane: "analytics-agent",
            notes: "Need to emit from server.",
          },
          {
            key: "proof_path_assigned",
            kind: "event",
            status: "required_not_tracked",
            ownerLane: "analytics-agent",
            notes: "Need to emit from server.",
          },
        ],
      },
      artifactPath: "/tmp/austin-tx/run-1/99-final-playbook.md",
    });

    const inboundRequestDoc = {
      data: () => ({ encrypted: true }),
      id: "req-1",
    };
    const growthEventDocs = [
      {
        data: () => ({
          event: "robot_team_inbound_captured",
          properties: { city: "Austin, TX" },
        }),
      },
      {
        data: () => ({
          event: "proof_path_assigned",
          properties: { city: "Austin, TX" },
        }),
      },
    ];

    collectionGet.mockImplementation(() =>
      Promise.resolve({ docs: [], empty: true }),
    );
    dbCollection.mockImplementation((name: string) => {
      if (name === "waitlistSubmissions" || name === "users") {
        return { limit: () => ({ get: async () => ({ docs: [] }) }) };
      }
      if (name === "inboundRequests") {
        return { limit: () => ({ get: async () => ({ docs: [inboundRequestDoc] }) }) };
      }
      if (name === "growth_events") {
        return {
          orderBy: () => ({
            limit: () => ({
              get: async () => ({ docs: growthEventDocs }),
            }),
          }),
        };
      }
      if (name === "stats") {
        return { doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) };
      }
      return { limit: () => ({ get: async () => ({ docs: [] }) }) };
    });

    decryptInboundRequestForAdmin.mockResolvedValue({
      requestId: "req-1",
      qualification_state: "submitted",
      context: { demandCity: "Austin, TX" },
      request: {
        buyerType: "robot_team",
        siteLocation: "Austin, TX",
      },
      ops: {
        proof_path: {
          proof_pack_delivered_at: null,
          hosted_review_started_at: null,
          hosted_review_follow_up_at: null,
          human_commercial_handoff_at: null,
        },
      },
    });

    const { collectCityLaunchScorecard } = await import("../utils/cityLaunchScorecard");
    const scorecard = await collectCityLaunchScorecard("Austin, TX");

    expect(scorecard.activation.cityThesis).toBe("Austin proof thesis");
    expect(scorecard.activation.validationBlockers[0]?.summary).toContain("Verify stack fit");
    expect(
      scorecard.activation.metricsDependencies.find(
        (entry) => entry.key === "robot_team_inbound_captured",
      )?.status,
    ).toBe("verified");
    expect(scorecard.warnings.join("\n")).toContain("Validation required: Verify stack fit before outreach.");
  });

  it("reports proof-motion execution state and falls back to first-party ledgers when Firehose is unavailable", async () => {
    vi.stubEnv("FIREHOSE_API_TOKEN", "");
    vi.stubEnv("FIREHOSE_BASE_URL", "");

    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: ["cityLaunchProspects"],
    });
    readCityLaunchActivation.mockResolvedValue({
      founderApproved: true,
      status: "activation_ready",
      rootIssueId: "root-1",
      budgetTier: "zero_budget",
    });
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "San Jose, CA",
      citySlug: "san-jose-ca",
      status: "completed",
      reportsRoot: "/tmp",
      cityReportsRoot: "/tmp/san-jose-ca",
      canonicalPlaybookPath: "/tmp/playbook.md",
      runDirectory: "/tmp/san-jose-ca/run-1",
      manifestPath: "/tmp/san-jose-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/san-jose-ca/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/san-jose-ca/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      activationPayload: {
        cityThesis: "San Jose proof thesis",
        primarySiteLane: "industrial_warehouse",
        primaryWorkflowLane: "dock handoff",
        primaryBuyerProofPath: "exact_site",
        lawfulAccessModes: ["buyer_requested_site"],
        validationBlockers: [],
        metricsDependencies: [],
      },
      artifactPath: "/tmp/san-jose-ca/run-1/99-final-playbook.md",
    });

    const inboundRequestDoc = { data: () => ({ encrypted: true }), id: "req-1" };

    collectionGet.mockImplementation(() =>
      Promise.resolve({ docs: [], empty: true }),
    );
    dbCollection.mockImplementation((name: string) => {
      if (name === "waitlistSubmissions" || name === "users") {
        return { limit: () => ({ get: async () => ({ docs: [] }) }) };
      }
      if (name === "inboundRequests") {
        return { limit: () => ({ get: async () => ({ docs: [inboundRequestDoc] }) }) };
      }
      if (name === "growth_events") {
        return {
          orderBy: () => ({
            limit: () => ({
              get: async () => ({ docs: [] }),
            }),
          }),
        };
      }
      if (name === "stats") {
        return { doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) };
      }
      return { limit: () => ({ get: async () => ({ docs: [] }) }) };
    });

    decryptInboundRequestForAdmin.mockResolvedValue({
      requestId: "req-1",
      qualification_state: "qualified_ready",
      context: { demandCity: "San Jose, CA" },
      request: {
        buyerType: "robot_team",
        siteLocation: "San Jose, CA",
      },
      ops: {
        proof_path: {
          proof_pack_delivered_at: "2026-04-20T00:00:00.000Z",
          hosted_review_started_at: null,
          hosted_review_follow_up_at: null,
          human_commercial_handoff_at: null,
        },
      },
    });

    const { collectCityLaunchScorecard } = await import("../utils/cityLaunchScorecard");
    const scorecard = await collectCityLaunchScorecard("San Jose, CA");

    expect(scorecard.activation.executionStates.proofAsset).toBe("ready");
    expect(scorecard.activation.executionStates.proofPack).toBe("delivered");
    expect(scorecard.activation.executionStates.hostedReview).toBe("missing");
    expect(scorecard.activation.executionStates.analyticsSource).toBe("first_party_only");
    expect(scorecard.warnings.join("\n")).toContain(
      "Firehose enrichment unavailable; using first-party city-launch ledgers only.",
    );
  });
});
