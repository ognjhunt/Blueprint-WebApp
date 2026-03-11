import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the site worlds concept page", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", { name: /Open site-specific robot environments by the hour\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Blueprint turns site-specific worlds into hosted environments that robot teams can actually use\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Six site worlds a robot team could open today\./i })).toBeInTheDocument();
    expect(screen.getByText(/Midwest Grocery Backroom/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public pricing can stay simple\./i })).toBeInTheDocument();
    expect(screen.getByText(/^Open access$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Teams should open a session, not manage raw checkpoints\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/session = blueprint\.site_worlds\.create/i)).toBeInTheDocument();
  });
});
