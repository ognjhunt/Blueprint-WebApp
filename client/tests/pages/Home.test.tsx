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
        name: /Inspect the exact site before your team books the visit\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint gives robot teams a world model of one real facility and workflow\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open public demo/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /See results/i })).toHaveAttribute(
      "href",
      "/case-studies",
    );
    expect(
      screen.getByText(
        /The public demo is the fastest way to understand the product/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the capturer path secondary", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(screen.getByText(/Why teams buy/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Delivery examples with concrete outcomes\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Need the capture side instead\?/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Capture basics/i })).toHaveAttribute(
      "href",
      "/capture",
    );
    expect(screen.getByRole("link", { name: /Open capture app/i })).toHaveAttribute(
      "href",
      "/capture-app",
    );
  });
});
