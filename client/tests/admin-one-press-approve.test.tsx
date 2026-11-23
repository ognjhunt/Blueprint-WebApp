import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminRobotTeamAccess from "../src/pages/AdminRobotTeamAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { uid: "staff" } }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers ?? {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

const id = "a".repeat(64);
const application = {
  id, name: "Fixture applicant", email: "fixture@example.invalid", company: "Fixture company", website: null,
  robot: "Fixture robot", workWanted: "Fixture work", region: null, status: "applied", appliedAtIso: "2026-11-01T00:00:00.000Z",
  decidedAtIso: null, decidedBy: null, decisionNote: null,
  fit: { clearFit: false, listedTaskCount: 0, checks: [
    { id: "work_email", label: "Work email", passed: true, detail: "Company domain example.invalid" },
    { id: "open_tasks_in_region", label: "Open site jobs in their region", passed: false, detail: "No region given" },
  ] },
};

it("opens at the linked application and approves it with one press: no confirm box, no note prompt", async () => {
  window.history.replaceState(null, "", `/admin/robot-team-access?application=${id}`);
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  const confirm = vi.spyOn(window, "confirm");
  const prompt = vi.spyOn(window, "prompt");
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true,
    json: async () => init?.method === "POST" ? { application: { id, status: "approved" } } : { applications: [application], count: 1 } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<QueryClientProvider client={new QueryClient()}><AdminRobotTeamAccess /></QueryClientProvider>);

  const card = (await screen.findByText("Fixture applicant · Fixture company")).closest(`#application-${id}`);
  expect(card).toHaveAttribute("aria-current", "true");
  await waitFor(() => expect(scrolled).toHaveBeenCalled());
  expect(screen.queryByText(/Open site jobs in their region/)).toBeNull();
  expect(screen.queryByText(/Review an existing job|BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS/)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const [url, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "POST")!;
  expect(url).toBe(`/api/admin/robot-team-access/${id}/decision`);
  expect(JSON.parse(String(init!.body))).toEqual({ status: "approved" });
  expect(confirm).not.toHaveBeenCalled();
  expect(prompt).not.toHaveBeenCalled();
});
