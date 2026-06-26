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
        name: /Test robot policies before field time\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Start$/i }).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/Compare your policy against earlier checkpoints/i);
    expect(container).toHaveTextContent(/Capture site/i);
    expect(container).toHaveTextContent(/Compare policies/i);
    expect(container).toHaveTextContent(/Pick next test/i);
    expect(container).toHaveTextContent(/100 episodes/i);
    expect(container).toHaveTextContent(/500 episodes/i);
    expect(container).toHaveTextContent(/rank-fidelity result outside the measured evaluation scope/i);
    expect(container).not.toHaveTextContent(/WAM\/VLA/i);
    expect(container).not.toHaveTextContent(/digital twin/i);
    expect(container).not.toHaveTextContent(/SimReady/i);
    expect(container).not.toHaveTextContent(/Scenario tests/i);
    expect(container).not.toHaveTextContent(/Site Data Package/i);
    expect(container).not.toHaveTextContent(/optional data exports/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/decision memo/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/\bLoRA\b/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
