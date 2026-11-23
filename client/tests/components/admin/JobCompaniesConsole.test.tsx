import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobCompaniesConsole } from "@/components/admin/JobCompaniesConsole";
import type { AdminJobCompanies } from "@/types/jobCompanies";

/**
 * The operator's "Deployment companies" panel (package C1): sharing in words, the sends and responses on record (read
 * only since 2026-11-22: no hand send, void or emailed answer), and the hold, which needs a reason.
 */
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }) }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

const NORTH = "a".repeat(64);
const visible: AdminJobCompanies = {
  sharing: { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null },
  hold: null, consentRevoked: false, libraryUrl: "https://tryblueprint.io/contact/robot-team#job-job-a",
  companies: [{ id: NORTH, company: "North Robotics", email: "sales@north.example" }],
  sends: [], responses: [],
};
let panel: AdminJobCompanies;
const posts: Array<{ path: string; body: unknown }> = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  panel = structuredClone(visible);
  posts.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const base = "/api/admin/jobs/job-a/companies";
    if (url === base && !init?.method) return json(panel);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    posts.push({ path: url.slice(base.length), body });
    if (url === `${base}/hold`) {
      panel.hold = body.held ? { atIso: "2026-11-12T13:00:00.000Z", by: "ops@tryblueprint.io", reason: body.reason ?? null } : null;
      panel.sharing = body.held ? { state: "shared_not_visible", reason: "blueprint_hold",
        words: "Shared, but not visible to companies right now: Blueprint stopped showing it." } : visible.sharing;
      return json({ hold: { held: body.held } });
    }
    return json({ error: "unexpected" }, 500);
  }));
});

const section = () => screen.getByRole("region", { name: "Deployment companies" });

describe("the Deployment companies panel", () => {
  it("shows sends and answers on record with no form to record, void or answer by hand", async () => {
    panel.sends = [{ sendId: "send-1", companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
      sentBy: "ops@tryblueprint.io", voidedAtIso: null, voidedBy: null }];
    panel.responses = [{ companyId: NORTH, company: "North Robotics", email: "sales@north.example", alias: "A", state: "needs_something",
      inputs: "We would need a second gripper.", updatedAtIso: "2026-11-12T12:00:00.000Z", recordedBy: "company" }];
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    const sends = await within(section()).findByRole("region", { name: "Sends" });
    expect(within(sends).getByText(/North Robotics \(Company A to the site\)/)).toBeInTheDocument();
    expect(within(sends).queryByRole("button", { name: "Void" })).toBeNull();
    const responses = within(section()).getByRole("region", { name: "Responses" });
    expect(within(responses).getByText("“We would need a second gripper.”")).toBeInTheDocument();
    expect(within(section()).queryByRole("form", { name: "Record a send" })).toBeNull();
    expect(within(section()).queryByRole("form", { name: "Record a response" })).toBeNull();
    expect(within(section()).queryByLabelText("Job library address")).toBeNull();
  });

  it("stops showing the job to companies only with a reason, and shows it again", async () => {
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    const holdForm = await within(section()).findByRole("form", { name: "Stop showing this job to companies" });
    expect(within(holdForm).getByRole("textbox")).toBeRequired();
    fireEvent.change(within(holdForm).getByRole("textbox"), { target: { value: "Checking the summary" } });
    fireEvent.click(within(holdForm).getByRole("button", { name: "Stop showing this job to companies" }));
    expect(await within(section()).findByText(/Not shown to any company since .*: Checking the summary\./)).toBeInTheDocument();
    expect(within(section()).getByText("Shared, but not visible to companies right now: Blueprint stopped showing it.")).toBeInTheDocument();
    fireEvent.click(within(section()).getByRole("button", { name: "Show again" }));
    await waitFor(() => expect(within(section()).getByText("Shared and visible to approved companies.")).toBeInTheDocument());
    expect(posts).toEqual([{ path: "/hold", body: { held: true, reason: "Checking the summary" } }, { path: "/hold", body: { held: false } }]);
  });

  it("shows the automatic send among the sends; introductions and their outcomes are on the job page itself", async () => {
    panel.autoSend = { sentAtIso: "2026-11-12T10:00:00.000Z", count: 4 };
    panel.sends = [{ sendId: `system-${NORTH}`, companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
      sentBy: "system", voidedAtIso: null, voidedBy: null }];
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    const sends = await within(section()).findByRole("region", { name: "Sends" });
    expect(within(sends).getByText(/North Robotics \(Company A to the site\).*automatic/)).toBeInTheDocument();
    expect(section().textContent).not.toMatch(/\$|USD|price|charge/i);
  });
});
