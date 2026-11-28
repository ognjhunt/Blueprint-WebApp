/**
 * The simulation on request (owner, 2026-11-28) on both pages: the company's job page offers "Ask for a simulation" only
 * where the server says one can be asked for, sends the press, and then says when it was asked; the site's page says the
 * simulation is built if a company asks, or that none will be built. A job from before the change keeps today's words.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "@/lib/companyResponses";
import { OUTLOOK_SENTENCES, SIMULATION_BUILDING } from "@/lib/jobOutlook";
import { libraryStageLabels } from "@/types/taskBrowse";
import { HOW_STEPS } from "@/lib/publicCopy";
import * as W from "@/lib/simulationRequest";
import { readyAnswer } from "./fixtures/siteAnswer";

const auth = vi.hoisted(() => ({ loading: false, currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (user: unknown, headers: Record<string, string> = {}) =>
  user ? { ...headers, Authorization: "Bearer test-token" } : headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
vi.mock("wouter", () => ({ useParams: () => ({ jobId: "job-1" }) }));

const { default: CompanyJob } = await import("@/pages/CompanyJob");
const { SiteAnswer } = await import("@/components/site/SiteAnswer");

const page = (overrides: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  headline: "Stack cartons on pallets", headlineFacts: [], fitSummary: [], simulationStatus: null, visitMustConfirm: [], aboutSite: [],
  publishedAtIso: "2026-11-28T10:00:00.000Z", sentence: "Stack the cartons onto the pallet.", jobFacts: [], country: "United States",
  video: { state: "preparing" }, simulation: { state: "not_finished" }, simulationDownload: { state: "not_finished" }, myAnswer: null,
  packetFacts: null, responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...overrides });
const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("the company's job page", () => {
  it("says the simulation is built when a company asks, offers the button, sends the press and then says when it was asked", async () => {
    fetchMock.mockResolvedValueOnce(json({ item: page({ simulationStatus: W.SIMULATION_ON_REQUEST_COMPANY, simulationRequest: { state: "can_ask" } }) }));
    render(<CompanyJob />);
    expect(await screen.findByText("A simulation of the site is built when a company asks for one.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Ask for a simulation" });
    fetchMock.mockResolvedValueOnce(json({ ok: true, already: false, askedAtIso: "2026-11-28T12:00:00.000Z", message: W.SIMULATION_ASKED }));
    fetchMock.mockResolvedValueOnce(json({ item: page({ simulationStatus: W.simulationAskedLine("2026-11-28T12:00:00.000Z"),
      simulationRequest: { state: "asked", askedAtIso: "2026-11-28T12:00:00.000Z" } }) }));
    button.click();
    expect(await screen.findByText("Asked November 28, 2026. The simulation is being built from the site's video.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/site-worlds/jobs/job-1/simulation-request");
    expect(init).toMatchObject({ method: "POST", body: "{}" });
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token", "X-CSRF-Token": "local-test" });
    expect(screen.queryByRole("button", { name: "Ask for a simulation" })).toBeNull();
  });

  it("says the refusal's own sentence when the press is refused", async () => {
    fetchMock.mockResolvedValueOnce(json({ item: page({ simulationStatus: W.SIMULATION_ON_REQUEST_COMPANY, simulationRequest: { state: "can_ask" } }) }));
    render(<CompanyJob />);
    const button = await screen.findByRole("button", { name: "Ask for a simulation" });
    fetchMock.mockResolvedValueOnce(json({ error: W.SIMULATION_CANNOT_BE_ASKED }, 409));
    button.click();
    expect(await screen.findByText("A simulation can no longer be built for this job.")).toBeInTheDocument();
  });

  it("offers no button on a job from before the change, or once the simulation cannot be asked for", async () => {
    for (const status of ["The simulation is being built from the site's video.", "There is no simulation for this job."]) {
      fetchMock.mockResolvedValueOnce(json({ item: page({ simulationStatus: status }) }));
      const { unmount } = render(<CompanyJob />);
      expect(await screen.findByText(status)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ask for a simulation" })).toBeNull();
      unmount();
    }
  });

  it("labels the library card for the stage", () => {
    expect(libraryStageLabels.simulation_on_request).toBe("Simulation on request");
    // Every other label as before.
    expect(libraryStageLabels).toMatchObject({ no_video: "No video yet", video_received: "Simulation not started yet",
      simulation_building: "Simulation being built", simulation_built: "Simulation built", no_simulation: "No simulation" });
  });
});

describe("the site's job page", () => {
  const section = () => screen.getByRole("region", { name: "Simulation of your site" });
  it("says the simulation is built if a company asks for one, and that none will be built once none can be", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer}
      outlook={{ phase: "building", reason: "simulation_on_request", sentence: OUTLOOK_SENTENCES.simulation_on_request }} />);
    expect(screen.getByText("A simulation of your site is built if a company asks for one.")).toBeVisible();
    expect(screen.queryByText(SIMULATION_BUILDING)).toBeNull();
    unmount();
    render(<SiteAnswer token="owner-token" answer={readyAnswer}
      outlook={{ phase: "building", reason: "simulation_not_built", sentence: OUTLOOK_SENTENCES.simulation_not_built }} />);
    expect(screen.getByText("No simulation of your site will be built for this job.")).toBeVisible();
  });
  it("keeps today's line for every job that does not wait for a request", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} outlook={{ phase: "building", reason: null, sentence: null }} />);
    expect(section()).toHaveTextContent(SIMULATION_BUILDING);
  });
});

describe("the how-it-works step", () => {
  it("says the simulation comes if a company asks, not that it always does", () => {
    expect(HOW_STEPS[1].line).toBe("We share your video and job description with approved companies, with a simulation if a company asks for one.");
  });
});
