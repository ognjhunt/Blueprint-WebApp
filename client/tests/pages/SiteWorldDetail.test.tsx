import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SiteWorldDetail from "@/pages/SiteWorldDetail";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

describe("SiteWorldDetail", () => {
  it("keeps the explainer secondary and uses direct hosted-session start CTAs", async () => {
    window.history.replaceState({}, "", "/site-worlds/sw-chi-01");

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Harborview Grocery Distribution Annex/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What this site world is good for\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Get the site package\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Run this site hosted\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What a hosted session looks like/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick the site/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Score the run, export results, and compare policies/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-serve starting rate/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What goes in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What comes back/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What teams do with this world model/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Example run for Harborview Grocery Distribution Annex/i }),
    ).toBeInTheDocument();

    const sceneLink = screen.getByRole("link", { name: /Request scene package/i });
    const sceneUrl = new URL(sceneLink.getAttribute("href")!, "https://example.com");
    expect(sceneUrl.pathname).toBe("/contact");
    expect(sceneUrl.searchParams.get("interest")).toBe("data-licensing");

    const hostedLink = screen.getByRole("link", { name: /Start hosted session/i });
    expect(hostedLink).toHaveAttribute("href", "/world-models/sw-chi-01/start");
  });

  it("shows the World Labs preview launch CTA when a generated world is ready", async () => {
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue({
      ...getSiteWorldById("sw-chi-01")!,
      worldLabsPreview: {
        status: "ready",
        model: "Marble 0.1-mini",
        launchUrl: "https://marble.worldlabs.ai/worlds/world-123",
        panoUrl: "https://cdn.worldlabs.ai/pano.jpg",
        spzUrls: ["https://cdn.worldlabs.ai/world.spz"],
        colliderMeshUrl: "https://cdn.worldlabs.ai/collider.glb",
      },
    });

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    const launchLink = await screen.findByRole("link", { name: /Launch interactive preview/i });
    expect(launchLink).toHaveAttribute("href", "https://marble.worldlabs.ai/worlds/world-123");
    expect(launchLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/The World Labs viewer opens in a new tab/i)).toBeInTheDocument();
    expect(screen.getByText(/SPZ export: Available/i)).toBeInTheDocument();
  });
});
