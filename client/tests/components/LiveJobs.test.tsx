import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LiveJobs, LIVE_JOBS_EMPTY, LIVE_JOBS_HEADING } from "@/components/site/LiveJobs";

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

  // Owner, 2026-11-23: each row opens its job, with a picture for its kind in place of the site's own thumbnail.
  it("makes each row with a reference one link to the job, and leaves a row without one as text", async () => {
    const ref = `l-${"a".repeat(32)}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jobs: [
      { ref, kind: "Palletizing job", kindKey: "palletizing", country: "United States", postedOn: "2026-11-20", simulationReady: true },
      { ref: "req-1", kind: "Pick and place job", kindKey: "pick_and_place", country: null, postedOn: "2026-11-18", simulationReady: false },
    ] }), { status: 200 })));
    render(<LiveJobs />);
    const link = await screen.findByRole("link", { name: /Palletizing job/ });
    expect(link.getAttribute("href")).toBe(`/jobs/${ref}`);
    expect(link.textContent).toContain("See job");
    expect(link.querySelector(".live-job-icon svg")).not.toBeNull();
    // A value that is not a public reference (an id) is never made into a link.
    expect(screen.queryByRole("link", { name: /Pick and place job/ })).toBeNull();
  });

  // Outreach playbook fix 12 (2026-11-27): an empty list is said plainly; an unreadable one still shows nothing.
  it("says plainly that there are no live jobs when the list is empty, and shows nothing when it cannot be read", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ jobs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<LiveJobs />);
    expect(await screen.findByRole("heading", { name: LIVE_JOBS_HEADING })).toBeTruthy();
    expect(screen.getByText(LIVE_JOBS_EMPTY)).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/public/live-jobs");
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const second = render(<LiveJobs />);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(second.container.innerHTML).toBe("");
  });
});
