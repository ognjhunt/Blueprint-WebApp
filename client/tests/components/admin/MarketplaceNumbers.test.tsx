import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFINITIONS, MarketplaceNumbers, NO_DATA, durationInWords } from "@/components/admin/MarketplaceNumbers";
import type { MarketplaceNumbers as Numbers } from "@/types/marketplaceNumbers";

/**
 * "Marketplace numbers" on the staff job page (owner, 2026-11-25): the three headline numbers first, each with its
 * definition; then the secondary numbers; then one row per job. Nothing measured says "No data yet", never 0.
 */
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { uid: "staff" } }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }) }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

const H = 3_600_000;
const empty: Numbers = {
  windowDays: 7, includeTests: false, sinceIso: "2026-11-19T00:00:00.000Z", generatedAtIso: "2026-11-25T15:00:00.000Z",
  sharedJobs: 0, limits: [],
  headline: {
    firstResponse: { measured: 0, medianMs: null, p90Ms: null, waiting: 0, notMeasurable: 0 },
    firstApply: { measured: 0, medianMs: null, p90Ms: null, waiting: 0, notMeasurable: 0 },
    jobsWithApply: { count: 0, of: 0, share: null },
    applicationsIntroduced: { count: 0, of: 0, share: null },
  },
  answers: { needMoreDetails: { count: 0, of: 0, share: null }, notAFit: { count: 0, of: 0, share: null } },
  outcomes: { introductions: 0, rows: [{ key: "visit", label: "Visit (marked by the site)", introductions: 0 }] },
  cost: { perJob: null, noLedger: 0, unreadable: 0, unavailable: 0, lanes: [], capUsd: 40 },
  simulation: { viewerOpens: null, downloads: null },
  jobs: [],
};
const full: Numbers = {
  ...empty, sharedJobs: 2, limits: ["Only the 200 jobs shared most recently were read; any shared earlier in this window are left out."],
  headline: {
    firstResponse: { measured: 2, medianMs: 5 * H + 12 * 60_000, p90Ms: 20 * H, waiting: 0, notMeasurable: 0 },
    firstApply: { measured: 1, medianMs: 26 * H, p90Ms: 26 * H, waiting: 1, notMeasurable: 0 },
    jobsWithApply: { count: 1, of: 2, share: 0.5 },
    applicationsIntroduced: { count: 1, of: 3, share: 1 / 3 },
  },
  answers: { needMoreDetails: { count: 1, of: 5, share: 0.2 }, notAFit: { count: 2, of: 5, share: 0.4 } },
  outcomes: { introductions: 1, rows: [{ key: "visit", label: "Visit (marked by the site)", introductions: 1 },
    { key: "answer_installed", label: "Installed", introductions: 0 }] },
  cost: { perJob: { jobs: 1, medianUsd: 12.34, p90Usd: 12.34, maxUsd: 12.34, totalUsd: 12.34 }, noLedger: 1, unreadable: 0, unavailable: 0,
    lanes: [{ key: "preparation", label: "Preparation (Pipeline)", spread: { jobs: 1, medianUsd: 10, p90Usd: 10, maxUsd: 10, totalUsd: 10 }, unreadable: 0 }],
    capUsd: 40 },
  simulation: { viewerOpens: { total: 4, jobs: 1, companies: 2 }, downloads: null },
  jobs: [
    { jobId: "job-b", internalTest: null, sharedAtIso: "2026-11-24T09:00:00.000Z", videoAtIso: "2026-11-24T08:00:00.000Z",
      firstResponse: { state: "none" }, firstApply: { state: "none" }, responses: 0, applications: 0, introductions: 0,
      introductionsWaiting: 0, spend: { state: "no_ledger" }, simulationOpens: null, simulationDownloads: null },
    { jobId: "job-a", internalTest: null, sharedAtIso: "2026-11-20T09:00:00.000Z", videoAtIso: "2026-11-20T08:00:00.000Z",
      firstResponse: { state: "at", atIso: "2026-11-20T10:00:00.000Z", afterVideoMs: 2 * H },
      firstApply: { state: "time_unknown" }, responses: 3, applications: 3, introductions: 1, introductionsWaiting: 1,
      spend: { state: "counted", usd: 12.34 }, simulationOpens: 4, simulationDownloads: null },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MarketplaceNumbers /></QueryClientProvider>);
}
beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://blueprint.invalid");
    return json({ ...full, windowDays: Number(url.searchParams.get("window")), includeTests: url.searchParams.get("includeTests") === "1" });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Marketplace numbers", () => {
  it("shows the three headline numbers first, each with its one-sentence definition", async () => {
    renderSection();
    expect(screen.getByRole("heading", { level: 2, name: "Marketplace numbers" })).toBeInTheDocument();
    const headline = await screen.findByRole("group", { name: "Headline numbers" });
    const labels = within(headline).getAllByRole("heading", { level: 3 }).map(heading => heading.textContent);
    expect(labels).toEqual(["Video to first response", "Video to first Apply", "Shared jobs with at least one Apply",
      "Applications that became introductions"]);
    expect(headline).toHaveTextContent("Median 5 h 12 min");
    expect(headline).toHaveTextContent("90th percentile 20 h · 2 jobs measured");
    expect(headline).toHaveTextContent("Median 26 h");
    expect(headline).toHaveTextContent("1 still waiting");
    expect(headline).toHaveTextContent("50% (1 of 2 jobs)");
    expect(headline).toHaveTextContent("33% (1 of 3 applications)");
    for (const definition of [DEFINITIONS.firstResponse, DEFINITIONS.firstApply, DEFINITIONS.jobsWithApply, DEFINITIONS.applicationsIntroduced])
      expect(within(headline).getByText(definition)).toBeInTheDocument();
    // The headline numbers come before the secondary ones and the table.
    const secondary = screen.getByRole("group", { name: "Secondary numbers" });
    expect(headline.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(secondary.compareDocumentPosition(screen.getByRole("table", { name: "Each job" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Only the 200 jobs shared most recently were read/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0];
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/admin/jobs/marketplace-numbers?window=7&includeTests=0");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("shows the secondary numbers: answers, outcomes recorded, spend with its lanes, and simulation use", async () => {
    renderSection();
    const secondary = await screen.findByRole("group", { name: "Secondary numbers" });
    expect(secondary).toHaveTextContent("Need more details: 20% (1 of 5 answers)");
    expect(secondary).toHaveTextContent("Not a fit: 40% (2 of 5 answers)");
    expect(secondary).toHaveTextContent("Visit (marked by the site): 1 of 1 introduction");
    expect(secondary).not.toHaveTextContent("Installed");
    expect(secondary).toHaveTextContent("Median $12.34 · 90th percentile $12.34 · largest $12.34, over 1 job");
    expect(secondary).toHaveTextContent("Left out: 1 job with no ledger entry.");
    expect(within(screen.getByRole("table", { name: "Spend by lane" })).getByRole("row", { name: /Preparation \(Pipeline\)/ }))
      .toHaveTextContent("$10.00");
    expect(secondary).toHaveTextContent(DEFINITIONS.cost(40));
    expect(secondary).toHaveTextContent("Viewer opens: 4 on 1 job, by 2 companies");
    expect(secondary).toHaveTextContent(`Downloads: ${NO_DATA}`);
  });

  it("shows one row per job: shared, first response, first Apply, applications, introductions, spend, opens and downloads", async () => {
    renderSection();
    const table = await screen.findByRole("table", { name: "Each job" });
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Job", "Shared", "First response",
      "First Apply", "Applications", "Introductions", "Spend", "Simulation opens", "Downloads"]);
    const [, newer, older] = within(table).getAllByRole("row");
    expect(within(newer).getByRole("link", { name: "job-b" })).toHaveAttribute("href", "/admin/jobs?job=job-b");
    expect(newer).toHaveTextContent("No response yet");
    expect(newer).toHaveTextContent("No Apply yet");
    expect(newer).toHaveTextContent("No ledger entry");
    // Nothing recorded is "No data yet", never 0.
    expect(within(newer).getAllByText(NO_DATA)).toHaveLength(2);
    expect(older).toHaveTextContent("2 h after the video");
    expect(older).toHaveTextContent("Time not recorded");
    expect(older).toHaveTextContent("1 (1 asked, not made yet)");
    expect(older).toHaveTextContent("$12.34");
  });

  it("says No data yet for every number when nothing was measured, never 0", async () => {
    fetchMock.mockImplementation(async () => json(empty));
    renderSection();
    const headline = await screen.findByRole("group", { name: "Headline numbers" });
    expect(within(headline).getAllByText(NO_DATA)).toHaveLength(4);
    expect(headline).not.toHaveTextContent(/\b0%|\b0 min/);
    const secondary = screen.getByRole("group", { name: "Secondary numbers" });
    expect(secondary).toHaveTextContent(`Need more details: ${NO_DATA}`);
    expect(secondary).toHaveTextContent(`Viewer opens: ${NO_DATA}`);
    expect(within(secondary).getAllByText(NO_DATA).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(`${NO_DATA}: no job was shared with companies in this window.`)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("switches the window and includes internal test jobs on a visible switch", async () => {
    renderSection();
    await screen.findByRole("group", { name: "Headline numbers" });
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    await waitFor(() => expect(fetchMock.mock.calls.map(([url]) => String(url)))
      .toContain("/api/admin/jobs/marketplace-numbers?window=30&includeTests=0"));
    const internal = screen.getByRole("checkbox", { name: "Include internal test jobs" });
    expect(internal).not.toBeChecked();
    fireEvent.click(internal);
    await waitFor(() => expect(fetchMock.mock.calls.map(([url]) => String(url)))
      .toContain("/api/admin/jobs/marketplace-numbers?window=30&includeTests=1"));
    expect(await screen.findByText(/internal test jobs included/)).toBeInTheDocument();
  });

  it("says when the numbers could not be read, and shows none", async () => {
    fetchMock.mockImplementation(async () => json({ error: "The marketplace numbers are unavailable. Try again." }, 503));
    renderSection();
    expect(await screen.findByText("The marketplace numbers are unavailable. Try again.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Headline numbers" })).toBeNull();
  });

  it("says a duration in plain words", () => {
    expect(durationInWords(20_000)).toBe("under a minute");
    expect(durationInWords(42 * 60_000)).toBe("42 min");
    expect(durationInWords(5 * H + 12 * 60_000)).toBe("5 h 12 min");
    expect(durationInWords(3 * H)).toBe("3 h");
    expect(durationInWords(76 * H)).toBe("3 d 4 h");
  });
});
