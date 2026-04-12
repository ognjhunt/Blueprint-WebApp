import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForRobotIntegrators from "@/pages/ForRobotIntegrators";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    tokenClaims: null,
    logout: vi.fn(),
  }),
}));

describe("ForRobotIntegrators", () => {
  it("renders the robot-team use cases and simpler positioning", () => {
    render(<ForRobotIntegrators />);

    expect(screen.getByText(/^For Robot Teams$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Bring the exact deployment site into your robot workflow\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Blueprint turns real customer facilities into site-specific world models\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams train and ship with this\./i })).toBeInTheDocument();
    expect(screen.getByText(/Tune before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Share one environment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What to expect/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Real-site world models your team can train on, fine-tune against, and export data from\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
  });
});
