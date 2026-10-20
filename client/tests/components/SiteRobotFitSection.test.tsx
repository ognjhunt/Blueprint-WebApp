// @vitest-environment jsdom
/**
 * What the job needs and every form of robot with its verdict, as the readiness
 * report and the printable brief show them. Fixed copy and the site's own data:
 * no team, no "match".
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteRobotFitView } from "@/components/site/SiteRobotFitSection";
import { SITE_ROBOT_FIT_NOTE, type SiteRobotFit } from "@/data/robotFit";

const FIT: SiteRobotFit = {
  needs: ["It has to pick the object up and put it down at another spot.",
    "It can work from one place: the object moves 90 cm (you measured this)."],
  forms: [
    { id: "fixed_base_arm", label: "One arm on a fixed stand", description: "A single robot arm fixed in place at the work area.",
      verdict: "fits", reasons: [] },
    { id: "humanoid", label: "Walking humanoid", description: "A human-shaped robot with two arms that walks on two legs.",
      verdict: "fits", reasons: ["Walking between spots isn't needed: the object moves 90 cm (you measured this)."] },
    { id: "legged_manipulator", label: "Legged robot with an arm", description: "A robot that walks on legs, such as four, with an arm on top.",
      verdict: "not_a_fit", reasons: ["The object weighs over 25 kg (you told us), so check that this robot can lift it."] },
  ],
  unknowns: ["How heavy the object is. You can add it under Add measurements (optional) on this page."],
  note: SITE_ROBOT_FIT_NOTE,
};

describe("SiteRobotFitView", () => {
  it("shows what the job needs, every form with its verdict and reasons, and what is unknown", () => {
    const { container } = render(<SiteRobotFitView fit={FIT} />);
    expect(screen.getByText(FIT.needs[1])).toBeInTheDocument();
    for (const form of FIT.forms) expect(screen.getByText(form.label)).toBeInTheDocument();
    expect(screen.getAllByText("Fits")).toHaveLength(2);
    expect(screen.getByText("Not a fit")).toBeInTheDocument();
    expect(screen.getByText(FIT.forms[1].reasons[0])).toBeInTheDocument();
    expect(screen.getByText(FIT.unknowns[0])).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bmatch/i);
  });

  it("leaves out what it has nothing to say about", () => {
    const { container } = render(<SiteRobotFitView fit={{ ...FIT, forms: [], unknowns: [] }} />);
    expect(screen.queryByRole("list", { name: "Robot forms" })).toBeNull();
    expect(container.querySelectorAll("ul")).toHaveLength(1);
  });
});
