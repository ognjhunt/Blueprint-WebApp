import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("explains the robot-team use case for the single Task Evaluation Run", () => {
    render(<ForRobotTeams />);
    expect(screen.getByRole("heading", { name: /Decide what deserves scarce robot time/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/A ranking is not guaranteed/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline chooses the least expensive currently qualified evidence/i)).toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
  });
});
