import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof page", () => {
  it("renders the claim-boundary explainer", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /What we claim, and what we refuse to\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not a Blueprint result, an accuracy claim, or a deployment claim/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^The request packet$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Evidence gathered for that packet$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Research signals, clearly labelled$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/One site, one task, one decision/i)).toBeInTheDocument();
  });

  it("keeps the claim ceiling and request CTA visible", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /What a run carries, and what sits above the line/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Above the ceiling/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Estimates are not physical guarantees, safety approval remains external/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/never a safety certification/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /^Request a Task Evaluation Run$/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
  });
});
