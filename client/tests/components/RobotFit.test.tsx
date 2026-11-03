import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RobotFit, isRobotFit, type RobotFitView } from "@/components/site/RobotFit";

const fit: RobotFitView = {
  route: "full", status: "completed", reason: null,
  counts: { fits: 1, fitsSpec: 1, doesntFit: 1, unknown: 2 },
  models: [
    { name: "Panda", manufacturer: "Franka Robotics", verdict: "fits", openChecks: [] },
    { name: "UR5e", manufacturer: "Universal Robots", verdict: "fits_spec", openChecks: ["access"] },
    { name: "Lite 6", manufacturer: "UFACTORY", verdict: "doesnt_fit", openChecks: ["reach"] },
    { name: "G1", manufacturer: "Unitree", verdict: "unknown", openChecks: ["reach", "payload"] },
    { name: "Gen3", manufacturer: "Kinova", verdict: "unknown", openChecks: ["payload"] },
  ],
  modelsTruncated: false,
};

describe("RobotFit", () => {
  it("shows the robots that fit first and says it is an estimate, never a physical test", () => {
    render(<RobotFit fit={fit} />);
    const section = screen.getByRole("region", { name: "Robot fit" });
    expect(within(section).getByText(/estimate from published robot specs/)).toBeTruthy();
    expect(within(section).getByText(/not a\s+physical test/)).toBeTruthy();
    expect(within(section).getByText("2 of 5 robots checked fit on paper, 1 is ruled out and 2 need more information."))
      .toBeTruthy();
    expect(within(section).getByText("Fit, with an arm path checked in your scene (1)")).toBeTruthy();
    expect(within(section).getByText("Fit on paper (1)")).toBeTruthy();
    // What stayed open is named in plain words.
    expect(within(section).getByText(/Open: path from the entrance/)).toBeTruthy();
    expect(within(section).getByText(/Open: reach, lifting capacity/)).toBeTruthy();
    // Ruled-out and undecided robots stay folded until asked for.
    expect(within(section).getByText("Ruled out (1)").closest("details")).toBeTruthy();
    expect(within(section).getByText("Need more information (2)").closest("details")).toBeTruthy();
    expect(within(section).queryByText(/More robots were checked/)).toBeNull();
  });

  it("says why a check did not run", () => {
    render(<RobotFit fit={{ ...fit, route: "geometry_only", status: "not_run", reason: "task_family_not_modelled",
      counts: null, models: [] }} />);
    expect(screen.getByText(/covers moving one object so far/)).toBeTruthy();
    expect(screen.queryByText(/robots checked fit on paper/)).toBeNull();
  });

  it("says when more robots were checked than are listed", () => {
    render(<RobotFit fit={{ ...fit, modelsTruncated: true }} />);
    expect(screen.getByText("More robots were checked than are listed here.")).toBeTruthy();
  });

  it("accepts only a well-formed table", () => {
    expect(isRobotFit(fit)).toBe(true);
    expect(isRobotFit({ ...fit, status: "not_run", reason: "task_family_not_modelled", counts: null, models: [] })).toBe(true);
    expect(isRobotFit(null)).toBe(false);
    expect(isRobotFit({ ...fit, counts: null })).toBe(false);
    expect(isRobotFit({ ...fit, models: [{ ...fit.models[0], verdict: "probably" }] })).toBe(false);
    expect(isRobotFit({ ...fit, route: "cheapest" })).toBe(false);
  });
});
