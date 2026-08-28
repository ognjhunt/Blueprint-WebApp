import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("leads with budget-qualified demand rather than with lead volume", () => {
    render(<ForRobotTeams />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Arrive with the robot\. Not before it/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /not short of leads\. You are short of weeks/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deployment-engineer weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero engineering hours before arrival/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /We prepare it\. You install it and prove it/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Join the robot network/i }).length,
    ).toBeGreaterThan(0);
  });

  it("keeps the modelled economics labelled as assumptions", () => {
    const { container } = render(<ForRobotTeams />);
    expect(container).toHaveTextContent(/management assumptions, not disclosed customer terms/i);
    expect(
      screen.getAllByRole("link", {
        name: /Agility Robotics investor presentation, June 2026/i,
      }).length,
    ).toBeGreaterThan(0);
  });
});
