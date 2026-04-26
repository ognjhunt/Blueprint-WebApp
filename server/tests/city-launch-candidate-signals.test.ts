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

  it("can fetch an explicit candidate id without listing unrelated candidate records", async () => {
    const {
      intakeCityLaunchCandidateSignals,
      listCityLaunchCandidateSignals,
      __resetCityLaunchCandidateSignalMemoryForTests,
    } = await import("../utils/cityLaunchLedgers");

    __resetCityLaunchCandidateSignalMemoryForTests();

    await intakeCityLaunchCandidateSignals([
      {
        creatorId: "user-1",
        city: "Durham, NC",
        name: "Target Candidate",
        address: "100 Main St",
        lat: 36.001,
        lng: -78.901,
        provider: "apple_mapkit",
        providerPlaceId: "mapkit:target",
        types: ["store"],
        sourceContext: "app_open_scan",
      },
      {
        creatorId: "user-1",
        city: "Durham, NC",
        name: "Other Candidate",
        address: "200 Main St",
        lat: 36.002,
        lng: -78.902,
        provider: "apple_mapkit",
        providerPlaceId: "mapkit:other",
        types: ["store"],
        sourceContext: "app_open_scan",
      },
    ]);

    const records = await listCityLaunchCandidateSignals({
      city: "Durham, NC",
      candidateIds: ["candidate-durham-nc-mapkit-target"],
      statuses: ["queued"],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      id: "candidate-durham-nc-mapkit-target",
      name: "Target Candidate",
    }));
  });
});
