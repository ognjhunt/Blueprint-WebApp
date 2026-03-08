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
    logout: vi.fn(),
  }),
}));

describe("Header", () => {
  it("does not show How It Works in the top navigation", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /How It Works/i })).not.toBeInTheDocument();
  });

  it("shows Marketplace in the top navigation", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /^Marketplace$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/deployment-marketplace");
  });

  it("puts Marketplace first in the top navigation", () => {
    render(<Header />);

    const nav = screen.getByRole("navigation");
    const navLinks = within(nav).getAllByRole("link");
    expect(navLinks[0]).toHaveTextContent("Marketplace");
  });

  it("does not show legacy partners nav link", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /Partners/i })).not.toBeInTheDocument();
  });

  it("uses Request a Capture as the primary CTA", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Request a Capture/i })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
