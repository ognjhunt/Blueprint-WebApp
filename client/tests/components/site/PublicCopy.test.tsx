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
}));

vi.mock("@/lib/experiments", () => ({
  resolveExperimentVariant: vi.fn(() => new Promise(() => {})),
}));

describe("public real-site evaluation copy", () => {
  it("keeps the buyer path centered on one decision-oriented service", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(
      <MinimalSiteLayout><Home /></MinimalSiteLayout>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Your site/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Discuss your site/i }).length).toBeGreaterThan(0);

    expect(container).toHaveTextContent(/Define the task/i);
    expect(container).toHaveTextContent(/Compare candidates/i);
    expect(container).toHaveTextContent(/Choose the pilot/i);
    expect(container).toHaveTextContent(/clear reason to pause/i);
    expect(container).toHaveTextContent(/site and robot team run the physical pilot/i);

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
