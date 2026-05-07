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
        name: /Blueprint turns real places into sites your robot team can inspect\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Send the site, route, or facility type you care about/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request site review/i })[0],
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(screen.getByRole("heading", { name: /Submit or claim a site\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Check where capture is open\./i })).toBeInTheDocument();
    expect(screen.getByText(/A walkthrough or site record starts the product/i)).toBeInTheDocument();
    expect(screen.getByText(/Blueprint packages the capture into a site-specific world model/i)).toBeInTheDocument();
    expect(screen.getByText(/A managed browser session can help a robot team inspect/i)).toBeInTheDocument();
  });

  it("surfaces concise sections for sites, products, proof, and closing action", {
    timeout: 20000,
  }, () => {
    window.localStorage.clear();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Start with one complete proof journey\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open proof/i })).toHaveAttribute(
      "href",
      "/proof",
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
        name: /See what is attached before you commit\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Capture provenance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/See what a robot team would inspect/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with the site, task, and robot question\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See product/i })[0]).toHaveAttribute("href", "/product");
  });
});
