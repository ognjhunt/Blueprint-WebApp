import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "@/lib/companyResponses";

/**
 * The company's video and simulation download carry a 15-minute ticket in their address
 * (`server/utils/taskEvaluationResultDownloadTicket.ts`). The page asks the same authorised page request for fresh
 * tickets before they end, and again when the video fails after its ticket has run, so a company can keep watching for
 * as long as it may see the job. A withdrawn job or a lost approval answers that request with a refusal, and the page
 * says the job is no longer available.
 */
const auth = vi.hoisted(() => ({ loading: false, currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
vi.mock("wouter", () => ({ useParams: () => ({ jobId: "job-1" }) }));

const { default: CompanyJob } = await import("@/pages/CompanyJob");

const START_MS = Date.parse("2026-11-23T12:00:00.000Z");
const TICKET_SECONDS = 15 * 60;
const videoUrl = (nowMs: number, signature: string) =>
  `/api/company-media/jobs/job-1/video.mp4?capture=c1&viewer=v1&expires=${Math.floor(nowMs / 1000) + TICKET_SECONDS}&signature=${signature}`;
const simulationUrl = (nowMs: number, signature: string) =>
  `/api/company-media/jobs/job-1/simulation.zip?capture=c1&viewer=v1&expires=${Math.floor(nowMs / 1000) + TICKET_SECONDS}&signature=${signature}`;

const item = (nowMs: number, signature: string): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  headline: "Stack cartons on pallets", headlineFacts: [], fitSummary: [], firstLookStatus: null, simulationStatus: null,
  visitMustConfirm: [], aboutSite: [],
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack cartons onto the pallet.", jobFacts: [], country: "United States",
  video: { state: "ready", url: videoUrl(nowMs, signature), width: 1280, height: 720, durationSeconds: 40 },
  simulation: { state: "not_finished" }, simulationDownload: { state: "ready", url: simulationUrl(nowMs, signature) }, firstLook: null,
  firstLookRows: [], myAnswer: null, packetFacts: null, notShown: [],
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT } });
const pageAnswer = (nowMs: number, signature: string) => ({ ok: true, status: 200, json: async () => ({ item: item(nowMs, signature) }) });

const fetchMock = vi.fn();
const video = () => screen.getByLabelText("The site's video, without sound") as HTMLVideoElement;
const pageRequests = () => fetchMock.mock.calls.filter(([path]) => path === "/api/site-worlds/jobs/job-1").length;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(START_MS);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  auth.currentUser = { uid: "u1", email: "team@example.test" };
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("the company's video and download keep working past their 15-minute ticket", () => {
  it("asks the page for fresh tickets before they end, and keeps the video's place", async () => {
    fetchMock.mockResolvedValueOnce(pageAnswer(START_MS, "a".repeat(64)));
    render(<CompanyJob />);
    await screen.findByLabelText("The site's video, without sound");
    expect(video().getAttribute("src")).toBe(videoUrl(START_MS, "a".repeat(64)));

    // The company has watched to 12.5 seconds and the video is playing.
    fireEvent.play(video());
    video().currentTime = 12.5;
    fireEvent.timeUpdate(video());
    const playCalls = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;

    const refreshedAt = START_MS + (TICKET_SECONDS - 60) * 1000;
    fetchMock.mockResolvedValueOnce(pageAnswer(refreshedAt, "b".repeat(64)));
    await act(async () => { await vi.advanceTimersByTimeAsync((TICKET_SECONDS - 60) * 1000); });

    expect(pageRequests()).toBe(2);
    expect(video().getAttribute("src")).toBe(videoUrl(refreshedAt, "b".repeat(64)));
    expect(screen.getByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", simulationUrl(refreshedAt, "b".repeat(64)));
    // The new address continues from the same place, still playing.
    fireEvent.loadedMetadata(video());
    expect(video().currentTime).toBe(12.5);
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length).toBe(playCalls + 1);
  });

  it("asks again when the video fails after its ticket ran out, and not in a loop when a fresh one fails", async () => {
    fetchMock.mockResolvedValueOnce(pageAnswer(START_MS, "a".repeat(64)));
    render(<CompanyJob />);
    await screen.findByLabelText("The site's video, without sound");
    // A laptop asleep past the ticket's end: the clock jumps, then the next byte range is refused.
    const wokeAt = START_MS + 20 * 60 * 1000;
    vi.setSystemTime(wokeAt);
    fetchMock.mockResolvedValue(pageAnswer(wokeAt, "c".repeat(64)));
    await act(async () => { fireEvent.error(video()); await vi.advanceTimersByTimeAsync(0); });
    expect(video().getAttribute("src")).toBe(videoUrl(wokeAt, "c".repeat(64)));
    const requests = pageRequests();
    // A fresh address that fails for another reason does not ask again at once.
    await act(async () => { fireEvent.error(video()); await vi.advanceTimersByTimeAsync(0); });
    expect(pageRequests()).toBe(requests);
  });

  it("says the job is no longer available when the refresh is refused after a withdrawal", async () => {
    fetchMock.mockResolvedValueOnce(pageAnswer(START_MS, "a".repeat(64)));
    render(<CompanyJob />);
    await screen.findByLabelText("The site's video, without sound");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "This job is not available.",
      access: { status: "approved", emailVerified: true, staff: false } }) });
    await act(async () => { await vi.advanceTimersByTimeAsync((TICKET_SECONDS - 60) * 1000); });
    expect(await screen.findByRole("heading", { name: "This job is no longer available" })).toBeInTheDocument();
    expect(screen.queryByLabelText("The site's video, without sound")).toBeNull();
    expect(screen.queryByRole("link", { name: "Download the simulation" })).toBeNull();
  });
  it("asks again after a refresh that failed, so the download does not stay on an ended ticket", async () => {
    fetchMock.mockResolvedValueOnce(pageAnswer(START_MS, "a".repeat(64)));
    render(<CompanyJob />);
    await screen.findByLabelText("The site's video, without sound");
    // The scheduled refresh meets a 503: the page stays as it is.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    await act(async () => { await vi.advanceTimersByTimeAsync((TICKET_SECONDS - 60) * 1000); });
    expect(pageRequests()).toBe(2);
    expect(screen.getByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", simulationUrl(START_MS, "a".repeat(64)));
    // Thirty seconds later it asks again, and the fresh tickets arrive.
    const retriedAt = START_MS + (TICKET_SECONDS - 30) * 1000;
    fetchMock.mockResolvedValueOnce(pageAnswer(retriedAt, "d".repeat(64)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(pageRequests()).toBe(3);
    expect(screen.getByRole("link", { name: "Download the simulation" })).toHaveAttribute("href", simulationUrl(retriedAt, "d".repeat(64)));
  });

  it("does not put the job back on the page when the company signs out while a refresh is on its way", async () => {
    fetchMock.mockResolvedValueOnce(pageAnswer(START_MS, "a".repeat(64)));
    const view = render(<CompanyJob />);
    await screen.findByLabelText("The site's video, without sound");
    let answer: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
    await act(async () => { await vi.advanceTimersByTimeAsync((TICKET_SECONDS - 60) * 1000); });
    expect(pageRequests()).toBe(2);
    // Signed out before the refresh answers.
    auth.currentUser = null;
    view.rerender(<CompanyJob />);
    expect(screen.queryByLabelText("The site's video, without sound")).toBeNull();
    await act(async () => { answer(pageAnswer(START_MS + 14 * 60_000, "e".repeat(64))); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByLabelText("The site's video, without sound")).toBeNull();
    expect(screen.queryByRole("link", { name: "Download the simulation" })).toBeNull();
  });
});
