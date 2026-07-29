import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("explains the robot-team use case for the single Task Evaluation Run", () => {
    render(<ForRobotTeams />);
    expect(
      screen.getByRole("heading", { name: /Spend field time where it will actually pay/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/A ranking is not promised/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/least expensive method currently qualified/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/explicit abstention/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
  });
});
