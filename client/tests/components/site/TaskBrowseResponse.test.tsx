import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskBrowseCard } from "@/types/taskBrowse";

/**
 * A deployment company's library (package E, E3): each job's row links to the job's own page, where the company watches
 * the video and answers. The row itself carries no form. The address Blueprint emails a company is the job's page.
 */
const auth = vi.hoisted(() => ({ currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers }));

const { TaskBrowse } = await import("@/components/site/TaskBrowse");

const card = (overrides: Partial<TaskBrowseCard> = {}): TaskBrowseCard => ({
  id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling", siteType: "", region: "", objects: "Cartons",
  cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "capture", evaluationAvailable: false,
  publishedAtIso: "2026-11-11T10:00:00.000Z", thumbnailUrl: null, ...overrides });
const access = { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("a job in the library", () => {
  // Every listed job is open (`categoryDraft`), so the list has no open/past toggle (launch copy c-028).
  it("lists every job and searches the fields on the listing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
      card({ region: "United States" }),
      card({ id: "job-2", title: "Inspect cases", region: "Canada" }),
    ] }) });
    render(<TaskBrowse />);
    expect(await screen.findByRole("heading", { name: "Palletize cartons" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Inspect cases" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Job availability" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Open|Past|All) jobs$/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search jobs" }), { target: { value: "cartons united" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Inspect cases" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows each card's sentence from the site, with search and Ready to test as the only filters", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
      card({ region: "United States", sentence: "Stack 12 kg cartons onto the pallet." }),
      card({ id: "job-2", title: "Inspect cases", region: "Canada", sentence: "Check each case label." }),
    ] }) });
    render(<TaskBrowse />);
    expect(await screen.findByText("Stack 12 kg cartons onto the pallet.")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Job type" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Region" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Ready to test" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search jobs" }), { target: { value: "label" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Inspect cases" })).toBeVisible();
  });

  it("keeps an older email link to one job usable, and drops the retired view from it", async () => {
    window.history.replaceState({}, "", "/contact/robot-team?view=past#job-job-2");
    try {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
        card(), card({ id: "job-2", title: "Move crates" }),
      ] }) });
      render(<TaskBrowse />);
      expect(await screen.findByRole("heading", { name: "Move crates" })).toBeVisible();
      expect(window.location.search).not.toContain("view=");
      expect(window.location.hash).toBe("#job-job-2");
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("labels where a job's simulation stands only when that is known", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
      card({ id: "job-1", title: "Inspect cases", simulationStage: "video_received" }),
      card({ id: "job-2", title: "Move crates", simulationStage: "simulation_built" }),
      card({ id: "job-3", title: "Load trays", simulationStage: null }),
    ] }) });
    render(<TaskBrowse />);
    const rows = await screen.findAllByRole("listitem");
    const row = (title: string) => rows.find(item => within(item).queryByRole("heading", { name: title }))!;
    expect(within(row("Inspect cases")).getByText("Simulation not started yet")).toBeVisible();
    expect(row("Move crates").querySelector(".opportunity-labels")).toBeNull();
    expect(row("Load trays").querySelector(".opportunity-labels")).toBeNull();
    expect(screen.queryByText("No simulation download")).toBeNull();
  });

  it("filters on a downloadable simulation rather than the legacy evaluation flag", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
      card({ simulationDownloadAvailable: true }),
      card({ id: "job-2", title: "Scene without a package", evaluationAvailable: true, simulationStage: "simulation_built" }),
    ] }) });
    render(<TaskBrowse />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Ready to test" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(within(screen.getByRole("listitem")).getByText("Ready to test")).toBeVisible();
    expect(screen.queryByText("Scene without a package")).toBeNull();
  });
  it("links the row to the job's own page and carries no answer form of its own", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [card({ jobUrl: "/jobs/job-1" })] }) });
    render(<TaskBrowse />);
    const row = (await screen.findAllByRole("listitem"))[0];
    expect(row).toHaveAttribute("id", "job-job-1");
    expect(within(row).getByRole("heading", { name: "Palletize cartons" })).toBeVisible();
    expect(within(row).getAllByRole("link")).toHaveLength(1);
    expect(within(row).getByRole("link", { name: "View job" })).toHaveAttribute("href", "/jobs/job-1");
    expect(within(row).queryByRole("form")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows only the Terms prompt, and no job or count, to a company that has not accepted the current Terms", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: "terms_acceptance_required",
      error: "Before you see jobs, read and agree to our Terms and Privacy Policy.", access: { ...access, allowed: false, termsRequired: true } }) });
    render(<TaskBrowse />);
    expect(await screen.findByText("Before you see jobs, read and agree to our Terms and Privacy Policy.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I agree to the Terms and Privacy Policy" })).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(/\d+ jobs?/)).toBeNull();
  });
});

