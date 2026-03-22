import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/site/Header";

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

describe("Header", () => {
  it("does not show How It Works in the top navigation", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /How It Works/i })).not.toBeInTheDocument();
  });

  it("shows Capture in the top navigation", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /^Capture$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/capture");
  });

  it("puts Capture first in the top navigation", () => {
    render(<Header />);

    const nav = screen.getByRole("navigation");
    const navLinks = within(nav).getAllByRole("link");
    expect(navLinks[0]).toHaveTextContent("Capture");
  });

  it("does not show legacy partners nav link", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /Partners/i })).not.toBeInTheDocument();
  });

  it("shows World Models in the top navigation", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /^World Models$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/world-models");
  });

  it("uses Talk to Blueprint as the primary CTA", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Talk to Blueprint/i })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
