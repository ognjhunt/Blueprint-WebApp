import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CityLanding from "@/pages/CityLanding";

const citySlugMock = vi.hoisted(() => ({ value: "durham-nc" }));
const navigateMock = vi.hoisted(() => vi.fn());
const launchStatusMock = vi.hoisted(() => ({
  state: {
    data: {
      ok: true,
      supportedCities: [
        { city: "Durham", stateCode: "NC", displayName: "Durham, NC", citySlug: "durham-nc" },
      ],
      cities: [
        {
          city: "Durham",
          stateCode: "NC",
          displayName: "Durham, NC",
          citySlug: "durham-nc",
          status: "live",
          latitude: 35.994,
          longitude: -78.8986,
        },
      ],
      statusCounts: {
        live: 1,
        planned: 0,
        underReview: 0,
      },
      currentCity: null,
    } as any,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("wouter", () => ({
  useParams: () => ({ citySlug: citySlugMock.value }),
  useLocation: () => [`/city/${citySlugMock.value}`, navigateMock],
}));

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => launchStatusMock.state,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: null }),
}));

describe("CityLanding", () => {
  beforeEach(() => {
    citySlugMock.value = "durham-nc";
    navigateMock.mockClear();
    launchStatusMock.state = {
      data: {
        ok: true,
        supportedCities: [
          { city: "Durham", stateCode: "NC", displayName: "Durham, NC", citySlug: "durham-nc" },
        ],
        cities: [
          {
            city: "Durham",
            stateCode: "NC",
            displayName: "Durham, NC",
            citySlug: "durham-nc",
            status: "live",
            latitude: 35.994,
            longitude: -78.8986,
          },
        ],
        statusCounts: {
          live: 1,
          planned: 0,
          underReview: 0,
        },
        currentCity: null,
      },
      loading: false,
      error: null,
    };
  });

  it("uses city-specific tracked coordinates instead of the Austin fallback", () => {
    render(<CityLanding />);

    expect(screen.getByRole("heading", { level: 1, name: /Durham, NC/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Durham, NC is in current launch-approved capture routing/i),
    ).toBeInTheDocument();
    expect(screen.getByText("35.9940° N")).toBeInTheDocument();
    expect(screen.getByText("78.8986° W")).toBeInTheDocument();
    expect(screen.queryByText("30.2672° N")).not.toBeInTheDocument();
    expect(screen.queryByText("97.7431° W")).not.toBeInTheDocument();
  });

  it("fails closed when launch status cannot be verified", () => {
    launchStatusMock.state = {
      data: null,
      loading: false,
      error: "Failed to load launch cities",
    };

    render(<CityLanding />);

    expect(
      screen.getByText(/could not verify current launch status for Durham Nc/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Unverified$/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Open capture app/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Join future-city waitlist/i }),
    ).toHaveAttribute("href", "#city-waitlist");
  });
});
