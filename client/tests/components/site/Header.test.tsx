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
    expect(screen.getByRole("link", { name: /^How It Works$/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: /^Deliverables$/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /^Pricing$/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /^About$/i })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: /^Capture$/i })).not.toBeInTheDocument();
  });

  it("uses the hosted-evaluation CTA as the primary action", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Request hosted evaluation/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
  });

  it("keeps utility links available for capture and auth", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});
