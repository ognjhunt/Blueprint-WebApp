// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());
const updateCityLaunchCandidateSignalReview = vi.hoisted(() => vi.fn());
const upsertCityLaunchProspect = vi.hoisted(() => vi.fn());
const dispatchCityLaunchTargetPromotionNotifications = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchCandidateSignals,
  updateCityLaunchCandidateSignalReview,
  upsertCityLaunchProspect,
}));

vi.mock("../utils/cityLaunchNotifications", () => ({
  dispatchCityLaunchTargetPromotionNotifications,
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
    dispatchCityLaunchTargetPromotionNotifications.mockReset();
    dispatchCityLaunchTargetPromotionNotifications.mockResolvedValue({
      generatedAt: "2026-04-25T20:00:00.000Z",
      dryRun: false,
      city: "Durham, NC",
      citySlug: "durham-nc",
      triggerType: "city_launch_targets_promoted",
      prospectIds: ["public_candidate_durham-nc_durham-food-hall"],
      recipientCount: 0,
      queuedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      records: [],
    });
    upsertCityLaunchProspect.mockImplementation(async (input: { id: string }) => ({ ...input, id: input.id }));
  });

  it("promotes evidence-backed public candidates into approved prospects", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([candidate()]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(listCityLaunchCandidateSignals).toHaveBeenCalledWith({
      city: "Durham, NC",
      statuses: ["queued", "in_review"],
      candidateIds: [],
      limit: 100,
    });
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
    expect(dispatchCityLaunchTargetPromotionNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "Durham, NC",
        promotedProspects: [
          expect.objectContaining({
            id: "public_candidate_durham-nc_durham-food-hall",
            status: "approved",
          }),
        ],
        dryRun: false,
      }),
    );
  });

  it("passes explicit candidate ids through so batch handoffs do not scan the whole city", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([candidate({ id: "candidate-durham-2" })]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({
      city: "Durham, NC",
      candidateIds: [" candidate-durham-2 ", "candidate-durham-2"],
      dryRun: true,
    });

    expect(listCityLaunchCandidateSignals).toHaveBeenCalledWith({
      city: "Durham, NC",
      statuses: ["queued", "in_review"],
      candidateIds: ["candidate-durham-2"],
      limit: 1,
    });
    expect(result.reviewedCount).toBe(1);
  });

  it("passes explicit candidate ids through so batch handoffs do not scan the whole city", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([candidate({ id: "candidate-durham-2" })]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({
      city: "Durham, NC",
      candidateIds: [" candidate-durham-2 ", "candidate-durham-2"],
      dryRun: true,
    });

    expect(listCityLaunchCandidateSignals).toHaveBeenCalledWith({
      city: "Durham, NC",
      statuses: ["queued", "in_review"],
      candidateIds: ["candidate-durham-2"],
      limit: 1,
    });
    expect(result.reviewedCount).toBe(1);
  });

  it("keeps candidates in review when source evidence is incomplete", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([
      candidate({ sourceUrls: [], confidence: "medium", verificationStatus: "partially_verified" }),
    ]);

    const { reviewCityLaunchCandidateBatch } = await import("../utils/cityLaunchCandidateReview");
    const result = await reviewCityLaunchCandidateBatch({ city: "Durham, NC", dryRun: false });

    expect(result.keptInReviewCount).toBe(1);
    expect(upsertCityLaunchProspect).not.toHaveBeenCalled();
    expect(dispatchCityLaunchTargetPromotionNotifications).not.toHaveBeenCalled();
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
    expect(dispatchCityLaunchTargetPromotionNotifications).not.toHaveBeenCalled();
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
    expect(dispatchCityLaunchTargetPromotionNotifications).not.toHaveBeenCalled();
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
