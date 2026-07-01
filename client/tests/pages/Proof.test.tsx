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
      screen.getByText(/research number is correlation evidence, not an[\s\S]*accuracy or deployment claim/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Research signal$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Request packet$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Owner proof$/i })).toBeInTheDocument();
    expect(screen.getByText(/Scopes one site, task, robot, policy set, and threshold/i)).toBeInTheDocument();
  });

  it("keeps the claim boundary and request CTA visible", () => {
    render(<Proof />);

    expect(
      screen.getByRole("heading", { name: /What we do not claim\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not turn a virtual score into a universal accuracy guarantee/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /^Start$/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
  });
});
