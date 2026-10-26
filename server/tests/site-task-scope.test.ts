// @vitest-environment node
/**
 * Which jobs we can score in simulation today, and what follows when we cannot.
 *
 * The Pipeline builds every non-articulated website job as pick-and-place, so
 * a job we cannot score must be held here, never coerced into a narrower task
 * a team could pass. A team evaluation runs a rigid pick-and-place onto a spot
 * on the surface the object starts on, or opening one door or drawer (Pipeline
 * `team_scene_packet.py` since #2943, `website_task_preparation.py`), so
 * placing an object inside a container is held (audit N4). Under the owner's
 * rule (2026-10-26) a held job is accepted, told we are preparing its
 * evaluation and counted as demand; nothing is refused by keyword.
 */
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_TASK_LINES, SUPPORTED_TASK_SCOPE, screenTaskScope, scoredTaskDescription, taskScopeHeld, taskScopeNotYet,
  taskScopeRecord,
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
    ["Cartons", "unclear"],
    ["Close the cabinet doors at the end of the shift", "closing"],
    ["Packing orders", "unclear"],
    // Placing an object inside a container is blocked before a scene exists.
    ["Pack cartons into totes", "container"],
    ["Put the part in the bin", "container"],
    ["Place each cup inside the crate", "container"],
  ])("holds %j as %s", (summary, reason) => {
    expect(screen(summary)).toMatchObject({ supported: false, kind: null, reason,
      disposition: reason === "unclear" ? "needs_description" : "held_for_preparation" });
  });

  it("records a held job as demand for what to build next, and an unreadable brief as not yet described", () => {
    const held = taskScopeRecord(screen("Folding towels for wash-and-fold orders"), "2026-10-26T00:00:00Z");
    expect(held).toMatchObject({ disposition: "held_for_preparation", demandKind: "deformable" });
    expect(taskScopeHeld({ site_task_scope: held })).toBe(true);
    const undescribed = taskScopeRecord(screen("Your site task"), "2026-10-26T00:00:00Z");
    expect(undescribed).toMatchObject({ disposition: "needs_description", demandKind: null });
    expect(taskScopeHeld({ site_task_scope: undescribed })).toBe(false);
    const scorable = taskScopeRecord(screen("Opening the sample drawer before each batch"), "2026-10-26T00:00:00Z");
    expect(scorable).toMatchObject({ disposition: "scorable", demandKind: null });
    // Nothing is refused by keyword: no harness capability verdict exists yet.
    expect(new Set(["scorable", "held_for_preparation", "needs_description"])).toContain(held.disposition);
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
    expect(status.headline).toMatch(/preparing an evaluation/);
    expect(status.operatorAction).toMatch(/liquids.*two kinds of job: picking up one rigid object and placing it at another spot on the same table, shelf or counter, and opening one door, drawer or lid/);
  });

  it("names only the job kinds Blueprint's evaluation can score, everywhere", () => {
    expect(SUPPORTED_TASK_LINES).toEqual(["Picking up one rigid object and placing it at another spot on the same table, shelf or counter",
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
