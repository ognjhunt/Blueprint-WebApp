import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LiveJobs, LIVE_JOBS_HEADING } from "@/components/site/LiveJobs";

/** Owner, 2026-11-23: /jobs shows that real jobs exist, by what Blueprint derives about each, before a company applies. */
describe("LiveJobs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists each live job by its kind, country, day and simulation state, and points to the application", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jobs: [
      { kind: "Palletize cartons", country: "United States", postedOn: "2026-11-20", simulationReady: true },
      { kind: "Automation job", country: null, postedOn: "2026-11-18", simulationReady: false },
    ] }), { status: 200 })));
    render(<LiveJobs />);
    expect(await screen.findByRole("heading", { name: LIVE_JOBS_HEADING })).toBeTruthy();
    const rows = screen.getAllByRole("listitem").map(row => row.textContent);
    expect(rows).toEqual(["Palletize cartonsUnited States · Posted November 20, 2026 · Simulation ready",
      "Automation jobPosted November 18, 2026"]);
    expect(screen.getByRole("link", { name: "Apply to see jobs" }).getAttribute("href")).toBe("#partner-application");
  });

  it("shows nothing while there are no live jobs, or when the list cannot be read", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ jobs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, unmount } = render(<LiveJobs />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/public/live-jobs"));
    expect(container.innerHTML).toBe("");
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const second = render(<LiveJobs />);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(second.container.innerHTML).toBe("");
  });
});
