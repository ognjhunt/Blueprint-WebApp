// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ profiles: [] as any[] }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
vi.mock("../utils/taskEvaluationLaunchContract", () => ({
  resolvePublishedLaunchProfileCatalog: async () => ({ profiles: state.profiles, blocker: null }),
  forwardTaskEvaluationLaunch: vi.fn(),
}));
vi.mock("../utils/taskEvaluationLaunchForwardWorker", () => ({ forwardStoredPolicyCanaryRun: vi.fn() }));
import { policyCanarySetupFor } from "../utils/policyCanaryRunSubmission";
const offering: any = {
  offering_digest: "offering", evaluation_preparation_binding: { configured_scene_revision_digest: "revision" },
  team_namespace: "team", scene_identity: { id: "scene" }, configuration_run_id: "configuration", task: { identity: { id: "task" } },
};
function profile(id: string) {
  return { profile_id: id, source_commit: id, task_evaluation_run: { team_namespace: "team", scene_id: "scene", configuration_run_id: "configuration" },
    internal_policy_canary_setup: { setup_digest: id, source_launch_id: "launch", offering_digest: "offering", scene_revision_digest: "revision",
      robot_presets: [{ robot_preset_id: "franka", display_name: "Franka", task_family_id: "rigid_pick_place", readiness: { status: "verified_runnable", receipt: { uri: "fixture://robot", digest: "digest" }, reason: null } }],
      task_success_contract_digest: "contract", task_success_contract: { contract_digest: "contract", scope: { site_id: "scene", task_id: "task" } } } };
}
describe("immutable policy setup selection across releases", () => {
  beforeEach(() => { state.profiles = [profile("old"), profile("new")]; });
  it("selects the exact submitted setup while retained releases remain published", async () => {
    const result = await policyCanarySetupFor("launch", offering, { setupDigest: "new", robotPresetId: "franka" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.setup.setup_digest).toBe("new");
  });
  it("chooses a deterministic default but refuses unknown or duplicate identities", async () => {
    expect(await policyCanarySetupFor("launch", offering, { setupDigest: "unknown", robotPresetId: "franka" })).toMatchObject({ ok: false });
    const initial = await policyCanarySetupFor("launch", offering);
    expect(initial).toMatchObject({ ok: true, setup: { setup_digest: "new" } });
    state.profiles.push(profile("new"));
    expect(await policyCanarySetupFor("launch", offering, { setupDigest: "new", robotPresetId: "franka" })).toMatchObject({ ok: false, code: "POLICY_CANARY_SETUP_AMBIGUOUS" });
  });
});
