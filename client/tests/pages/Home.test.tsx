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
        name: /Site-specific world models for real places\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Evaluate exact deployment sites before the expensive part starts/i,
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
      screen.getByText(/A site-specific digital environment built from real capture/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Walkthrough media, poses, metadata, geometry when available/i)).toBeInTheDocument();
    expect(screen.getByText(/Managed reruns, observations, evidence exports/i)).toBeInTheDocument();
  });

  it("surfaces concise sections for sites, products, proof, and closing action", {
    timeout: 20000,
  }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Open the map to everyday places\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open capture app/i })).toHaveAttribute(
      "href",
      "/capture-app",
    );
    expect(
      screen.getByRole("heading", {
        name: /Everyday places can become robot-team evidence\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Two ways to work with one exact site\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /See what attaches before it commits\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Capture provenance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Composite stories make the evidence path concrete/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with the site that matters\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View sample deliverables/i }),
    ).toBeInTheDocument();
  });
});
