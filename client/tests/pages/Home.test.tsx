import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders one Task Evaluation Run lifecycle with abstention and one primary CTA", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Know what the real site will do to your robot/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    // Run lifecycle figure carries the one-product story.
    expect(screen.getByText(/^Pin the testbed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Plan the evidence$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Decide or abstain$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Name the next test$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/explicit abstention/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not infer a winner from raw scores/i)).toBeInTheDocument();
    // Figures must state that they are illustrative, never measured output.
    expect(screen.getAllByText(/Conceptual ordering/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not customer captures/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });
});
