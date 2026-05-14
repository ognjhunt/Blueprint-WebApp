import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";
import { siteWorldCards } from "@/data/siteWorlds";

describe("SiteWorlds", () => {
  it("renders the marketplace-grade world-model catalog with truthful state labels", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Browse exact-site world models\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Blueprint is building a capture-backed supply of site worlds/i)).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Open sample world model/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");

    const requestLinks = screen.getAllByRole("link", { name: /Request world model/i });
    expect(requestLinks[requestLinks.length - 1]).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds",
    );

    expect(screen.getAllByText(/Sample/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Request-gated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Planned catalog profile/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Catalog records/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Start with a site world, not an abstract demo\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("link", { name: /Harborview Grocery Distribution Annex/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Media Room Demo Walkthrough/i }).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", {
        name: /Scan every listing by proof, access, and freshness\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Marketplace filters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search site, workflow, robot/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Retail$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Proof visible$/i })).toBeInTheDocument();

    siteWorldCards.forEach((site) => {
      expect(screen.getAllByText(site.siteName).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Freshness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Planned route diagram/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Inspect listing/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Scope this site/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Hosted setup/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Package access/i }).length).toBeGreaterThan(0);

    expect(screen.getByText(/True-to-site geometry/i)).toBeInTheDocument();
    expect(screen.getByText(/Photoreal textures/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Ask for the exact site your robot team needs\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Common reasons robot teams buy this path/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/What public status means/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want access/i)).not.toBeInTheDocument();
  });
});
