import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminJobConsole from "@/pages/AdminJobConsole";
import { defaultExpiry, toLocalInputValue } from "@/components/admin/AdmitFreeEvaluationForm";
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
    evaluations: { total: 1, pendingAdmission: 1, admitted: 0, pending: [{ requestId: "eval-1", teamName: "Atlas", setupName: "Arm v2" }] },
    runs: { queued: 0, running: 0, reported: 0, noResult: 0, passing: 0, belowTarget: 0, untargeted: 0, best: null },
    recommendation: { state: "none", recommendationId: null, teamId: null, teamName: null, evaluationRunId: null },
    booking: { state: "none", startsAt: null },
    withdrawal: { state: "none" },
    opsNotice: null,
    lastActivityIso: "2026-10-03T00:00:00.000Z",
    stage: "admission",
    nextAction: "Admit evaluation for Atlas",
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
  admissions: [{
    evaluationRequestId: "eval-1",
    submittedAtIso: "2026-10-03T00:00:00.000Z",
    admitted: false,
    handoff: null,
    ownerUid: "team-owner",
    team: { teamId: "team-1", name: "Atlas", status: "applied" },
    setup: { setupId: "setup-1", name: "Arm v2", reference: "https://policy.example.com/v2", missing: false },
    matchingCheckpoints: [{ checkpointId: "ckpt_1", label: "v2", runtime: "policy_endpoint", status: "registered" }],
    blockers: [],
  }],
  admissionDefaults: { episodes: 50, sponsorCapUsd: 20, maxSponsorCapUsd: 20, reservationTtlMs: 6 * 3_600_000,
    maxAttempts: 1, evidenceScope: "development_only" },
  links: { lead: "/admin/leads/job-a", recommendation: "/admin/robot-team-access?job=job-a" },
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
      if (params.get("stage") === "recommend") return json({ jobs: [], nextCursor: null, scanned: 2, stages: [] });
      return json({ jobs: [row(), row({ requestId: "job-b", siteName: "Cold Store", stage: "awaiting_booking",
        nextAction: "Waiting on site to book Nova", actionOwner: "site", evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] } })],
        nextCursor: null, scanned: 2, stages: [] });
    }
    if (url === "/api/admin/jobs/job-a") return json(detail);
    if (url === "/api/admin/free-evaluations/eval-1/admit" && init?.method === "POST") return json({ runId: "run_free_abc", created: true }, 201);
    return json({ error: "unexpected" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("AdminJobConsole", () => {
  it("lists one row per job with its stage and next action", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Job console" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const list = await screen.findByRole("list", { name: "Site jobs" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Dock 4")).toBeInTheDocument();
    expect(within(items[0]).getByText("Admit evaluation", { selector: "span" })).toBeInTheDocument();
    expect(within(items[0]).getByText("Admit evaluation for Atlas")).toBeInTheDocument();
    expect(within(items[1]).getByText("Waiting on site to book Nova")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Search site name")).toBeInTheDocument();
  });

  it("filters by stage and searches on the server", async () => {
    renderPage();
    await screen.findByRole("list", { name: "Site jobs" });
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "recommend" } });
    expect(await screen.findByText("No site jobs match this view.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("stage=recommend"))).toBe(true);
    fireEvent.change(screen.getByLabelText("Search site name"), { target: { value: "cold" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("q=cold"))).toBe(true));
  });

  it("opens a job and admits its free evaluation through the existing endpoint", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open Dock 4" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Dock 4" })).toBeInTheDocument();
    expect(window.location.search).toBe("?job=job-a");
    expect(screen.getByRole("link", { name: "Open recommendation form" })).toHaveAttribute("href", "/admin/robot-team-access?job=job-a");
    expect(screen.getByRole("link", { name: "Open lead record" })).toHaveAttribute("href", "/admin/leads/job-a");

    const form = screen.getByRole("form", { name: "Admit free evaluation eval-1" });
    expect(within(form).getByLabelText("Team ID")).toHaveValue("team-1");
    expect(within(form).getByLabelText("Checkpoint")).toHaveValue("ckpt_1");
    expect(within(form).getByLabelText("Episodes")).toHaveValue(50);
    expect(within(form).getByLabelText("Sponsor cap (USD)")).toHaveValue(20);
    expect(within(form).getByText(/the site and team pay nothing/)).toBeInTheDocument();

    fireEvent.submit(form);
    expect(await screen.findByText("run_free_abc")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/admin/free-evaluations/eval-1/admit")!;
    const init = call[1] as RequestInit;
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", "X-CSRF-Token": "csrf", Authorization: "Bearer token" });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ teamId: "team-1", checkpointId: "ckpt_1", episodes: 50, sponsorCapUsd: 20,
      maxAttempts: 1, evidenceScope: "development_only" });
    const expiry = Date.parse(body.expiresAtIso);
    expect(expiry).toBeGreaterThan(Date.now());
    expect(expiry).toBeLessThanOrEqual(Date.now() + 6 * 3_600_000);
  });

  it("shows the admission endpoint's refusal", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/jobs/job-a") return json(detail);
      if (url.endsWith("/admit")) return json({ code: "free_evaluation_not_admitted", error: "free_evaluation_policy_mismatch" }, 409);
      return json({ jobs: [row()], nextCursor: null, scanned: 1, stages: [] });
    });
    window.history.replaceState(null, "", "/admin/jobs?job=job-a");
    renderPage();
    const form = await screen.findByRole("form", { name: "Admit free evaluation eval-1" });
    fireEvent.submit(form);
    expect(await within(form).findByRole("alert")).toHaveTextContent("free_evaluation_policy_mismatch");
  });
});

describe("admission expiry defaults", () => {
  it("formats a local datetime value and stays inside the reservation window", () => {
    const now = new Date(2026, 9, 13, 9, 5).getTime();
    expect(toLocalInputValue(now)).toBe("2026-10-13T09:05");
    expect(defaultExpiry(detail.admissionDefaults, now)).toBe("2026-10-13T15:00");
  });
});
