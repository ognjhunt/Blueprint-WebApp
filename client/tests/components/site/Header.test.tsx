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
    expect(screen.getByRole("link", { name: /^Hosted Evaluation$/i })).toHaveAttribute(
      "href",
      "/exact-site-hosted-review",
    );
    expect(screen.getByRole("link", { name: /^Pricing$/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /^Trust$/i })).toHaveAttribute("href", "/governance");
    expect(screen.queryByRole("link", { name: /^Sample Listing$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Deliverables$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^About$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Capture$/i })).not.toBeInTheDocument();
  });

  it("uses a reduced proof-first action rail in the header", () => {
    render(<Header />);

    const sampleLink = screen.getByRole("link", { name: /View sample listing/i });
    const bookingLink = screen.getByRole("link", { name: /^Book call$/i });
    expect(sampleLink).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");
    expect(bookingLink).toHaveAttribute("href", "/book-exact-site-review");
    expect(screen.queryByRole("link", { name: /See hosted evaluation/i })).not.toBeInTheDocument();
  });

  it("de-emphasizes auth from the main marketing header", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
