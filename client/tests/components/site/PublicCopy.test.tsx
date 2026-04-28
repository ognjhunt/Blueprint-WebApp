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

describe("public capture and world-model copy", () => {
  it("keeps the buyer path centered on world models, proof, and hosted evaluation", { timeout: 10000 }, () => {
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
        name: /Site-specific world models for real places\./i,
      }),
	    ).toBeInTheDocument();
	    expect(screen.getAllByRole("link", { name: /Inspect a real site/i }).length).toBeGreaterThan(0);
	    expect(screen.getAllByRole("link", { name: /Open sample evaluation/i }).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/world models/i);
    expect(container).toHaveTextContent(/real capture/i);
    expect(container).toHaveTextContent(/robot-team evidence/i);
    expect(container).toHaveTextContent(/products/i);
    expect(container).toHaveTextContent(/proof/i);
    expect(container).toHaveTextContent(/hosted review/i);
    expect(container).not.toHaveTextContent(/digital twin/i);
    expect(container).not.toHaveTextContent(/SimReady/i);
    expect(container).not.toHaveTextContent(/marketplace/i);
    expect(screen.queryByRole("link", { name: /^Environments$/i })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/decision memo/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/LoRA/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
