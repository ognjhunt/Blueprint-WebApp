import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import Home from "@/pages/Home";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    tokenClaims: null,
    logout: vi.fn(),
  }),
  useOptionalAuth: () => null,
}));

vi.mock("@/lib/experiments", () => ({
  resolveExperimentVariant: vi.fn(() => new Promise(() => {})),
}));

describe("public managed-pilot copy", () => {
  it("keeps the buyer path centered on one decision-oriented service", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(
      <MinimalSiteLayout><Home /></MinimalSiteLayout>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Could a robot take over a repetitive task at your site\?/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Show us a task/i }).length).toBeGreaterThan(0);

    expect(container).toHaveTextContent(/Show us the task/i);
    expect(container).toHaveTextContent(/We find the right robot/i);
    expect(container).toHaveTextContent(/No pilot, no fee/i);
    expect(container).toHaveTextContent(/Book the pilot/i);
    expect(container).toHaveTextContent(/One click\. We coordinate the rest/i);
    for (const link of screen.getAllByRole("link", { name: "For robot teams" })) expect(link).toHaveAttribute("href", "/contact/robot-team");

    // Withdrawn products, legacy package prices, and outcome guarantees stay absent.
    expect(container).not.toHaveTextContent(/Policy Shortlist/i);
    expect(container).not.toHaveTextContent(/Robot Match/i);
    expect(container).not.toHaveTextContent(/\$2,500/i);
    expect(container).not.toHaveTextContent(/\$3,000/i);
    expect(container).not.toHaveTextContent(/\$5,000/i);
    expect(container).not.toHaveTextContent(/guaranteed winner/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
  });
});
