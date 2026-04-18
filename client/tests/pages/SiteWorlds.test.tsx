import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the simplified catalog-first world-models page", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Browse exact-site world models\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Real facilities, real capture, and clear paths into site packages or hosted sessions\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /View Sample Site/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");

    expect(
      screen.getAllByRole("link", { name: /Request Access/i })[0],
    ).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );

    expect(screen.getAllByText(/Site Package/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hosted Session/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Public proof first/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Featured sites\./i,
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
        name: /Browse the catalog\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Public demo available/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Hosted path documented/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Need a specific site\?/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Common reasons robot teams buy this surface/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/What public status means/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want access/i)).not.toBeInTheDocument();
  });
});
