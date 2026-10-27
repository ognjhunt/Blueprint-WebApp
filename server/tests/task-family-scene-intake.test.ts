// @vitest-environment node
import { describe, expect, it } from "vitest";
import { taskFamilyIntakeTask, taskFamilyNames, websiteFamilySourceBinding } from "../utils/taskFamilySceneIntake";

const sha = (char: string) => `sha256:${char.repeat(64)}`;
const authority = { request_id: "one", scene_id: "site-one", capture_id: "walkthrough-one", task_context_digest: sha("a") };
const task = () => ({ task_id: `website-${authority.task_context_digest.slice(7, 27)}`, strategy: "button_press",
  task_success_contract_digest: sha("b"), native_runtime_contract_digest: sha("c"),
  task_family_runtime_selection: { runtime_id: "qualified-native-runtime", runtime_catalog_digest: sha("d") },
  policy_selection: { candidate_id: "qualified-policy", catalog_digest: sha("e"), configuration_digest: sha("f") } });

describe("source-bound family preparation identity", () => {
  it.each(taskFamilyNames)("retains the strict %s request without a substitute subject or scientific-contract rewrite", strategy => {
    const value = { ...task(), strategy };
    expect(taskFamilyIntakeTask.parse(value)).toEqual(value);
    expect(websiteFamilySourceBinding(value, authority)).toEqual(value);
    const { policy_selection: _selection, ...withoutPolicy } = value;
    expect(taskFamilyIntakeTask.parse(withoutPolicy)).toEqual(withoutPolicy);
  });

  it.each([
    { strategy: "invented_physics" }, { task_success_contract_digest: "unsealed" },
    { native_runtime_contract_digest: sha("g") }, { task_success_contract: { schema_version: "task_family_success_contract.v1" } },
    { subject: { geometry_origin: "synthetic_design" } },
    { task_family_runtime_selection: { runtime_id: "runtime", runtime_catalog_digest: sha("d"), factory: "job.supplied:build" } },
    { task_family_runtime_selection: { runtime_id: "", runtime_catalog_digest: sha("d") } },
    { task_family_runtime_selection: { runtime_id: "a".repeat(129), runtime_catalog_digest: sha("d") } },
    { task_family_runtime_selection: { runtime_id: "runtime", runtime_catalog_digest: "unsealed" } },
    { policy_selection: { candidate_id: "policy", catalog_digest: sha("e"), configuration_digest: "unsealed" } },
  ])("refuses an unknown, unsealed or executable request field (%j)", patch => {
    expect(taskFamilyIntakeTask.safeParse({ ...task(), ...patch }).success).toBe(false);
  });

  it.each([
    { task_context_digest: sha("b") }, { scene_id: "site-another" },
    { request_id: "another" }, { capture_id: "../walkthrough-one" }, { task_context_digest: "unsealed" },
  ])("cannot bind to a different or malformed sponsored scope (%j)", patch => {
    expect(() => websiteFamilySourceBinding(task(), { ...authority, ...patch })).toThrow("family_binding_invalid");
  });
});
