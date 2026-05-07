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
      screen.getByRole("heading", { name: /Use exact-site worlds for the work that usually gets expensive late\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The strongest fit is when a buyer already knows the site/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tune before travel/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Compare releases/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /A site-specific product, not a generic benchmark\./i })).toBeInTheDocument();
    expect(
      screen.getByText(/A site-specific world model of one real facility and workflow/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Inspect sample review/i })[0]).toHaveAttribute(
      "href",
      "/proof",
    );
    expect(screen.queryByText(/Shrink the demo-to-deployment gap\./i)).not.toBeInTheDocument();
  });
});
