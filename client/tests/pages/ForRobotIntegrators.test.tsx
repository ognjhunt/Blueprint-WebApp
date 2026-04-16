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
      screen.getByRole("heading", { name: /Test the exact site before deployment\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Shrink the demo-to-deployment gap\./i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint turns a real facility into a site-specific world model, data package, and hosted test environment/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams train and ship with this\./i })).toBeInTheDocument();
    expect(screen.getByText(/Tune before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Share one environment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What to expect/i })).toBeInTheDocument();
    expect(
      screen.getByText(/A site-specific world model, data package, and hosted evaluation path built from real capture/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
  });
});
