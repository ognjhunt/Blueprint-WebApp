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
        name: /Bring the exact deployment site into your robot workflow\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint turns one real facility into a site-specific world model your team can train on/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Request hosted evaluation/i })
        .some(
          (link) =>
            link.getAttribute("href") === "/exact-site-hosted-review",
      ),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(
      screen.getByText(/one site-specific digital environment built from real capture of one facility/i),
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
    expect(
      screen.getByText(/Blueprint sells site-specific packages and hosted access, not deployment guarantees\./i),
    ).toBeInTheDocument();
  });
});
