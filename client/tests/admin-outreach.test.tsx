import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminOutreach from "../src/pages/AdminOutreach";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { uid: "staff" } }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers ?? {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const stopped = { contactedOn: "2026-12-01", channel: "email", messageVersion: "company-first.v1", goAheadEntryOn: null,
  answer: "asked_to_stop", nextStep: null, nextStepOn: null, doNotContact: true, doNotContactSince: "2026-12-03",
  recordedBy: "ops@example.test", recordedAtIso: "2026-12-03T10:00:00.000Z" };
const list = { ok: true, contacted: 1, doNotContact: 1, rows: [
  { teamId: "team-a", name: "Team A", website: "https://team-a.test", status: "prospect", outreach: stopped, flags: ["no_go_ahead_date"] },
  { teamId: "team-b", name: "Team B", website: null, status: "prospect", outreach: null, flags: [] },
] };

/** Outreach playbook fix 8: the owner's contact table, inside the admin app. */
it("shows do not contact and the flags plainly, and sends only the fields that changed", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ok: true,
    json: async () => (init?.method === "POST" ? { ok: true } : list) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<QueryClientProvider client={new QueryClient()}><AdminOutreach /></QueryClientProvider>);
  const a = await screen.findByLabelText("Outreach for Team A");
  expect(within(a).getByText("Do not contact since 2026-12-03")).toBeInTheDocument();
  expect(within(a).getByText("Asked us to stop", { selector: "span" })).toBeInTheDocument();
  expect(within(within(a).getByLabelText("Flags")).getByText("No go-ahead date recorded for this contact.")).toBeInTheDocument();
  // The opt-out cannot be unticked here.
  expect(within(a).getByRole("checkbox")).toBeDisabled();
  expect(screen.getByText("1 contacted · 1 do not contact · 2 records")).toBeInTheDocument();
  expect(screen.getByText(/Being contacted is not a relationship/)).toBeInTheDocument();

  const b = screen.getByLabelText("Outreach for Team B");
  const form = within(b).getByRole("form", { name: "Change outreach for Team B" });
  fireEvent.change(within(form).getByLabelText("Contacted on"), { target: { value: "2026-12-04" } });
  fireEvent.change(within(form).getByLabelText("Message version"), { target: { value: "company-first.v1" } });
  fireEvent.click(within(form).getByRole("button", { name: "Save" }));
  await within(b).findByText("Saved.");
  const [url, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "POST") as [string, RequestInit];
  expect(url).toBe("/api/admin/robot-teams/team-b/outreach");
  expect(JSON.parse(String(init.body))).toEqual({ contactedOn: "2026-12-04", messageVersion: "company-first.v1" });
});

it("filters to the do-not-contact records and shows the server's reason when a change is refused", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
    ? { ok: false, status: 400, json: async () => ({ error: "That stays on the record and is never removed." }) }
    : { ok: true, json: async () => list }));
  render(<QueryClientProvider client={new QueryClient()}><AdminOutreach /></QueryClientProvider>);
  await screen.findByLabelText("Outreach for Team A");
  fireEvent.change(screen.getByLabelText("Show"), { target: { value: "do_not_contact" } });
  expect(screen.queryByLabelText("Outreach for Team B")).toBeNull();
  const a = screen.getByLabelText("Outreach for Team A");
  fireEvent.change(within(a).getByLabelText("Answer"), { target: { value: "replied" } });
  fireEvent.click(within(a).getByRole("button", { name: "Save" }));
  expect(await within(a).findByRole("alert")).toHaveTextContent("never removed");
});
