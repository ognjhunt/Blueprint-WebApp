import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders realistic deployment sites and direct hosted-session start links", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Site-specific world models for robot teams\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Each Site World is a robot-ready model of one real site and one real workflow\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Two ways a robot team can use one world model\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Four common reasons teams buy or stream a site world\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Scene Package$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted Sessions$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Each listing is one site-specific world model\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/each site card shows its own self-serve hourly rate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();

    const sceneLinks = screen.getAllByRole("link", { name: /Request scene package/i });
    const sceneUrl = new URL(sceneLinks[0].getAttribute("href")!, "https://example.com");
    expect(sceneUrl.pathname).toBe("/contact");
    expect(sceneUrl.searchParams.get("interest")).toBe("data-licensing");
    expect(sceneUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect(sceneUrl.searchParams.get("siteName")).toBe("Harborview Grocery Distribution Annex");

    const hostedLinks = screen.getAllByRole("link", { name: /Start hosted session/i });
    expect(hostedLinks[0]).toHaveAttribute("href", "/site-worlds/sw-chi-01/start");
  });
});
