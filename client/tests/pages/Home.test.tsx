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
  it("renders the simplified hero with the two primary entry points", { timeout: 10000 }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Site-specific world models for real facilities\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blueprint helps robot teams inspect, license, and run exact-site world-model products built from real capture\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Explore Sites/i })[0],
    ).toHaveAttribute("href", "/world-models");
    expect(
      screen.getAllByRole("link", { name: /Request Access/i })[0],
    ).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );
    expect(
      screen.getByText(/Built for teams that need the real site before deployment\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Real capture provenance/i)).toBeInTheDocument();
    expect(screen.getByText(/Site package licensing/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted session access/i)).toBeInTheDocument();
  });

  it("surfaces concise sections for sites, products, proof, and closing action", {
    timeout: 10000,
  }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Real places\. Real capture\. Real buying surfaces\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Two ways to work with one exact site\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /See what a team gets before it commits\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Capture provenance/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Package outputs/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted session artifacts/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with the site that matters\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chicago grocery backroom/i })).toHaveAttribute(
      "href",
      "/world-models/sw-chi-01",
    );
    expect(screen.getByRole("link", { name: /Media room walkthrough/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(
      screen.getByRole("link", { name: /View sample deliverables/i }),
    ).toBeInTheDocument();
  });
});
