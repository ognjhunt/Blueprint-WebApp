/**
 * The one place a set-up flag's code becomes words a site can read.
 *
 * Publication v3 carries typed codes from the Pipeline's own checks: the free
 * CPU scene check, a run's camera gate, and a humanoid row's spawn check
 * (`betaPolicyScreeningContract`). A site never sees a code. Each known code
 * has one plain sentence here; a code this release does not know says only
 * that a point was raised, so a newer Pipeline never breaks the page and
 * nothing is invented about what the point was.
 *
 * A code may be qualified (`robot_rigid_pick_place_unreachable:carry`,
 * `external:task_object:composition_support_...`). The sentence is that of the
 * whole code, else of its first part that has one.
 */
import { screeningRowFlagFields, screeningSceneFeasibility, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";

export const SETUP_FLAG_UNCLASSIFIED_SENTENCE = "Our scene check raised a point we could not classify.";

const SETUP_FLAG_SENTENCES: ReadonlyMap<string, string> = new Map(Object.entries({
  // The free CPU scene check (Pipeline `website_candidate_feasibility.scene_check`).
  scripted_carry_path_not_found: "Our scene check could not find a path for a robot arm to carry the object from where it starts to where the job places it.",
  robot_rigid_pick_place_unreachable: "In our scene check, the robot arm could not reach every point on the way from where the object starts to where the job places it.",
  robot_rigid_pick_place_scene_strike: "In our scene check, the robot arm's path ran into part of the scene.",
  arm_reach_solve_flagged: "Our scene check could not confirm that a robot's arm reaches every step of the job from where it stands in the scene.",
  robot_arm_task_unreached: "In our scene check, a robot's arm did not reach one step of the job from where it stands in the scene.",
  robot_arm_task_beyond_reach: "Our scene check measured one step of the job as beyond a robot arm's reach from where it stands in the scene.",
  robot_reach_insufficient: "Our scene check measured the job as out of reach for at least one robot from the position planned in the scene.",
  // A run's camera gate, before any robot moved (Pipeline `observation_quality_flags`).
  droid_wrist_task_pixels_below_threshold: "Before the run, the robot's wrist camera showed too little of the job's object or its target.",
  policy_canary_task_semantic_visibility_failed: "Before the run, our check of what the robot's cameras could see of the job's object and its target did not pass.",
  composition_support_background_occlusion_requires_review: "Before the run, the scene hid part of the job's object or its target in a camera view.",
  // A humanoid row's spawn and floor check (Pipeline `setup_quality_flags`).
  g1_scene_floor_estimated: "The floor the humanoid robot stood on in the simulation was a flat stand-in, not the floor measured from your video.",
  g1_goal_marker_not_in_initial_view: "At the start, the humanoid robot's camera did not have its goal in view.",
  g1_spawn_clearance_unmeasured: "We could not measure whether the humanoid robot's starting position was clear of the scene.",
  g1_spawn_foot_unsupported: "At the start, the floor did not fully support one of the humanoid robot's feet.",
  g1_spawn_overlap: "One of the humanoid robot's starting positions overlapped the scene, so it was left out of the run.",
  g1_spawn_floor_absent: "One of the humanoid robot's starting positions had no floor under it, so it was left out of the run.",
}));

/** One plain sentence for a flag code; the generic sentence for one this release does not know. Never the code. */
export function setupFlagSentence(code: string): string {
  return SETUP_FLAG_SENTENCES.get(code) ?? code.split(":").map(part => SETUP_FLAG_SENTENCES.get(part)).find(Boolean)
    ?? SETUP_FLAG_UNCLASSIFIED_SENTENCE;
}

/**
 * What the Pipeline's checks recorded about the scene a run used, as sentences: the campaign's scene check
 * first, then each candidate's own flags in row order. Each sentence once; none when nothing was flagged.
 */
export function screeningSetupNotes(publication: BetaPolicyScreeningPublication): string[] {
  const codes = [...(screeningSceneFeasibility(publication)?.flags ?? []),
    ...publication.candidates.flatMap(row => screeningRowFlagFields.flatMap(key => row[key] ?? []))];
  return [...new Set(codes.map(setupFlagSentence))];
}
