// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("city launch candidate signal intake", () => {
  it("dedupes repeated nearby discovery submissions", async () => {
    const {
      intakeCityLaunchCandidateSignals,
      __resetCityLaunchCandidateSignalMemoryForTests,
    } = await import("../utils/cityLaunchLedgers");

    __resetCityLaunchCandidateSignalMemoryForTests();

    const first = await intakeCityLaunchCandidateSignals([
      {
        creatorId: "user-1",
        city: "Austin, TX",
        name: "Dock One",
        address: "100 Logistics Way",
        lat: 30.2672,
        lng: -97.7431,
        provider: "google_places",
        providerPlaceId: "place-123",
        types: ["warehouse"],
        sourceContext: "app_open_scan",
      },
    ]);
    const second = await intakeCityLaunchCandidateSignals([
      {
        creatorId: "user-1",
        city: "Austin, TX",
        name: "Dock One",
        address: "100 Logistics Way",
        lat: 30.2672,
        lng: -97.7431,
        provider: "google_places",
        providerPlaceId: "place-123",
        types: ["warehouse"],
        sourceContext: "app_open_scan",
      },
    ]);

    expect(first[0]).toEqual(
      expect.objectContaining({
        id: "candidate-austin-tx-place-123",
        status: "queued",
        seenCount: 1,
      }),
    );
    expect(second[0]).toEqual(
      expect.objectContaining({
        id: "candidate-austin-tx-place-123",
        status: "queued",
        seenCount: 2,
      }),
    );
  });
});
