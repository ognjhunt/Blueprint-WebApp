/**
 * The AI control policies Blueprint's simulation can run, in plain words: the
 * policy's common name, who makes it, and the robot it is trained for.
 *
 * Derived by hand from the Pipeline's policy catalog
 * (`BlueprintCapturePipeline/config/beta_policy_candidates.v1.json`), one entry
 * per row with `eligibility.enabled === true` (12 rows). Each field comes from
 * that row's own `display_name`, `policy.source`, `eligibility.license_note`
 * and `interface.robot_profile_id`:
 *
 * - `policy`: the row's `display_name` without its training-set and checkpoint
 *   suffixes. A site never reads a raw checkpoint string.
 * - `maker`: who publishes the weights, as the row's source or licence names
 *   it: `huggingface.co/nvidia/…` and the NVIDIA licence → NVIDIA;
 *   `huggingface.co/allenai/…` and "Official Ai2 README" → Ai2;
 *   `gs://openpi-assets/…` → Physical Intelligence (the Pipeline's own policy
 *   registry names that bucket's family "Physical Intelligence openpi"). The
 *   HumanoidArena rows name only a personal model page, so their maker is
 *   `null`: unknown stays unknown.
 * - `robot`: the row's `interface.robot_profile_id`
 *   (`droid_franka_panda_robotiq_2f85_v1`, `unitree_g1_dex3_sonic_v1`), with
 *   the robot spec catalog's model id so the page can tell whether the policies
 *   ran on the robot the answer picked.
 *
 * Re-derive this file when that catalog's enabled rows change.
 */

export interface SimulatedRobot {
  /** In a sentence: "a Franka research arm". */
  name: string;
  /** The robot spec catalog's id for it. */
  modelId: string;
  /** Whether it is an arm (said "arm") or another kind of robot (said "robot"). */
  kind: "arm" | "humanoid";
}

export interface SimulationPolicy {
  /** The policy's common name, such as "π0.5". */
  policy: string;
  /** Who makes it, or null when the catalog row does not say. */
  maker: string | null;
  robot: SimulatedRobot;
}

export const FRANKA_RESEARCH_ARM: SimulatedRobot = { name: "a Franka research arm", modelId: "franka_emika_panda", kind: "arm" };
export const UNITREE_G1: SimulatedRobot = { name: "a Unitree G1 humanoid", modelId: "unitree_g1", kind: "humanoid" };

const PI = "Physical Intelligence";

export const SIMULATION_POLICIES: Readonly<Record<string, SimulationPolicy>> = {
  // "π0.5 DROID", gs://openpi-assets/checkpoints/polaris/pi05_droid_jointpos_polaris
  pi05_droid: { policy: "π0.5", maker: PI, robot: FRANKA_RESEARCH_ARM },
  // "π0 DROID joint position (PolaRiS)"
  pi0_droid_jointpos_polaris: { policy: "π0", maker: PI, robot: FRANKA_RESEARCH_ARM },
  // "π0 DROID joint position 100k (PolaRiS)": the same policy at a later training checkpoint.
  pi0_droid_jointpos_100k_polaris: { policy: "π0 (a later training version)", maker: PI, robot: FRANKA_RESEARCH_ARM },
  // "π0-FAST DROID joint position (PolaRiS)"
  pi0_fast_droid_jointpos_polaris: { policy: "π0-FAST", maker: PI, robot: FRANKA_RESEARCH_ARM },
  // "GR00T N1.7 DROID", huggingface.co/nvidia/GR00T-N1.7-DROID, "NVIDIA Open Model License"
  groot_n17_droid: { policy: "GR00T N1.7", maker: "NVIDIA", robot: FRANKA_RESEARCH_ARM },
  // "Cosmos 3 Nano Policy DROID", huggingface.co/nvidia/Cosmos3-Nano-Policy-DROID
  cosmos3_nano_policy_droid: { policy: "Cosmos 3 Nano Policy", maker: "NVIDIA", robot: FRANKA_RESEARCH_ARM },
  // "MolmoAct 2 DROID", huggingface.co/allenai/MolmoAct2-DROID, "Official Ai2 README"
  molmoact2_droid: { policy: "MolmoAct 2", maker: "Ai2", robot: FRANKA_RESEARCH_ARM },
  // "Cosmos 3 Edge Policy DROID", huggingface.co/nvidia/Cosmos3-Edge-Policy-DROID
  cosmos3_edge_policy_droid: { policy: "Cosmos 3 Edge Policy", maker: "NVIDIA", robot: FRANKA_RESEARCH_ARM },
  // "HumanoidArena DP G1 / Dex3 / SONIC manipulation", modelscope.cn/models/Twang2026/HumanoidArena_models
  humanoidarena_dp_g1_dex3_sonic: { policy: "HumanoidArena DP (handling objects)", maker: null, robot: UNITREE_G1 },
  // "HumanoidArena π0.5 G1 / Dex3 / SONIC manipulation"
  humanoidarena_pi05_g1_dex3_sonic: { policy: "HumanoidArena π0.5 (handling objects)", maker: null, robot: UNITREE_G1 },
  // "HumanoidArena DP G1 / Dex3 / SONIC navigation"
  humanoidarena_dp_g1_dex3_sonic_vision_navi: { policy: "HumanoidArena DP (walking to a goal)", maker: null, robot: UNITREE_G1 },
  // "HumanoidArena π0.5 G1 / Dex3 / SONIC navigation"
  humanoidarena_pi05_g1_dex3_sonic_vision_navi: { policy: "HumanoidArena π0.5 (walking to a goal)", maker: null, robot: UNITREE_G1 },
};

/** A name that reads like a code (underscores, paths, links, version or digest strings) is never shown. */
const looksLikeCode = (value: string) => /[_/\\:@#]|\.v\d|\bv\d+(\.\d+)*\b|sha256|[0-9a-f]{12,}|\d{3,}/i.test(value);
/** Our own working words ("Current candidate", "Baseline 2") are never a policy's name either. */
const looksLikeWorkingLabel = (value: string) =>
  /\b(candidates?|screening|episodes?|embodiments?|checkpoints?|baselines?|placeholders?|templates?|unnamed|unknown|untitled|current|default|test|tbd|todo)\b/i.test(value);
/** Said of a policy whose name we do not know, in a sentence: "In a simulation of your site, an AI control policy did best". */
export const UNNAMED_POLICY = "an AI control policy";

/**
 * A candidate's plain name. An id this file does not know falls back to the
 * evaluation's display name with no maker and no robot, unless that name reads
 * like a code or a working label, which falls back to "an AI control policy".
 */
export function simulationPolicyFor(candidateId: string, displayName: string): { policy: string; maker: string | null; robot: SimulatedRobot | null } {
  const known = Object.prototype.hasOwnProperty.call(SIMULATION_POLICIES, candidateId) ? SIMULATION_POLICIES[candidateId] : null;
  if (known) return known;
  const name = displayName.trim();
  return { policy: name && !looksLikeCode(name) && !looksLikeWorkingLabel(name) ? name : UNNAMED_POLICY, maker: null, robot: null };
}
