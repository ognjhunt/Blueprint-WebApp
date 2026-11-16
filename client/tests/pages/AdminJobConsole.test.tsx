import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminJobConsole, { PACKAGE_URL_REVOKE_DELAY_MS } from "@/pages/AdminJobConsole";
import type { JobConsoleDetail, JobConsoleRow } from "@/types/jobConsole";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "founder", email: "founder@tryblueprint.io" } }),
}));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

function row(overrides: Partial<JobConsoleRow> = {}): JobConsoleRow {
  return {
    requestId: "job-a",
    createdAtIso: "2026-10-01T00:00:00.000Z",
    siteName: "Dock 4",
    siteLocation: "Austin, TX",
    company: "Acme",
    claimed: true,
    archived: false,
    brief: { state: "confirmed", unresolvedGates: 0 },
    capture: { state: "covered", missingViews: [] },
    listing: { state: "live" },
    teamAccess: { listed: true, evaluationAvailable: true, reason: null, sceneHold: null },
    evaluations: { total: 1, pendingAdmission: 1, admitted: 0, pending: [{ requestId: "eval-1", teamName: "Atlas", setupName: "Arm v2" }] },
    runs: { queued: 0, running: 0, reported: 0, noResult: 0, passing: 0, belowTarget: 0, best: null },
    withdrawal: { state: "none" },
    opsNotice: null,
    lastActivityIso: "2026-10-03T00:00:00.000Z",
    stage: "awaiting_teams",
    nextAction: "Send the job to an approved deployment company",
    actionOwner: "blueprint",
    attention: [],
    ...overrides,
  };
}

const detail: JobConsoleDetail = {
  job: row(),
  timeline: [
    { key: "created", label: "Job received", atIso: "2026-10-01T00:00:00.000Z", done: true },
    { key: "admitted", label: "Free evaluation admitted", atIso: null, done: false },
  ],
  runs: [],
  links: { lead: "/admin/leads/job-a", recommendation: "/admin/robot-team-access?job=job-a" },
  simulationPackageUrl: null,
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
  window.history.replaceState(null, "", "/admin/jobs");
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/admin/jobs?")) {
      const params = new URLSearchParams(url.split("?")[1]);
      if (params.get("stage") === "passing_run") return json({ jobs: [], nextCursor: null, scanned: 2, stages: [] });
      return json({ jobs: [row(), row({ requestId: "job-b", siteName: "Cold Store", stage: "passing_run",
        nextAction: "Work with a deployment company on the passing result (1 passing run)", actionOwner: "blueprint", evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] } })],
        nextCursor: null, scanned: 2, stages: [] });
    }
    if (url === "/api/admin/jobs/job-a") return json(detail);
    return json({ error: "unexpected" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("AdminJobConsole", () => {
  it("reveals robot integration planning only in the existing operator console", async () => {
    renderPage();
    await screen.findByRole("list", { name: "Site jobs" });
    expect(screen.queryByRole("heading", { name: "Robot and policy shortlist" })).toBeNull();
    fireEvent.click(screen.getByText("Robot integration planning", { selector: "summary" }));
    expect(await screen.findByRole("heading", { name: "Robot and policy shortlist" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Shortlist I2RT YAM (two arms)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download robot and policy shortlist" })).toBeDisabled();
  });
  it("lists one row per job with its stage and next action", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Job console" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const list = await screen.findByRole("list", { name: "Site jobs" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Dock 4")).toBeInTheDocument();
    expect(within(items[0]).getByText("Awaiting teams", { selector: "span" })).toBeInTheDocument();
    expect(within(items[0]).getByText("Send the job to an approved deployment company")).toBeInTheDocument();
    expect(within(items[1]).getByText("Passing run", { selector: "span" })).toBeInTheDocument();
    expect(within(items[1]).getByText("Work with a deployment company on the passing result (1 passing run)")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Search site name")).toBeInTheDocument();
  });

  it("shows a job robot teams cannot evaluate as not open, with its real next step", async () => {
    fetchMock.mockImplementation(async () => json({ jobs: [row({ stage: "not_open", actionOwner: "blueprint",
      nextAction: "Rights review pending: review the capture's rights and privacy", evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] },
      teamAccess: { listed: false, evaluationAvailable: false, reason: "rights_needs_review", sceneHold: null } })],
      nextCursor: null, scanned: 1, stages: [] }));
    renderPage();
    const list = await screen.findByRole("list", { name: "Site jobs" });
    const [item] = within(list).getAllByRole("listitem");
    expect(within(item).getByText("Not open to teams", { selector: "span" })).toBeInTheDocument();
    expect(within(item).getByText("Rights review pending: review the capture's rights and privacy")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Stage")).getByRole("option", { name: "Not open to teams" })).toHaveValue("not_open");
  });

  it("filters by stage and searches on the server", async () => {
    renderPage();
    await screen.findByRole("list", { name: "Site jobs" });
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "passing_run" } });
    expect(await screen.findByText("No site jobs match this view.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("stage=passing_run"))).toBe(true);
    fireEvent.change(screen.getByLabelText("Search site name"), { target: { value: "cold" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("q=cold"))).toBe(true));
  });

  it("opens a job with its links and offers no admission of a team's run (2026-11-12)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open Dock 4" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Dock 4" })).toBeInTheDocument();
    expect(window.location.search).toBe("?job=job-a");
    expect(screen.getByRole("link", { name: "Open recommendation form" })).toHaveAttribute("href", "/admin/robot-team-access?job=job-a");
    expect(screen.queryByRole("heading", { name: "Evaluation requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: /Admit free evaluation/ })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/free-evaluations/"))).toBe(false);
  });

  it("offers no simulation package download while the job has none", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open Dock 4" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Dock 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download the simulation package" })).not.toBeInTheDocument();
    expect(screen.queryByText(/simulation package/i)).not.toBeInTheDocument();
  });

  it("downloads the simulation package with the admin's sign-in once one is ready", async () => {
    const zip = "/api/admin/jobs/job-a/simulation.zip";
    const createObjectURL = vi.fn(() => "blob:package");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-a") return json({ ...detail, simulationPackageUrl: zip });
      if (url === zip) return new Response(new Blob(["PK"]), { status: 200, headers: { "Content-Type": "application/zip" } });
      if (url.startsWith("/api/admin/jobs?")) return json({ jobs: [row()], nextCursor: null, scanned: 1, stages: [] });
      return json({ error: "unexpected" }, 500);
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open Dock 4" }));
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
      // (vi.waitFor above may have moved the fake clock a few polling intervals.)
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
    const zip = "/api/admin/jobs/job-a/simulation.zip";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-a") return json({ ...detail, simulationPackageUrl: zip });
      if (url === zip) return json({ error: "The simulation is not available.", code: "company_simulation_unavailable" }, 404);
      if (url.startsWith("/api/admin/jobs?")) return json({ jobs: [row()], nextCursor: null, scanned: 1, stages: [] });
      return json({ error: "unexpected" }, 500);
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open Dock 4" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download the simulation package" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The simulation is not available.");
  });
});
