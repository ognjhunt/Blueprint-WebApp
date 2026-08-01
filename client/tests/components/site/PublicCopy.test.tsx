import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
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
      <>
        <Header />
        <Home />
        <Footer />
      </>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Rank your candidates on the site you are bidding on, before the pilot/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);

    // One service, and the lifecycle that backs it.
    expect(container).toHaveTextContent(/One service\. Priced per decision\./i);
    expect(container).toHaveTextContent(/The capture becomes a testbed we version, pin, and maintain/i);
    expect(container).toHaveTextContent(/cheapest evidence that is actually good enough/i);

    // Screening leads, the ordering follows, and the ordering carries the
    // resolution that makes it readable.
    expect(container).toHaveTextContent(/Some candidates the building will not take/i);
    expect(container).toHaveTextContent(/Then the survivors get ranked, with the margin/i);
    expect(container).toHaveTextContent(/Tied at this rollout count/i);

    // Withdrawn products, fixed prices, and outcome guarantees stay absent.
    expect(container).not.toHaveTextContent(/Policy Shortlist/i);
    expect(container).not.toHaveTextContent(/Robot Match/i);
    expect(container).not.toHaveTextContent(/\$3,000/i);
    expect(container).not.toHaveTextContent(/\$5,000/i);
    expect(container).not.toHaveTextContent(/guaranteed winner/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
  });
});
