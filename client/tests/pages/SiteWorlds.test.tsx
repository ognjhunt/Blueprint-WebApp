import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders realistic deployment sites and direct hosted-session start links", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Test on the site before you go to the site\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Each Site World is a hosted model of one real site and one real workflow\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Choose how you want access\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Common reasons robot teams use a Site World\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Get the package/i)).toBeInTheDocument();
    expect(screen.getByText(/Run it hosted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A model of the exact site and workflow/i),
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
