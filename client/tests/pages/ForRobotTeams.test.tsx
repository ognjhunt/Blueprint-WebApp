import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("explains why robot teams use the shared preparation layer", () => {
    render(<ForRobotTeams />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /captured task, not a blank site/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Keep scarce deployment engineers on qualified work/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Skip repeated site discovery/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Site files stay controlled/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Blueprint prepares\. Your team integrates and proves/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Join the robot network/i }).length,
    ).toBeGreaterThan(0);
  });
});
