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
        name: /The robot should arrive after the homework is done/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Prepare a deployment/i }).length).toBeGreaterThan(0);

    // One bounded service, and the three-stage lifecycle that backs it.
    expect(container).toHaveTextContent(/Capture the workflow/i);
    expect(container).toHaveTextContent(/Recreate the job/i);
    expect(container).toHaveTextContent(/Test before the trip/i);

    // The result stays decision-oriented and preserves the evidence boundary.
    expect(container).toHaveTextContent(/Use it to validate—not to discover/i);
    expect(container).toHaveTextContent(/Onsite validation still required/i);
    expect(container).toHaveTextContent(/exact checklist for onsite validation/i);

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
