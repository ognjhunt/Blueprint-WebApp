// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const listCityLaunchActivations = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchActivations,
  };
});

describe("city launch status", () => {
  it("returns only launch-supported cities from activation truth", async () => {
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
    expect(result.currentCity).toEqual(
      expect.objectContaining({
        city: "Austin",
        stateCode: "TX",
        isSupported: true,
        citySlug: "austin-tx",
      }),
    );
  });
});
