// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const listCityLaunchActivations = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());
const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchActivations,
    listCityLaunchProspects,
    listCityLaunchCandidateSignals,
  };
});

describe("city launch status", () => {
  it("returns live, planned, and under-review cities from launch truth with map coordinates", async () => {
    listCityLaunchActivations.mockResolvedValue([
      {
        city: "Austin, TX",
        citySlug: "austin-tx",
        founderApproved: true,
        status: "activation_ready",
      },
      {
        city: "San Francisco, CA",
        citySlug: "san-francisco-ca",
        founderApproved: false,
        status: "growth_live",
      },
      {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        founderApproved: false,
        status: "planning",
      },
    ]);
    listCityLaunchProspects.mockImplementation(async (city: string) => {
      switch (city) {
        case "Austin, TX":
          return [
            {
              id: "austin-prospect",
              city: "Austin, TX",
              citySlug: "austin-tx",
              status: "capturing",
              lat: 30.2672,
              lng: -97.7431,
            },
          ];
        case "Chicago, IL":
          return [
            {
              id: "chicago-prospect",
              city: "Chicago, IL",
              citySlug: "chicago-il",
              status: "qualified",
              lat: 41.8781,
              lng: -87.6298,
            },
          ];
        default:
          return [];
      }
    });
    listCityLaunchCandidateSignals.mockResolvedValue([
      {
        id: "raleigh-candidate",
        city: "Raleigh, NC",
        citySlug: "raleigh-nc",
        name: "Raleigh Warehouse Cluster",
        status: "queued",
        lat: 35.7796,
        lng: -78.6382,
      },
    ]);

    const { buildCreatorLaunchStatus } = await import("../utils/cityLaunchCaptureTargets");
    const result = await buildCreatorLaunchStatus({
      resolvedCity: {
        city: "Austin",
        stateCode: "TX",
      },
    });

    expect(result.supportedCities).toEqual([
      { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
      { city: "San Francisco", stateCode: "CA", displayName: "San Francisco, CA", citySlug: "san-francisco-ca" },
    ]);
    expect(result.cities).toEqual([
      expect.objectContaining({
        city: "Austin",
        displayName: "Austin, TX",
        citySlug: "austin-tx",
        status: "live",
        latitude: 30.2672,
        longitude: -97.7431,
      }),
      expect.objectContaining({
        city: "Chicago",
        displayName: "Chicago, IL",
        citySlug: "chicago-il",
        status: "planned",
        latitude: 41.8781,
        longitude: -87.6298,
      }),
      expect.objectContaining({
        city: "Raleigh",
        displayName: "Raleigh, NC",
        citySlug: "raleigh-nc",
        status: "under_review",
        latitude: 35.7796,
        longitude: -78.6382,
      }),
      expect.objectContaining({
        city: "San Francisco",
        displayName: "San Francisco, CA",
        citySlug: "san-francisco-ca",
        status: "live",
      }),
    ]);
    expect(result.statusCounts).toEqual({
      live: 2,
      planned: 1,
      underReview: 1,
    });
    expect(result.currentCity).toEqual(
      expect.objectContaining({
        city: "Austin",
        stateCode: "TX",
        isSupported: true,
        citySlug: "austin-tx",
        status: "live",
      }),
    );
  });

  it("fails closed when activation ledger reads are unavailable", async () => {
    listCityLaunchActivations.mockRejectedValue(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."));
    listCityLaunchProspects.mockResolvedValue([]);
    listCityLaunchCandidateSignals.mockResolvedValue([]);

    const { buildCreatorLaunchStatus } = await import("../utils/cityLaunchCaptureTargets");
    const result = await buildCreatorLaunchStatus({
      resolvedCity: {
        city: "Austin",
        stateCode: "TX",
      },
    });

    expect(result.supportedCities).toEqual([]);
    expect(result.cities).toEqual([]);
    expect(result.statusCounts).toEqual({
      live: 0,
      planned: 0,
      underReview: 0,
    });
    expect(result.currentCity).toEqual(
      expect.objectContaining({
        city: "Austin",
        stateCode: "TX",
        isSupported: false,
        isPubliclyTracked: false,
        citySlug: null,
        status: null,
      }),
    );
    expect(result.sourceStatus).toEqual(
      expect.objectContaining({
        cityLaunchActivations: "unavailable",
        cityLaunchProspects: "unavailable",
        cityLaunchCandidateSignals: "available",
      }),
    );
    expect(result.sourceStatus.warnings.join("\n")).toContain("RESOURCE_EXHAUSTED");
  });

  it("builds an unavailable status payload for route-level fallback", async () => {
    const { buildUnavailableCreatorLaunchStatus } = await import("../utils/cityLaunchCaptureTargets");
    const result = buildUnavailableCreatorLaunchStatus({
      resolvedCity: {
        city: "Austin",
        stateCode: "TX",
      },
      warning: "creatorLaunchStatus:unexpected builder failure",
    });

    expect(result.supportedCities).toEqual([]);
    expect(result.currentCity).toEqual(
      expect.objectContaining({
        city: "Austin",
        stateCode: "TX",
        citySlug: null,
        isSupported: false,
        status: null,
      }),
    );
    expect(result.sourceStatus).toEqual({
      cityLaunchActivations: "unavailable",
      cityLaunchProspects: "unavailable",
      cityLaunchCandidateSignals: "unavailable",
      warnings: ["creatorLaunchStatus:unexpected builder failure"],
    });
  });
});
