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
    expect(screen.getByRole("link", { name: /^Sample Listing$/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /^Hosted Evaluation$/i })).toHaveAttribute(
      "href",
      "/exact-site-hosted-review",
    );
    expect(screen.getByRole("link", { name: /^Deliverables$/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /^Pricing$/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /^FAQ$/i })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: /^Governance$/i })).toHaveAttribute("href", "/governance");
    expect(screen.getByRole("link", { name: /^About$/i })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: /^Capture$/i })).not.toBeInTheDocument();
  });

  it("uses proof-first utility actions in the header", () => {
    render(<Header />);

    const sampleLink = screen.getByRole("link", { name: /View sample listing/i });
    const hostedLink = screen.getByRole("link", { name: /See hosted evaluation/i });
    expect(sampleLink).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");
    expect(hostedLink).toHaveAttribute("href", "/exact-site-hosted-review");
  });

  it("de-emphasizes auth from the main marketing header", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
