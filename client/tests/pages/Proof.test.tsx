import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof page", () => {
  it("renders the concise proof explainer", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Proof stays scoped\./i }),
    ).toBeInTheDocument();

    // The three evidence layers stay distinct and ranked.
    expect(screen.getByRole("heading", { name: /^Raw capture$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Derived evidence$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Physical outcomes$/i })).toBeInTheDocument();
    expect(
      screen.getByText(/never quietly promoted to fact/i),
    ).toBeInTheDocument();

    // External research is cited as category context only.
    expect(
      screen.getByText(/It is not a Blueprint result, not an accuracy/i),
    ).toBeInTheDocument();
  });

  it("keeps the claim boundary and request CTA visible", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /A run is evidence\. It is not permission\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Estimates are not physical guarantees, safety approval remains external/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /^Request a Task Evaluation Run$/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
  });
});
