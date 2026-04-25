// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());
const updateCityLaunchCandidateSignalReview = vi.hoisted(() => vi.fn());
const upsertCityLaunchProspect = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchCandidateSignals,
  updateCityLaunchCandidateSignalReview,
  upsertCityLaunchProspect,
}));

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-durham-1",
    dedupeKey: "Durham, NC:test",
    creatorId: "agent:public-commercial-candidate-agent",
    city: "Durham, NC",
    citySlug: "durham-nc",
    name: "Durham Food Hall",
    address: "530 Foster St, Durham, NC 27701",
    lat: 36.0001,
    lng: -78.9001,
    provider: "agent_web_research",
    providerPlaceId: "durham-food-hall",
    types: ["food_hall", "public_market"],
    sourceContext: "agent_public_candidate_research",
    status: "queued",
    reviewState: "awaiting_city_review",
    sourceUrls: ["https://durhamfoodhall.com/"],
    sourceEvidenceSummary: "Official source supports an indoor food hall with public common seating.",
    sourceQueries: ["Durham Food Hall official indoor public area"],
    sourceBuckets: ["food_hall"],
    candidateType: "food_hall",
    indoorPosture: "indoor_only",
    publicAccessPosture: "Public-facing food hall with common visitor areas.",
    allowedCaptureZones: ["public corridors", "common seating"],
    avoidZones: ["staff-only areas", "private tenant prep areas"],
    cameraPolicyEvidence: "No hostile public camera policy found in source review.",
    confidence: "high",
    verificationStatus: "verified",
    estimatedPublicAreaSqft: 12000,
    estimatedCaptureMinutes: 45,
    estimatedCaptureComplexity: "standard",
    demandScore: 0.78,
    suggestedPayoutCents: 7375,
    payoutBasis: "base show-up + estimated walkthrough time + standard complexity",
    lastVerifiedAt: "2026-04-25T20:00:00.000Z",
    reviewedByAgent: "capturer-growth-agent",
    seenCount: 1,
    submittedAtIso: "2026-04-25T20:00:00.000Z",
    lastSeenAtIso: "2026-04-25T20:00:00.000Z",
    ...overrides,
  };
}

describe("city launch candidate review", () => {
  beforeEach(() => {
    listCityLaunchCandidateSignals.mockReset();
    updateCityLaunchCandidateSignalReview.mockReset();
    upsertCityLaunchProspect.mockReset();
    upsertCityLaunchProspect.mockImplementation(async (input: { id: string }) => ({ id: input.id }));
  });

  it("promotes evidence-backed public candidates into approved prospects", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([candidate()]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(result.promotedCount).toBe(1);
    expect(upsertCityLaunchProspect).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "Durham, NC",
        sourceBucket: "public_commercial_review_candidate",
        channel: "agent_public_candidate_research",
        status: "approved",
        ownerAgent: "public-space-review-agent",
        workflowFit: "public-facing common-access capture",
      }),
    );
    expect(updateCityLaunchCandidateSignalReview).toHaveBeenCalledWith(
      "candidate-durham-1",
      expect.objectContaining({
        status: "promoted",
        reviewState: "promoted_to_prospect",
        reviewDecision: "promote",
      }),
    );
  });

  it("keeps candidates in review when source evidence is incomplete", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([
      candidate({ sourceUrls: [], confidence: "medium", verificationStatus: "partially_verified" }),
    ]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(result.keptInReviewCount).toBe(1);
    expect(upsertCityLaunchProspect).not.toHaveBeenCalled();
    expect(updateCityLaunchCandidateSignalReview).toHaveBeenCalledWith(
      "candidate-durham-1",
      expect.objectContaining({
        status: "in_review",
        reviewState: "needs_review_evidence",
        reviewDecision: "keep_in_review",
        reviewReasons: expect.arrayContaining(["missing source URLs"]),
      }),
    );
  });

  it("does not promote outdoor-primary candidates even with other evidence", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([
      candidate({ indoorPosture: "outdoor_primary", verificationStatus: "verified" }),
    ]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(result.rejectedCount).toBe(1);
    expect(upsertCityLaunchProspect).not.toHaveBeenCalled();
    expect(updateCityLaunchCandidateSignalReview).toHaveBeenCalledWith(
      "candidate-durham-1",
      expect.objectContaining({
        status: "rejected",
        reviewState: "rejected_outdoor_primary",
        reviewDecision: "reject",
      }),
    );
  });

  it("rejects private or controlled facility candidates from the public lane", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([
      candidate({ types: ["warehouse"], publicAccessPosture: "Private facility access only." }),
    ]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(result.rejectedCount).toBe(1);
    expect(upsertCityLaunchProspect).not.toHaveBeenCalled();
    expect(updateCityLaunchCandidateSignalReview).toHaveBeenCalledWith(
      "candidate-durham-1",
      expect.objectContaining({
        status: "rejected",
        reviewState: "rejected_private_or_controlled_site_type",
        reviewDecision: "reject",
      }),
    );
  });
});
