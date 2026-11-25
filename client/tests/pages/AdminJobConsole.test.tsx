import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminJobConsole, { PACKAGE_URL_REVOKE_DELAY_MS } from "@/pages/AdminJobConsole";
import type { AdminJobDetail, AdminJobRow } from "@/types/jobConsole";

/**
 * The admin job page (owner, 2026-11-17): one row per job, and a job's page in six parts, each shown only when it has
 * something true to show. The page works out nothing: every line is what the API returned.
 */
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "founder", email: "founder@tryblueprint.io" } }),
}));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

const siteRow: AdminJobRow = { requestId: "job-a", sentence: "Stack cartons onto the pallet.", internalTest: null,
  phase: "building", standing: "Building the simulation", receivedAtIso: "2026-11-17T08:00:00.000Z" };
const testRow: AdminJobRow = { requestId: "job-t", sentence: "Pick the mug up.", internalTest: { label: "mug to tray" },
  phase: "simulation_ready", standing: "Simulation ready", receivedAtIso: "2026-11-16T18:00:00.000Z" };

const siteJob: AdminJobDetail = {
  requestId: "job-a",
  job: { sentence: "Stack cartons onto the pallet.", drafted: false, site: { name: "Dock 4", place: "Springfield" }, internalTest: null },
  standing: { phase: "building", phrase: "Building the simulation", siteSees: null,
    companies: "Not shared: the site has not accepted the current statement.", pipeline: "The Pipeline reports: building the scene." },
  simulationPackageUrl: null, simulationPackage: null, scenePreviewViewUrl: null, cost: null,
  stops: [{ key: "rights-older_statement", text: "The site agreed to an older statement.", whose: "site", atIso: null }],
  events: [{ key: "received", text: "Job received", atIso: "2026-11-17T08:00:00.000Z" }],
};
const testJob: AdminJobDetail = {
  requestId: "job-t",
  job: { sentence: "Pick the mug up.", drafted: false, site: null, internalTest: { label: "mug to tray" } },
  standing: { phase: "simulation_ready", phrase: "Simulation ready", siteSees: null, companies: null,
    pipeline: "The Pipeline reports: the simulation package is published." },
  simulationPackageUrl: "/api/admin/jobs/job-t/simulation.zip",
  simulationPackage: { files: ["README.txt", "scene.usda"], sizeBytes: 2_000_000, builtAtIso: "2026-11-16T21:40:00.000Z" },
  scenePreviewViewUrl: null,
  cost: { spentOrHeldUsd: 18.42, unreadable: [] },
  stops: [],
  events: [{ key: "received", text: "Job received", atIso: "2026-11-16T18:00:00.000Z" },
    { key: "package", text: "Simulation package built", atIso: "2026-11-16T21:40:00.000Z" }],
};

let fetchMock: ReturnType<typeof vi.fn>;
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminJobConsole /></QueryClientProvider>);
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/admin/jobs");
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/admin/jobs") return json({ jobs: [siteRow, testRow], nextCursor: null });
    if (url === "/api/admin/jobs/job-a") return json(siteJob);
    if (url === "/api/admin/jobs/job-t") return json(testJob);
    return json({ error: "unexpected" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("the job list", () => {
  it("shows one row per job: the site's sentence or the test's label, where it stands, and when it was received", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Jobs" })).toBeInTheDocument();
    const items = within(await screen.findByRole("list", { name: "Jobs" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("“Stack cartons onto the pallet.”");
    expect(items[0]).toHaveTextContent(/Building the simulation · Received Nov 17, 2026/);
    expect(items[1]).toHaveTextContent("Internal test: mug to tray");
    expect(items[1]).toHaveTextContent(/Simulation ready · Received Nov 16, 2026/);
    // No filter, search, stage chip or next action of its own.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("shows the owner's totals in one line, with the billable events CSV fetched with the admin's sign-in", async () => {
    const totals = { siteJobs: 12, siteJobsThisWeek: 3, withVideo: 10, shownToCompanies: 8, answered: 5,
      introductionsAsked: 4, introductionsMade: null, outcomeAnswers: 1, billableEvents: 4, billableEventsNotMade: 2 };
    const csv = "/api/admin/jobs/billable-events.csv";
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:csv");
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs") return json({ jobs: [siteRow], nextCursor: null });
      if (url === "/api/admin/jobs/totals") return json(totals);
      if (url === csv) return new Response("event_id\r\n", { status: 200, headers: { "Content-Type": "text/csv" } });
      return json({ error: "unexpected" }, 500);
    });
    renderPage();
    const line = await screen.findByLabelText("Totals");
    await waitFor(() => expect(line).toHaveTextContent("12 site jobs (3 in the last 7 days) · 10 with a video · 8 shown to companies · 5 with an answer"
      + " · 4 introductions asked · ? made · 1 outcome answers · 4 billable events · 2 recorded but not made (not counted)"));
    expect(line).not.toHaveTextContent(/\$|price/i);
    fireEvent.click(within(line).getByRole("button", { name: "Billable events (CSV)" }));
    await waitFor(() => expect(clicked).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === csv)!;
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("keeps the billable events CSV when the totals cannot be read", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs") return json({ jobs: [siteRow], nextCursor: null });
      if (url === "/api/admin/jobs/totals") return json({ error: "The totals are unavailable. Try again." }, 503);
      return json({ error: "unexpected" }, 500);
    });
    renderPage();
    const line = await screen.findByLabelText("Totals");
    await waitFor(() => expect(line).toHaveTextContent("The totals are unavailable."));
    expect(within(line).getByRole("button", { name: "Billable events (CSV)" })).toBeTruthy();
  });

  it("keeps the privacy request queue, closed until opened", async () => {
    renderPage();
    await screen.findByRole("list", { name: "Jobs" });
    expect(screen.getByText("Account and data deletion requests", { selector: "summary" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/account-deletion"))).toBe(false);
  });

  it("holds the owner's marketplace numbers on the list, read with the admin's sign-in, and not on a job's page", async () => {
    renderPage();
    expect(await screen.findByRole("region", { name: "Marketplace numbers" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/admin/jobs/marketplace-numbers?"))).toBe(true));
    fireEvent.click(await screen.findByRole("link", { name: /Stack cartons/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Dock 4" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Marketplace numbers" })).toBeNull();
  });
});

describe("a job's page", () => {
  it("opens a site's job with its name and place, where it stands from the API, what stopped it and what happened", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("link", { name: /Stack cartons/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Dock 4" })).toBeInTheDocument();
    expect(window.location.search).toBe("?job=job-a");
    expect(screen.getByText("Springfield")).toBeInTheDocument();
    expect(screen.getByText("Job job-a")).toBeInTheDocument();
    const standing = screen.getByRole("region", { name: "Where it stands" });
    expect(standing).toHaveTextContent("Building the simulation");
    expect(standing).toHaveTextContent("The Pipeline reports: building the scene.");
    expect(screen.getByRole("region", { name: "What stopped it" })).toHaveTextContent("The site agreed to an older statement. The site's step.");
    // Each event's time sits on its own line above it.
    const happened = within(screen.getByRole("region", { name: "What happened" })).getAllByRole("listitem");
    expect(happened.map(item => item.children.length)).toEqual([2]);
    expect(happened[0].children[1]).toHaveTextContent("Job received");
    // Parts with nothing true to show are left out.
    expect(screen.queryByRole("region", { name: "What was built" })).toBeNull();
    expect(screen.queryByRole("region", { name: "What it has cost so far" })).toBeNull();
    expect(screen.getByText("Deployment companies", { selector: "summary" })).toBeInTheDocument();
  });

  it("reads the job again after a company action, so the sharing line, stops and events above stay true", async () => {
    const panel = { sharing: { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null }, hold: null,
      consentRevoked: false, libraryUrl: "https://tryblueprint.io/contact/robot-team#job-job-a", companies: [], sends: [], responses: [] };
    let held = false;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-a") return json(held ? { ...siteJob, stops: [...siteJob.stops,
        { key: "blueprint-hold", text: "Blueprint stopped showing this job to companies.", whose: "blueprint", atIso: null }] } : siteJob);
      if (url === "/api/admin/jobs/job-a/companies" && !init?.method) return json(panel);
      if (url === "/api/admin/jobs/job-a/companies/hold") { held = true; return json({ hold: { held: true } }); }
      return json({ error: "unexpected" }, 500);
    });
    window.history.replaceState(null, "", "/admin/jobs?job=job-a");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Dock 4" });
    const summary = screen.getByText("Deployment companies", { selector: "summary" });
    (summary.parentElement as HTMLDetailsElement).open = true;
    fireEvent(summary.parentElement!, new Event("toggle"));
    const tool = await screen.findByRole("region", { name: "Deployment companies" });
    const reads = () => fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/jobs/job-a").length;
    const before = reads();
    fireEvent.change(await within(tool).findByLabelText(/^Why/), { target: { value: "Checking the summary" } });
    fireEvent.click(await within(tool).findByRole("button", { name: "Stop showing this job to companies" }));
    await waitFor(() => expect(reads()).toBe(before + 1));
    expect(await screen.findByText(/Blueprint stopped showing this job to companies\./)).toBeInTheDocument();
  });

  it("has no recommendation form, open gates, coverage, public card, ops notice or claim warning", async () => {
    window.history.replaceState(null, "", "/admin/jobs?job=job-a");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Dock 4" });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/recommendation|gate|coverage|public card|ops notice|claimed|location pending|robot team/i);
    expect(screen.queryByRole("link", { name: /recommendation/i })).toBeNull();
  });

  it("shows an internal test job by its label, with no site and no company tool", async () => {
    window.history.replaceState(null, "", "/admin/jobs?job=job-t");
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Internal test" })).toBeInTheDocument();
    expect(screen.getByText("mug to tray")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What it has cost so far" })).toHaveTextContent("$18.42");
    expect(screen.getByRole("region", { name: "What was built" })).toHaveTextContent(/2 files, 2.0 MB, built Nov 16, 2026: README.txt, scene.usda\./);
    expect(screen.queryByRole("region", { name: "What stopped it" })).toBeNull();
    expect(screen.queryByText("Deployment companies", { selector: "summary" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "‹ All jobs" }));
    expect(await screen.findByRole("list", { name: "Jobs" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("offers no simulation package download while the job has none", async () => {
    window.history.replaceState(null, "", "/admin/jobs?job=job-a");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Dock 4" });
    expect(screen.queryByRole("button", { name: "Download the simulation package" })).not.toBeInTheDocument();
  });

  it("downloads the simulation package with the admin's sign-in once one is ready", async () => {
    const zip = "/api/admin/jobs/job-t/simulation.zip";
    const createObjectURL = vi.fn(() => "blob:package");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-t") return json(testJob);
      if (url === zip) return new Response(new Blob(["PK"]), { status: 200, headers: { "Content-Type": "application/zip" } });
      return json({ error: "unexpected" }, 500);
    });
    window.history.replaceState(null, "", "/admin/jobs?job=job-t");
    renderPage();
    const button = await screen.findByRole("button", { name: "Download the simulation package" });
    // Only the revoke timer is faked; vi.waitFor keeps real timers.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.click(button);
      await vi.waitFor(() => expect(clicked).toHaveBeenCalledTimes(1));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === zip)!;
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer token" });
      // The save gets time to start: the object URL is not revoked with the click, only after the delay.
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(PACKAGE_URL_REVOKE_DELAY_MS / 2);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(PACKAGE_URL_REVOKE_DELAY_MS / 2);
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:package");
    } finally {
      vi.useRealTimers();
      clicked.mockRestore();
    }
  });

  it("says why when the package cannot be downloaded", async () => {
    const zip = "/api/admin/jobs/job-t/simulation.zip";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-t") return json(testJob);
      if (url === zip) return json({ error: "The simulation is not available.", code: "company_simulation_unavailable" }, 404);
      return json({ error: "unexpected" }, 500);
    });
    window.history.replaceState(null, "", "/admin/jobs?job=job-t");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Download the simulation package" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The simulation is not available.");
  });

  // #1312's behaviour, on this page: under the download, fetched with the admin's sign-in, only ever the viewer.
  describe("View the simulation of the site", () => {
    const mint = "/api/admin/jobs/job-t/scene-preview-view";
    const viewer = "/splat-viewer/index.html?content=%2Fapi%2Fwebsite-atlas-preview-views%2Fjob-t%2Fwalkthrough-job-t%2Fscene.ply";
    function answers(mintAnswer: () => Response, patch: Partial<AdminJobDetail> = { scenePreviewViewUrl: mint }) {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/admin/jobs/job-t") return json({ ...testJob, ...patch });
        if (url === mint) return mintAnswer();
        if (url === "/api/admin/jobs") return json({ jobs: [testRow], nextCursor: null });
        return json({ error: "unexpected" }, 500);
      });
      window.history.replaceState(null, "", "/admin/jobs?job=job-t");
    }

    it("is not offered while the job has no stored preview", async () => {
      window.history.replaceState(null, "", "/admin/jobs?job=job-t");
      renderPage();
      expect(await screen.findByRole("heading", { level: 1, name: "Internal test" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "View the simulation of the site" })).not.toBeInTheDocument();
    });

    it("shows under the package download, and shows alone when there is no package", async () => {
      answers(() => json({ url: viewer }), { scenePreviewViewUrl: mint });
      const first = renderPage();
      const built = await screen.findByRole("region", { name: "What was built" });
      const buttons = within(built).getAllByRole("button").map(button => button.textContent);
      expect(buttons).toEqual(["Download the simulation package", "View the simulation of the site"]);
      first.unmount();
      answers(() => json({ url: viewer }), { scenePreviewViewUrl: mint, simulationPackageUrl: null, simulationPackage: null });
      renderPage();
      const alone = await screen.findByRole("region", { name: "What was built" });
      expect(within(alone).getAllByRole("button").map(button => button.textContent)).toEqual(["View the simulation of the site"]);
    });

    it("mints the ticket with the admin's sign-in and sends the tab it opened to the viewer", async () => {
      answers(() => json({ url: viewer }));
      const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
      const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "View the simulation of the site" }));
      expect(open).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(tab.location.href).toBe(viewer));
      expect(tab.opener).toBeNull();
      const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === mint)!;
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer token" });
      expect(tab.close).not.toHaveBeenCalled();
    });

    it("offers a link when the browser blocks the new tab", async () => {
      answers(() => json({ url: viewer }));
      vi.spyOn(window, "open").mockReturnValue(null);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "View the simulation of the site" }));
      expect(await screen.findByRole("link", { name: "Open the viewer" })).toHaveAttribute("href", viewer);
    });

    it("closes the tab and says why when the ticket is refused", async () => {
      const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
      vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
      answers(() => json({ error: "The simulation of the site is not available.", code: "scene_preview_unavailable" }, 404));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "View the simulation of the site" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("The simulation of the site is not available.");
      expect(tab.close).toHaveBeenCalledTimes(1);
      expect(tab.location.href).toBe("");
    });

    it("never sends the tab anywhere but the viewer", async () => {
      const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
      vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
      answers(() => json({ url: "https://elsewhere.example/" }));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "View the simulation of the site" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(tab.close).toHaveBeenCalledTimes(1);
      expect(tab.location.href).toBe("");
    });
  });
});
