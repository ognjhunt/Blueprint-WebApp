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
  it("opens with active jobs and searches the fields on the listing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
      card({ region: "United States" }),
      card({ id: "job-2", title: "Inspect cases", region: "Canada" }),
      card({ id: "job-3", title: "Move crates", opportunity: "past" }),
    ] }) });
    render(<TaskBrowse />);
    expect(await screen.findByRole("heading", { name: "Palletize cartons" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Move crates" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search jobs" }), { target: { value: "cartons united" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Inspect cases" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Past jobs" }));
    expect(screen.getByRole("heading", { name: "Move crates" })).toBeVisible();
  });

  it("keeps an older email link to a past job usable", async () => {
    window.history.replaceState({}, "", "/contact/robot-team#job-job-2");
    try {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [
        card(), card({ id: "job-2", title: "Move crates", opportunity: "past" }),
      ] }) });
      render(<TaskBrowse />);
      expect(await screen.findByRole("heading", { name: "Move crates" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Past jobs" })).toHaveAttribute("aria-pressed", "true");
    } finally {
      window.history.replaceState({}, "", "/");
    }
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

