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

describe("public capture and data marketplace copy", () => {
  it("keeps the buyer path centered on site data, policy evaluation, proof, and free operator participation", { timeout: 10000 }, () => {
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
        name: /Real-site data for robot teams before the pilot\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request site data/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^Proof$/i }).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/open robot-team marketplace/i);
    expect(container).toHaveTextContent(/site data packages/i);
    expect(container).toHaveTextContent(/policy-evaluation sessions/i);
    expect(container).toHaveTextContent(/training exports/i);
    expect(container).toHaveTextContent(/site operators can submit facilities and define boundaries for free/i);
    expect(container).toHaveTextContent(/success rate/i);
    expect(container).toHaveTextContent(/proof/i);
    expect(container).not.toHaveTextContent(/digital twin/i);
    expect(container).not.toHaveTextContent(/SimReady/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/decision memo/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/\bLoRA\b/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
