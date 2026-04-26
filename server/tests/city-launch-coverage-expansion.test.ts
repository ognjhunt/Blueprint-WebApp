// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCityLaunchProspects = vi.hoisted(() => vi.fn());
const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());
const intakeCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());
const reviewCityLaunchCandidateBatch = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: null,
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchProspects,
  listCityLaunchCandidateSignals,
  intakeCityLaunchCandidateSignals,
}));

vi.mock("../utils/cityLaunchCandidateReview", () => ({
  reviewCityLaunchCandidateBatch,
}));

describe("city launch coverage expansion", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    listCityLaunchProspects.mockReset();
    listCityLaunchCandidateSignals.mockReset();
    intakeCityLaunchCandidateSignals.mockReset();
    reviewCityLaunchCandidateBatch.mockReset();
    listCityLaunchProspects.mockResolvedValue([]);
    listCityLaunchCandidateSignals.mockResolvedValue([]);
    const module = await import("../utils/cityLaunchCoverageExpansion");
    module.__resetCityLaunchCoverageMemoryForTests();
  });

  it("plans cell-specific queries from per-city coverage gaps", async () => {
    listCityLaunchProspects.mockResolvedValue([
      {
        id: "prospect-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        status: "approved",
        claimState: "available",
        coverageTileId: "downtown-core",
        coverageCategory: "food_hall",
        sourceBucket: "official_venue_site",
        lat: 35.996,
        lng: -78.902,
        siteCategory: "food_hall",
      },
    ]);
    listCityLaunchCandidateSignals.mockResolvedValue([
      {
        id: "candidate-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        status: "in_review",
        coverageTileId: "downtown-core",
        coverageCategory: "hotel_lobby_common_area",
        sourceBucket: "official_tourism_or_chamber",
        lat: 35.996,
        lng: -78.902,
        types: ["hotel_lobby_common_area"],
      },
    ]);

    const { planCityLaunchCoverageExpansion } = await import("../utils/cityLaunchCoverageExpansion");
    const plan = await planCityLaunchCoverageExpansion({
      city: "Durham, NC",
      maxQueries: 5,
      maxCandidates: 10,
    });

    expect(plan.policy.citySlug).toBe("durham-nc");
    expect(plan.coverageBefore.totals.approvedActiveCount).toBe(1);
    expect(plan.coverageBefore.totals.inReviewCount).toBe(1);
    expect(plan.gapCells.length).toBeGreaterThan(0);
    expect(plan.queryPlan).toHaveLength(5);
    expect(plan.queryPlan[0]).toEqual(expect.objectContaining({
      city: "Durham, NC",
      citySlug: "durham-nc",
      tileId: expect.any(String),
      category: expect.any(String),
      query: expect.stringContaining("Durham, NC"),
    }));
  });

  it("seeds only coordinate-backed governed search results and runs deterministic review", async () => {
    vi.stubEnv("SEARCH_API_PROVIDER", "parallel_mcp");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            structuredContent: {
              results: [
                {
                  name: "Durham Central Market Hall",
                  address: "100 Main St, Durham, NC",
                  lat: 35.9959,
                  lng: -78.9016,
                  url: "https://example.com/market",
                  source_evidence_summary: "Official page describes an indoor public market hall.",
                  indoor_posture: "indoor_only",
                  public_access_posture: "Public-facing indoor market with posted public hours.",
                  allowed_capture_zones: ["market hall common aisles", "public seating"],
                  avoid_zones: ["staff-only prep areas"],
                  verification_status: "verified",
                  estimated_capture_minutes: 35,
                  estimated_capture_complexity: "standard",
                  suggested_payout_cents: 6500,
                  payout_basis: "review estimate, not a guarantee",
                },
              ],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            structuredContent: {
              results: [],
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    intakeCityLaunchCandidateSignals.mockResolvedValue([
      {
        id: "candidate-durham-market",
        status: "queued",
        seenCount: 1,
      },
    ]);
    reviewCityLaunchCandidateBatch.mockResolvedValue({
      outcomes: [
        {
          candidateId: "candidate-durham-market",
          decision: "promote",
          promotedProspectId: "public_candidate_durham-nc_market",
        },
      ],
    });

    const { runCityLaunchCoverageExpansion } = await import("../utils/cityLaunchCoverageExpansion");
    const result = await runCityLaunchCoverageExpansion({
      city: "Durham, NC",
      apply: true,
      maxQueries: 1,
      maxCandidates: 1,
    });

    expect(intakeCityLaunchCandidateSignals).toHaveBeenCalledWith([
      expect.objectContaining({
        city: "Durham, NC",
        name: "Durham Central Market Hall",
        coverageRunId: result.run.id,
        coverageTileId: expect.any(String),
        coverageCategory: expect.any(String),
        discoveryQuery: expect.stringContaining("Durham, NC"),
      }),
    ]);
    expect(reviewCityLaunchCandidateBatch).toHaveBeenCalledWith(expect.objectContaining({
      city: "Durham, NC",
      candidateIds: ["candidate-durham-market"],
      dryRun: false,
      reviewedBy: "public-space-review-agent",
    }));
    expect(result.run.status).toBe("completed");
    expect(result.run.seededCandidateIds).toEqual(["candidate-durham-market"]);
    expect(result.run.promotedProspectIds).toEqual(["public_candidate_durham-nc_market"]);
  });
});
