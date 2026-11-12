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

    expect(screen.getByRole("heading", { level: 1, name: "Film a job once. We turn it into a job packet." })).toBeInTheDocument();
    // One filled action on the page: the header is the brand and one quiet link.
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(container).toHaveTextContent(/Send a video of one job that repeats/);
    expect(container).toHaveTextContent(/We turn it into a job packet: what the job is, a first look at which robots could fit, and a simulation of your site\./);
    expect(container).toHaveTextContent(/We share it with robot deployment companies we approve, and they answer\. Your name and contact details go to a company only if you ask to meet it\./);
    expect(container).toHaveTextContent(/Free for sites/);
    expect(container).toHaveTextContent(/We take pick-up-and-put-down jobs best\. Nothing here is a test at your site or a safety check\./);
    // The frame of 2026-11-12: no invented result, no claim that the trial is the answer, no price.
    expect(container).not.toHaveTextContent(/which did best|top AI robots|AI robot|Find a company to set it up|during the beta/i);
    expect(container).not.toHaveTextContent(/A clear pilot plan|estimate of what’s likely to work/i);
    expect(container).not.toHaveTextContent(/full evaluation|comparable proposals|delivery proposals|join by invitation/i);
    expect(container).not.toHaveTextContent(/choose a team to deliver|delivery team|invited robot teams/i);
    expect(container).not.toHaveTextContent(/\$99\b/);
    expect(container).not.toHaveTextContent(/book it with one click|one team whose evaluation passed/i);
    expect(screen.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" })).toHaveAttribute("href", "/partners");
    // The footer: one quiet line, the way to withdraw cookie consent among it.
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/beta#who-we-are");

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
