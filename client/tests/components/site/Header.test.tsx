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

    expect(screen.getByRole("link", { name: /^Product$/i })).toHaveAttribute(
      "href",
      "/product",
    );
    expect(screen.getByRole("link", { name: /^Catalog$/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /^Earn$/i })).toHaveAttribute(
      "href",
      "/capture",
    );
    expect(screen.getByRole("link", { name: /^Pricing$/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /^Proof$/i })).toHaveAttribute("href", "/proof");
    expect(screen.queryByRole("link", { name: /^Sample Listing$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Deliverables$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^About$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Hosted Evaluation$/i })).not.toBeInTheDocument();
  });

  it("uses a reduced proof-first action rail in the header", () => {
    render(<Header />);

    const sampleLink = screen.getByRole("link", { name: /Inspect a real site/i });
    expect(sampleLink).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");
    expect(screen.queryByRole("link", { name: /See hosted evaluation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Book call$/i })).not.toBeInTheDocument();
  });

  it("de-emphasizes auth from the main marketing header", () => {
    render(<Header />);

    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
