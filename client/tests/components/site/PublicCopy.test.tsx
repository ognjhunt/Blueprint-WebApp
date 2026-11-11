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

    expect(container).toHaveTextContent(/Send a video of the job/i);
    expect(container).toHaveTextContent(/See which robot fits/i);
    expect(container).toHaveTextContent(/Proof in simulation/i);
    expect(container).toHaveTextContent(/Free during the beta/i);
    expect(container).toHaveTextContent(/Find a deployment company/i);
    // The journey (owner, 2026-11-11): a spec check, proof in simulation, then approved deployment companies.
    expect(container).toHaveTextContent(/check real robot models against it by their published specifications/i);
    expect(container).toHaveTextContent(/test control policies, the software that drives a robot, on the job in a simulation of your site/i);
    expect(container).toHaveTextContent(/share the job with deployment companies we’ve approved/i);
    expect(container).not.toHaveTextContent(/A clear pilot plan|estimate of what’s likely to work/i);
    expect(container).not.toHaveTextContent(/full evaluation|comparable proposals|delivery proposals|join by invitation/i);
    expect(container).not.toHaveTextContent(/choose a team to deliver|delivery team|invited robot teams/i);
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
