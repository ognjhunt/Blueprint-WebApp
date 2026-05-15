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
        /A backroom layout with dock access, aisle replenishment paths, and a short transfer into shelf staging/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site overview/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tasks in this world model/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Composite hosted evaluation preview/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request package access\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Configure a hosted evaluation request for this site\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Status$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Request-scoped commercial review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proof depth/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proof label/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pipeline-backed metadata/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/setup checks for account access/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Freshness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hosted still \+ presentation still \+ buyer note/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Listing proof preview/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Composite visuals are labeled separately from proof/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Representative capture example/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Public capture pattern, not listing-specific proof\./i })).toBeInTheDocument();
    expect(screen.getByText(/does not claim a buyer send, customer result, or open export/i)).toBeInTheDocument();
    expect(screen.getByText(/Capture app cue/i)).toBeInTheDocument();
    expect(screen.getByText(/Evidence opened/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Guardrails/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Decision note/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hosted report rows/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Export tree/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proof depth/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Not specified/i)).not.toBeInTheDocument();

    const packageLink = screen.getAllByRole("link", { name: /Request package access/i })[0];
    const packageUrl = new URL(packageLink.getAttribute("href")!, "https://example.com");
    expect(packageUrl.pathname).toBe("/contact");
    expect(packageUrl.searchParams.get("interest")).toBe("data-licensing");

    const hostedLink = screen.getByRole("link", { name: /Request hosted evaluation/i });
    const hostedUrl = new URL(hostedLink.getAttribute("href")!, "https://example.com");
    expect(hostedUrl.pathname).toBe("/contact");
    expect(hostedUrl.searchParams.get("interest")).toBe("hosted-evaluation");
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

    expect(await screen.findByRole("button", { name: /Generate preview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh status/i })).toBeInTheDocument();
    expect(screen.getByText(/Optional provider-generated preview/i)).toBeInTheDocument();
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
    expect(screen.getByText(/The site package and hosted request path stay primary on this listing\./i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refresh status/i })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: /Generate preview/i }));

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

    fireEvent.click(await screen.findByRole("button", { name: /Refresh status/i }));

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

    const generateButton = await screen.findByRole("button", { name: /Generate preview/i });
    const refreshButton = screen.getByRole("button", { name: /Refresh status/i });
    expect(generateButton).toBeDisabled();
    expect(refreshButton).toBeDisabled();
    expect(screen.getByText(/No live operation id/i)).toBeInTheDocument();
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
    expect(screen.getByText(/The optional interactive preview is ready to open in a new tab\./i)).toBeInTheDocument();
    expect(screen.getByText(/Interactive preview is optional and does not redefine listing trust\./i)).toBeInTheDocument();
  });
});
