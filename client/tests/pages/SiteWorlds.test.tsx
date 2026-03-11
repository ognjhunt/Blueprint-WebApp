import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the robot-team two-layer selector with scene package first", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Review the site asset, then the hosted eval layer\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This page is for robot teams\. Start with the site asset package for one real site/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Two ways a robot team can use a site\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Scene Package$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted Sessions$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /Twelve sites a robot team could review right now\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Qualification is for site operators\./i)).toBeInTheDocument();
    expect(screen.getByText(/Midwest Grocery Backroom/i)).toBeInTheDocument();
    expect(screen.queryByText(/Session live/i)).not.toBeInTheDocument();

    const sceneLinks = screen.getAllByRole("link", { name: /See package/i });
    expect(sceneLinks[0]).toHaveAttribute("href", "/site-worlds/sw-chi-01#scene-package");

    const hostedLinks = screen.getAllByRole("link", { name: /See hosted eval flow/i });
    expect(hostedLinks[0]).toHaveAttribute("href", "/site-worlds/sw-chi-01#hosted-sessions");
  });
});
