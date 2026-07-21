import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("renders the shortened buyer-objections page", () => {
    render(<FAQ />);

    expect(
      screen.getByRole("heading", {
        name: /The questions that usually decide fit\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What does Blueprint sell\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What does a Task Evaluation Run return\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What is a Policy Improvement Run\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Is the published 0.929 correlation a Blueprint result\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How do capturers and site operators participate\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Are the sites page and run dashboard filled with samples\?/i)).toBeInTheDocument();
    expect(screen.getByText(/capture-backed Task Evaluation Runs, Policy Improvement Runs/i)).toBeInTheDocument();
    expect(screen.getByText(/shows an empty request path instead of invented supply or analytics/i)).toBeInTheDocument();
    const robotTeamLinks = screen.getAllByRole("link", {
      name: /Talk to Blueprint about a real site/i,
    });
    expect(robotTeamLinks.length).toBeGreaterThanOrEqual(1);
    robotTeamLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", expect.stringContaining("/contact/robot-team?persona=robot-team"));
      expect(link).toHaveAttribute("href", expect.stringContaining("buyerType=robot_team"));
    });

    expect(screen.queryByText(/What scenario variation controls are live today\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What turns a listing from listing-only into proof-rich\?/i)).not.toBeInTheDocument();
  });
});
