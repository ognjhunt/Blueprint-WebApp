import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobCompaniesConsole } from "@/components/admin/JobCompaniesConsole";
import type { AdminJobCompanies } from "@/types/jobCompanies";

/**
 * The operator's "Deployment companies" panel (package C1): sharing in words, the library address to copy, record a
 * send (only while visible), void, responses with the company's own words, record an emailed answer, and the hold.
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
    if (url === `${base}/sends`) {
      panel.sends.push({ sendId: "send-1", companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
        sentBy: "ops@tryblueprint.io", voidedAtIso: null, voidedBy: null });
      return json({ send: { sendId: "send-1", alias: "A" } });
    }
    if (url === `${base}/sends/send-1/void`) { panel.sends[0].voidedAtIso = "2026-11-12T11:00:00.000Z"; panel.sends[0].voidedBy = "ops@tryblueprint.io"; return json({}); }
    if (url === `${base}/responses`) {
      panel.responses.push({ companyId: NORTH, company: "North Robotics", email: "sales@north.example", alias: "A", state: body.state,
        inputs: body.inputs, updatedAtIso: "2026-11-12T12:00:00.000Z", recordedBy: "operator" });
      return json({ response: { alias: "A" } });
    }
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
  it("records a send, shows it with who and when, and voids it", async () => {
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    expect(await within(section()).findByText("Shared and visible to approved companies.")).toBeInTheDocument();
    expect(within(section()).getByLabelText("Job library address")).toHaveTextContent("https://tryblueprint.io/contact/robot-team#job-job-a");
    expect(within(section()).getByText("Not sent to any company yet.")).toBeInTheDocument();
    const sendForm = within(section()).getByRole("form", { name: "Record a send" });
    fireEvent.change(within(sendForm).getByRole("combobox"), { target: { value: NORTH } });
    fireEvent.submit(sendForm);
    const sends = within(section()).getByRole("region", { name: "Sends" });
    expect(await within(sends).findByText(/North Robotics \(Company A to the site\)/)).toBeInTheDocument();
    expect(posts).toEqual([{ path: "/sends", body: { companyId: NORTH } }]);
    fireEvent.click(within(sends).getByRole("button", { name: "Void" }));
    expect(await within(sends).findByText(/^Voided /)).toBeInTheDocument();
    expect(within(sends).queryByRole("button", { name: "Void" })).toBeNull();
  });

  it("records an emailed answer with the company's words, only for a company the job was sent to, and has no note for the site", async () => {
    const { unmount } = render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    let form = await within(section()).findByRole("form", { name: "Record a response" });
    // Not sent to anyone yet: no company to choose, and the panel says why.
    expect(within(form).getAllByRole("combobox")[0].querySelectorAll("option:not([disabled])")).toHaveLength(0);
    expect(within(form).getByText(/Record a send first/)).toBeInTheDocument();
    unmount();
    panel.sends.push({ sendId: "send-1", companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
      sentBy: "ops@tryblueprint.io", voidedAtIso: null, voidedBy: null });
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    form = await within(section()).findByRole("form", { name: "Record a response" });
    const [company, state] = within(form).getAllByRole("combobox");
    fireEvent.change(company, { target: { value: NORTH } });
    fireEvent.change(state, { target: { value: "needs_something" } });
    expect(within(state).getAllByRole("option").map(option => option.textContent)).toEqual(["Interested", "Not a fit", "Would need something"]);
    expect(within(form).queryByLabelText(/Note/)).toBeNull();
    fireEvent.change(within(form).getByLabelText(/Their words/), { target: { value: "We would need a second gripper." } });
    fireEvent.submit(form);
    const responses = within(section()).getByRole("region", { name: "Responses" });
    expect(await within(responses).findByText("“We would need a second gripper.”")).toBeInTheDocument();
    expect(within(responses).getByText("Would need something")).toBeInTheDocument();
    expect(posts).toEqual([{ path: "/responses", body: { companyId: NORTH, state: "needs_something", inputs: "We would need a second gripper." } }]);
  });

  it("stops showing the job to companies, disables sends while held, and shows it again", async () => {
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    const holdForm = await within(section()).findByRole("form", { name: "Stop showing this job to companies" });
    fireEvent.change(within(holdForm).getByRole("textbox"), { target: { value: "Checking the summary" } });
    fireEvent.click(within(holdForm).getByRole("button", { name: "Stop showing this job to companies" }));
    expect(await within(section()).findByText(/Not shown to any company since .*: Checking the summary\./)).toBeInTheDocument();
    expect(within(section()).getByText("Shared, but not visible to companies right now: Blueprint stopped showing it.")).toBeInTheDocument();
    expect(within(within(section()).getByRole("form", { name: "Record a send" })).getByRole("button", { name: "Record the send" })).toBeDisabled();
    fireEvent.click(within(section()).getByRole("button", { name: "Show again" }));
    await waitFor(() => expect(within(section()).getByText("Shared and visible to approved companies.")).toBeInTheDocument());
    expect(posts).toEqual([{ path: "/hold", body: { held: true, reason: "Checking the summary" } }, { path: "/hold", body: { held: false } }]);
  });

  it("shows the automatic send, introductions with their latest outcome, and billable events with no price", async () => {
    panel.autoSend = { sentAtIso: "2026-11-12T10:00:00.000Z", count: 4 };
    panel.sends = [{ sendId: `system-${NORTH}`, companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
      sentBy: "system", voidedAtIso: null, voidedBy: null }];
    panel.introductions = [{ companyId: NORTH, company: "North Robotics", alias: "A", requestedAtIso: "2026-11-12T15:00:00.000Z",
      latestOutcome: { by: "company", state: "quote_given", label: "Quote given", atIso: "2026-11-26T15:00:00.000Z" } }];
    panel.billableEvents = [{ id: "introduction-job-a-x", kind: "introduction", companyId: NORTH, company: "North Robotics",
      atIso: "2026-11-12T15:00:00.000Z", priceUsd: null, status: "recorded_no_price" }];
    render(<JobCompaniesConsole requestId="job-a" currentUser={{ uid: "founder" } as never} />);
    expect(await within(section()).findByText(/Sent automatically to 4 deployment companies/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Sends" })).getByText(/automatic/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Introductions" })).getByText(/North Robotics \(Company A\).*Quote given \(company/)).toBeInTheDocument();
    const events = screen.getByRole("region", { name: "Billable events" });
    expect(within(events).getByText(/Introduction · North Robotics .* recorded, no price/)).toBeInTheDocument();
    expect(events.textContent).not.toMatch(/\$|USD|charge[ds]? (?!is)/i);
  });
});
