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
        name: /Answer it before you send a robot/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);

    // One service, and the lifecycle that backs it.
    expect(container).toHaveTextContent(/One service\. Priced per decision\./i);
    expect(container).toHaveTextContent(/We build the testbed/i);
    expect(container).toHaveTextContent(/cheapest evidence that is actually good enough/i);

    // Refusing to decide is still stated on the page, not buried.
    expect(container).toHaveTextContent(/A run is allowed to tell you it cannot tell you/i);
    expect(container).toHaveTextContent(/is not reported as one/i);

    // Withdrawn products, fixed prices, and outcome guarantees stay absent.
    expect(container).not.toHaveTextContent(/Policy Shortlist/i);
    expect(container).not.toHaveTextContent(/Robot Match/i);
    expect(container).not.toHaveTextContent(/\$3,000/i);
    expect(container).not.toHaveTextContent(/\$5,000/i);
    expect(container).not.toHaveTextContent(/guaranteed winner/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
  });
});
