import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorldDetail from "@/pages/SiteWorldDetail";

describe("SiteWorldDetail", () => {
  it("keeps the explainer secondary and uses direct hosted-session start CTas", () => {
    window.history.replaceState({}, "", "/site-worlds/sw-chi-01");

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Harborview Grocery Distribution Annex/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with the site asset package\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Use the hosted eval layer built from the site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How this works/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick the site/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Score the run, export results, and compare policies/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What goes in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What comes back/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What teams do with it/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Example run for Harborview Grocery Distribution Annex/i }),
    ).toBeInTheDocument();

    const sceneLink = screen.getByRole("link", { name: /Request scene package/i });
    const sceneUrl = new URL(sceneLink.getAttribute("href")!, "https://example.com");
    expect(sceneUrl.pathname).toBe("/contact");
    expect(sceneUrl.searchParams.get("interest")).toBe("data-licensing");

    const hostedLink = screen.getByRole("link", { name: /Start hosted session/i });
    const hostedUrl = new URL(hostedLink.getAttribute("href")!, "https://example.com");
    expect(hostedUrl.pathname).toBe("/contact");
    expect(hostedUrl.searchParams.get("interest")).toBe("evaluation-package");
    expect(hostedUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect(hostedUrl.searchParams.get("siteName")).toBe("Harborview Grocery Distribution Annex");
    expect(hostedUrl.searchParams.get("siteLocation")).toBe("1847 W Fulton St, Chicago, IL 60612");
    expect(hostedUrl.searchParams.get("targetRobotTeam")).toBe(
      "Unitree G1 with head cam and wrist cam",
    );
  });
});
