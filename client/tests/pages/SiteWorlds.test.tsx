import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the upgraded site worlds catalog with detail-page links", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", { name: /Open site-specific robot environments by the hour\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Blueprint turns site-specific worlds into hosted environments that robot teams can actually use\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Twelve site worlds a robot team could open today\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Midwest Grocery Backroom/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public pricing can stay simple\./i })).toBeInTheDocument();
    expect(screen.getByText(/^Open access$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Teams should open a session, not manage raw checkpoints\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/session = blueprint\.site_worlds\.create/i)).toBeInTheDocument();
    const startLinks = screen.getAllByRole("link", { name: /Start billed session/i });
    expect(startLinks.length).toBeGreaterThan(0);
    expect(startLinks[0]).toHaveAttribute(
      "href",
      "/site-worlds/sw-chi-01?start=1",
    );
    const viewLinks = screen.getAllByRole("link", { name: /View site world/i });
    expect(viewLinks[0]).toHaveAttribute(
      "href",
      "/site-worlds/sw-chi-01",
    );
  });
});
