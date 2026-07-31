import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("leads with screening then ranking, and keeps one primary CTA", () => {
    const { container } = render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Rank your candidates against a real site before you send one/i,
      }),
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

    // A run grants neither of these, and the contract enforces it.
    expect(container).toHaveTextContent(/Deployment approval/i);
    expect(container).toHaveTextContent(/Safety certification/i);

    // Screening comes before ranking, and it is the half that names a cause.
    expect(
      screen.getByRole("heading", { name: /Some candidates the building will not take/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Ruled out$/i).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/None of these rows is a prediction/i);

    // The ordering ships with its margin and its resolution floor, and a pair
    // inside the floor is named as tied rather than ranked.
    expect(
      screen.getByRole("heading", { name: /Then the survivors get ranked, with the margin/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Separated$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tied at this rollout count/i).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/inside the 19\.8 pp floor/i);

    // The real-world-ordering boundary stays stated, as a limit rather than a
    // headline. This is the one claim the Pipeline contract will not carry.
    expect(container).toHaveTextContent(
      /We have not measured how our orderings track real-world orderings/i,
    );

    // Withdrawn product names and fixed campaign prices stay gone.
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
  });

  it("marks every figure that shows numbers as illustrative", () => {
    const { container } = render(<Home />);
    const figures = container.querySelectorAll("figure");
    expect(figures.length).toBeGreaterThanOrEqual(4);

    // The three figures that plot schematic values must carry the marker, and so
    // must the run film, so none of the four can be read as live run data. The
    // qualitative before/after comparison plots nothing and needs none.
    expect(screen.getAllByText(/^Illustrative$/i).length).toBe(4);
  });
});
