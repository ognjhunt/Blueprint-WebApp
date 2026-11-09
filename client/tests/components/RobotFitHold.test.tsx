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
  it("names the robots checked and why each did not fit, and says it is a pre-spend estimate", () => {
    render(<RobotFitHold hold={hold} />);
    const section = screen.getByRole("region", { name: "Robots checked before any spend" });
    expect(within(section).getByText(/before any paid work/)).toBeTruthy();
    expect(within(section).getByText(/no robot was tried on your job/)).toBeTruthy();
    expect(within(section).getByText("Task checked: picking up one object and putting it down somewhere else.")).toBeTruthy();
    expect(within(section).getByText(
      "136 robot setups (a robot and the software that drives it): 8 ruled out, 128 not available for this job.")).toBeTruthy();
    const rows = within(section).getAllByRole("listitem").map(row => row.textContent);
    expect(rows).toEqual([
      "Franka Panda arm with a Robotiq 2F-85 gripper: Ruled out (the task is farther than the arm reaches from any place it could be mounted level with the lower work surface)",
      "Unitree G1 humanoid with Dex3 hands: Not decided before the scene is built (standing still, its arms do not span the task; it may still reach by walking, leaning or crouching)",
      "A robot registered by a robot team: Its body fits the room on this check",
    ]);
    expect(within(section).queryByText(/More robots were checked/)).toBeNull();
  });

  it("shows an unfamiliar reason as written, and says when the list is cut short", () => {
    render(<RobotFitHold hold={{ ...hold, taskKind: null, embodimentsTruncated: true,
      embodiments: [{ embodiment: "droid_franka_panda_robotiq_2f85_v1", verdict: "no_fit", reasons: ["wrist_clearance"] }] }} />);
    expect(screen.getByText(/wrist clearance/)).toBeTruthy();
    expect(screen.queryByText(/Task checked/)).toBeNull();
    expect(screen.getByText("More robots were checked than are listed here.")).toBeTruthy();
  });

  it("shows a task kind it does not know with a neutral label, never its code", () => {
    const unknown = { ...hold, taskKind: "fold_cloth_into_bin" };
    expect(isRobotFitHold(unknown)).toBe(true);
    render(<RobotFitHold hold={unknown} />);
    expect(screen.getByText("Task checked: the task described in your job.")).toBeTruthy();
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
