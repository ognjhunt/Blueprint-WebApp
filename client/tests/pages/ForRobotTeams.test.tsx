import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("leads with the allocation constraint rather than with lead volume", () => {
    render(<ForRobotTeams />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /scarcest resource isn't robots/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /not short of leads\. You are short of weeks/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deployment-engineer weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/Site files stay controlled/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /We prepare\. You integrate and prove/i }),
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
