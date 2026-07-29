import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("uses the same service, result model, and CTA for the site-operator persona", () => {
    render(<ForSiteOperators />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Find out what a robot could do here, before anyone shows up/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length,
    ).toBeGreaterThan(0);

    // Same service as the robot-team persona, entered from the other side.
    expect(
      screen.getByText(/You should not have to become an evaluation expert to get an answer/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Both end up in the same run/i)).toBeInTheDocument();
    // Candidates are optional at intake.
    expect(screen.getByText(/Candidates can be linked whenever they exist/i)).toBeInTheDocument();
    // Operator control and the safety boundary stay explicit.
    expect(screen.getByText(/^Restricted areas$/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety stays yours/i)).toBeInTheDocument();
    // Abstention is still one of the named outcomes.
    expect(screen.getByText(/^Not yet$/i)).toBeInTheDocument();

    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
  });
});
