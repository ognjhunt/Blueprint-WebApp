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

describe("Home", () => {
  it("renders the preserved hero and commercial product path", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Site-specific world models built from real capture\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint packages exact-site capture into world models, hosted review rooms, and proof/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request world model/i })[0],
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(screen.getByRole("heading", { name: /Blueprint sells exact-site world-model products\./i })).toBeInTheDocument();
    expect(screen.getByText(/The product is not a generic scene library/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Exact-Site World Model Package/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hosted Evaluation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Buyer Review/i })).toBeInTheDocument();
    expect(screen.getByText(/A walkthrough or site record starts the product/i)).toBeInTheDocument();
    expect(screen.getByText(/Blueprint packages the capture into a site-specific world model/i)).toBeInTheDocument();
    expect(screen.getByText(/A managed review path gives robot teams task scenarios/i)).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Open sample proof/i })).toHaveAttribute(
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
    expect(screen.getAllByText(/Sample proof and demo worlds are labeled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approved listings keep capture basis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request one exact-site world model\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See hosted workflow/i })[0]).toHaveAttribute("href", "/product");
  });
});
