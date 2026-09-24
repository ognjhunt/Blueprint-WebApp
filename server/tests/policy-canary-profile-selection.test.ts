// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ profiles: [] as any[] }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
vi.mock("../utils/taskEvaluationLaunchContract", () => ({
  resolvePublishedLaunchProfileCatalog: async () => ({
    profiles: state.profiles,
  }),
}));
vi.mock("../utils/taskEvaluationLaunchForwardWorker", () => ({
  forwardStoredPolicyCanaryRun: vi.fn(),
}));
import { policyCanarySetupFor } from "../utils/policyCanaryRunSubmission";

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;
const offering = {
  offering_digest: sha("a"),
  team_namespace: "team-1",
  configuration_run_id: "construction-1",
  scene_identity: { id: "scene-1" },
  task: { identity: { id: "task-1" } },
  evaluation_preparation_binding: {
    configured_scene_revision_digest: sha("b"),
  },
} as any;
function profile(id: string, robot: string, digest: string, team = "team-1") {
  return {
    profile_id: id,
    source_commit: "a".repeat(40),
    task_evaluation_run: {
      team_namespace: team,
      scene_id: "scene-1",
      configuration_run_id: "construction-1",
    },
    internal_policy_canary_setup: {
      source_launch_id: "launch-1",
      offering_digest: sha("a"),
      scene_revision_digest: sha("b"),
      setup_digest: digest,
      task_success_contract_digest: sha("c"),
      task_success_contract: {
        contract_digest: sha("c"),
        scope: { site_id: "scene-1", task_id: "task-1" },
      },
      robot_presets: [
        {
          robot_preset_id: robot,
          display_name: robot,
          task_family_id: "pick_place",
          readiness: {
            status: "verified_runnable",
            receipt: { uri: "fixture://readiness", digest: sha("d") },
            reason: null,
          },
        },
      ],
    },
  };
}
describe("per-embodiment execution profile selection", () => {
  it("selects G1's own sealed profile and lists only this team's exact scene revision", async () => {
    state.profiles = [
      profile("franka", "franka", sha("e")),
      profile("g1", "g1", sha("f")),
      profile("private", "other", sha("1"), "other-team"),
    ];
    const result = await policyCanarySetupFor("launch-1", offering, {
      setupDigest: sha("f"),
      robotPresetId: "g1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("selection refused");
    expect(result.profile.profile_id).toBe("g1");
    expect(result.setup.setup_digest).toBe(sha("f"));
    expect(result.availableSetups.map((row) => row.robot_preset_id)).toEqual([
      "franka",
      "g1",
    ]);
  });
  it("never falls back to Franka for a stale digest or mismatched G1 selection", async () => {
    state.profiles = [
      profile("franka", "franka", sha("e")),
      profile("g1", "g1", sha("f")),
    ];
    for (const selection of [
      { setupDigest: sha("1"), robotPresetId: "g1" },
      { setupDigest: sha("e"), robotPresetId: "g1" },
    ]) {
      expect(
        await policyCanarySetupFor("launch-1", offering, selection),
      ).toMatchObject({ ok: false, status: 409 });
    }
  });
  it("refuses ambiguous duplicate published plans", async () => {
    state.profiles = [
      profile("g1-a", "g1", sha("f")),
      profile("g1-b", "g1", sha("f")),
    ];
    expect(
      await policyCanarySetupFor("launch-1", offering, {
        setupDigest: sha("f"),
        robotPresetId: "g1",
      }),
    ).toMatchObject({ ok: false, code: "POLICY_CANARY_SETUP_AMBIGUOUS" });
  });
});
