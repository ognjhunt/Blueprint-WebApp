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
  it("says video received while the video is read or the site names the job", async () => {
    for (const phase of ["reading", "waiting_on_site"]) {
      outlook.value = { outlook: { phase, reason: null }, certain: true };
      expect(await stage(), phase).toBe("video_received");
    }
  });
  it("says simulation being built only while it is", async () => {
    expect(await stage()).toBe("simulation_building");
  });
  it("says simulation built once the Pipeline rebuilt the scene, or the trial ran in it", async () => {
    expect(await libraryJobStage("job", { pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://x" } } })).toBe("simulation_built");
    outlook.value = { outlook: { phase: "result", reason: null }, certain: true };
    expect(await stage()).toBe("simulation_built");
  });
  it("says no simulation for this kind of job when it is kept on file or another kind", async () => {
    for (const value of [{ phase: "cannot_match", reason: "kept_on_file" }, { phase: "cannot_match", reason: "other_kind" }]) {
      outlook.value = { outlook: value, certain: true };
      expect(await stage(), value.reason).toBe("no_simulation");
    }
  });
  it("shows nothing for a held job, another ending, or any state it cannot read for certain", async () => {
    for (const value of [{ outlook: { phase: "no_test", reason: "scene_held" }, certain: true },
      { outlook: { phase: "no_test", reason: "window_expired" }, certain: true },
      { outlook: { phase: "ended_by_site", reason: "closed_by_owner" }, certain: true },
      { outlook: { phase: "building", reason: null }, certain: false }]) {
      outlook.value = value;
      expect(await stage(), JSON.stringify(value)).toBeNull();
    }
    walk.value = null;
    expect(await stage()).toBeNull();
  });
});
