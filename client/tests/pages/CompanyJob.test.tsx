import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const { default: CompanyJob } = await import("@/pages/CompanyJob");

const item = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons onto the pallet. Call [removed]",
  jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
  video: { state: "ready", url: "/api/company-media/jobs/job-1/video.mp4?x=1", width: 1280, height: 720, durationSeconds: 4 },
  simulation: { state: "ready", viewerUrl: "/splat-viewer/index.html?content=x" }, simulationDownload: { state: "not_finished" }, firstLook: null,
  firstLookRows: [{ verdict: "fits", text: "Fits.", robot: "Universal Robots UR20" }], myAnswer: null,
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...overrides });
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); auth.currentUser = { uid: "u1", email: "team@example.test" }; });

describe("the company's page for one job", () => {
  it("shows the packet's parts and sends an answer with the recorded line", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "Carton palletizing opportunity" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/site-worlds/jobs/job-1");
    expect(screen.getByText("Stack 12 kg cartons onto the pallet. Call [removed]")).toBeInTheDocument();
    expect(screen.getByText("Weight: 5 to 15 kg (11 to 33 lb)")).toBeInTheDocument();
    expect(screen.getByText(/United States/)).toBeInTheDocument();
    const video = screen.getByLabelText("The site's video, without sound") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/api/company-media/jobs/job-1/video.mp4?x=1");
    expect(video.getAttribute("controlsList")).toContain("nodownload");
    expect(screen.getByRole("link", { name: "View the simulation of the site" })).toHaveAttribute("href", "/splat-viewer/index.html?content=x");
    expect(screen.getByText("Fits.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).toBeNull();

    const form = screen.getByRole("form", { name: "Answer about this job" });
    expect(within(form).getByText(COMPANY_RESPONSE_STATEMENT)).toBeInTheDocument();
    // Without a simulation package the two tested answers are not offered (E9).
    expect(within(form).getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["interested", "declined", "needs_something"]);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, nextAction: "Your answer is saved." }) });
    fireEvent.click(within(form).getByLabelText("Would need something"));
    fireEvent.change(within(form).getByRole("textbox"), { target: { value: "A second gripper." } });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Your answer is saved."));
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/site-worlds/tasks/job-1/interest");
    expect(JSON.parse(String(init.body))).toEqual({ state: "needs_something", inputs: "A second gripper.",
      statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION });
  });

  it("says the video is being prepared and the simulation is not finished until each exists", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ video: { state: "preparing" },
      simulation: { state: "not_finished" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("The video is being prepared.")).toBeInTheDocument();
    expect(screen.getByText("The simulation of the site is not finished yet.")).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in and fetches nothing", async () => {
    auth.currentUser = null;
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "Sign in to see this job" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the job is not available when the server refuses it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    render(<CompanyJob />);
    expect(await screen.findByRole("heading", { name: "This job is not available" })).toBeInTheDocument();
  });

  it("shows a conditional first-look row and the count of the rest, from the shared first look", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({
      firstLookRows: [{ verdict: "conditional", text: "Fits if the item weighs under 11.6 kg.", robot: "Universal Robots UR10e" }],
      firstLookMore: "And 27 more." }) }) });
    render(<CompanyJob />);
    expect(await screen.findByText("Fits if the item weighs under 11.6 kg.")).toBeInTheDocument();
    expect(screen.getByText("Universal Robots UR10e:")).toBeInTheDocument();
    expect(screen.getByText("And 27 more.")).toBeInTheDocument();
  });

  it("offers the download and the two tested answers once the job has a simulation package", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item({ simulation: { state: "not_finished" },
      simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?x=1" } }) }) });
    render(<CompanyJob />);
    expect(await screen.findByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", "/api/company-media/jobs/job-1/simulation.zip?x=1");
    expect(screen.getByText("The site's scene with the job's object in it, and what counts as done. Test in your own tools.")).toBeInTheDocument();
    expect(screen.getByText("Open scene.usda. The room's look is a Gaussian splat that some tools cannot show; the collision mesh is in the file too.")).toBeInTheDocument();
    expect(screen.queryByText("The simulation of the site is not finished yet.")).toBeNull();
    const form = screen.getByRole("form", { name: "Answer about this job" });
    expect(within(form).getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(
      ["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"]);
    expect(within(form).getByLabelText("Tested it: can do")).toBeInTheDocument();
  });

  it("asks a company that has not accepted the current Terms to agree, shows nothing of the job, then loads it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: "terms_acceptance_required",
      error: "Before you see jobs, read and agree to our Terms and Privacy Policy." }) });
    render(<CompanyJob />);
    expect(await screen.findByText("Before you see jobs, read and agree to our Terms and Privacy Policy.")).toBeInTheDocument();
    const prompt = screen.getByRole("region", { name: "Terms and Privacy Policy" });
    expect(within(prompt).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(prompt).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByRole("heading", { name: "Carton palletizing opportunity" })).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ item: item() }) });
    fireEvent.click(screen.getByRole("button", { name: "I agree to the Terms and Privacy Policy" }));
    expect(await screen.findByRole("heading", { name: "Carton palletizing opportunity" })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/robot-team-access/accept-terms");
    expect(JSON.parse(String(init.body))).toEqual({ acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-13.1" });
  });
});

