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
  return { source_commit: id, task_evaluation_run: { team_namespace: "team", scene_id: "scene", configuration_run_id: "configuration" },
    internal_policy_canary_setup: { setup_digest: id, source_launch_id: "launch", offering_digest: "offering", scene_revision_digest: "revision",
      task_success_contract_digest: "contract", task_success_contract: { contract_digest: "contract", scope: { site_id: "scene", task_id: "task" } } } };
}
describe("immutable policy setup selection across releases", () => {
  beforeEach(() => { state.profiles = [profile("old"), profile("new")]; });
  it("selects the exact submitted setup while retained releases remain published", async () => {
    const result = await policyCanarySetupFor("launch", offering, "new");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.setup.setup_digest).toBe("new");
  });
  it("refuses unknown, duplicate, or unselected setup identities", async () => {
    expect(await policyCanarySetupFor("launch", offering, "unknown")).toMatchObject({ ok: false });
    expect(await policyCanarySetupFor("launch", offering)).toMatchObject({ ok: false, code: "POLICY_CANARY_SETUP_AMBIGUOUS" });
    state.profiles.push(profile("new"));
    expect(await policyCanarySetupFor("launch", offering, "new")).toMatchObject({ ok: false, code: "POLICY_CANARY_SETUP_AMBIGUOUS" });
  });
});
