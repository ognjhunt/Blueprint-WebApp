import { z } from "zod";

import { policyCanaryRobotPresetSchema } from "@/lib/policyCanaryRuns";
import { rigidTaskSuccessContractSchema } from "@/lib/rigidTaskSuccessContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

function crossRuntimeJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(crossRuntimeJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${crossRuntimeJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function crossRuntimeDigest(value: Record<string, unknown>, digestField: string) {
  const normalized = { ...value };
  delete normalized[digestField];
  const bytes = new TextEncoder().encode(crossRuntimeJson(normalized));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export const packetPlanningSetupSchema = z.object({
  schema_version: z.literal("task_evaluation_packet_planning_setup.v1"),
  claim_ceiling: z.literal("planning_only"),
  scene_id: z.string().min(1),
  task_id: z.string().min(1),
  source_packet_receipt_digest: digest,
  source_packet_request_digest: digest,
  source_scene_plan_digest: digest,
  source_declared_task_success_contract_digest: digest,
  task_success_contract: rigidTaskSuccessContractSchema,
  task_success_contract_digest: digest,
  robot_presets: z.array(policyCanaryRobotPresetSchema).min(1),
  setup_digest: digest,
}).strict();

export type PacketPlanningSetup = z.infer<typeof packetPlanningSetupSchema>;

export type PacketPolicyPairChoice = {
  schema_version: "task_evaluation_packet_policy_pair_choice.v1";
  claim_ceiling: "planning_only";
  setup_digest: string;
  source_packet_receipt_digest: string;
  robot_preset_id: string;
  policy_candidate_ids: [string, string];
  objective_id: "task_success" | "g1_navigation_goal";
  choice_digest: string;
};

export async function parsePacketPlanningSetup(input: string): Promise<PacketPlanningSetup> {
  if (input.length > 1_000_000) throw new Error("The packet setup file is too large.");
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("The packet setup file is not valid JSON.");
  }
  const setup = packetPlanningSetupSchema.parse(raw);
  if (setup.setup_digest !== await crossRuntimeDigest(setup, "setup_digest")
    || setup.task_success_contract_digest !== setup.task_success_contract.contract_digest
    || setup.task_success_contract.scope.site_id !== setup.scene_id
    || setup.task_success_contract.scope.task_id !== setup.task_id
    || setup.task_success_contract.provenance.confirmation_status !== "confirmed"
    || setup.robot_presets.some((robot) => robot.readiness.status !== "unavailable"
      || robot.policy_candidates.some((candidate) => candidate.readiness.status !== "unavailable"))) {
    throw new Error("The packet setup does not match its sealed task and planning status.");
  }
  return setup;
}

export async function makePacketPolicyPairChoice(
  setup: PacketPlanningSetup,
  robotPresetId: string,
  selectedIds: string[],
): Promise<PacketPolicyPairChoice> {
  const robots = setup.robot_presets.filter((robot) => robot.robot_preset_id === robotPresetId);
  if (robots.length !== 1 || selectedIds.length !== 2 || new Set(selectedIds).size !== 2) {
    throw new Error("Choose two policies from one robot setup.");
  }
  const robot = robots[0];
  const candidates = robot.policy_candidates.filter((candidate) => selectedIds.includes(candidate.candidate_id));
  if (candidates.length !== 2) throw new Error("The selected policies are not in this packet setup.");
  const objective = candidates[0].evaluation_objective_id || "task_success";
  const compatible = candidates.every((candidate) => {
    const match = candidate.compatibility;
    return (candidate.evaluation_objective_id || "task_success") === objective
      && match.robot_preset_ids.includes(robot.robot_preset_id)
      && match.embodiment_ids.includes(robot.embodiment_id)
      && match.observation_schema_ids.includes(robot.observation_schema.schema_id)
      && match.action_schema_ids.includes(robot.action_schema.schema_id)
      && match.simulator_runtime_ids.includes(robot.simulator_runtime_id)
      && match.task_family_ids.includes(robot.task_family_id);
  });
  if (!compatible) throw new Error("Choose two policies with the same objective and compatible robot setup.");
  const choice = {
    schema_version: "task_evaluation_packet_policy_pair_choice.v1" as const,
    claim_ceiling: "planning_only" as const,
    setup_digest: setup.setup_digest,
    source_packet_receipt_digest: setup.source_packet_receipt_digest,
    robot_preset_id: robot.robot_preset_id,
    policy_candidate_ids: candidates.map((candidate) => candidate.candidate_id) as [string, string],
    objective_id: objective,
  };
  return { ...choice, choice_digest: await crossRuntimeDigest(choice, "choice_digest") };
}

export function downloadPacketPolicyPairChoice(choice: PacketPolicyPairChoice, taskId: string) {
  const blob = new Blob([`${JSON.stringify(choice, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${taskId.replace(/[^A-Za-z0-9._-]/g, "-")}-packet-policy-pair-choice.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
