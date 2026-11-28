// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const walk = vi.hoisted(() => ({ value: { received: false } as { received: boolean } | null }));
const outlook = vi.hoisted(() => ({ value: { outlook: { phase: "building", reason: null }, certain: true } as Record<string, any> }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
vi.mock("../utils/siteWalkthrough", () => ({ siteWalkthroughIdentity: () => ({}), savedWalkthrough: async () => walk.value }));
vi.mock("../utils/jobOutlook", () => ({ loadJobOutlookDecision: async () => outlook.value }));
const { libraryJobStage } = await import("../utils/taskBrowse");
const { libraryStageLabels } = await import("../../client/src/types/taskBrowse");

// Review, 2026-11-12: a card shared on the start form before any video read "Video received", and a held job read
// "Simulation being built". Each label now comes from the job's real state, and none shows when that is unknown.
describe("the job library's label for where a job's simulation stands", () => {
  beforeEach(() => { walk.value = { received: true }; outlook.value = { outlook: { phase: "building", reason: null }, certain: true }; });
  const stage = () => libraryJobStage("job", {});

  it("says no video yet for a card shared on the start form before any video arrived", async () => {
    walk.value = { received: false };
    expect(await stage()).toBe("no_video");
    expect(libraryStageLabels.no_video).toBe("No video yet");
  });
  it("says the simulation is not started yet while the video is read or the site names the job", async () => {
    for (const phase of ["reading", "waiting_on_site"]) {
      outlook.value = { outlook: { phase, reason: null }, certain: true };
      expect(await stage(), phase).toBe("video_received");
    }
    // Every listed job already has a video, so the label speaks of the simulation.
    expect(libraryStageLabels.video_received).toBe("Simulation not started yet");
  });
  it("says simulation being built only while it is", async () => {
    expect(await stage()).toBe("simulation_building");
  });
  it("says simulation built once the Pipeline rebuilt the scene, or the trial ran in it", async () => {
    expect(await libraryJobStage("job", { pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://x" } } })).toBe("simulation_built");
    outlook.value = { outlook: { phase: "simulation_ready", reason: null }, certain: true };
    expect(await stage()).toBe("simulation_built");
  });
  // Changed on purpose 2026-11-27 (outreach audit D7): an ending after which nothing is built read "The simulation of
  // the site is not finished yet." to a company, which promised more. It now reads that there is no simulation.
  it("says there is no simulation once the job ended with none built and none coming", async () => {
    const { SIMULATION_STATUS } = await import("../../client/src/lib/companyJobPage");
    for (const reason of ["preparation_failed", "spending_cap_reached", "scene_stopped", "no_grant", "window_expired"]) {
      outlook.value = { outlook: { phase: "no_test", reason }, certain: true };
      expect(await stage(), reason).toBe("no_simulation");
    }
    expect(libraryStageLabels.no_simulation).toBe("No simulation");
    expect(SIMULATION_STATUS.no_simulation).toBe("There is no simulation for this job.");
  });
  it("shows nothing for a held job, the site's own ending, or any state it cannot read for certain", async () => {
    // No ending is labelled by the job's kind.
    for (const value of [{ outlook: { phase: "no_test", reason: "scene_held" }, certain: true },
      { outlook: { phase: "no_test", reason: "run_held" }, certain: true },
      { outlook: { phase: "ended_by_site", reason: "closed_by_owner" }, certain: true },
      { outlook: { phase: "building", reason: null }, certain: false }]) {
      outlook.value = value;
      expect(await stage(), JSON.stringify(value)).toBeNull();
    }
    walk.value = null;
    expect(await stage()).toBeNull();
  });
});

// The simulation on request (owner, 2026-11-28): a job whose simulation waits for a company to ask says so on its card,
// and one for which none can be asked now says there is no simulation. Every other job keeps its labels above.
describe("the library label for a job whose simulation is built on request", () => {
  beforeEach(() => { walk.value = { received: true }; });
  it("says the simulation is on request while no company has asked", async () => {
    const { SIMULATION_STATUS } = await import("../../client/src/lib/companyJobPage");
    outlook.value = { outlook: { phase: "building", reason: "simulation_on_request" }, certain: true };
    expect(await libraryJobStage("job", {})).toBe("simulation_on_request");
    expect(libraryStageLabels.simulation_on_request).toBe("Simulation on request");
    expect(SIMULATION_STATUS.simulation_on_request).toBe("A simulation of the site is built when a company asks for one.");
  });
  it("says there is no simulation when none can be asked for now, and being built once one was asked for", async () => {
    outlook.value = { outlook: { phase: "building", reason: "simulation_not_built" }, certain: true };
    expect(await libraryJobStage("job", {})).toBe("no_simulation");
    outlook.value = { outlook: { phase: "building", reason: null }, certain: true };
    expect(await libraryJobStage("job", {})).toBe("simulation_building");
  });
});
