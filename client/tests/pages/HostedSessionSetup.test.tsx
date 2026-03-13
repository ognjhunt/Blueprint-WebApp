import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HostedSessionSetup from "@/pages/HostedSessionSetup";
import { getSiteWorldById } from "@/data/siteWorlds";

const setLocationMock = vi.fn();

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

vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => "token-1"),
    },
  },
}));

afterEach(() => {
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

    expect(await screen.findByRole("heading", { name: /Start Hosted Session/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Harborview Grocery Distribution Annex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1847 W Fulton St, Chicago, IL 60612/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This launches a streamed world-model session for one site, one robot, and one task question\./i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/World Model/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Robot profile/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Session Runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/Embedded demo readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Raw session bundle \+ RLDS dataset/i)).toBeInTheDocument();
  });

  it("renders structured readiness blockers for demo and runtime launch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            launchable: false,
            entitled: true,
            blockers: ["Presentation demo UI base URL is not configured."],
            presentation_demo: {
              launchable: false,
              blockers: ["Presentation demo UI base URL is not configured."],
              blocker_details: [
                {
                  code: "presentation_ui_unconfigured",
                  message: "Presentation demo UI base URL is not configured.",
                  source: "presentation_demo",
                },
              ],
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

    expect(await screen.findByText(/Embedded demo readiness/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Presentation package: gs:\/\/bucket\/presentation.json/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Presentation demo UI base URL is not configured\./i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime session readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/The site-world registration does not include a live runtime handle yet\./i)).toBeInTheDocument();
  });
});
