import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskBrowseCard } from "@/types/taskBrowse";

/**
 * A deployment company's own response on a job in the library (package C1): three answers, and one line under the
 * form saying what the site is told. The address Blueprint emails a company (`#job-<id>`) is the job's row.
 */
const auth = vi.hoisted(() => ({ currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));

const { TaskBrowse } = await import("@/components/site/TaskBrowse");

const card = (overrides: Partial<TaskBrowseCard> = {}): TaskBrowseCard => ({
  id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling", siteType: "", region: "", objects: "Cartons",
  cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "capture", evaluationAvailable: false, costUsd: null,
  publishedAtIso: "2026-11-11T10:00:00.000Z", thumbnailUrl: null, ...overrides });
const access = { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("a company's response on a job in the library", () => {
  it("offers three answers, says what the site is told, and sends the third as needs_something", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access, items: [card()] }) });
    render(<TaskBrowse />);
    const row = (await screen.findAllByRole("listitem"))[0];
    expect(row).toHaveAttribute("id", "job-job-1");
    const form = within(row).getByRole("form", { name: "Respond about this job" });
    expect(within(form).getAllByRole("option").map(option => [option.getAttribute("value"), option.textContent])).toEqual([
      ["interested", "Interested"], ["declined", "Not a fit"], ["needs_something", "Would need something"]]);
    expect(within(form).getByText("The site is told your answer, not your company's name or your words.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Blueprint will review your inputs." }) });
    fireEvent.change(within(form).getByRole("combobox"), { target: { value: "needs_something" } });
    fireEvent.change(within(form).getByRole("textbox"), { target: { value: "A second gripper for the cartons." } });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Blueprint will review your inputs."));
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/site-worlds/tasks/job-1/interest");
    expect(JSON.parse(String(init.body))).toEqual({ state: "needs_something", inputs: "A second gripper for the cartons." });
  });
});
