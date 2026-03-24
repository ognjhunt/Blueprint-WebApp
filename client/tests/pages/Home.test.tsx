import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/pages/Home";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    tokenClaims: null,
    logout: vi.fn(),
  }),
}));

describe("Home", () => {
  it("renders the buyer-first hero and primary CTAs", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Test your robot on the exact customer site before you travel\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint turns real facility capture into a site-specific world model your team can review, run, and export from\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /Open public demo/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /Why it works/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(
      screen.getByText(
        /The public demo proves the site is real/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the capturer path secondary", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(screen.getByText(/What teams use this for/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /The point is not just seeing the site\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Proof, package details, and examples in one buyer-facing path\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /High-trust technical purchases need a visible reason to believe the surface\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Keep the capture path secondary to the buyer journey\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /About Blueprint/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /Compatibility and exports/i })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(screen.getByRole("link", { name: /Read capture basics/i })).toHaveAttribute(
      "href",
      "/capture",
    );
    expect(screen.getByRole("link", { name: /Open capture app/i })).toHaveAttribute(
      "href",
      "/capture-app",
    );
  });
});
