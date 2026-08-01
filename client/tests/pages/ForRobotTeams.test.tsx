import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("explains the robot-team use case for the single Task Evaluation Run", () => {
    render(<ForRobotTeams />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Spend field time on the candidate that earned it/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length,
    ).toBeGreaterThan(0);

    // A ranking is explicitly not the promise.
    expect(screen.getByText(/Bring candidates\. Get them screened, then ordered\./i)).toBeInTheDocument();
    // The buyer does not select the evidence backend.
    expect(screen.getByText(/Why you do not pick the backend/i)).toBeInTheDocument();
    // Abstention survives as a named outcome on the persona page too.
    expect(screen.getByText(/^Inside the resolution$/i)).toBeInTheDocument();

    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
  });
});
