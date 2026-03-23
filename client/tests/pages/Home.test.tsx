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
        name: /Buy access to the exact site your robot needs\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint sells site-specific world models built from real indoor capture\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /Request hosted eval/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );
    expect(screen.getByRole("link", { name: /See sample deliverables/i })).toHaveAttribute(
      "href",
      "/world-models/sw-chi-01",
    );
    expect(
      screen.getByText(
        /The proof reel is there to show one concrete listing end to end/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the capturer path secondary", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(screen.getByText(/Why teams buy/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Keep the path simple\./i }),
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
