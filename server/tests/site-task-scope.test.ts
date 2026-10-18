// @vitest-environment node
/**
 * Which jobs we can score in simulation today, and what follows when we cannot.
 *
 * The Pipeline builds every non-articulated website job as pick-and-place, so
 * a job we cannot score must be refused here, never coerced into a narrower
 * task a team could pass. A team evaluation runs only a rigid pick-and-place
 * onto a spot on the surface the object starts on (Pipeline
 * `team_scene_packet.py`, `website_task_preparation.py`), so opening jobs and
 * placing an object inside a container are refused too (audit N4).
 */
import { describe, expect, it } from "vitest";
import { SUPPORTED_TASK_LINES, SUPPORTED_TASK_SCOPE, screenTaskScope, scoredTaskDescription, taskScopeNotYet } from "../utils/siteTaskScope";
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
  ])("scores %j as %s", (summary, kind) => {
    expect(screen(summary)).toMatchObject({ supported: true, kind, reason: null });
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
    ["Cartons", "unclear"],
    ["Close the cabinet doors at the end of the shift", "closing"],
    ["Packing orders", "unclear"],
    // A team evaluation cannot score opening a door or drawer (the Lab
    // example on the home page is an illustration, never a scoreable job).
    ["Opening the sample drawer before each batch", "articulated"],
    ["Pull open the cabinet door for the morning check-in", "articulated"],
    // Placing an object inside a container is blocked before a scene exists.
    ["Pack cartons into totes", "container"],
    ["Put the part in the bin", "container"],
    ["Place each cup inside the crate", "container"],
  ])("refuses %j as %s", (summary, reason) => {
    expect(screen(summary)).toMatchObject({ supported: false, kind: null, reason });
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
    public_task_listing: { enabled: true, consentVersion: "v", approvedAtIso: "2026-10-01T00:00:00Z",
      details: { title: "Folding towels", taskFamily: "Recurring work", siteType: "", region: "", objects: "", opportunity: "open" } },
  };

  it("is closed to robot teams once its screen is recorded, and unscreened jobs are unaffected", () => {
    expect(teamJobAccess({ ...listed, site_task_scope: { supported: false, reason: "deformable" } }))
      .toMatchObject({ listed: false, evaluationAvailable: false, reason: "task_not_yet_supported" });
    expect(teamJobAccess(listed).reason).not.toBe("task_not_yet_supported");
    expect(teamJobAccess({ ...listed, site_task_scope: { supported: true, kind: "rigid_pick_and_place" } }).reason)
      .not.toBe("task_not_yet_supported");
  });

  it("shows the same not-yet on the job page, ahead of every later rung", () => {
    const status = projectTaskStatus(taskStatusInputFrom({
      briefDrafted: true, stage: null, site_task_brief_confirmed_at: "2026-10-01",
      site_task_triage: { disposition: "qualified" }, site_task_scope: { supported: false, reason: "liquid" },
      screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 },
      site_task_next_update_iso: null,
    }));
    expect(status.decision).toBe("not_yet_supported");
    expect(status.headline).toMatch(/cannot score this job.*not open to robot teams/);
    expect(status.operatorAction).toMatch(/liquids.*one kind of job: picking up one rigid object and placing it at another spot on the same table, shelf or counter/);
  });

  it("names only the job kind a robot team can run, everywhere", () => {
    expect(SUPPORTED_TASK_LINES).toEqual(["Picking up one rigid object and placing it at another spot on the same table, shelf or counter"]);
    expect(SUPPORTED_TASK_SCOPE).not.toMatch(/door|drawer|open/i);
    expect(taskScopeNotYet("articulated").detail).toMatch(/opens a door or drawer/);
    expect(taskScopeNotYet("container").detail).toMatch(/inside a container/);
    expect(taskScopeNotYet("closing").detail).not.toMatch(/scores opening/);
  });

  it("asks for one sentence when it could not tell which job this is, instead of calling it out of scope", () => {
    const unclear = taskScopeNotYet("unclear");
    expect(unclear.headline).toMatch(/one sentence/i);
    expect(unclear.headline).not.toMatch(/cannot score this job/i);
    expect(unclear.nextStep).toMatch(/describe the job in one sentence/i);
    expect(taskScopeNotYet("liquid").headline).toMatch(/cannot score this job/i);
  });
});

describe("scoredTaskDescription", () => {
  it("states what the simulation scored, and never guesses an unknown kind", () => {
    expect(scoredTaskDescription("rigid_pick_place")).toBe("Pick up the object and place it in the target area");
    expect(scoredTaskDescription("pick_and_place")).toBe("Pick up the object and place it in the target area");
    expect(scoredTaskDescription("planar_push")).toBe("Push the object across the surface into the target area");
    expect(scoredTaskDescription("articulated_open_close")).toBe("Open the door or drawer and hold it open");
    expect(scoredTaskDescription("deformable_fold")).toBeNull();
    expect(scoredTaskDescription(undefined)).toBeNull();
  });
});
