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

describe("public service-first copy", () => {
  it("uses service language across header, homepage, and footer", () => {
    window.localStorage.clear();
    const { container } = render(
      <>
        <Header />
        <Home />
        <Footer />
      </>,
    );

    expect(screen.getAllByRole("link", { name: /Request a site brief/i }).length).toBeGreaterThan(0);
    expect(HERO_HEADLINES).toContain(screen.getByRole("heading", { level: 1 }).textContent);
    expect(container).toHaveTextContent(/site twin|digital twin/i);
    expect(container).toHaveTextContent(/humanoid/i);
    expect(container).toHaveTextContent(/readiness|evaluate|adaptation artifacts/i);

    expect(container).not.toHaveTextContent(/adapter weights/i);
    expect(container).not.toHaveTextContent(/LoRA/i);
    expect(container).not.toHaveTextContent(/fine-tune/i);
    expect(container).not.toHaveTextContent(/100\+ hours of training video/i);
    expect(container).not.toHaveTextContent(/no 3D conversion/i);
  });
});
