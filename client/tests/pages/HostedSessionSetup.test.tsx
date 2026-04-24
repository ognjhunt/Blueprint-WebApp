import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HostedSessionSetup from "@/pages/HostedSessionSetup";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";

const setLocationMock = vi.fn();
const { authMock } = vi.hoisted(() => ({
  authMock: {
    currentUser: {
      getIdToken: vi.fn(async () => "token-1"),
    },
  },
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/site-worlds/sw-chi-01/start", setLocationMock],
  };
});

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
}));

vi.mock("@/lib/firebase", () => ({
  auth: authMock,
}));

afterEach(() => {
  authMock.currentUser = {
    getIdToken: vi.fn(async () => "token-1"),
  };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HostedSessionSetup", () => {
  it("renders the three launch sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            launchable: true,
            entitled: true,
            blockers: [],
            presentation_demo: {
              launchable: true,
              blockers: [],
              blocker_details: [],
              presentationWorldManifestUri: "gs://bucket/presentation.json",
            },
            runtime_only: {
              launchable: true,
              blockers: [],
              blocker_details: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(<HostedSessionSetup params={{ slug: "sw-chi-01" }} />);

    expect(await screen.findByRole("heading", { name: /Configure Hosted Evaluation/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Harborview Grocery Distribution Annex/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1847 W Fulton St, Chicago, IL 60612/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/We will run your robot on-site at Harborview Grocery Distribution Annex/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/World Model/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Robot profile/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Presentation demo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Observation frames/i).length).toBeGreaterThan(0);
  });

  it("renders structured readiness blockers for demo and runtime launch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            launchable: false,
            entitled: true,
            blockers: [],
            presentation_demo: {
              launchable: true,
              blockers: [],
              blocker_details: [],
              status: "presentation_ui_unconfigured",
              presentationWorldManifestUri: "gs://bucket/presentation.json",
            },
            runtime_only: {
              launchable: false,
              blockers: ["The site-world registration does not include a live runtime handle yet."],
              blocker_details: [
                {
                  code: "runtime_handle_missing",
                  message: "The site-world registration does not include a live runtime handle yet.",
                  source: "runtime",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(<HostedSessionSetup params={{ slug: "sw-chi-01" }} />);

    expect(await screen.findByText(/Presentation demo/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Artifacts are ready\. Private operator UI is still blocked\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Runtime session is blocked right now\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/World-model runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime session is blocked right now\./i)).toBeInTheDocument();
  });

  it("offers a runtime-only launch fallback when the embedded demo is blocked", async () => {
    const demoSiteId = "siteworld-f5fd54898cfb";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string" && input.includes("/launch-readiness")) {
        return new Response(
          JSON.stringify({
            launchable: false,
            entitled: true,
            blockers: [],
            presentation_demo: {
              launchable: false,
              blockers: ["Private operator UI is still blocked."],
              blocker_details: [],
              status: "presentation_ui_unconfigured",
              presentationWorldManifestUri: "gs://bucket/presentation.json",
            },
            runtime_only: {
              launchable: true,
              blockers: [],
              blocker_details: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          workspaceUrl: "/site-worlds/sessions/runtime-only-1",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HostedSessionSetup params={{ slug: demoSiteId }} />);

    expect(
      await screen.findByText(/Embedded demo is blocked, but the world-model runtime is available\./i),
    ).toBeInTheDocument();
    const runtimeButton = screen.getByRole("button", { name: /Launch runtime session/i });
    expect(runtimeButton).toBeEnabled();

    fireEvent.click(runtimeButton);

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/site-worlds/sessions/runtime-only-1");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createCall] = fetchMock.mock.calls;
    const request = JSON.parse(String(createCall?.[1]?.body || "{}")) as Record<string, unknown>;
    expect(request.sessionMode).toBe("runtime_only");
    expect(request.runtimeUi).toBeNull();
    expect((request.runtimeSessionConfig as Record<string, unknown>).canonical_package_uri).toBe(
      getSiteWorldById(demoSiteId)?.siteWorldSpecUri || null,
    );
  });

  it("treats the env-configured hosted demo site world as public even without Firebase auth", async () => {
    const demoSiteId = "siteworld-707ec52ef0a8";
    vi.stubEnv("VITE_HOSTED_DEMO_SITE_WORLD_ID", demoSiteId);
    authMock.currentUser = null;
    vi.mocked(fetchSiteWorldDetail).mockResolvedValue({
      ...getSiteWorldById("siteworld-f5fd54898cfb"),
      id: demoSiteId,
    } as never);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          launchable: true,
          entitled: true,
          blockers: [],
          presentation_demo: {
            launchable: false,
            blockers: ["Temporary runtime-only demo"],
            blocker_details: [],
          },
          runtime_only: {
            launchable: true,
            blockers: [],
            blocker_details: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<HostedSessionSetup params={{ slug: demoSiteId }} />);

    expect(await screen.findByText(/World-model runtime/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0]?.[1]?.headers || {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
