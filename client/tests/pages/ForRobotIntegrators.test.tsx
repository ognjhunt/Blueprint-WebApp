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
      screen.getByRole("heading", { name: /Qualify the site before you commit pilot time\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Blueprint starts with the site, task, and constraints that matter for deployment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What robot teams use Blueprint for\./i })).toBeInTheDocument();
    expect(screen.getByText(/Test before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Share one environment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What to expect/i })).toBeInTheDocument();
    expect(screen.getByText(/A qualification-first review path with optional hosted world-model access downstream/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start qualification/i })).toHaveAttribute(
      "href",
      "/contact?buyerType=robot_team&interest=qualification",
    );
  });
});
