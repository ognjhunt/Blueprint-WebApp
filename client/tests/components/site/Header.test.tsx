import { render, screen } from "@testing-library/react";
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
  it("shows discoverable nav link for how-it-works route", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /How It Works/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/how-it-works");
  });

  it("shows Pilot Exchange in the top navigation", () => {
    render(<Header />);

    const link = screen.getByRole("link", { name: /Pilot Exchange/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/pilot-exchange");
  });
});
