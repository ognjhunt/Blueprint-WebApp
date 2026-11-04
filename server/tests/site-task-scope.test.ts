// @vitest-environment node
/**
 * Which jobs we can score in simulation today, and what follows when we cannot.
 *
 * The Pipeline builds every non-articulated website job as pick-and-place, so
 * a job we cannot score must be held here, never coerced into a narrower task
 * a team could pass. A team evaluation runs a rigid pick-and-place onto a spot
 * on its destination surface, or opening one door or drawer (Pipeline
 * `team_scene_packet.py` since #2943, `website_task_preparation.py`), so
 * placing an object inside a container is held (audit N4). Under the owner's
 * rule (2026-10-26) a held job is accepted, told we are preparing its
 * evaluation and counted as demand; nothing is refused by keyword.
 */
import { describe, expect, it } from "vitest";
import {
  MULTI_STEP_TASK_HOLD, SUPPORTED_TASK_LINES, SUPPORTED_TASK_SCOPE, multiStepHoldMessage, multiStepTaskHold, screenTaskScope,
  scoredTaskDescription, taskScopeHeld, taskScopeNotYet, taskScopeRecord,
} from "../utils/siteTaskScope";
import { teamJobAccess } from "../utils/teamJobAccess";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";

const screen = (summary: string, successDefinition: string | null = null) =>
  screenTaskScope({ summary, successDefinition });

describe("screenTaskScope", () => {
  it.each([
    ["Cartons from a conveyor onto a pallet", "rigid_pick_and_place"],
    ["Pick up the tote, then place it on the rack", "rigid_pick_and_place"],
    ["Pick up each packed carton and place it at the end of the table", "rigid_pick_and_place"],
    ["Pick the part out of the bin and place it on the tray", "rigid_pick_and_place"],
    // The home page's rigid examples are jobs we can score.
    ["Moving clean cups from the dish rack to the counter", "rigid_pick_and_place"],
    ["Moving small boxed parts from the scale to the outbound tray", "rigid_pick_and_place"],
    // A team evaluation scores opening one door or drawer since Pipeline #2943.
    ["Opening the sample drawer before each batch", "articulated_open_close"],
    ["Pull open the cabinet door for the morning check-in", "articulated_open_close"],
  ])("scores %j as %s", (summary, kind) => {
    expect(screen(summary)).toMatchObject({ supported: true, kind, reason: null, disposition: "scorable" });
  });

  it.each([
    ["Folding towels for wash-and-fold orders", "deformable"],
    ["Pour sauce into takeaway containers", "liquid"],
    ["Insert pins into the connector housing", "assembly"],
    ["Loading blanks into one CNC machine and unloading finished parts", "assembly"],
    ["Moving linen carts from the laundry room to each floor", "deformable"],
    ["Push the delivery cart to the loading dock", "mobile"],
    // No website success contract scores a push.
    ["Pushing sealed cartons from the scale into the outbound lane", "push"],
    ["Slide each tray along the bench to the pass", "push"],
    ["Pick parts from the bin and scan each one", "other"],
    ["Open the drawer and put the parts inside", "multi_step"],
    ["Walk each tote over to the packing station", "mobile"],
    ["Pick up the box, then wait for approval", "multi_step"],
    ["Your site task", "unclear"],
    ["Cartons", "other"],
    ["Close the cabinet doors at the end of the shift", "closing"],
    ["Packing orders", "other"],
    // Placing an object inside a container is blocked before a scene exists.
    ["Pack cartons into totes", "container"],
    ["Put the part in the bin", "container"],
    ["Place each cup inside the crate", "container"],
  ])("holds %j as %s", (summary, reason) => {
    expect(screen(summary)).toMatchObject({ supported: false, kind: null, reason,
      disposition: reason === "unclear" ? "needs_description" : "accepted_for_analysis" });
  });

  // A sequence of same-kind steps is several steps, never one rigid move the Pipeline would narrow to one object.
  it.each([
    ["Take the plates to the kitchen then load the dishwasher", ["take the plates to the kitchen", "load the dishwasher"]],
    ["Open the fridge and take out the milk", ["open the fridge", "take out the milk"]],
    ["Take the plates to the kitchen and the cups to the sink", ["take the plates to the kitchen", "the cups to the sink"]],
    ["Carry the plates to the kitchen and put them in the sink", ["carry the plates to the kitchen", "put them in the sink"]],
    ["Unload the truck and stack the boxes on the pallet", ["unload the truck", "stack the boxes on the pallet"]],
    ["Pick up the box, turn it over and put it back on the shelf",
      ["pick up the box", "turn it over", "put it back on the shelf"]],
    ["1. Pick up the tray 2. Put it on the counter 3. Bring the cups to the sink",
      ["pick up the tray", "put it on the counter", "bring the cups to the sink"]],
    ["The robot picks up the tray and then puts the cups on the counter",
      ["the robot picks up the tray", "puts the cups on the counter"]],
    ["Move the box to the shelf. After that, move the crate to the floor.",
      ["move the box to the shelf", "move the crate to the floor"]],
  ])("holds %j as several steps, naming them", (summary, steps) => {
    expect(screen(summary)).toEqual({ supported: false, kind: null, reason: "multi_step",
      disposition: "accepted_for_analysis", matched: steps });
  });

  it.each([
    "Pick up the tray and put it on the counter",
    "Pick up the tray, then put it on the counter",
    "Pick the tray up and place it on the counter",
    "Move the box from the table to the shelf",
    "Grab the mug off the shelf and set it on the table",
    "Take the milk out of the fridge",
    "Put the salt and pepper on the shelf",
    "Pick and place the bracket on the bench",
    "Picking up trays and placing them on the counter",
    "Take the dishes to the sink and put them in the sink",
    "Pick up the red block and put the block on the plate",
  ])("scores %j as one rigid move", summary => {
    expect(screen(summary)).toMatchObject({ supported: true, kind: "rigid_pick_and_place", reason: null, disposition: "scorable" });
  });

  it("reads several steps from the success definition too", () => {
    expect(screen("Your site task", "The plates are moved to the kitchen and the cups are put on the shelf"))
      .toMatchObject({ reason: "multi_step" });
    expect(screen("Pick up the tray and put it on the counter", "The tray is placed on the counter"))
      .toMatchObject({ supported: true, kind: "rigid_pick_and_place" });
  });

  it("records a held job as demand for what to build next, and an unreadable brief as not yet described", () => {
    const held = taskScopeRecord(screen("Folding towels for wash-and-fold orders"), "2026-10-26T00:00:00Z");
    expect(held).toMatchObject({ disposition: "accepted_for_analysis", demandKind: "deformable" });
    expect(taskScopeHeld({ site_task_scope: held })).toBe(true);
    const undescribed = taskScopeRecord(screen("Your site task"), "2026-10-26T00:00:00Z");
    expect(undescribed).toMatchObject({ disposition: "needs_description", demandKind: null });
    expect(taskScopeHeld({ site_task_scope: undescribed })).toBe(false);
    const scorable = taskScopeRecord(screen("Opening the sample drawer before each batch"), "2026-10-26T00:00:00Z");
    expect(scorable).toMatchObject({ disposition: "scorable", demandKind: null });
    // Nothing is refused by keyword: no harness capability verdict exists yet.
    expect(new Set(["scorable", "accepted_for_analysis", "held_for_preparation", "needs_description"])).toContain(held.disposition);
  });

  it("reads the success definition: it can name the job, or rule it out", () => {
    expect(screen("Your site task", "The tote is placed on the outbound rack")).toMatchObject({ supported: true, kind: "rigid_pick_and_place" });
    expect(screen("Move towels to the shelf", null)).toMatchObject({ supported: false, reason: "deformable" });
    expect(screen("Move parts to the shelf", "Each part is folded flat")).toMatchObject({ supported: false, reason: "deformable" });
  });
});

describe("a job we cannot score", () => {
  const listed = {
    request: { buyerType: "site_operator", consent_attestation: undefined },
    public_task_listing: { enabled: true, consentVersion: "public-task-card-v1", approvedAtIso: "2026-10-01T00:00:00Z",
      details: { title: "Folding towels", taskFamily: "Recurring work", siteType: "", region: "", objects: "", cycleTarget:"",pilotTiming:"",pilotBudget:"", opportunity: "open" } },
  };

  it("keeps an approved job card visible while native execution remains held", () => {
    expect(teamJobAccess({ ...listed, site_task_scope: { supported: false, reason: "deformable" } }))
      .toMatchObject({ listed: true, evaluationAvailable: false, reason: "task_not_yet_supported" });
    expect(teamJobAccess(listed).reason).not.toBe("task_not_yet_supported");
    expect(teamJobAccess({ ...listed, site_task_scope: { supported: true, kind: "rigid_pick_and_place" } }).reason)
      .not.toBe("task_not_yet_supported");
  });

  it("shows the scope hint while no preparation or evaluation has been observed", () => {
    const status = projectTaskStatus(taskStatusInputFrom({
      briefDrafted: true, stage: null, site_task_brief_confirmed_at: "2026-10-01",
      site_task_triage: { disposition: "qualified" }, site_task_scope: { supported: false, reason: "liquid" },
      screening: null,
      site_task_next_update_iso: null,
    }));
    expect(status.decision).toBe("not_yet_supported");
    expect(status.headline).toMatch(/preparing an evaluation/);
    expect(status.operatorAction).toMatch(/liquids.*cover: picking up one rigid object and placing it at another spot on a supported destination surface, and opening one door, drawer or lid/);
  });

  it("holds a job that names several steps by name, and asks the site to split it", () => {
    const hold = multiStepTaskHold({ summary: "Take the plates to the kitchen then load the dishwasher" });
    expect(hold).toEqual({ code: MULTI_STEP_TASK_HOLD, steps: ["take the plates to the kitchen", "load the dishwasher"] });
    expect(MULTI_STEP_TASK_HOLD).toBe("website_multi_step_task_preparation_required");
    expect(multiStepTaskHold({ summary: "Pick up the tray and put it on the counter" })).toBeNull();
    expect(multiStepTaskHold({ summary: "Your site task" })).toBeNull();
    expect(multiStepTaskHold(null)).toBeNull();
    // A refused preparation reports a retryable stop; the job page says why it is held instead.
    const status = projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null, hasStoredCapture: true,
      multiStepHold: hold, preparationStatus: { state: "failed_retryable", correlationId: null } }));
    expect(status.decision).toBe("not_yet_supported");
    expect(status.headline).toBe("Your job is on hold because it has more than one step.");
    expect(status.operatorAction).toBe("Our simulation tests one step at a time, such as picking up one object and putting it "
      + "down somewhere else. We read these steps: “take the plates to the kitchen”, “load the dishwasher”. We won't test "
      + "only part of your job without asking you. To have one step tested, change your job description to that one step "
      + "and confirm it. Otherwise your job stays on hold and your video stays saved; you do not need to send it again.");
    expect(status.outcome).toBeUndefined();
    // A run already reported, or a scene already handed off, keeps its own rung.
    expect(projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null, multiStepHold: hold,
      screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 } })).decision).not.toBe("not_yet_supported");
    expect(multiStepHoldMessage(["one step"]).action).not.toMatch(/We read these steps/);
    expect(taskScopeNotYet("multi_step")).toMatchObject({ headline: "Your job is on hold because it has more than one step.",
      nextStep: expect.stringMatching(/change your job description to that one step and confirm it/) });
    expect(taskScopeNotYet("multi_step").detail).toMatch(/tests one step at a time.*rather than test only part of it/);
  });

  it("shows an actual queued evaluation ahead of an older scope hint without claiming execution or results", () => {
    const status = projectTaskStatus(taskStatusInputFrom({
      briefDrafted: true, stage: null, site_task_brief_confirmed_at: "2026-10-01",
      site_task_triage: { disposition: "qualified" }, site_task_scope: { supported: false, reason: "liquid" },
      screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 },
      site_task_next_update_iso: null,
    }));
    expect(status.decision).toBe("screening");
    expect(status.headline).toBe("Robot screening has not started. Results are not available yet.");
    expect(status.operatorAction).toBeNull();
  });

  it("names only the job kinds Blueprint's evaluation can score, everywhere", () => {
    expect(SUPPORTED_TASK_LINES).toEqual(["Picking up one rigid object and placing it on a supported destination surface",
      "Opening one door, drawer or lid of a fixture"]);
    expect(SUPPORTED_TASK_SCOPE).toMatch(/opening one door, drawer or lid/);
    // Screens recorded before Pipeline #2943 still read with their own reason.
    expect(taskScopeNotYet("articulated").detail).toMatch(/opens a door or drawer/);
    expect(taskScopeNotYet("container").detail).toMatch(/inside a container/);
    expect(taskScopeNotYet("closing").detail).not.toMatch(/scores opening/);
  });

  it("asks for one sentence when it could not tell which job this is, instead of calling it out of scope", () => {
    const unclear = taskScopeNotYet("unclear");
    expect(unclear.headline).toMatch(/one sentence/i);
    expect(unclear.headline).toMatch(/before we can evaluate it/);
    expect(unclear.headline).not.toMatch(/robot teams?/i);
    expect(unclear.headline).not.toMatch(/preparing an evaluation/i);
    expect(unclear.nextStep).toMatch(/describe the job in one sentence/i);
    expect(taskScopeNotYet("liquid").headline).toMatch(/preparing an evaluation/i);
    expect(taskScopeNotYet("liquid").nextStep).toMatch(/stays on file.*email you when we can evaluate it/i);
  });
});

describe("scoredTaskDescription", () => {
  it("states what the simulation scored, and never guesses an unknown kind", () => {
    expect(scoredTaskDescription("rigid_pick_place")).toBe("Pick up the object and place it in the target area");
    expect(scoredTaskDescription("pick_and_place")).toBe("Pick up the object and place it in the target area");
    expect(scoredTaskDescription("planar_push")).toBe("Push the object across the surface into the target area");
    // The same words as SUPPORTED_TASK_LINES: one door, drawer or lid.
    expect(scoredTaskDescription("articulated_open_close")).toBe("Open the door, drawer or lid and hold it open");
    expect(scoredTaskDescription("deformable_fold")).toBeNull();
    expect(scoredTaskDescription(undefined)).toBeNull();
  });
});
