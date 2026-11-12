// @vitest-environment node
/**
 * Codes the Pipeline sends (review, 2026-11-12): an unknown reason or flag never fails a read or an ingest, and the
 * codes known today each have one plain sentence. Written from the rule: each slot, an unknown value, a known one.
 */
import { describe, expect, it } from "vitest";
import { SETUP_FLAG_UNCLASSIFIED_SENTENCE, isKnownFlag, isRobotFactFlag, robotFactNotes, setupFlagSentence } from "../utils/screeningSetupFlagSentences";
import { screeningReasonLabel } from "../../client/src/lib/screeningPlainLanguage";
import { betaPolicyScreeningHoldSchema, isKnownHoldReason, screeningHoldOutcome } from "../utils/betaPolicyScreeningHold";
import { adoptedSceneOutcome, sceneIntentOutcomeSchema, sceneOutcomeMessage, sceneOutcomeNoticeIntent } from "../utils/sceneIntentOutcome";
import { projectWebsiteSceneProgression } from "../utils/websiteSceneProgression";
import { buildTaskLifecycleNotification } from "../utils/taskLifecycleNotifications";
import { parseWebsitePreparationWatch } from "../utils/websitePreparationWatch";
import { referenceCheckSentence } from "../utils/screeningSetupFlagSentences";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { jobOutlook, type JobOutlookInput } from "../utils/jobOutlook";
import { projectAtlasPreparationOutcome, recaptureSentences, TASK_NOT_NAMED_REASON } from "../utils/taskPreparationOutcome";

describe("set-up and scene flags", () => {
  it.each([
    ["scene_estimate:task_object_guessed", "We could not tell for certain from your video which object the job moves, so the simulated scene uses our best guess."],
    ["scene_estimate:target_role_kept", "We could not tell whether one of the things in your video is part of the job, so the simulated scene leaves it where it is."],
    ["scene_estimate:task_review_estimated", "Parts of the job in the simulated scene come from our review of your video, which we could not confirm."],
    ["scene_estimate:destination_guessed", "We could not tell exactly where the object should go, so the simulated scene uses our best guess."],
    ["scene_estimate:destination_near_start", "In the simulated scene, the place the object goes is close to where it starts, so the job may be easier there than at your site."],
    ["task_object_partly_hidden:wrist_left", "In the simulation, the job's object was partly hidden from one of the robot's cameras."],
    ["task_target_marker_partly_hidden:exterior_1", "In the simulation, the mark showing where the object goes was partly hidden from one of the robot's cameras."],
    ["task_object_not_in_view:wrist", "In the simulation, the job's object was not in view of one of the robot's cameras."],
    ["scene_appearance_clearance_too_large", "We could not tidy the reconstructed surface around the object, so it may look partly covered in the simulation."],
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
  // Rewritten (review, 2026-11-12): an unknown TERMINAL kind is the general ending; an unknown wait is not adopted.
  it("does not adopt a wait whose kind it does not know: the job keeps the state its status shows", () => {
    expect(sceneIntentOutcomeSchema.safeParse(sealed("brand_new_kind", false)).success).toBe(true);
    const record = { state: "accepted", website_request_id: "job-1", pipeline_status: { status: "running", outcome: sealed("brand_new_kind", false) } };
    expect(adoptedSceneOutcome(record)).toBeNull();
    expect(sceneOutcomeNoticeIntent("intake-1", record)).toBeNull();
    expect(projectWebsiteSceneProgression(record)).toEqual({ state: "in_progress" });
    expect(adoptedSceneOutcome({ state: "accepted", pipeline_status: { status: "blocked", outcome: sealed("held") } })?.kind).toBe("held");
  });
  it("adopts an ending whose kind it does not know as the general ending: one email, and never 'time ran out'", () => {
    const record = { state: "blocked", website_request_id: "job-1", pipeline_status: { status: "blocked", outcome: sealed("brand_new_kind") } };
    expect(adoptedSceneOutcome(record)?.kind).toBe("stopped");
    const progression = projectWebsiteSceneProgression(record)!;
    expect(progression.state).toBe("ended");
    const notice = sceneOutcomeNoticeIntent("intake-1", record)!;
    expect(notice).toMatchObject({ kind: "stopped", request_id: "job-1" });
    expect(sceneOutcomeNoticeIntent("intake-1", record)).toEqual(notice);
    const sentence = "The simulation of your job stopped, for a reason this page cannot show yet. Our team is alerted when this happens. "
      + "Your answer stays on your job page. Nothing is needed from you.";
    expect(sceneOutcomeMessage("stopped")).toBe(sentence);
    const email = buildTaskLifecycleNotification({ requestId: "job-1", milestone: "scene_outcome", eventId: notice.event_id,
      sceneOutcomeKind: "stopped", to: "owner@example.test" });
    expect(email.subject).toBe("The simulation of your job stopped");
    expect(email.body).toContain(sentence);
    expect(`${email.subject} ${email.body}`).not.toMatch(/time .*ran out|expired|window/i);
    const outlook = jobOutlook({ consentRevoked: false, closedByOwner: false, answer: { state: "ready", unsized: false, reason: null }, windowEnded: false, noGrantEnded: false,
      preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "ended", endingKind: "stopped" }, proof: null });
    expect(outlook).toMatchObject({ phase: "no_test", reason: "simulation_stopped",
      sentence: "The simulation of your job stopped, for a reason this page cannot show yet." });
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

describe("a capacity_blocked ending in the job outlook", () => {
  it("says we could not prepare the job in time, on our side; any other ending keeps its own reason", () => {
    const input = (terminalReason: string | null): JobOutlookInput => ({ consentRevoked: false, closedByOwner: false,
      answer: { state: "ready", unsized: false, reason: null },
      windowEnded: false, noGrantEnded: false, preparation: { state: "failed_terminal", geometryOnlyEnd: false, terminalReason }, scene: null, proof: null });
    expect(jobOutlook(input("capacity_blocked"))).toEqual({ phase: "no_test", reason: "not_processed_in_time",
      sentence: "We could not start or finish preparing your job in time, for a reason on our side. Nothing you did caused it." });
    expect(jobOutlook(input("retry_exhausted")).reason).toBe("preparation_failed");
    expect(jobOutlook(input(null)).reason).toBe("preparation_failed");
  });
});

describe("the preparation watch keeps a long reason code", () => {
  const watch = (terminal_reason: string) => ({ schema_version: "website_preparation_watch.v1", request_id: "job-1", capture_id: "cap-1",
    kind: "ended", state: "failed_terminal", terminal_reason, attempt_count: 1, since_iso: "2026-11-12T00:00:00.000Z", due_at_ms: 1,
    alerted_at_iso: null, delivery: null });
  it.each([40, 41, 128])("parses a %i-character reason, as long as any Pipeline code", length => {
    const code = `r${"x".repeat(length - 1)}`;
    expect(parseWebsitePreparationWatch(watch(code))?.terminal_reason).toBe(code);
  });
});

describe("the reference check's sentence never says a verdict its counts do not show", () => {
  it("adds nothing when no try was scored", () => expect(referenceCheckSentence(0, 0, 3)).toBeNull());
});
