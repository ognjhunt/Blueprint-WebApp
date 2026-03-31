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
        name: /Train your robot on the exact customer site before you visit\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint captures real customer facilities and turns them into digital environments your team can test against before showing up\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Request hosted evaluation/i })
        .some(
          (link) =>
            link.getAttribute("href") === "/contact?persona=robot-team&interest=evaluation-package",
      ),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(
      screen.getByText(/a world model is a site-specific digital environment/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\? Send a short brief\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Three things Blueprint sells\./i })).toBeInTheDocument();
  });

  it("surfaces honest proof, deliverables, and trust", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /See the real site first, then inspect the product around it\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /What goes into the site package/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /What comes back from hosted evaluation/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Use one exact site to answer one expensive question earlier\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read about Blueprint/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /See deliverables and technical reference/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("heading", { name: /Clear enough for a skeptical buyer\./i })).toBeInTheDocument();
  });
});
