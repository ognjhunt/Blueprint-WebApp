// @vitest-environment node
/**
 * Codes the Pipeline sends (review, 2026-11-12): an unknown reason or flag never fails a read or an ingest, and the
 * codes known today each have one plain sentence. Written from the rule: each slot, an unknown value, a known one.
 */
import { describe, expect, it } from "vitest";
import { SETUP_FLAG_UNCLASSIFIED_SENTENCE, isKnownFlag, isRobotFactFlag, robotFactNotes, setupFlagSentence } from "../utils/screeningSetupFlagSentences";
import { screeningReasonLabel } from "../../client/src/lib/screeningPlainLanguage";
import { betaPolicyScreeningHoldSchema, isKnownHoldReason, screeningHoldOutcome } from "../utils/betaPolicyScreeningHold";
import { adoptedSceneOutcome, sceneIntentOutcomeSchema } from "../utils/sceneIntentOutcome";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { jobOutlook, type JobOutlookInput } from "../utils/jobOutlook";
import { projectAtlasPreparationOutcome, recaptureSentences, TASK_NOT_NAMED_REASON } from "../utils/taskPreparationOutcome";

describe("set-up and scene flags", () => {
  it.each([
    ["scene_estimate:task_object_guessed", "We could not tell for certain from your video which object the job moves, so the simulated scene uses our best guess."],
    ["scene_estimate:target_role_kept", "We kept the object's role in the job as your job description gives it, without checking it against your video."],
    ["scene_estimate:task_review_estimated", "Parts of the job in the simulated scene come from our review of your video, which we could not confirm."],
    ["scene_estimate:destination_guessed", "We could not see in your video where the object goes, so the simulated scene uses our best guess."],
    ["scene_estimate:destination_near_start", "In the simulated scene, the place the object goes is close to where it starts, so the job may be easier there than at your site."],
    ["task_object_partly_hidden:wrist_left", "In the simulation, the job's object was partly hidden from one of the robot's cameras."],
    ["task_target_marker_partly_hidden:exterior_1", "In the simulation, the mark showing where the object goes was partly hidden from one of the robot's cameras."],
    ["task_object_not_in_view:wrist", "In the simulation, the job's object was not in view of one of the robot's cameras."],
    ["scene_appearance_clearance_too_large", "In the simulated scene, the space around the object is larger than in your video."],
    ["task_object_placement_differs_from_video", "In the simulated scene, the object does not sit exactly where your video shows it."],
    ["task_object_size_differs_from_video", "In the simulated scene, the object's size differs from what your video shows."],
    ["scene_task_not_visible:tote_1", "None of the robot's cameras in the simulated scene could see the job's object or the mark showing where it goes, so this scene could not test robots. This is ours to fix."],
  ])("says %s in plain words, never the code", (code, sentence) => {
    expect(setupFlagSentence(code)).toBe(sentence);
    expect(isKnownFlag(code)).toBe(true);
    expect(isRobotFactFlag(code)).toBe(false);
  });
  it("keeps the facts about one robot and the object for that robot's result, never as set-up notes", () => {
    const row = { setup_quality_flags: ["task_object_heavier_than_grip", "task_object_wider_than_gripper"],
      scene_check_flags: ["task_object_grip_depends_on_weight", "task_object_needs_edge_grip:top"] };
    expect(robotFactNotes(row)).toEqual(["The object is heavier than this robot's grip is rated to hold.",
      "The object is wider than this robot's gripper opens.",
      "Whether this robot can hold the object depends on its weight, which we estimated from your video.",
      "This robot can only hold the object by its edge."]);
    for (const code of [...row.setup_quality_flags, ...row.scene_check_flags]) expect(isRobotFactFlag(code)).toBe(true);
  });
  it("says only that a point was raised for a flag it does not know, and marks it unknown for staff", () => {
    expect(setupFlagSentence("brand_new_flag:camera_9")).toBe(SETUP_FLAG_UNCLASSIFIED_SENTENCE);
    expect(isKnownFlag("brand_new_flag:camera_9")).toBe(false);
  });
});

describe("waits and holds", () => {
  it.each([
    ["beta_screening_work_disk_wait", "In line for processing on our side."],
    ["account_monthly_spend_job_start_wait", "In line for processing on our side."],
    ["scene_run_in_cold_storage", "Held on our side while its saved simulation is restored. Nothing is needed from you."],
    ["scene_task_not_visible:mark", "Not run: no camera in the simulated scene could see the job's object or where it goes. This is ours to fix."],
  ])("labels %s plainly", (code, label) => expect(screeningReasonLabel(code)).toBe(label));
  it("reads a hold reason it does not know as a hold on our side, instead of refusing the hold", () => {
    expect(isKnownHoldReason("brand_new_hold")).toBe(false);
    expect(screeningHoldOutcome({ status: "held", reason_code: "brand_new_hold" as never })).toBe("held_setup");
    expect(screeningHoldOutcome({ status: "held", reason_code: "robot_free_probe_failed" })).toBe("held_scene_check");
    const shape = betaPolicyScreeningHoldSchema.shape ?? (betaPolicyScreeningHoldSchema as any)._def?.schema?.shape;
    expect(shape?.reason_code.safeParse("brand_new_hold").success ?? true).toBe(true);
  });
});

describe("scene outcome kinds", () => {
  const sealed = (kind: string, terminal = true) => {
    const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one",
      intent_digest: `sha256:${"d".repeat(64)}`, kind, terminal, reason_category: "blueprint_fault", reason_code: "anything",
      decided_at_epoch: 1793000000.25 };
    return { ...value, outcome_digest: crossRuntimeArtifactDigest(value, "outcome_digest") };
  };
  it("parses an outcome kind it does not know, and does not adopt it: the job keeps the state its status shows", () => {
    expect(sceneIntentOutcomeSchema.safeParse(sealed("brand_new_kind")).success).toBe(true);
    expect(adoptedSceneOutcome({ state: "accepted", pipeline_status: { status: "blocked", outcome: sealed("brand_new_kind") } })).toBeNull();
    expect(adoptedSceneOutcome({ state: "accepted", pipeline_status: { status: "blocked", outcome: sealed("held") } })?.kind).toBe("held");
  });
});

describe("a job waiting for its sentence", () => {
  const base: JobOutlookInput = { consentRevoked: false, closedByOwner: false, answer: { state: "ready", unsized: false, reason: null },
    windowEnded: false, noGrantEnded: false, preparation: { state: "awaiting_inputs", geometryOnlyEnd: false }, scene: null, proof: null };
  it("waits on the site: not building, not an ending, no answer", () => {
    expect(jobOutlook({ ...base, awaitsSiteSentence: true })).toEqual({ phase: "waiting_on_site", reason: "task_not_named",
      sentence: "Tell us in one sentence what the robot should do, so we can build the simulation of your job." });
    expect(jobOutlook({ ...base, awaitsSiteSentence: true, windowEnded: true }).phase).toBe("no_test");
    expect(jobOutlook(base).phase).toBe("building");
  });
  it("says so on the page from the Atlas preview, never as a processing failure", () => {
    const outcome = projectAtlasPreparationOutcome({ state: "needs_input", reason: TASK_NOT_NAMED_REASON,
      preview_digest: `sha256:${"a".repeat(64)}` } as never);
    expect(outcome).toMatchObject({ title: "Tell us the job in one sentence", actionOwner: "site", category: "insufficient_evidence" });
  });
  it("names the unseen object from the site's own words when it can, else says the object the job moves", () => {
    expect(recaptureSentences("website_task_object_not_observed", "the red bin").reason).toBe("We could not find the red bin in your video.");
    expect(recaptureSentences("website_task_object_not_observed", null).reason).toBe("We could not find the object the job moves in your video.");
    expect(recaptureSentences("website_task_object_not_observed", "<script>").reason).toBe("We could not find the object the job moves in your video.");
  });
});
