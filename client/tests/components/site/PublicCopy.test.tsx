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
        name: /Robots aren't the bottleneck\. Deploying them is/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Prepare a deployment/i }).length).toBeGreaterThan(0);

    // One bounded service, and the three-stage transformation that backs it.
    expect(container).toHaveTextContent(/Capture/i);
    expect(container).toHaveTextContent(/Recreate/i);
    expect(container).toHaveTextContent(/Evaluate/i);

    // The result stays decision-oriented and preserves the evidence boundary.
    expect(container).toHaveTextContent(/Use it to validate\. Not to discover/i);
    expect(container).toHaveTextContent(
      /Onsite integration, commissioning, and the physical pilot stay with the robot company/i,
    );
    expect(container).toHaveTextContent(/acceptance criteria before the robot company begins/i);

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
