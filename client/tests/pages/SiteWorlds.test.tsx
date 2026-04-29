import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the simplified catalog-first world-models page", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Exact-site worlds\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Browse real facilities\./i)).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Inspect a real site/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");

    expect(
      screen.getAllByRole("link", { name: /Request access/i })[0],
    ).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );

    expect(screen.getAllByText(/Exact site/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hosted request/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Public catalog/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Real facilities, presented as worlds\./i,
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
        name: /The catalog expands from the same visual language\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/True-to-site geometry/i)).toBeInTheDocument();
    expect(screen.getByText(/Photoreal textures/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Start with the exact site that matters\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Common reasons robot teams buy this surface/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/What public status means/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want access/i)).not.toBeInTheDocument();
  });
});
