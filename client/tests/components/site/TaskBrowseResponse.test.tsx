import { render, screen, within } from "@testing-library/react";
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
  cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "capture", evaluationAvailable: false, costUsd: null,
  publishedAtIso: "2026-11-11T10:00:00.000Z", thumbnailUrl: null, ...overrides });
const access = { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("a job in the library", () => {
  it("links the row to the job's own page and carries no answer form of its own", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [card({ jobUrl: "/jobs/job-1" })] }) });
    render(<TaskBrowse />);
    const row = (await screen.findAllByRole("listitem"))[0];
    expect(row).toHaveAttribute("id", "job-job-1");
    expect(within(row).getByRole("link", { name: "Carton palletizing opportunity" })).toHaveAttribute("href", "/jobs/job-1");
    expect(within(row).getByRole("link", { name: "Open the job and answer" })).toHaveAttribute("href", "/jobs/job-1");
    expect(within(row).queryByRole("form")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
