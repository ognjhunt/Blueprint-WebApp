// @vitest-environment jsdom
/**
 * What the job needs and every form of robot with its verdict, as the readiness
 * report and the printable brief show them. Fixed copy and the site's own data,
 * mostly what its video shows and what Blueprint estimates from it: no team, no
 * "match", and no question.
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
      verdict: "not_a_fit", reasons: ["The object weighs about 30–40 kg (estimated from your video), so check that this robot can lift it."] },
  ],
  note: SITE_ROBOT_FIT_NOTE,
};

describe("SiteRobotFitView", () => {
  it("shows what the job needs and every form with its verdict and reasons, without descriptions", () => {
    const { container } = render(<SiteRobotFitView fit={FIT} />);
    expect(screen.getByText(FIT.needs[1])).toBeInTheDocument();
    for (const form of FIT.forms) expect(screen.getByText(form.label)).toBeInTheDocument();
    expect(screen.getAllByText("Fits")).toHaveLength(2);
    expect(screen.getByText("Not a fit")).toBeInTheDocument();
    expect(screen.getByText(FIT.forms[1].reasons[0])).toBeInTheDocument();
    expect(screen.queryByText(FIT.forms[0].description)).toBeNull();
    expect(container.textContent).not.toMatch(/\bmatch|don't know yet|on this page/i);
  });

  it("leaves out what it has nothing to say about", () => {
    const { container } = render(<SiteRobotFitView fit={{ ...FIT, forms: [] }} />);
    expect(screen.queryByRole("list", { name: "Robot forms" })).toBeNull();
    expect(container.querySelectorAll("ul")).toHaveLength(1);
  });
});
