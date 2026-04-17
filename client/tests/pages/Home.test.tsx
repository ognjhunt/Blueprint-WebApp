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
  it("renders the first-screen explanation and proof-first CTA order", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Test the exact site before deployment\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint turns a real facility into a site-specific world model, data package, and hosted test environment/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Shrink the demo-to-deployment gap\./i)).toBeInTheDocument();
    const ctas = screen.getAllByRole("link").filter((link) =>
      ["View sample listing", "See hosted evaluation", "Scope your site"].includes(
        link.textContent?.trim() || "",
      ),
    );
    expect(ctas.map((link) => link.textContent?.trim())).toEqual([
      "View sample listing",
      "See hosted evaluation",
      "Scope your site",
    ]);
    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /See hosted evaluation/i })).toHaveAttribute(
      "href",
      "/exact-site-hosted-review",
    );
    expect(screen.getByRole("link", { name: /Scope your site/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByRole("link", { name: /Book scoping call/i })).toHaveAttribute(
      "href",
      "/book-exact-site-review",
    );
    expect(
      screen.getByText(/one site-specific world model built from real capture of one facility/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\? Send a short brief\./i)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /Choose the path that matches the work\./i }).length).toBeGreaterThan(0);
  });

  it("surfaces honest proof, deliverables, and trust", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /See the real site first, then inspect the product around it\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Current public proof assets buyers can inspect today\./i }),
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
    expect(screen.getByRole("heading", { name: /What a serious buyer should be able to verify at a glance\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How buying works before anyone gets on a plane\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /An anonymized proof story buyers can follow\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Use one exact site to answer one expensive question earlier\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /When not to buy exact-site work yet\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read about Blueprint/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /Review governance and trust/i })).toHaveAttribute(
      "href",
      "/governance",
    );
    expect(
      screen.getByText(/Blueprint sells site-specific packages and hosted access, not deployment guarantees\./i),
    ).toBeInTheDocument();
  });
});
