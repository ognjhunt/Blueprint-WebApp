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
    tokenClaims: null,
    logout: vi.fn(),
  }),
}));

describe("Header", () => {
  it("keeps the buyer-facing nav focused", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /^World Models$/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /^Proof$/i })).toHaveAttribute("href", "/proof");
    expect(screen.getByRole("link", { name: /^About$/i })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /^FAQ$/i })).toHaveAttribute("href", "/faq");
    expect(screen.queryByRole("link", { name: /^Capture$/i })).not.toBeInTheDocument();
  });

  it("uses Talk to Blueprint as the primary CTA", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Talk to Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
  });

  it("keeps utility links available for capture and auth", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Open public demo/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});
