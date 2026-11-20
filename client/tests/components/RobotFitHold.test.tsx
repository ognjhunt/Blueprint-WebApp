import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RobotFitHold, isRobotFitHold, type RobotFitHoldView } from "@/components/site/RobotFitHold";

const hold: RobotFitHoldView = {
  status: "no_fit", holdReason: "website_robot_fit_none:reach", taskKind: "rigid_pick_place",
  counts: { fit: 0, noFit: 8, unknown: 0, unavailable: 128 },
  embodiments: [
    { embodiment: "droid_franka_panda_robotiq_2f85_v1", verdict: "no_fit", reasons: ["reach"] },
    { embodiment: "unitree_g1_dex3_sonic_v1", verdict: "unknown", reasons: ["nominal_arm_span_missed_body_motion_may_reach"] },
    { embodiment: "registered_team_embodiment", verdict: "fit", reasons: [] },
  ],
  embodimentsTruncated: false,
  precheckDigest: `sha256:${"f".repeat(64)}`,
};

describe("RobotFitHold", () => {
  // Launch copy (2026-11-20): the site is told the outcome, an estimate from its video. The per-robot list, the robot
  // setups line and the check's reason codes are engineering detail, and name robot software Blueprint no longer runs.
  it("says none of the robots checked fits, as an estimate from the video, and names no robot or reason code", () => {
    render(<RobotFitHold hold={hold} />);
    const section = screen.getByRole("region", { name: "Robots we checked" });
    expect(within(section).getByRole("heading", { name: "Robots we checked" })).toBeTruthy();
    expect(within(section).getByText(
      "None of the robots we checked fits this job. This is an estimate from your video; it does not mean no robot could do the job.")).toBeTruthy();
    expect(within(section).getByText("Job checked: picking up one object and putting it down somewhere else.")).toBeTruthy();
    expect(within(section).queryAllByRole("listitem")).toHaveLength(0);
    expect(section.textContent).not.toMatch(/Franka|Unitree|robot team|setups|software|paid work|before any spend|scene|ruled out/i);
  });

  it("shows no reason code and no job line when the hold names no kind", () => {
    render(<RobotFitHold hold={{ ...hold, taskKind: null, embodimentsTruncated: true,
      embodiments: [{ embodiment: "droid_franka_panda_robotiq_2f85_v1", verdict: "no_fit", reasons: ["wrist_clearance"] }] }} />);
    expect(screen.queryByText(/wrist clearance|wrist_clearance/)).toBeNull();
    expect(screen.queryByText(/Job checked/)).toBeNull();
    expect(screen.queryByText(/More robots were checked/)).toBeNull();
  });

  it("shows a task kind it does not know with a neutral label, never its code", () => {
    const unknown = { ...hold, taskKind: "fold_cloth_into_bin" };
    expect(isRobotFitHold(unknown)).toBe(true);
    render(<RobotFitHold hold={unknown} />);
    expect(screen.getByText("Job checked: the job you described.")).toBeTruthy();
    expect(screen.queryByText(/fold_cloth|fold cloth/)).toBeNull();
    expect(isRobotFitHold({ ...hold, taskKind: "Fold-Cloth" })).toBe(false);
    expect(isRobotFitHold({ ...hold, taskKind: "a".repeat(41) })).toBe(false);
  });

  it("accepts only a well-formed hold", () => {
    expect(isRobotFitHold(hold)).toBe(true);
    expect(isRobotFitHold(null)).toBe(false);
    expect(isRobotFitHold({ ...hold, status: "unknown" })).toBe(false);
    expect(isRobotFitHold({ ...hold, holdReason: "reach" })).toBe(false);
    expect(isRobotFitHold({ ...hold, counts: { ...hold.counts, noFit: -1 } })).toBe(false);
    expect(isRobotFitHold({ ...hold, embodiments: [{ embodiment: "sketch_bot", verdict: "no_fit", reasons: [] }] })).toBe(false);
  });
});
