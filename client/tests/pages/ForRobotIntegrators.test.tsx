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
      screen.getByRole("heading", { name: /Ground robot evaluation in the real indoor site\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Use exact-site worlds for the work that usually gets expensive late\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The strongest fit is when a buyer already knows the indoor site/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ground the eval in the real facility/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Replay the task before field time/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /A site-specific indoor product, not a generic benchmark\./i })).toBeInTheDocument();
    expect(
      screen.getByText(/This path works well for policy fine-tuning, training data generation/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See how it works/i })[0]).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.queryByText(/Shrink the demo-to-deployment gap\./i)).not.toBeInTheDocument();
  });
});
