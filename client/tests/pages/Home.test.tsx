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

vi.mock("@/lib/experiments", () => ({
  resolveExperimentVariant: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(() => new Promise(() => {})),
}));

describe("Home", () => {
  it("renders the preserved hero and commercial product path", { timeout: 10000 }, () => {
    window.localStorage.clear();
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Site-specific world models for robot teams, built from real capture\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Name one facility or route\. Blueprint packages the capture, proof, rights limits, and hosted review path/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request world model/i })[0],
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(
      Array.from(container.querySelectorAll("[data-home-section]"))
        .map((node) => node.getAttribute("data-home-section"))
        .slice(0, 3),
    ).toEqual(["hero", "exact-site-preview", "first-route"]);
    expect(
      screen.getByRole("heading", { name: /Real capture route to explorable site preview\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Sample\/generated preview fallback/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Request exact-site preview/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(screen.getByRole("heading", { name: /Blueprint sells exact-site products, not generic demos\./i })).toBeInTheDocument();
    expect(screen.getByText(/Blueprint turns real capture into site-specific packages/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site Package Access/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Hosted Review$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Buyer Request Path/i })).toBeInTheDocument();
    expect(screen.getByText(/A walkthrough or site record starts the product/i)).toBeInTheDocument();
    expect(screen.getByText(/Blueprint packages the capture into a site-specific world model/i)).toBeInTheDocument();
    expect(screen.getByText(/A hosted review path for task scenarios/i)).toBeInTheDocument();
  });

  it("surfaces concise sections for sites, products, proof, and closing action", {
    timeout: 20000,
  }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Start with the exact site your robot needs to understand\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inspect proof/i })).toHaveAttribute(
      "href",
      "/proof",
    );
    expect(
      screen.getByRole("heading", {
        name: /The proof travels with the product\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Sample worlds show the package shape\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Exact-site capture turns vague simulation demand into a buyer-ready package\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Samples and demo worlds are labeled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approved listings keep capture basis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request one exact-site world model\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See hosted workflow/i })[0]).toHaveAttribute("href", "/product");
  });
});
