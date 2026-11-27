import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminRobotTeamAccess from "../src/pages/AdminRobotTeamAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { uid: "staff" } }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers ?? {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Outreach gap 1 (2026-11-27): the owner tries the automatic rule once, before a real applicant meets it. */
it("runs the rule on a typed domain and website and shows each step with its result and reason", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, json: async () => url.endsWith("/rule-trial")
    ? { check: { schemaVersion: "company_check.v1", checkedAtIso: "2026-11-27T02:00:00.000Z", outcome: "needs_owner",
      reasons: ["not_a_robot_company"], emailDomain: "example.test", website: "https://example.test" },
    steps: [{ step: "domain", ok: true, detail: "example.test is the website's domain" }, { step: "website", ok: true, detail: "HTTP 200 at example.test" },
      { step: "model", ok: false, detail: "no: A bakery." }] }
    : { applications: [], count: 0, init } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<QueryClientProvider client={new QueryClient()}><AdminRobotTeamAccess /></QueryClientProvider>);
  const form = screen.getByRole("form", { name: "Try the automatic rule" });
  fireEvent.change(within(form).getByLabelText("Work email domain"), { target: { value: "example.test" } });
  fireEvent.change(within(form).getByLabelText("Website"), { target: { value: "https://example.test" } });
  fireEvent.click(within(form).getByRole("button", { name: "Run the rule" }));
  const result = await screen.findByLabelText("Rule trial result");
  const [, init] = fetchMock.mock.calls.find(([url]) => url.endsWith("/rule-trial")) as [string, RequestInit];
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ emailDomain: "example.test", website: "https://example.test" });
  expect(result.textContent).toContain("The rule would leave this company to you.");
  expect(within(result).getAllByRole("listitem").map(item => item.textContent)).toEqual([
    "✓ Work email at the website's domain: example.test is the website's domain", "✓ Website read: HTTP 200 at example.test",
    "✗ Model: does it deploy robots?: no: A bakery."]);
  // Nothing about it is a decision: no application card appears, nothing else is posted.
  expect(fetchMock.mock.calls.filter(([, call]) => call?.method === "POST")).toHaveLength(1);
});

it("says so when the rule could not run", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/rule-trial")
    ? { ok: false, json: async () => ({ error: "The rule could not run just now. Try again shortly." }) }
    : { ok: true, json: async () => ({ applications: [], count: 0 }) }));
  render(<QueryClientProvider client={new QueryClient()}><AdminRobotTeamAccess /></QueryClientProvider>);
  const form = screen.getByRole("form", { name: "Try the automatic rule" });
  fireEvent.change(within(form).getByLabelText("Work email domain"), { target: { value: "example.test" } });
  fireEvent.change(within(form).getByLabelText("Website"), { target: { value: "example.test" } });
  fireEvent.click(within(form).getByRole("button", { name: "Run the rule" }));
  expect(await within(form).findByRole("alert")).toHaveTextContent("The rule could not run just now. Try again shortly.");
});
