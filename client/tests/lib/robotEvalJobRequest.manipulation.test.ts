import { describe, expect, it } from "vitest";

import { siteLibrarySites } from "@/data/siteLibrary";
import {
  DEFAULT_SIMULATOR_EVAL_TASKS,
  buildRobotEvalJobRequestFromSite,
} from "@/lib/robotEvalJobRequest";

describe("robot eval manipulation request builder", () => {
  it("emits manipulation task and all three policy tiers without WebApp proof upgrade", () => {
    const site = siteLibrarySites.find((candidate) => candidate.robotEvalPublication);
    expect(site).toBeTruthy();
    const manipulationTask = DEFAULT_SIMULATOR_EVAL_TASKS.find(
      (task) => task.taskKind === "mobile_manipulation_pick_carry_place",
    );
    expect(manipulationTask).toBeTruthy();

    const request = buildRobotEvalJobRequestFromSite(
      site!,
      { route: "/sites/test", surface: "site-detail" },
      { simulatorTasks: [manipulationTask!] },
    ) as Record<string, any>;

    expect(request.manipulation_task).toMatchObject({
      schema_version: "robot_eval_manipulation_task_request.v1",
      task_kind: "mobile_manipulation_pick_carry_place",
      object_id: "simready_tote_001",
      object_contract_required: true,
    });
    expect(request.policy_tier_selection.requested_tiers.map((tier: any) => tier.tier_id)).toEqual([
      "default_phase_policy",
      "lucky_g1_reference_or_blueprint_physics",
      "team_policy_endpoint_or_vla_adapter",
    ]);
    expect(request.policy_package.default_test_policy).toMatchObject({
      policy_kind: "mobile_manipulation_pick_carry_place",
      object_id: "simready_tote_001",
      object_class: "tote",
    });
    expect(request.execution_request.artifact_contract.expected_outputs).toEqual(
      expect.arrayContaining([
        "manipulation_object_contracts",
        "manipulation_policy_tier_matrix",
        "manipulation_physics_output",
        "manipulation_contact_manifest",
        "manipulation_g1_model_manifest",
        "manipulation_controller_trace",
        "lucky_g1_reference_adapter_manifest",
        "lucky_g1_reference_trace",
        "lucky_g1_reference_video_manifest",
      ]),
    );
    expect(request.manipulation_task.claim_boundary).toMatchObject({
      simulator_physics_execution_proven_by_webapp: false,
      grasp_or_carry_validated_by_webapp: false,
      robot_readiness_proven_by_webapp: false,
    });
  });
});
