// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const listCityLaunchActivations = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchActivations,
    listCityLaunchProspects,
  };
});

describe("city launch capture targets", () => {
  it("returns only active, nearby, capture-safe launch targets", async () => {
    listCityLaunchActivations.mockResolvedValue([
      {
        city: "Austin, TX",
        citySlug: "austin-tx",
        founderApproved: true,
        status: "activation_ready",
      },
      {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        founderApproved: false,
        status: "planning",
      },
    ]);

    listCityLaunchProspects.mockImplementation(async (city: string) => {
      if (city === "Austin, TX") {
        return [
          {
            id: "prospect-1",
            city,
            citySlug: "austin-tx",
            name: "Dock One",
            sourceBucket: "industrial_warehouse",
            status: "approved",
            lat: 30.2674,
            lng: -97.7431,
            siteAddress: "100 Logistics Way",
            locationSummary: "Warehouse corridor",
            siteCategory: "warehouse",
            workflowFit: "dock handoff",
            priorityNote: "High exact-site value",
          },
          {
            id: "prospect-2",
            city,
            citySlug: "austin-tx",
            name: "Far Away",
            sourceBucket: "industrial_warehouse",
            status: "approved",
            lat: 31.0,
            lng: -98.0,
            siteAddress: "200 Far Away",
            locationSummary: null,
            siteCategory: "warehouse",
            workflowFit: null,
            priorityNote: null,
          },
        ];
      }
      return [
        {
          id: "prospect-3",
          city,
          citySlug: "chicago-il",
          name: "Chicago Candidate",
          sourceBucket: "industrial_warehouse",
          status: "approved",
          lat: 41.8781,
          lng: -87.6298,
          siteAddress: "Chicago",
          locationSummary: null,
          siteCategory: "warehouse",
          workflowFit: null,
          priorityNote: null,
        },
      ];
    });

    const { buildCityLaunchCaptureTargetFeed } = await import("../utils/cityLaunchCaptureTargets");
    const result = await buildCityLaunchCaptureTargetFeed({
      lat: 30.2672,
      lng: -97.7431,
      radiusMeters: 2_000,
      limit: 10,
    });

    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]).toMatchObject({
      id: "prospect-1",
      displayName: "Dock One",
      launchContext: expect.objectContaining({
        citySlug: "austin-tx",
        prospectStatus: "approved",
        researchBacked: true,
      }),
    });
  });
});
