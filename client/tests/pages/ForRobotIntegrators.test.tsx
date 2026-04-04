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
      screen.getByRole("heading", { name: /Train on the exact site before your team visits it\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint turns real customer facilities into site-specific world models\. Use them to evaluate policies, generate training data, fine-tune against the actual layout, and compare releases/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams train and ship with this\./i })).toBeInTheDocument();
    expect(screen.getByText(/Tune before travel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Make site-specific data/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Compare releases/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Train operators/i)).toBeInTheDocument();
    expect(screen.getByText(/Share one environment/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you get/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What to expect/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Give your team the exact site in a format that feeds directly into your training pipeline and deployment decisions\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
  });
});
