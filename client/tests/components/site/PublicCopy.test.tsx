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
  it("uses capture and world-model language across header, homepage, and footer", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(
      <>
        <Header />
        <Home />
        <Footer />
      </>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /Use the exact site before deployment\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open public demo/i }).length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(/world models/i);
    expect(container).toHaveTextContent(/capture/i);
    expect(container).toHaveTextContent(/robot teams?/i);
    expect(container).not.toHaveTextContent(/digital twin/i);
    expect(container).not.toHaveTextContent(/SimReady/i);
    expect(container).not.toHaveTextContent(/marketplace/i);
    expect(container).not.toHaveTextContent(/environments/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/LoRA/i);
    expect(container).not.toHaveTextContent(/fine-tune/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
