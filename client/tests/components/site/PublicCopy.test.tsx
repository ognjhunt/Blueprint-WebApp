import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import Home, { HERO_HEADLINES } from "@/pages/Home";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    logout: vi.fn(),
  }),
}));

describe("public qualification-first copy", () => {
  it("uses qualification language across header, homepage, and footer", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(
      <>
        <Header />
        <Home />
        <Footer />
      </>,
    );

    expect(screen.getAllByRole("link", { name: /Request site qualification/i }).length).toBeGreaterThan(0);
    expect(HERO_HEADLINES).toContain(screen.getByRole("heading", { level: 1 }).textContent);
    expect(container).toHaveTextContent(/qualification/i);
    expect(container).toHaveTextContent(/feasible|blocked|readiness/i);
    expect(container).toHaveTextContent(/robot teams?/i);
    expect(container).not.toHaveTextContent(/digital twin/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/LoRA/i);
    expect(container).not.toHaveTextContent(/fine-tune/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
