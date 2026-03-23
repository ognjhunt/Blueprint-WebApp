import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders realistic deployment sites and request-based hosted evaluation links", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Train and evaluate on the exact site before your team shows up\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Each world model is built from real indoor captures and tied to a specific site and workflow\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Choose how you want access\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Common reasons robot teams use world models\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Get the package/i)).toBeInTheDocument();
    expect(screen.getByText(/Run it hosted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A site-faithful model of the exact workflow area/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Public walkthrough/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Likely buyer:/i)).not.toBeInTheDocument();

    const sceneLinks = screen.getAllByRole("link", { name: /Request scene package/i });
    const sceneUrl = new URL(sceneLinks[0].getAttribute("href")!, "https://example.com");
    expect(sceneUrl.pathname).toBe("/contact");
    expect(sceneUrl.searchParams.get("interest")).toBe("data-licensing");
    expect(sceneUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect(sceneUrl.searchParams.get("siteName")).toBe("Harborview Grocery Distribution Annex");

    const hostedLinks = screen.getAllByRole("link", { name: /Request hosted evaluation/i });
    const hostedUrl = new URL(hostedLinks[0].getAttribute("href")!, "https://example.com");
    expect(hostedUrl.pathname).toBe("/contact");
    expect(hostedUrl.searchParams.get("interest")).toBe("evaluation-package");
    expect(hostedUrl.searchParams.get("buyerType")).toBe("robot_team");
  });
});
