import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PilotOffers } from "@/components/site/PilotOffers";
import type { SitePilotOffer, SitePilotOffers } from "@/lib/pilotOffers";
import { PILOT_SHEET_FOOTER } from "@/lib/pilotOffers";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));

const REF = `p-${"b".repeat(32)}`;
const offer = (overrides: Partial<SitePilotOffer> = {}): SitePilotOffer => ({
  offerRef: REF, company: { name: "North Robotics", website: "https://north.example" }, unknown: [],
  offer: { kinds: ["palletizing"], limits: { maxKg: 25, maxSide: null, minHours: null, states: ["TX"] },
    terms: { weeks: 6, sitePays: { kind: "once", low: 5000, high: 8000 }, siteProvides: ["floor_space"], earliestStart: "within_month",
      afterPilot: "per_task" } }, ...overrides });
const pilot = (offers: SitePilotOffer[], version = "introduction-request-2026-11-24"): SitePilotOffers =>
  ({ offers, introductionStatementVersion: version });

describe("the site's pilot offers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says plainly when no offer fits on paper", () => {
    render(<PilotOffers token="tok" pilot={pilot([])} />);
    expect(screen.getByText("No pilot offer fits your job on paper yet. Approved companies can still see your job and answer.")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the company's name, website and terms, each open fact, and the introduction sentence under the button", () => {
    render(<PilotOffers token="tok" pilot={pilot([offer({ unknown: ["weight"] })])} />);
    const region = screen.getByRole("region", { name: "Pilot offers that fit your job" });
    expect(within(region).getByRole("heading", { name: "North Robotics" })).toBeVisible();
    expect(within(region).getByRole("link", { name: "https://north.example" })).toHaveAttribute("href", "https://north.example");
    for (const line of ["Pilot: 6 weeks", "Cost to you: $5,000 to $8,000 in total (the company's own figure, not a quote)",
      "You provide: Floor space", "Earliest start: Within a month", "After a pilot that works: Per task or item"])
      expect(within(region).getByText(line)).toBeVisible();
    expect(within(region).getByText("You have not said how heavy the item is. This company takes up to 25 kg.")).toBeVisible();
    const button = within(region).getByRole("button", { name: "Request this pilot" });
    expect(button).toHaveAccessibleDescription("We give North Robotics your email address and the place you gave us, and give you theirs.");
  });

  it("uses the job's own sentence, and sends its version with the opaque reference", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, requestedAtIso: "2026-11-28T10:00:00.000Z" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();
    render(<PilotOffers token="tok/1" pilot={pilot([offer()], "introduction-request-2026-11-12")} onChanged={onChanged} />);
    expect(screen.getByRole("button", { name: "Request this pilot" }))
      .toHaveAccessibleDescription("We give North Robotics your name, address and contact details, and give you theirs.");
    fireEvent.click(screen.getByRole("button", { name: "Request this pilot" }));
    expect(await screen.findByText("Requested November 28, 2026. The company has not confirmed yet.")).toBeVisible();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/site-task-brief/tok%2F1/pilot-requests");
    expect(JSON.parse(String(init.body))).toEqual({ offerRef: REF, statementVersion: "introduction-request-2026-11-12" });
    expect(onChanged).toHaveBeenCalled();
  });

  it("says a refusal in its own sentence, and takes the job's sentence the server names", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, reason: "statement_not_current",
      statementVersion: "introduction-request-2026-11-12" }), { status: 409 })));
    render(<PilotOffers token="tok" pilot={pilot([offer()])} />);
    fireEvent.click(screen.getByRole("button", { name: "Request this pilot" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The wording on this page has changed.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Request this pilot" }))
      .toHaveAccessibleDescription("We give North Robotics your name, address and contact details, and give you theirs."));
  });

  it.each([
    [{ state: "requested" as const, requestedAtIso: "2026-11-27T10:00:00.000Z" }, "Requested November 27, 2026. The company has not confirmed yet."],
    [{ state: "question" as const, requestedAtIso: "2026-11-27T10:00:00.000Z" }, "The company asked a question before it confirms. You can reply under Applicants."],
    [{ state: "declined" as const, requestedAtIso: "2026-11-27T10:00:00.000Z", reason: "We do not lift over 20 kg." },
      "The company said this job is not a fit: We do not lift over 20 kg."],
    [{ state: "confirmed" as const, requestedAtIso: "2026-11-27T10:00:00.000Z" }, "The company confirmed. We are emailing you both each other's contact details."],
    [{ state: "refused" as const, requestedAtIso: "2026-11-27T10:00:00.000Z" }, "The company confirmed, but the introduction could not be made. Its application is under Applicants."],
  ])("says where a request stands, with no button: %o", (request, line) => {
    render(<PilotOffers token="tok" pilot={pilot([offer({ request })])} />);
    expect(screen.getByText(line)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request this pilot" })).toBeNull();
  });

  it("shows the pilot sheet once the introduction is made", () => {
    render(<PilotOffers token="tok" pilot={pilot([offer({ request: { state: "confirmed", requestedAtIso: "2026-11-27T10:00:00.000Z",
      introducedAtIso: "2026-11-28T10:00:00.000Z", sheet: { sentence: "Stack cartons onto the pallet", done: null,
        requestedAtIso: "2026-11-27T10:00:00.000Z", terms: offer().offer.terms } } })])} />);
    const sheet = screen.getByRole("region", { name: "Pilot sheet" });
    expect(within(sheet).getByText("“Stack cartons onto the pallet”")).toBeVisible();
    expect(within(sheet).getByText("Not stated")).toBeVisible();
    expect(within(sheet).getByText("Pilot: 6 weeks")).toBeVisible();
    expect(within(sheet).getByText(PILOT_SHEET_FOOTER)).toBeVisible();
    expect(screen.getByText("The company confirmed on November 28, 2026. Its contact details are under Applicants.")).toBeVisible();
  });
});
