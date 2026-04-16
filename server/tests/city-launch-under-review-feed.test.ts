// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchCandidateSignals,
  };
});

describe("city launch under review feed", () => {
  it("returns only queued and in-review candidates near the user", async () => {
    listCityLaunchCandidateSignals.mockResolvedValue([
      {
        id: "candidate-1",
        city: "Austin, TX",
        citySlug: "austin-tx",
        name: "Dock One",
        address: "100 Logistics Way",
        lat: 30.2674,
        lng: -97.7431,
        status: "queued",
        reviewState: "awaiting_city_review",
      },
      {
        id: "candidate-2",
        city: "Austin, TX",
        citySlug: "austin-tx",
        name: "Promoted Place",
        address: "200 Approved Way",
        lat: 30.2675,
        lng: -97.743,
        status: "promoted",
        reviewState: "promoted_to_prospect",
      },
    ]);

    const { buildCityLaunchUnderReviewFeed } = await import("../utils/cityLaunchCaptureTargets");
    const result = await buildCityLaunchUnderReviewFeed({
      lat: 30.2672,
      lng: -97.7431,
      radiusMeters: 2_000,
      limit: 10,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        id: "candidate-1",
        reviewState: "awaiting_city_review",
      }),
    );
  });
});
