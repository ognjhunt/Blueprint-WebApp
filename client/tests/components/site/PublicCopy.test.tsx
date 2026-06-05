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

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(() => new Promise(() => {})),
}));

describe("public real-site evaluation copy", () => {
  it("keeps the buyer path centered on evaluation, proof, and free operator participation", { timeout: 10000 }, () => {
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
        name: /Evaluate robots on real sites before deployment\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request evaluation/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^Proof$/i }).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/Real-site robot evaluation/i);
    expect(container).toHaveTextContent(/Task Evaluation Run/i);
    expect(container).toHaveTextContent(/Post-Training Data Package/i);
    expect(container).toHaveTextContent(/Site operators submit sites free/i);
    expect(container).toHaveTextContent(/success rate/i);
    expect(container).toHaveTextContent(/proof/i);
    expect(container).not.toHaveTextContent(/digital twin/i);
    expect(container).not.toHaveTextContent(/SimReady/i);
    expect(container).not.toHaveTextContent(/Scenario tests/i);
    expect(container).not.toHaveTextContent(/Site Data Package/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/decision memo/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/\bLoRA\b/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
