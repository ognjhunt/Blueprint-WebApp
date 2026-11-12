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
import { isRobotFactFlagCode, screeningReferenceCheckFromCounts, screeningReferenceControl, screeningRowFlagFields, screeningSceneFeasibility, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";

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
  // The known-good control: a scripted reference arm run before the robots (Pipeline `beta_policy_screening_known_good_control`).
  // `:reused` (an earlier check of the same scene) reads as its outcome. Pending says nothing until it ends.
  known_good_control_passed: "Before testing robots, a scripted reference arm that reads exact positions from the simulation completed the job, so the simulated scene can record a success.",
  known_good_control_failed: "A scripted reference arm that reads exact positions from the simulation did not complete the job in the simulated scene, so a low result here may reflect our simulation rather than the robots.",
  known_good_control_unavailable: "We have no scripted reference for this kind of job yet, so nothing confirmed beforehand that the simulated scene can record a success.",
  "known_good_control_unavailable:embodiment": "We have no scripted reference for the robots tested on this job yet, so nothing confirmed beforehand that the simulated scene can record a success.",
  "known_good_control_unavailable:budget": "We did not run our scripted reference check, so that this job's budget could go to testing robots; nothing confirmed beforehand that the simulated scene can record a success.",
  known_good_control_interrupted: "Our scripted reference check did not finish, so it could not confirm that the simulated scene can record a success.",
  // The Pipeline's next flags carry the counts (`known_good_control_partly:1_of_3`) and a reason for an unavailable
  // check. A control row's sentence is still said from its counts (`referenceCheckSentence`); these words are for a
  // flag read on its own.
  known_good_control_partly: "A scripted reference arm that reads exact positions from the simulation did the job in only some of its tries in the simulated scene, so a low result here may partly reflect our simulation rather than the robots.",
  "known_good_control_unavailable:task_kind": "We have no scripted reference for this kind of job yet, so nothing confirmed beforehand that the simulated scene can record a success.",
  // A run's own record that an AI robot's software stopped mid-test (Pipeline `session_policy_server_lost`).
  session_policy_server_lost: "This AI robot's software stopped during the test, so only some tries were counted.",
  // What the simulated scene was built on that was estimated, not observed (Pipeline `atlas_scene_estimates`,
  // the campaign's `scene_feasibility` flags). Each is named; nothing measured is adjusted for it.
  "scene_estimate:level": "We could not tell from your video which way is level, so the simulated scene uses our reconstruction's own estimate of level, which we could not check.",
  "scene_estimate:splat_view_dependence_dropped": "The simulated scene shows each surface in one colour from every angle, so shine and reflections in your video are not reproduced.",
  "scene_estimate:floor": "Part of the floor in the simulated scene is a flat stand-in, not the floor measured from your video.",
  "scene_estimate:collider_registration": "The solid surfaces the robots touch in the simulated scene are an estimate: we could not fully line them up with what your video shows, so we kept only the parts that matched it.",
  "scene_estimate:review_citations_dropped": "Our review of your video pointed to some frames we could not use, so they were left out when we built the scene.",
  "scene_estimate:surrounding_views_dropped": "Some views of the area around the job were left out of the simulated scene to stay within the number of views we process, so those parts are missing from it.",
  // Proposed wording (review, 2026-11-12): what the simulated scene guessed about the job, beside a result.
  "scene_estimate:task_object_guessed": "We could not tell for certain from your video which object the job moves, so the simulated scene uses our best guess.",
  "scene_estimate:target_role_kept": "We could not tell whether one of the things in your video is part of the job, so the simulated scene leaves it where it is.",
  "scene_estimate:task_review_estimated": "Parts of the job in the simulated scene come from our review of your video, which we could not confirm.",
  "scene_estimate:destination_guessed": "We could not tell exactly where the object should go, so the simulated scene uses our best guess.",
  "scene_estimate:destination_near_start": "In the simulated scene, the place the object goes is close to where it starts, so the job may be easier there than at your site.",
  // The Pipeline's final names (review, 2026-11-12).
  "scene_estimate:registration_ambiguous": "We could not line your video up with the simulated scene with full confidence, so things may sit slightly differently from your site.",
  "scene_estimate:placement_uncertainty": "The object's position in the simulated scene may differ from your site by a few centimetres.",
  "scene_estimate:support_height_differs_from_picture": "In the simulated scene, the object rests slightly above or below the surface the cameras show.",
  // A run's camera and set-up checks, per camera where the code names one.
  task_object_partly_hidden: "In the simulation, the job's object was partly hidden from one of the robot's cameras.",
  task_target_marker_partly_hidden: "In the simulation, the mark showing where the object goes was partly hidden from one of the robot's cameras.",
  // Only the cameras actually checked are claimed (Pipeline rename, 2026-11-12; the released Pipeline never sent the
  // old `task_object_not_in_view` flag, so it has no words).
  task_object_not_in_view_of_checked_cameras: "In the simulation, the job's object was not in view of the robot's cameras that we checked.",
  task_target_marker_not_in_view_of_checked_cameras: "In the simulation, the mark showing where the object goes was not in view of the robot's cameras that we checked.",
  scene_appearance_clearance_too_large: "We could not tidy the reconstructed surface around the object, so it may look partly covered in the simulation.",
  task_object_size_differs_from_video: "In the simulated scene, the object's size differs from what your video shows.",
}));

/**
 * Facts about one robot and this object (review, 2026-11-12): shown on THAT robot's result, never as a doubt about how
 * we set up the simulation (they never raise the set-up notice and are not set-up notes).
 */
const ROBOT_FACT_FLAG_SENTENCES: ReadonlyMap<string, string> = new Map(Object.entries({
  task_object_wider_than_gripper: "The object is wider than this robot's gripper opens.",
  task_object_heavier_than_grip: "The object is heavier than this robot's grip is rated to hold.",
  task_object_grip_depends_on_weight: "Whether this robot can hold the object depends on its weight, which we estimated from your video.",
  task_object_needs_edge_grip: "This robot can only hold the object by its edge.",
  fixed_arm_reach_cannot_span_pick_and_place: "From one position, this robot's arm cannot reach both where the object starts and where it goes.",
}));
/** The box-fit flags (`task_object_box_fit_*`): one sentence for the family. */
const BOX_FIT_PREFIX = "task_object_box_fit_";
const BOX_FIT_SENTENCE = "In the simulated scene, the object's size or outline differs from what your video shows.";
const familySentence = (code: string) => code.split(":")[0].startsWith(BOX_FIT_PREFIX) ? BOX_FIT_SENTENCE : undefined;
const flagBase = (code: string) => code.split(":")[0];
/** A flag that is a fact about one robot and the object, not about how we set up the scene. */
export const isRobotFactFlag = (code: string) => isRobotFactFlagCode(code) && ROBOT_FACT_FLAG_SENTENCES.has(flagBase(code));
/** The sentences for one row's robot facts, each once, in row order; shown on that robot's result only. */
export function robotFactNotes(row: Partial<Record<typeof screeningRowFlagFields[number], string[]>>): string[] {
  const codes = screeningRowFlagFields.flatMap(key => row[key] ?? []).filter(isRobotFactFlag);
  return [...new Set(codes.map(code => ROBOT_FACT_FLAG_SENTENCES.get(flagBase(code))!))];
}
/** Whether a flag code is one this release has words for (a set-up note or a robot fact). */
export const isKnownFlag = (code: string) => code === KNOWN_GOOD_CONTROL_PENDING || isRobotFactFlag(code)
  || SETUP_FLAG_SENTENCES.has(code) || code.split(":").some(part => SETUP_FLAG_SENTENCES.has(part)) || familySentence(code) !== undefined;
/** The known-good control's code while it has not ended: no sentence yet. */
const KNOWN_GOOD_CONTROL_PENDING = "known_good_control_pending";

/** One plain sentence for a flag code; the generic sentence for one this release does not know. Never the code. */
export function setupFlagSentence(code: string): string {
  return SETUP_FLAG_SENTENCES.get(code) ?? familySentence(code) ?? code.split(":").map(part => SETUP_FLAG_SENTENCES.get(part)).find(Boolean)
    ?? SETUP_FLAG_UNCLASSIFIED_SENTENCE;
}

/**
 * What the Pipeline's checks recorded about the scene a run used, as sentences: the campaign's scene check
 * first, then each candidate's own flags in row order. Each sentence once; none when nothing was flagged.
 */
export function screeningSetupNotes(publication: BetaPolicyScreeningPublication): string[] {
  // The reference check's sentence states its real counts (`referenceCheckSentence`), never its passed or failed
  // flag: a released Pipeline flags 1 of 3 as passed. Only a check that could not run keeps its own flag's sentence
  // (no reference, budget, interrupted), and one flagged passed or failed with nothing scored gets the plain one.
  const control = screeningReferenceControl(publication.candidates);
  const reference = control ? referenceCheckSentence(control.episodes_scored, control.episodes_succeeded, control.episodes_void) : null;
  const controlCode = (code: string) => /^known_good_control_/.test(code);
  type Entry = { code: string; sentence?: undefined } | { code?: undefined; sentence: string };
  const codes: Entry[] = [...(screeningSceneFeasibility(publication)?.flags ?? []).map(code => ({ code })),
    ...publication.candidates.flatMap(row => screeningRowFlagFields.flatMap(key => (row[key] ?? []).map(code =>
      row === control && controlCode(code) && code !== KNOWN_GOOD_CONTROL_PENDING
        && (reference || /^known_good_control_(passed|failed)(:|$)/.test(code))
        ? { sentence: reference ?? REFERENCE_NOT_SCORED } : { code })))];
  return [...new Set(codes.filter(entry => entry.code === undefined || (entry.code !== KNOWN_GOOD_CONTROL_PENDING && !isRobotFactFlag(entry.code)))
    .map(entry => entry.code !== undefined ? setupFlagSentence(entry.code) : entry.sentence))];
}

const REFERENCE_ARM = "a scripted reference arm that reads exact positions from the simulation";
const REFERENCE_NOT_SCORED = "None of our scripted reference check's tries could be scored, so it could not confirm that the simulated scene can record a success.";
/**
 * The reference check in one sentence with its real numbers: successes of its scored tries, and how many could not be
 * scored when any. Null when none was scored (its flag's own sentence says why). The verdict is
 * `screeningReferenceCheckFromCounts` of the same numbers.
 */
export function referenceCheckSentence(scored: number, succeeded: number, voided: number): string | null {
  const check = screeningReferenceCheckFromCounts(scored, succeeded);
  if (check === "could_not_run") return null;
  const done = `did the job in ${succeeded === 0 ? "none" : succeeded} of ${scored} scored ${scored === 1 ? "try" : "tries"} in the simulated scene`
    + (voided > 0 ? ` (${voided} more ${voided === 1 ? "try" : "tries"} could not be scored)` : "");
  if (check === "passed") return `Before testing robots, ${REFERENCE_ARM} ${done}, so the simulated scene can record a success.`;
  const arm = REFERENCE_ARM[0].toUpperCase() + REFERENCE_ARM.slice(1);
  return check === "partly"
    ? `${arm} ${done}, so a low result here may partly reflect our simulation rather than the robots.`
    : `${arm} ${done}, so a low result here may reflect our simulation rather than the robots.`;
}
