import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof page", () => {
  it("renders the concise proof explainer", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /Proof stays scoped\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Every claim belongs to one site, task, robot, and evidence set/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Website$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Request packet$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Robot validation$/i })).toBeInTheDocument();
    expect(screen.getByText(/Scopes one site, task, and robot/i)).toBeInTheDocument();
  });

  it("keeps the claim boundary and request CTA visible", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /What we do not claim\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Virtual evaluations do not approve deployment, safety, universal SRCC/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /^Start$/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
  });
});
