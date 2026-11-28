import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "@/lib/companyResponses";
import { PILOT_OFFER_STATEMENT, PILOT_OFFER_STATEMENT_VERSION, PILOT_SHEET_FOOTER } from "@/lib/pilotOffers";

/** The company's side of a pilot offer (owner, 2026-11-28): the site's request on the job page, and the offer's form. */
const auth = vi.hoisted(() => ({ loading: false, currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth, useAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (user: unknown, headers: Record<string, string> = {}) =>
  user ? { ...headers, Authorization: "Bearer test-token" } : headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
vi.mock("wouter", () => ({ useParams: () => ({ jobId: "job-1" }), Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
  <a href={href} className={className}>{children as never}</a> }));
vi.mock("@/components/blueprint/app/AppShell", () => ({ AppShell: ({ children }: { children: unknown }) => <main>{children as never}</main> }));

const { default: CompanyJob } = await import("@/pages/CompanyJob");
const { default: PilotOfferSettings } = await import("@/pages/PilotOfferSettings");

const TERMS = { weeks: 6, sitePays: { kind: "nothing" as const }, siteProvides: ["power" as const], earliestStart: "within_month" as const,
  afterPilot: "undecided" as const };
const item = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  headline: "Stack cartons on pallets", headlineFacts: [], fitSummary: [], simulationStatus: null, visitMustConfirm: [], aboutSite: [],
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack cartons onto the pallet.", jobFacts: [], country: "United States",
  video: { state: "preparing" }, simulation: { state: "not_finished" }, simulationDownload: { state: "not_finished" }, myAnswer: null,
  packetFacts: null, responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...overrides });
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("the site's request on the company's job page", () => {
  it("shows the request with the company's own terms, and Confirm sends an Apply under the response line", async () => {
    const requested = item({ pilotRequest: { state: "requested", requestedAtIso: "2026-11-27T10:00:00.000Z", terms: TERMS } });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: requested }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, introduced: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ pilotRequest: { state: "confirmed",
        requestedAtIso: "2026-11-27T10:00:00.000Z", terms: TERMS } }) }) });
    render(<CompanyJob />);
    const banner = await screen.findByRole("region", { name: "Pilot request" });
    expect(within(banner).getByRole("heading", { name: "The site asked for your pilot offer." })).toBeVisible();
    expect(within(banner).getByText("Pilot: 6 weeks")).toBeVisible();
    // The company reads its own terms: "The site pays", never the site's "Cost to you".
    expect(within(banner).getByText("The site pays: nothing")).toBeVisible();
    expect(within(banner).getByText("The site provides: power")).toBeVisible();
    expect(within(banner).queryByText(/^Cost to you|^You provide/)).toBeNull();
    const button = within(banner).getByRole("button", { name: "Confirm" });
    expect(button).toHaveAccessibleDescription(COMPANY_RESPONSE_STATEMENT);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/site-worlds/jobs/job-1/pilot-request");
    expect(JSON.parse(String(init.body))).toEqual({ decision: "confirm", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION });
    expect(await screen.findByText("You confirmed. We are emailing you and the site each other's contact details.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("says why an introduction was not made, and that the application stands", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ pilotRequest: { state: "refused",
      requestedAtIso: "2026-11-27T10:00:00.000Z", terms: TERMS, refusal: "statement_not_current" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("Your application is saved, but the introduction was not made. The site's details changed after it "
      + "asked, so it has to accept you again. The site can still accept your application.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("shows the pilot sheet after the introduction", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      pilotRequest: { state: "confirmed", requestedAtIso: "2026-11-27T10:00:00.000Z", terms: TERMS, introducedAtIso: "2026-11-28T10:00:00.000Z" },
      pilotSheet: { sentence: "Stack cartons onto the pallet.", done: "Every carton square.", terms: TERMS, requestedAtIso: "2026-11-27T10:00:00.000Z" } }) }) });
    render(<CompanyJob />);
    const sheet = await screen.findByRole("region", { name: "Pilot sheet" });
    expect(within(sheet).getByText("“Every carton square.”")).toBeVisible();
    expect(within(sheet).getByText(PILOT_SHEET_FOOTER)).toBeVisible();
    // The sheet holds the terms as of the request, in words both sides read; the banner does not list them a second time.
    expect(within(sheet).getByText("The site pays: nothing")).toBeVisible();
    expect(screen.getAllByText("Pilot: 6 weeks")).toHaveLength(1);
    expect(screen.getByText("You confirmed on November 28, 2026. We emailed you and the site each other's contact details.")).toBeVisible();
  });

  it("shows no banner when the site has not asked", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    await screen.findByRole("heading", { name: "Stack cartons on pallets" });
    expect(screen.queryByRole("region", { name: "Pilot request" })).toBeNull();
  });
});

describe("the company's pilot offer form", () => {
  it("publishes an offer under the statement it shows", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ offer: null,
      statement: { version: PILOT_OFFER_STATEMENT_VERSION, text: PILOT_OFFER_STATEMENT } }) })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => ({ ok: true, status: 200, json: async () => ({ ok: true,
        offer: { ...JSON.parse(String(init.body)), revision: "r", updatedAtIso: "2026-11-28T10:00:00.000Z" } }) }));
    render(<PilotOfferSettings />);
    expect(await screen.findByText("You have no pilot offer yet.")).toBeVisible();
    expect(screen.getByText(PILOT_OFFER_STATEMENT)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Palletizing" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Heaviest item/ }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("radio", { name: "A one-time amount" }));
    fireEvent.change(screen.getByRole("textbox", { name: "From, in US dollars" }), { target: { value: "5,000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "To, in US dollars" }), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Your pilot offer is published.")).toBeVisible();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/site-worlds/pilot-offer");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ published: true, kinds: ["palletizing"],
      limits: { maxKg: 25, maxSide: null, minHours: null, states: "all_us" },
      terms: { weeks: 4, sitePays: { kind: "once", low: 5000, high: 8000 }, siteProvides: [], earliestStart: "within_month", afterPilot: "undecided" },
      statementVersion: PILOT_OFFER_STATEMENT_VERSION });
    expect(screen.getByRole("button", { name: "Pause the offer" })).toBeVisible();
  });

  it("asks for a kind of job before it sends anything", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ offer: null,
      statement: { version: PILOT_OFFER_STATEMENT_VERSION, text: PILOT_OFFER_STATEMENT } }) });
    render(<PilotOfferSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Choose at least one kind of job you take.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
