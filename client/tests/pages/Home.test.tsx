import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders one Task Evaluation Run lifecycle with abstention and one primary CTA", () => {
    const { container } = render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Answer it before you send a robot/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length,
    ).toBeGreaterThan(0);

    // The lifecycle still reads task -> maintained testbed -> routed evidence ->
    // answer. Section 03 now tells it as the run film rather than a static rail,
    // so these assert the film's own act copy.
    expect(container).toHaveTextContent(/You bring one real job at one real site/i);
    expect(container).toHaveTextContent(/The capture becomes a testbed we version, pin, and maintain/i);
    expect(container).toHaveTextContent(/Each claim goes to the cheapest evidence that is strong enough/i);
    expect(container).toHaveTextContent(/Supported, ruled out, or not yet/i);

    // A run grants neither of these, and the contract enforces it.
    expect(container).toHaveTextContent(/Deployment approval/i);
    expect(container).toHaveTextContent(/Safety certification/i);

    // Abstention is still a first-class, named outcome.
    expect(screen.getByText(/^Not yet$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Unresolved$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/A run is allowed to tell you it cannot tell you/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/is not reported as one/i),
    ).toBeInTheDocument();

    // Withdrawn product names and fixed campaign prices stay gone.
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
  });

  it("marks every figure that shows numbers as illustrative", () => {
    const { container } = render(<Home />);
    const figures = container.querySelectorAll("figure");
    expect(figures.length).toBeGreaterThanOrEqual(3);

    // The two figures that plot schematic values must carry the marker, and so
    // must the run film, so none of the three can be read as live run data. The
    // qualitative before/after comparison plots nothing and needs none.
    expect(screen.getAllByText(/^Illustrative$/i).length).toBe(3);
  });
});
