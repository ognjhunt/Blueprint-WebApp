import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";
import { siteWorldCards } from "@/data/siteWorlds";

describe("SiteWorlds", () => {
  it("renders the simplified catalog-first world-models page", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /World models for exact-site training and evaluation\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Browse current samples or request the place and task you need\./i)).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Open sample world model/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");

    expect(
      screen.getAllByRole("link", { name: /Request world model/i })[0],
    ).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=request-capture&source=site-worlds",
    );

    expect(screen.getAllByText(/Exact site/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hosted request/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Public catalog/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Start with a world model, not an abstract demo\./i,
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

    siteWorldCards.forEach((site) => {
      expect(screen.getAllByText(site.siteName).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Freshness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Composite preview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Hosted setup/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Package access/i }).length).toBeGreaterThan(0);

    expect(screen.getByText(/True-to-site geometry/i)).toBeInTheDocument();
    expect(screen.getByText(/Photoreal textures/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Start with the world model that matters\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Common reasons robot teams buy this path/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/What public status means/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want access/i)).not.toBeInTheDocument();
  });
});
