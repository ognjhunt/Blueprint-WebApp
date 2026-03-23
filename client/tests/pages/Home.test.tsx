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
        name: /Inspect the real site before your team shows up\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/These are reconstructions of real facilities, not synthetic worlds\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse world models/i })).toHaveAttribute(
      "href",
      "/world-models",
    );
    expect(screen.getByRole("link", { name: /See sample deliverables/i })).toHaveAttribute(
      "href",
      "/world-models/sw-chi-01",
    );
    expect(screen.getByRole("link", { name: /Talk to Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByText(/A buyer should not have to imagine what this is\./i)).toBeInTheDocument();
  });

  it("keeps capture and site-operator paths secondary", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(screen.getByText(/Why teams buy/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /One catalog\. One proof path\. One clear next step\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Keep the other audiences clear\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Capture App/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/For Site Operators/i).length).toBeGreaterThan(0);
  });
});
