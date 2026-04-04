import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SiteWorldDetail from "@/pages/SiteWorldDetail";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import type { PublicSiteWorldRecord } from "@/types/inbound-request";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

function buildSiteWorld(overrides: Partial<PublicSiteWorldRecord> = {}): PublicSiteWorldRecord {
  const base = getSiteWorldById("sw-chi-01") as PublicSiteWorldRecord;
  return {
    ...base,
    deploymentReadiness: {
      native_world_model_primary: true,
      native_world_model_status: "primary_ready",
      provider_fallback_only: true,
      provider_fallback_preview_status: "fallback_available",
      ...(base.deploymentReadiness || {}),
      ...((overrides.deploymentReadiness as Record<string, unknown> | undefined) || {}),
    },
    artifactExplorer: {
      status: "partial",
      headline: "Explore the site-world through saved artifacts",
      summary: "Artifact explorer",
      views: base.artifactExplorer?.views || [],
      sources: [
        {
          id: "worldlabs-request",
          label: "World Labs request manifest",
          uri: "gs://bucket/worldlabs/worldlabs_request_manifest.json",
          detail: "Manual/admin trigger bundle for Marble generation",
        },
        {
          id: "worldlabs-input-manifest",
          label: "World Labs input manifest",
          uri: "gs://bucket/worldlabs_input/worldlabs_input_manifest.json",
          detail: "Prepared World Labs-compatible input clip",
        },
        {
          id: "worldlabs-input-video",
          label: "World Labs input video",
          uri: "gs://bucket/worldlabs_input/worldlabs_input.mp4",
          detail: "Trimmed and transcoded video used for Marble generation",
        },
      ],
      operatorView:
        base.artifactExplorer?.operatorView || {
          available: false,
          live: false,
          label: "Private operator view unavailable",
          description: "Use artifact-backed exploration when no private operator bridge is configured.",
        },
      ...base.artifactExplorer,
      ...(overrides.artifactExplorer || {}),
    },
    ...overrides,
  };
}

describe("SiteWorldDetail", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ currentUser: null, userData: null, tokenClaims: null });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(buildSiteWorld());
  });

  it("keeps the explainer secondary and uses hosted evaluation request CTAs", async () => {
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
      screen.getByText(
        /This world model is built from real capture of this facility\. Use it to answer a deployment question on the real site, compare the package with hosted evaluation, and decide how your team should test before visiting\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Buy the site package\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request hosted evaluation for this site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What hosted evaluation looks like/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick the site/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Score the run, export results, and compare policies/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-serve starting rate/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What goes in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What comes back/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What teams use this listing for\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A sample eval loop for Harborview Grocery Distribution Annex/i)).toBeInTheDocument();
    expect(screen.queryByText(/Not specified/i)).not.toBeInTheDocument();

    const packageLink = screen.getByRole("link", { name: /Request site package/i });
    const packageUrl = new URL(packageLink.getAttribute("href")!, "https://example.com");
    expect(packageUrl.pathname).toBe("/contact");
    expect(packageUrl.searchParams.get("interest")).toBe("data-licensing");

    const hostedLink = screen.getByRole("link", { name: /Request hosted evaluation/i });
    const hostedUrl = new URL(hostedLink.getAttribute("href")!, "https://example.com");
    expect(hostedUrl.pathname).toBe("/contact");
    expect(hostedUrl.searchParams.get("interest")).toBe("evaluation-package");
  });

  it("shows admin Marble controls to allowed admin users", async () => {
    useAuthMock.mockReturnValue({
      currentUser: {
        email: "ops@tryblueprint.io",
        getIdToken: vi.fn(async () => "test-token"),
      },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        worldLabsPreview: {
          status: "queued",
          model: "Marble 0.1-mini",
        },
      }),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(await screen.findByRole("button", { name: /Generate Marble Preview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh Marble Status/i })).toBeInTheDocument();
    expect(screen.getByText(/Admin Marble Controls/i)).toBeInTheDocument();
  });

  it("does not show admin Marble controls to non-admin users", async () => {
    useAuthMock.mockReturnValue({
      currentUser: {
        email: "user@example.com",
      },
      userData: null,
      tokenClaims: null,
    });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        worldLabsPreview: {
          status: "ready",
          model: "Marble 0.1-mini",
          worldId: "world-123",
          launchUrl: "https://marble.worldlabs.ai/worlds/world-123",
        },
      }),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      await screen.findByRole("link", { name: /Open interactive preview/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Native Blueprint world-model artifacts are the primary path for this site\./i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Marble Preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refresh Marble Status/i })).not.toBeInTheDocument();
  });

  it("calls the admin generate API when Marble generation is triggered", async () => {
    const getIdToken = vi.fn(async () => "test-token");
    useAuthMock.mockReturnValue({
      currentUser: {
        email: "ops@tryblueprint.io",
        getIdToken,
      },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        worldLabsPreview: {
          status: "queued",
          model: "Marble 0.1-mini",
        },
      }),
    );
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          preview: {
            status: "queued",
            model: "Marble 0.1-mini",
            operationId: "op-123",
            requestManifestUri: "gs://bucket/worldlabs/worldlabs_request_manifest.json",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    fireEvent.click(await screen.findByRole("button", { name: /Generate Marble Preview/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/admin/site-worlds/sw-chi-01/worldlabs-preview/generate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });
    expect(getIdToken).toHaveBeenCalled();
  });

  it("calls the admin refresh API when Marble status is refreshed", async () => {
    const getIdToken = vi.fn(async () => "test-token");
    useAuthMock.mockReturnValue({
      currentUser: {
        email: "ops@tryblueprint.io",
        getIdToken,
      },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        worldLabsPreview: {
          status: "processing",
          model: "Marble 0.1-mini",
          operationId: "op-123",
          operationManifestUri: "gs://bucket/worldlabs/worldlabs_operation_manifest.json",
        },
      }),
    );
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          preview: {
            status: "processing",
            model: "Marble 0.1-mini",
            operationId: "op-123",
            requestManifestUri: "gs://bucket/worldlabs/worldlabs_request_manifest.json",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    fireEvent.click(await screen.findByRole("button", { name: /Refresh Marble Status/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/admin/site-worlds/sw-chi-01/worldlabs-preview/refresh",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });
    expect(getIdToken).toHaveBeenCalled();
  });

  it("shows a clear admin-facing error when required World Labs artifacts are missing", async () => {
    useAuthMock.mockReturnValue({
      currentUser: {
        email: "ops@tryblueprint.io",
        getIdToken: vi.fn(async () => "test-token"),
      },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        artifactExplorer: {
          status: "partial",
          headline: "Explore the site-world through saved artifacts",
          summary: "Artifact explorer",
          views: [],
          sources: [],
          operatorView: {
            available: false,
            live: false,
            label: "Private operator view unavailable",
            description: "Use artifact-backed exploration when no private operator bridge is configured.",
          },
        },
        worldLabsPreview: undefined,
      }),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    expect(
      await screen.findByText(/Pipeline output is required before Marble generation can run/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/worldlabs_request_manifest_uri/i)).toBeInTheDocument();
    expect(screen.getByText(/worldlabs_input_video_uri/i)).toBeInTheDocument();
  });

  it("keeps the existing launch CTA when the World Labs preview is ready", async () => {
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue(
      buildSiteWorld({
        worldLabsPreview: {
          status: "ready",
          model: "Marble 0.1-mini",
          worldId: "world-123",
          launchUrl: "https://marble.worldlabs.ai/worlds/world-123",
          panoUrl: "https://cdn.worldlabs.ai/pano.jpg",
          spzUrls: ["https://cdn.worldlabs.ai/world.spz"],
          colliderMeshUrl: "https://cdn.worldlabs.ai/collider.glb",
        },
      }),
    );

    render(<SiteWorldDetail params={{ slug: "sw-chi-01" }} />);

    const launchLink = await screen.findByRole("link", { name: /Open interactive preview/i });
    expect(launchLink).toHaveAttribute("href", "https://marble.worldlabs.ai/worlds/world-123");
    expect(launchLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/The World Labs viewer opens in a new tab/i)).toBeInTheDocument();
    expect(screen.getByText(/SPZ export: Available/i)).toBeInTheDocument();
  });
});
