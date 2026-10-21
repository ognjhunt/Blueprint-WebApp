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
        name: /Find the right way to automate your work\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Submit a job/i }).length).toBeGreaterThan(0);

    expect(container).toHaveTextContent(/Show us the work/i);
    expect(container).toHaveTextContent(/Compare robots in simulation/i);
    expect(container).toHaveTextContent(/Free during the beta/i);
    expect(container).toHaveTextContent(/Choose and measure a pilot/i);
    expect(container).toHaveTextContent(/You choose whether to proceed/i);
    expect(container).not.toHaveTextContent(/\$99\b/);
    expect(container).not.toHaveTextContent(/book it with one click|one team whose evaluation passed/i);
    for (const link of screen.getAllByRole("link", { name: "For partners" })) expect(link).toHaveAttribute("href", "/partners");

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
