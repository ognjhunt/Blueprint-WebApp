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
        /Blueprint turns real indoor capture into site-specific world models, site packages, and hosted evaluation/i,
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
    expect(screen.getByRole("link", { name: /View public demo/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(
      screen.getByText(/a world model is a site-specific digital environment/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\? Send a short brief\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Three terms buyers should not have to decode on their own\./i })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /See compatibility and export notes/i })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(screen.getByText(/capture-first, world-model-product-first/i)).toBeInTheDocument();
  });
});
