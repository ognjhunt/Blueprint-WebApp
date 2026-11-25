import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { COMPANY_APPLICATION_VERSION, LIBRARY_MODEL_TERMS_VERSION } from "@/lib/legalAcceptance";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION, estimateInWords } from "@/lib/companyResponses";

/**
 * The company's page for one job (package E, E3 and E5): the site's sentence, its answers, the country, the video
 * (or "The video is being prepared."), the first look, the simulation link, and the answer form with the recorded line.
 */
const auth = vi.hoisted(() => ({ loading: false, currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
vi.mock("wouter", () => ({ useParams: () => ({ jobId: "job-1" }) }));
const linkSignIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/companySignInLink", async (actual) => ({ ...(await actual<typeof import("@/lib/companySignInLink")>()),
  signInWithCompanyLink: linkSignIn }));

const { default: CompanyJob, SITE_ANSWERS_HINT, typedEstimate, ESTIMATE_INVALID, DECLINED_COMPANY_LINE } = await import("@/pages/CompanyJob");

const item = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  headline: "Stack cartons on pallets", headlineFacts: ["Two shifts"],
  fitSummary: [{ key: "object", label: "Object", value: "cartons", state: "from_video" },
    { key: "weight", label: "Weight", value: "5 to 15 kg (11 to 33 lb)", state: "stated" },
    { key: "perHour", label: "Times an hour", value: null, state: "not_stated", estimateBelow: true },
    { key: "hours", label: "Hours a day", value: "Two shifts", state: "stated" },
    { key: "timing", label: "When", value: null, state: "unsure" }],
  firstLookStatus: null, simulationStatus: null,
  visitMustConfirm: ["How pallets arrive, where they are staged and how full ones leave."],
  aboutSite: ["The site's name, street address and contact details come only with an introduction the site asks for."],
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons onto the pallet. Call [removed]",
  jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
  video: { state: "ready", url: "/api/company-media/jobs/job-1/video.mp4?x=1", width: 1280, height: 720, durationSeconds: 4 },
  simulation: { state: "ready", viewerUrl: "/splat-viewer/index.html?content=x" }, simulationDownload: { state: "not_finished" }, firstLook: null,
  firstLookRows: [{ verdict: "fits", text: "Fits.", robot: "Universal Robots UR20" }], myAnswer: null,
  packetFacts: { object: ["Starts: about 54 cm above the floor."], measured: ["Registration residual: 8 cm."],
    estimated: ["Weight: about 3.1 kg (0.34 to 28 kg). An estimate, not weighed."] },
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...overrides });
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); auth.currentUser = { uid: "u1", email: "team@example.test" }; });

describe("the company's page for one job", () => {
  it("shows the packet's parts and sends an answer with the recorded line", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    // The title is built from the job's facts, not the category.
    expect(await screen.findByRole("heading", { name: "Stack cartons on pallets" })).toBeInTheDocument();
    expect(screen.getByText("Two shifts", { selector: ".opportunity-meta span" })).toBeInTheDocument();
    const account = within(screen.getByRole("navigation", { name: "Account" }));
    expect(account.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(account.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/app");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/site-worlds/jobs/job-1");
    expect(screen.getByText("Stack 12 kg cartons onto the pallet. Call [removed]")).toBeInTheDocument();
    // At a glance: each question as a field, the skipped ones said, never dropped.
    const glance = within(screen.getByLabelText("The site's answers"));
    expect(glance.getByText("Weight").nextElementSibling).toHaveTextContent("5 to 15 kg (11 to 33 lb)");
    expect(glance.getByText("Times an hour").nextElementSibling).toHaveTextContent("Not stated · Blueprint's estimate is below");
    expect(glance.getByText("When").nextElementSibling).toHaveTextContent("Not sure");
    expect(glance.getByText("Object").nextElementSibling).toHaveTextContent("cartons (from the video)");
    expect(screen.getByText(/United States/)).toBeInTheDocument();
    const video = screen.getByLabelText("The site's video, without sound") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/api/company-media/jobs/job-1/video.mp4?x=1");
    expect(video.getAttribute("controlsList")).toContain("nodownload");
    // The simulation is opened from the top, beside the download, so a company sees it without downloading anything, in
    // the same tab (its viewer has the way back to this job); once, not again below the form (owner, 2026-11-25).
    const top = screen.getByRole("link", { name: "View the simulation" });
    expect(top).toHaveAttribute("href", "/splat-viewer/index.html?content=x");
    expect(top).not.toHaveAttribute("target");
    expect(top.closest(".company-job-actions")).not.toBeNull();
    expect(screen.getAllByRole("link", { name: /View the simulation/ })).toHaveLength(1);
    expect(screen.getByText("Fits.")).toBeInTheDocument();
    // What the video shows of the object and how sure each figure is, beside the site's own unchecked answers.
    expect(screen.getByText(SITE_ANSWERS_HINT)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "The object and where it goes" })).getByText("Starts: about 54 cm above the floor.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Measured" })).getByText("Registration residual: 8 cm.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Estimated" })).getByText(/An estimate, not weighed/)).toBeInTheDocument();
    // What a first visit must still confirm for this kind of job, and the site's identity rule.
    expect(within(screen.getByRole("list", { name: "What a visit must confirm" }))
      .getByText("How pallets arrive, where they are staged and how full ones leave.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "About the site" })).getByText(/come only with an introduction/)).toBeInTheDocument();
    expect(screen.queryByText(/does not show/)).toBeNull();
    // The page ends with the form: nothing of the job sits after it (owner, 2026-11-25: what sat below it was missed).
    const respond = screen.getByRole("region", { name: "Your response" });
    for (const part of ["The video", "First look", "The object and how sure we are", "A visit must confirm"])
      expect(screen.getByRole("region", { name: part }).compareDocumentPosition(respond) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(respond.nextElementSibling).toBeNull();
    expect(screen.queryByRole("link", { name: /download/i })).toBeNull();

    const form = screen.getByRole("form", { name: "Your response" });
    expect(within(form).getByText(COMPANY_RESPONSE_STATEMENT)).toBeInTheDocument();
    // Without a simulation package the two tested answers are not offered (E9).
    expect(within(form).getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["interested", "declined", "needs_something"]);
    // Nothing is chosen for the company: a first answer starts empty and the browser asks for one.
    for (const radio of within(form).getAllByRole("radio")) { expect(radio).not.toBeChecked(); expect(radio).toBeRequired(); }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Your answer is saved." }) });
    fireEvent.click(within(form).getByLabelText("Need more details"));
    fireEvent.change(within(form).getByRole("textbox", { name: "What details would help you decide?" }), { target: { value: "A second gripper." } });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Your answer is saved."));
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/site-worlds/tasks/job-1/interest");
    expect(JSON.parse(String(init.body))).toEqual({ state: "needs_something", inputs: "A second gripper.",
      statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION });
  });

  // A review of PR #1437: a rule the site gave that is not shown yet is never said as "the site has not said".
  it("says the site's rule for done can't be shown yet, and that a reply held at a limit can't be shown", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ successRulePending: true,
      clarification: { question: "How tall is the pallet?", answer: null, limitReached: true } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("What counts as done can't be shown right now.")).toBeInTheDocument();
    expect(screen.queryByText(/has not said what counts as done/)).toBeNull();
    expect(screen.getByText("The site replied, but its reply can't be shown: we reached a limit on checking words for names and contact details."))
      .toBeInTheDocument();
    expect(screen.queryByText(/You can read it here once/)).toBeNull();
  });

  it("tells the company when the site is asked to reply to its question, and when that date has passed", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      pendingQuestion: { askedAtIso: "2998-12-31T10:00:00.000Z", replyByIso: "2999-01-03T10:00:00.000Z", reminded: false } }) }) });
    const { unmount } = render(<CompanyJob />);
    expect(await screen.findByText("You asked on December 31, 2998. The site is asked to reply by January 3, 2999.")).toBeInTheDocument();
    unmount();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      pendingQuestion: { askedAtIso: "2026-11-12T10:00:00.000Z", replyByIso: "2026-11-15T10:00:00.000Z", reminded: true } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("The site has not replied yet. Its reply date was November 15, 2026, and we reminded it.")).toBeInTheDocument();
  });

  it("sends an application at a glance, with an optional estimate in the unit of how the company charges", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fireEvent.click(within(form).getByLabelText("Apply"));
    const glance = within(form).getByRole("group", { name: "Your application at a glance" });
    fireEvent.change(within(glance).getByLabelText("How you charge"), { target: { value: "subscription" } });
    expect(within(glance).getByText("Estimate, in US dollars a month")).toBeVisible();
    fireEvent.change(within(glance).getByLabelText("From"), { target: { value: "12,000" } });
    fireEvent.change(within(glance).getByLabelText("To"), { target: { value: "$18000" } });
    fireEvent.change(within(glance).getByLabelText("Similar jobs you have done"), { target: { value: "6_20" } });
    fireEvent.change(within(glance).getByLabelText("What a visit must confirm"), { target: { value: "Conveyor height." } });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Saved." }) });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Saved."));
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)).details).toEqual({
      chargeModel: "subscription", estimate: { lowUsd: 12000, highUsd: 18000 }, similarJobs: "6_20", visitMustConfirm: "Conveyor height." });
  });

  // Stress test round 2, 2026-11-24: the estimate's ends named no unit to a screen reader, the visit field had no hint,
  // and a refused field was neither marked nor focused.
  it("names each estimate end's unit and the visit field's hint, and marks, focuses and scrolls to a refused field", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fireEvent.click(within(form).getByLabelText("Apply"));
    const glance = within(form).getByRole("group", { name: "Your application at a glance" });
    fireEvent.change(within(glance).getByLabelText("How you charge"), { target: { value: "per_hour" } });
    const from = within(glance).getByLabelText("From"), to = within(glance).getByLabelText("To");
    const visit = within(glance).getByLabelText("What a visit must confirm");
    expect(from).toHaveAccessibleDescription(/^Estimate, in US dollars an hour Estimate before a site visit\. Not a quote\./);
    expect(to).toHaveAccessibleDescription(/^Estimate, in US dollars an hour/);
    expect(visit).toHaveAccessibleDescription(/^What you would need to see at the site before you commit/);
    // A comma decimal: refused, the From field marked, focused and scrolled to.
    fireEvent.change(from, { target: { value: "0,35" } });
    fireEvent.submit(form);
    await waitFor(() => expect(from).toHaveAttribute("aria-invalid", "true"));
    expect(document.activeElement).toBe(from);
    expect(scrolled).toHaveBeenCalled();
    expect(from).toHaveAccessibleDescription(/Enter the estimate in US dollars/);
    expect(to).not.toHaveAttribute("aria-invalid");
    // Only "To" fails on its own: it is the one marked. Typing in it clears the mark.
    fireEvent.change(from, { target: { value: "45" } });
    fireEvent.change(to, { target: { value: "20000" } });
    fireEvent.submit(form);
    await waitFor(() => expect(to).toHaveAttribute("aria-invalid", "true"));
    expect(from).not.toHaveAttribute("aria-invalid");
    expect(document.activeElement).toBe(to);
    fireEvent.change(to, { target: { value: "60" } });
    expect(to).not.toHaveAttribute("aria-invalid");
    // A refusal from the server names its field: the visit note.
    fireEvent.change(visit, { target: { value: "Floor load" } });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Keep what a visit must confirm short.",
      field: "visitMustConfirm" }) });
    fireEvent.submit(form);
    await waitFor(() => expect(visit).toHaveAttribute("aria-invalid", "true"));
    expect(document.activeElement).toBe(visit);
  });

  // Review of #1426: an estimate hidden by changing how the company charges never blocks the application.
  it("leaves out an estimate hidden by changing how the company charges, and still applies", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fireEvent.click(within(form).getByLabelText("Apply"));
    const glance = within(form).getByRole("group", { name: "Your application at a glance" });
    fireEvent.change(within(glance).getByLabelText("How you charge"), { target: { value: "per_hour" } });
    fireEvent.change(within(glance).getByLabelText("From"), { target: { value: "40" } });
    fireEvent.change(within(glance).getByLabelText("To"), { target: { value: "30" } });
    fireEvent.change(within(glance).getByLabelText("How you charge"), { target: { value: "undecided" } });
    expect(within(glance).queryByLabelText("From")).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Saved." }) });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Saved."));
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)).details).toEqual({ chargeModel: "undecided" });
  });

  // Stress test, 2026-11-24: an estimate under a dollar, or written with cents, could not be entered.
  it("reads an estimate in dollars and cents, low to high, and refuses one it cannot read", () => {
    expect(typedEstimate("per_hour", "", "")).toBeNull();
    expect(typedEstimate("per_hour", "30", "")).toEqual({ lowUsd: 30, highUsd: 30 });
    expect(typedEstimate("purchase", "$120,000", "150000")).toEqual({ lowUsd: 120000, highUsd: 150000 });
    expect(typedEstimate("per_hour", "12.5", "20")).toEqual({ lowUsd: 12.5, highUsd: 20 });
    expect(typedEstimate("per_hour", "$45.00", "$60.00")).toEqual({ lowUsd: 45, highUsd: 60 });
    expect(typedEstimate("per_task", "0.35", ".50")).toEqual({ lowUsd: 0.35, highUsd: 0.5 });
    expect(typedEstimate("purchase", "１２００", "")).toEqual({ lowUsd: 1200, highUsd: 1200 });
    expect(typedEstimate("purchase", "150000", "120000")).toBe("invalid");
    // More than two decimals, a comma that does not group thousands, a range in one box, a shorthand: never guessed.
    for (const [low, high] of [["0.355", ""], ["0,35", ""], ["1,2", ""], ["45-60", ""], ["12k", "18k"], ["0", ""], ["0.001", ""], ["100,000,001", ""]])
      expect(typedEstimate("per_task", low, high), `${low}..${high}`).toBe("invalid");
    expect(typedEstimate("undecided", "10", "20")).toBe("invalid");
    expect(typedEstimate(undefined, "10", "20")).toBe("invalid");
    expect(ESTIMATE_INVALID).not.toMatch(/whole dollars/);
  });

  it("says an estimate with cents as dollars and cents, at both ends, in the unit of how the company charges", () => {
    expect(estimateInWords("per_task", { lowUsd: 0.35, highUsd: 0.5 })).toBe("$0.35 to $0.50 per task or item");
    expect(estimateInWords("per_hour", { lowUsd: 45.5, highUsd: 60 })).toBe("$45.50 to $60.00 an hour");
    expect(estimateInWords("subscription", { lowUsd: 12000, highUsd: 18000 })).toBe("$12,000 to $18,000 a month");
    expect(estimateInWords("per_hour", { lowUsd: 15, highUsd: 15 })).toBe("$15 an hour");
    expect(estimateInWords("per_task", { lowUsd: 0.001, highUsd: 1 })).toBeNull();
  });

  it("names the answer just saved, never the one it replaced", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ myAnswer: { state: "needs_something",
      inputs: "A second gripper.", updatedAtIso: "2026-11-12T10:00:00.000Z", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText(/You answered “Need more details” on November 12, 2026\./)).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Your response" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Saved." }) });
    fireEvent.click(within(form).getByLabelText("Apply"));
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Saved."));
    expect(screen.getByText(/^You applied on /)).toBeInTheDocument();
    expect(screen.queryByText(/You answered “Need more details”/)).toBeNull();
  });

  it("keeps the answer on record when a new one is refused", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ myAnswer: { state: "needs_something",
      inputs: "A second gripper.", updatedAtIso: "2026-11-12T10:00:00.000Z", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION } }) }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Your answer was not saved." }) });
    fireEvent.click(within(form).getByLabelText("Apply"));
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Your answer was not saved."));
    expect(screen.getByText(/You answered “Need more details” on November 12, 2026\./)).toBeInTheDocument();
  });

  it("says the video is being prepared and the simulation is not finished until each exists", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ video: { state: "preparing" },
      simulation: { state: "not_finished" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("The video is being prepared.")).toBeInTheDocument();
    expect(screen.getByText("The simulation of the site is not finished yet.")).toBeInTheDocument();
  });

  it("says where the simulation stands under its buttons, and shows no first look or object box with nothing in it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ firstLookRows: [],
      firstLookStatus: "The video is being read. Our first look follows.", simulation: { state: "not_finished" },
      simulationStatus: "The simulation is being built from the site's video.", packetFacts: null }) }) });
    render(<CompanyJob />);
    expect(within(await screen.findByRole("region", { name: "Simulation of the site" })).getByRole("status"))
      .toHaveTextContent("The simulation is being built from the site's video.");
    // Owner, 2026-11-25: "is all of this truly needed?" A box that only says it has nothing yet is left out.
    expect(screen.queryByRole("region", { name: "First look" })).toBeNull();
    expect(screen.queryByRole("region", { name: "The object and how sure we are" })).toBeNull();
    expect(screen.queryByText(/Our first look/)).toBeNull();
    // No success rule from the site: the box says so rather than vanishing.
    expect(screen.getByText("The site has not said what counts as done yet.")).toBeInTheDocument();
  });

  it("names the questions the site skipped on one line, not a row each", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ fitSummary: [
      { key: "object", label: "Object", value: "bedside lamp", state: "from_video" },
      { key: "pickupHandoff", label: "Pickup", value: null, state: "not_stated" },
      { key: "perHour", label: "Times an hour", value: null, state: "not_stated", estimateBelow: true },
      { key: "hours", label: "Hours a day", value: null, state: "not_stated" },
      { key: "timing", label: "When", value: null, state: "unsure" }] }) }) });
    render(<CompanyJob />);
    const glance = within(await screen.findByLabelText("The site's answers"));
    expect(glance.getAllByRole("term").map(term => term.textContent)).toEqual(["Object", "Times an hour", "When"]);
    expect(glance.getByText(/Pickup · Hours a day/).closest("p")).toHaveTextContent("Not stated yet: Pickup · Hours a day");
  });

  it("leaves the skipped line and the unchecked-answers note out when there is nothing to say", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ fitSummary: [
      { key: "object", label: "Object", value: "bedside lamp", state: "from_video" }] }) }) });
    render(<CompanyJob />);
    const glance = within(await screen.findByLabelText("The site's answers"));
    expect(glance.queryByText(/Not stated yet/)).toBeNull();
    expect(screen.queryByText(SITE_ANSWERS_HINT)).toBeNull();
  });

  it("signs a visitor back into this job and fetches nothing while signed out", async () => {
    auth.currentUser = null;
    render(<CompanyJob />);
    // A tap on a public live job (owner, 2026-11-23): what the job holds, the one step to see it, and the way back here.
    expect(await screen.findByRole("heading", { name: "Apply to see this job" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    const signInHref = "/sign-in?next=%2Fjobs%2Fjob-1";
    // The four-field application is right here, pointed back at this job (no extra page to find).
    expect(main.getByRole("form", { name: "Deployment company application" })).toBeInTheDocument();
    expect(within(main.getByRole("list", { name: "What an approved company sees" })).getAllByRole("listitem")).toHaveLength(4);
    expect(main.getByText(/brings you back to this job/)).toBeInTheDocument();
    expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", signInHref);
    expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", signInHref);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the application from a job's gated page with that job to return to", async () => {
    auth.currentUser = null;
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Deployment company application" });
    await waitFor(() => expect(within(form).getByLabelText("Your name")).toBeEnabled());
    fireEvent.change(within(form).getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(within(form).getByLabelText("Work email"), { target: { value: "ada@arm.example" } });
    fireEvent.change(within(form).getByLabelText("Company"), { target: { value: "Arm Co" } });
    fireEvent.change(within(form).getByLabelText("Company website"), { target: { value: "https://arm.example" } });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "applied", notificationStatus: "queued" }) });
    fireEvent.submit(form);
    await screen.findByText("Your application is saved.");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/robot-team-access/apply");
    expect(JSON.parse(String(init.body))).toMatchObject({ returnToJob: "/jobs/job-1", email: "ada@arm.example" });
  });

  it("says the job is not available when the server refuses it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is not available" })).toBeInTheDocument();
  });

  // Stress test, 2026-11-24: a declined company read only "It may no longer be shared, or your account may not be approved".
  it("tells a declined company it is not approved to see jobs, and where to write", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ access: { status: "declined", signedIn: true,
      emailVerified: true, allowed: false, staff: false } }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is not available" })).toBeInTheDocument();
    expect(screen.getByText(DECLINED_COMPANY_LINE, { exact: false })).toBeVisible();
    expect(screen.getByRole("link", { name: "hello@tryblueprint.io" })).toHaveAttribute("href", "mailto:hello@tryblueprint.io");
    expect(screen.queryByText(/may no longer be shared/)).toBeNull();
  });

  // The page knows the account's access, so it says which case a refusal is.
  it("tells an approved company the job is no longer available, and links back to the jobs", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ access: { status: "approved", signedIn: true,
      emailVerified: true, allowed: true, staff: false } }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is no longer available" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to jobs" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/may not be approved/)).toBeNull();
  });

  it("tells an account that never applied that only approved companies see jobs, and how to apply", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ access: { status: "none", signedIn: true,
      emailVerified: true, allowed: false, staff: false } }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is not available" })).toBeInTheDocument();
    expect(screen.getByText(/Only approved deployment companies can see jobs\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply to see jobs" })).toHaveAttribute("href", "/jobs?next=%2Fjobs%2Fjob-1#partner-application");
  });

  it("shows a conditional first-look row and the count of the rest, from the shared first look", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      firstLookRows: [{ verdict: "conditional", text: "Fits if the item weighs under 11.6 kg.", robot: "Universal Robots UR10e" }],
      firstLookMore: "And 27 more." }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("Fits if the item weighs under 11.6 kg.")).toBeInTheDocument();
    expect(screen.getByText("Universal Robots UR10e:")).toBeInTheDocument();
    expect(screen.getByText("And 27 more.")).toBeInTheDocument();
    // Rows of robots on paper are a first look: the page does not also say the first look is not ready.
    expect(screen.queryByText(/first look is not ready/)).not.toBeInTheDocument();
  });

  it("offers the two tested answers in the one form once the job has a simulation package", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ simulation: { state: "not_finished" },
      simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?x=1" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", "/api/company-media/jobs/job-1/simulation.zip?x=1");
    // No viewer, no view button.
    expect(screen.queryByRole("link", { name: "View the simulation" })).toBeNull();
    expect(screen.getByText("A 3D simulation of the site, to test in your own tools. Open scene.usda first; the README inside explains each file.")).toBeInTheDocument();
    expect(screen.queryByText(/Gaussian splat/)).toBeNull();
    expect(screen.queryByText("The simulation of the site is not finished yet.")).toBeNull();
    expect(screen.queryByRole("link", { name: "Report simulation result" })).toBeNull();
    expect(screen.getAllByRole("form")).toHaveLength(1);
    const form = screen.getByRole("form", { name: "Your response" });
    expect(within(form).getAllByRole("radio").map(radio => radio.getAttribute("value")))
      .toEqual(["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"]);
    const note = within(form).getByRole("textbox");
    expect(note).not.toBeRequired();
    fireEvent.click(within(form).getByLabelText("Tested it: can do"));
    expect(within(form).getByRole("textbox", { name: "What did you test?" })).toBeRequired();
    // "Add details" keeps the question and the earliest start; "What you have checked" is gone.
    fireEvent.click(within(form).getByText("Add details"));
    expect(within(form).getByLabelText("Question for the site")).toBeInTheDocument();
    expect(within(form).getByLabelText("Earliest start")).toBeInTheDocument();
    expect(within(form).queryByLabelText("What you have checked")).toBeNull();
  });

  it("clears the last saved message once another answer is chosen", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?x=1" } }) }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Saved. If the site asks to meet you, we email you both each other's name and contact details." }) });
    fireEvent.click(within(form).getByLabelText("Apply"));
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("If the site asks to meet you"));
    fireEvent.click(within(form).getByLabelText("Tested it: can do"));
    expect(within(form).queryByRole("status")).toBeNull();
  });

  it("asks a company that has not accepted the current Terms to agree, shows nothing of the job, then loads it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: "terms_acceptance_required",
      error: "Before you see jobs, read and agree to our Terms and Privacy Policy." }) });
    render(<CompanyJob />);
    expect(await screen.findByText("Before you see jobs, read and agree to our Terms and Privacy Policy.")).toBeInTheDocument();
    const prompt = screen.getByRole("region", { name: "Terms and Privacy Policy" });
    expect(within(prompt).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(prompt).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByRole("heading", { name: "Palletize cartons" })).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    fireEvent.click(screen.getByRole("button", { name: "I agree to the Terms and Privacy Policy" }));
    // The title is built from the job's facts, not the category.
    expect(await screen.findByRole("heading", { name: "Stack cartons on pallets" })).toBeInTheDocument();
    expect(screen.getByText("Two shifts", { selector: ".opportunity-meta span" })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/robot-team-access/accept-terms");
    expect(JSON.parse(String(init.body))).toEqual({ acceptedTerms: true, termsVersion: LIBRARY_MODEL_TERMS_VERSION, privacyVersion: COMPANY_APPLICATION_VERSION });
  });
});

// Owner, 2026-11-23: a new-job email's link signs a signed-out company in on the way to the job.
describe("opening a job from its email", () => {
  beforeEach(() => { linkSignIn.mockReset(); window.history.replaceState(null, "", "/jobs/job-1?link=emailed-token&from=q%3Dx"); });

  it("signs a signed-out company in with the link, and takes the link out of the address bar", async () => {
    auth.currentUser = null;
    linkSignIn.mockReturnValue(new Promise(() => undefined));
    render(<CompanyJob />);
    await waitFor(() => expect(linkSignIn).toHaveBeenCalledWith("emailed-token"));
    expect(window.location.search).toBe("?from=q%3Dx");
    expect(screen.queryByText("Sign in to see this job")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });

  it("leaves the link unspent for a company that is already signed in, and opens the job", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    await waitFor(() => expect(fetchMock.mock.calls[0][0]).toBe("/api/site-worlds/jobs/job-1"));
    expect(linkSignIn).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?from=q%3Dx");
  });

  it("says the link no longer works and offers sign-in when it was used or expired", async () => {
    auth.currentUser = null;
    linkSignIn.mockRejectedValue(new Error("This sign-in link no longer works."));
    render(<CompanyJob />);
    expect(await screen.findByText("Apply to see this job", { selector: "h1" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("This sign-in link no longer works. Ask for a new one on the sign-in page.");
    expect(screen.getAllByRole("link", { name: "Sign in" }).some(link => link.getAttribute("href")?.startsWith("/sign-in"))).toBe(true);
  });
});
