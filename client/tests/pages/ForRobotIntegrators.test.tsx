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
  it("renders the simplified robot-team persona page", () => {
    render(<ForRobotIntegrators />);

    expect(screen.getByText(/^For Robot Teams$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Test the exact site before deployment\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Why integrators use this path\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Common jobs on one exact site\./i })).toBeInTheDocument();
    expect(screen.getByText(/Tune before travel/i)).toBeInTheDocument();
    expect(screen.getByText(/Compare releases/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get and what it does not do\./i })).toBeInTheDocument();
    expect(
      screen.getByText(/A site-specific world model, data package, and hosted evaluation path built from real capture/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.queryByText(/Shrink the demo-to-deployment gap\./i)).not.toBeInTheDocument();
  });
});
