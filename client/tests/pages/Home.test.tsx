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
  it("renders the first-screen explanation and primary CTAs", { timeout: 10000 }, () => {
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
        /Blueprint turns one real customer site into a working model your team can inspect, buy, or run before a pilot\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(
      screen
        .getAllByRole("link", { name: /Request hosted evaluation/i })
        .some(
          (link) =>
            link.getAttribute("href") === "/contact?persona=robot-team&interest=evaluation-package",
        ),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /View public demo listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(
      screen.getByText(
        /Prefer a lighter first step\? Email a short brief\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/What it is/i)).toBeInTheDocument();
    expect(screen.getByText(/How to buy/i)).toBeInTheDocument();
  });

  it("surfaces proof, results, and trust without pushing capture into the main flow", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(screen.getByText(/Common jobs/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What teams actually use Blueprint for/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Proof, results, and deliverables now live in one path\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Buyers should not have to guess what is real, supported, or allowed\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open how it works/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: /Open results/i })).toHaveAttribute(
      "href",
      "/case-studies",
    );
    expect(screen.getByRole("link", { name: /See deliverables/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /About Blueprint/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /Compatibility & exports/i })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(screen.queryByRole("link", { name: /Read capture basics/i })).not.toBeInTheDocument();
  });
});
