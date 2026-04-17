import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LaunchMap from "@/pages/LaunchMap";

vi.mock("react-simple-maps", () => ({
  ComposableMap: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Geographies: ({ children }: { children: (input: { geographies: any[] }) => ReactNode }) =>
    <g>{children({ geographies: [] })}</g>,
  Geography: () => <path />,
  Marker: ({ children }: { children: ReactNode }) => <g>{children}</g>,
}));

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => ({
    data: {
      ok: true,
      supportedCities: [
        { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
      ],
      cities: [
        {
          city: "Austin",
          stateCode: "TX",
          displayName: "Austin, TX",
          citySlug: "austin-tx",
          status: "live",
          latitude: 30.2672,
          longitude: -97.7431,
        },
        {
          city: "Chicago",
          stateCode: "IL",
          displayName: "Chicago, IL",
          citySlug: "chicago-il",
          status: "planned",
          latitude: 41.8781,
          longitude: -87.6298,
        },
        {
          city: "Raleigh",
          stateCode: "NC",
          displayName: "Raleigh, NC",
          citySlug: "raleigh-nc",
          status: "under_review",
          latitude: 35.7796,
          longitude: -78.6382,
        },
      ],
      statusCounts: {
        live: 1,
        planned: 1,
        underReview: 1,
      },
      currentCity: null,
    },
    loading: false,
    error: null,
  }),
}));

describe("LaunchMap", () => {
  it("renders the public launch map with all launch states", () => {
    render(<LaunchMap />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Where Blueprint is live/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Austin, TX/i)).toBeInTheDocument();
    expect(screen.getByText(/Chicago, IL/i)).toBeInTheDocument();
    expect(screen.getByText(/Raleigh, NC/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Live$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Planned$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Under review$/i).length).toBeGreaterThan(0);
  });

  it("shows stronger live-city actions and softer non-live actions in the city popover", () => {
    render(<LaunchMap />);

    fireEvent.click(screen.getByRole("button", { name: /Open Austin, TX details/i }));
    expect(
      screen.getByRole("link", { name: /Apply for capturer access/i }),
    ).toHaveAttribute("href", "/signup/capturer");
    expect(
      screen.getByRole("link", { name: /Open capture app/i }),
    ).toHaveAttribute("href", "/capture-app");

    fireEvent.click(screen.getByRole("button", { name: /Open Chicago, IL details/i }));
    expect(
      screen.getByRole("link", { name: /Join future-city waitlist/i }),
    ).toHaveAttribute("href", "/signup/capturer?intent=future-city");
    expect(screen.getByRole("link", { name: /Talk to Blueprint/i })).toHaveAttribute(
      "href",
      "/contact?persona=launch-map",
    );
    expect(screen.queryByRole("link", { name: /Open capture app/i })).not.toBeInTheDocument();
  });
});
