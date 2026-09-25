import { canonicalDigest } from "@/lib/rigidTaskSuccessContract";
import type { PolicyCanaryRobotPreset, PolicyCanarySetupView } from "@/lib/policyCanaryRuns";

export type PolicyPairChoice = {
  schema_version: "task_evaluation_policy_pair_choice.v1";
  claim_ceiling: "planning_only";
  source_launch_id: string;
  offering_digest: string;
  scene_revision_digest: string;
  setup_digest: string;
  robot_preset_id: string;
  policy_candidate_ids: [string, string];
  objective_id: "task_success" | "g1_navigation_goal";
  choice_digest: string;
};

export async function makePolicyPairChoice(
  setup: PolicyCanarySetupView,
  robot: PolicyCanaryRobotPreset,
  selectedIds: string[],
): Promise<PolicyPairChoice> {
  if (setup.robot_presets.filter((item) => item.robot_preset_id === robot.robot_preset_id).length !== 1
    || selectedIds.length !== 2 || new Set(selectedIds).size !== 2) {
    throw new Error("Choose two policies from one robot setup.");
  }
  const candidates = robot.policy_candidates.filter((item) => selectedIds.includes(item.candidate_id));
  if (candidates.length !== 2) throw new Error("The selected policies are no longer in this setup.");
  const objective = candidates[0].evaluation_objective_id || "task_success";
  const compatible = candidates.every((candidate) => {
    const contract = candidate.compatibility;
    return (candidate.evaluation_objective_id || "task_success") === objective
      && contract.robot_preset_ids.includes(robot.robot_preset_id)
      && contract.embodiment_ids.includes(robot.embodiment_id)
      && contract.observation_schema_ids.includes(robot.observation_schema.schema_id)
      && contract.action_schema_ids.includes(robot.action_schema.schema_id)
      && contract.simulator_runtime_ids.includes(robot.simulator_runtime_id)
      && contract.task_family_ids.includes(robot.task_family_id);
  });
  if (!compatible) throw new Error("Choose two policies with the same objective and compatible robot setup.");
  const choice = {
    schema_version: "task_evaluation_policy_pair_choice.v1" as const,
    claim_ceiling: "planning_only" as const,
    source_launch_id: setup.source_launch_id,
    offering_digest: setup.offering_digest,
    scene_revision_digest: setup.scene_revision_digest,
    setup_digest: setup.setup_digest,
    robot_preset_id: robot.robot_preset_id,
    policy_candidate_ids: candidates.map((item) => item.candidate_id) as [string, string],
    objective_id: objective,
  };
  return { ...choice, choice_digest: await canonicalDigest(choice, "choice_digest") };
}

export function downloadPolicyPairChoice(choice: PolicyPairChoice) {
  const blob = new Blob([`${JSON.stringify(choice, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${choice.source_launch_id.replace(/[^A-Za-z0-9._-]/g, "-")}-policy-pair-choice.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
