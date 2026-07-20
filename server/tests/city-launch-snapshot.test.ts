// @vitest-environment node
//
// TTL snapshot cache for the shared city-launch feed inputs: within the TTL a
// single Firestore fan-out (activations + per-city prospects + candidate
// signals) serves every request, concurrent refreshes collapse into one
// loader (single-flight), and an expired snapshot is reloaded.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  __resetCityLaunchSnapshotForTests,
  getCityLaunchSnapshot,
} from "../utils/cityLaunchSnapshot";

const activation = {
  city: "Austin, TX",
  citySlug: "austin-tx",
  founderApproved: true,
  status: "activation_ready",
};

beforeEach(() => {
  __resetCityLaunchSnapshotForTests();
  vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SNAPSHOT_TTL_MS", "90000");
  listCityLaunchActivations.mockReset().mockResolvedValue([activation]);
  listCityLaunchProspects.mockReset().mockResolvedValue([
    { id: "prospect-1", citySlug: "austin-tx", status: "approved", lat: 30.2, lng: -97.7 },
  ]);
  listCityLaunchCandidateSignals.mockReset().mockResolvedValue([
    { id: "candidate-1", city: "Austin, TX", citySlug: "austin-tx", status: "queued", lat: 30.3, lng: -97.8 },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("city launch snapshot cache", () => {
  it("serves repeated requests from one load within the TTL", async () => {
    const first = await getCityLaunchSnapshot();
    const second = await getCityLaunchSnapshot();

    expect(second).toBe(first);
    expect(listCityLaunchActivations).toHaveBeenCalledTimes(1);
    expect(listCityLaunchProspects).toHaveBeenCalledTimes(1);
    expect(listCityLaunchCandidateSignals).toHaveBeenCalledTimes(1);
    expect(first.prospectsByCitySlug.get("austin-tx")).toHaveLength(1);
    expect(first.candidateSignals).toHaveLength(1);
  });

  it("reloads after the TTL expires", async () => {
    vi.useFakeTimers();
    const first = await getCityLaunchSnapshot();
    await vi.advanceTimersByTimeAsync(89_000);
    expect(await getCityLaunchSnapshot()).toBe(first);

    await vi.advanceTimersByTimeAsync(2_000);
    const reloaded = await getCityLaunchSnapshot();
    expect(reloaded).not.toBe(first);
    expect(listCityLaunchActivations).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent refreshes into a single in-flight load", async () => {
    let releaseLoad: (value: (typeof activation)[]) => void = () => undefined;
    listCityLaunchActivations.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseLoad = resolve;
        }),
    );

    const [first, second, third] = await (async () => {
      const pending = Promise.all([
        getCityLaunchSnapshot(),
        getCityLaunchSnapshot(),
        getCityLaunchSnapshot(),
      ]);
      releaseLoad([activation]);
      return pending;
    })();

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(listCityLaunchActivations).toHaveBeenCalledTimes(1);
  });

  it("captures per-source errors instead of caching a rejection", async () => {
    const prospectsError = new Error("prospects unavailable");
    listCityLaunchActivations.mockResolvedValue([
      activation,
      { city: "Chicago, IL", citySlug: "chicago-il", founderApproved: true, status: "executing" },
    ]);
    listCityLaunchProspects.mockImplementation(async (city: string) => {
      if (city === "Chicago, IL") {
        throw prospectsError;
      }
      return [];
    });
    listCityLaunchCandidateSignals.mockRejectedValue(new Error("signals unavailable"));

    const snapshot = await getCityLaunchSnapshot();
    expect(snapshot.activationsError).toBeNull();
    expect(snapshot.prospectErrorsByCitySlug.get("chicago-il")).toBe(prospectsError);
    expect(snapshot.prospectsByCitySlug.get("austin-tx")).toEqual([]);
    expect(snapshot.candidateSignals).toEqual([]);
    expect(snapshot.candidateSignalsError).toBeInstanceOf(Error);
  });

  it("bypasses caching when the TTL is zero", async () => {
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SNAPSHOT_TTL_MS", "0");
    await getCityLaunchSnapshot();
    await getCityLaunchSnapshot();
    expect(listCityLaunchActivations).toHaveBeenCalledTimes(2);
  });
});
