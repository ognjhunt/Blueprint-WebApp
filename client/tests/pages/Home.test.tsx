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

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => ({
    data: {
      ok: true,
      supportedCities: [
        { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
        {
          city: "San Francisco",
          stateCode: "CA",
          displayName: "San Francisco, CA",
          citySlug: "san-francisco-ca",
        },
      ],
      currentCity: null,
    },
    loading: false,
    error: null,
  }),
}));

describe("Home", () => {
  it("renders the simplified hero with two primary paths", { timeout: 10000 }, () => {
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
    const ctas = screen.getAllByRole("link").filter((link) =>
      ["View Sample Site", "Book Hosted Review"].includes(
        link.textContent?.trim() || "",
      ),
    );
    expect(ctas.map((link) => link.textContent?.trim())).toEqual([
      "View Sample Site",
      "Book Hosted Review",
    ]);
    expect(screen.getByRole("link", { name: /View Sample Site/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.getByRole("link", { name: /Book Hosted Review/i })).toHaveAttribute(
      "href",
      "/book-exact-site-review",
    );
    expect(
      screen.getByText(/One exact site\. One workflow lane\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Talk to Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team",
    );
    expect(screen.getByRole("heading", { name: /Where Blueprint is live, planned, and under review\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open launch map/i })).toHaveAttribute(
      "href",
      "/launch-map",
    );
    expect(screen.getAllByRole("heading", { name: /Choose the path that matches the work\./i }).length).toBeGreaterThan(0);
  });

  it("surfaces honest proof, deliverables, and trust", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /See the real site first, then inspect the product around it\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Inspect the public proof before you contact anyone\./i }),
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
