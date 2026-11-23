import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CITY_STATE_PRIVACY_VERSION, LAUNCH_COPY_VERSION } from "@/lib/legalAcceptance";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "@/lib/companyResponses";

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

const { default: CompanyJob, SITE_ANSWERS_HINT, NO_FIRST_LOOK } = await import("@/pages/CompanyJob");

const item = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons onto the pallet. Call [removed]",
  jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
  video: { state: "ready", url: "/api/company-media/jobs/job-1/video.mp4?x=1", width: 1280, height: 720, durationSeconds: 4 },
  simulation: { state: "ready", viewerUrl: "/splat-viewer/index.html?content=x" }, simulationDownload: { state: "not_finished" }, firstLook: null,
  firstLookRows: [{ verdict: "fits", text: "Fits.", robot: "Universal Robots UR20" }], myAnswer: null,
  packetFacts: { object: ["Starts: about 54 cm above the floor."], measured: ["Registration residual: 8 cm."],
    estimated: ["Weight: about 3.1 kg (0.34 to 28 kg). An estimate, not weighed."] },
  notShown: ["No safety assessment of any robot at this site."],
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...overrides });
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); auth.currentUser = { uid: "u1", email: "team@example.test" }; });

describe("the company's page for one job", () => {
  it("shows the packet's parts and sends an answer with the recorded line", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "Palletize cartons" })).toBeInTheDocument();
    const account = within(screen.getByRole("navigation", { name: "Account" }));
    expect(account.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(account.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/app");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/site-worlds/jobs/job-1");
    expect(screen.getByText("Stack 12 kg cartons onto the pallet. Call [removed]")).toBeInTheDocument();
    expect(screen.getByText("Weight: 5 to 15 kg (11 to 33 lb)")).toBeInTheDocument();
    expect(screen.getByText(/United States/)).toBeInTheDocument();
    const video = screen.getByLabelText("The site's video, without sound") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/api/company-media/jobs/job-1/video.mp4?x=1");
    expect(video.getAttribute("controlsList")).toContain("nodownload");
    expect(screen.getByRole("link", { name: "View the simulation of the site" })).toHaveAttribute("href", "/splat-viewer/index.html?content=x");
    // The simulation opens in the same tab; its viewer has the way back to this job.
    expect(screen.getByRole("link", { name: "View the simulation of the site" })).not.toHaveAttribute("target");
    expect(screen.getByText("Fits.")).toBeInTheDocument();
    // What the video shows of the object and how sure each figure is, beside the site's own unchecked answers.
    expect(screen.getByText(SITE_ANSWERS_HINT)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "The object and where it goes" })).getByText("Starts: about 54 cm above the floor.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Measured" })).getByText("Registration residual: 8 cm.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Estimated" })).getByText(/An estimate, not weighed/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "What this job packet does not show" }))
      .getByText("No safety assessment of any robot at this site.")).toBeInTheDocument();
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

  it("names the answer just saved, never the one it replaced", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ myAnswer: { state: "needs_something",
      inputs: "A second gripper.", updatedAtIso: "2026-11-12T10:00:00.000Z", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText(/You answered “Need more details” on November 12, 2026\./)).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Your response" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Saved." }) });
    fireEvent.click(within(form).getByLabelText("Interested"));
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Saved."));
    expect(screen.getByText(/^You answered “Interested” on /)).toBeInTheDocument();
    expect(screen.queryByText(/You answered “Need more details”/)).toBeNull();
  });

  it("keeps the answer on record when a new one is refused", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ myAnswer: { state: "needs_something",
      inputs: "A second gripper.", updatedAtIso: "2026-11-12T10:00:00.000Z", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION } }) }) });
    render(<CompanyJob />);
    const form = await screen.findByRole("form", { name: "Your response" });
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Your answer was not saved." }) });
    fireEvent.click(within(form).getByLabelText("Interested"));
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

  it("signs a visitor back into this job and fetches nothing while signed out", async () => {
    auth.currentUser = null;
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "Sign in to see this job" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    const signInHref = "/sign-in?next=%2Fjobs%2Fjob-1";
    expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", signInHref);
    expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", signInHref);
    expect(main.getByRole("link", { name: "Apply to see jobs" })).toHaveAttribute("href", "/jobs?next=%2Fjobs%2Fjob-1#partner-application");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the job is not available when the server refuses it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is not available" })).toBeInTheDocument();
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
    expect(screen.queryByText(NO_FIRST_LOOK)).not.toBeInTheDocument();
  });

  it("offers the two tested answers in the one form once the job has a simulation package", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ simulation: { state: "not_finished" },
      simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?x=1" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", "/api/company-media/jobs/job-1/simulation.zip?x=1");
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
    fireEvent.click(within(form).getByLabelText("Interested"));
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
    expect(await screen.findByRole("heading", { name: "Palletize cartons" })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/robot-team-access/accept-terms");
    expect(JSON.parse(String(init.body))).toEqual({ acceptedTerms: true, termsVersion: LAUNCH_COPY_VERSION, privacyVersion: CITY_STATE_PRIVACY_VERSION });
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
    expect(await screen.findByText("Sign in to see this job")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("This sign-in link no longer works. Ask for a new one on the sign-in page.");
    expect(screen.getAllByRole("link", { name: "Sign in" }).some(link => link.getAttribute("href")?.startsWith("/sign-in"))).toBe(true);
  });
});
