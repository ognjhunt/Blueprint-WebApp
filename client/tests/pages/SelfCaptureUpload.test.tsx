/**
 * The capture page, split by device.
 *
 * A desktop cannot film a workcell, so its page is the handoff: the code, the
 * copyable link, and the status of the phone — never a camera button that opens
 * a webcam at the operator's face. A phone gets the camera first. These tests
 * pin that split, because "a useless button on the laptop" and "no camera on
 * the phone" are the two ways it silently breaks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SelfCaptureUpload from "@/pages/SelfCaptureUpload";
import { RECORDING_RIGHTS_STATEMENT } from "@/lib/recordingRightsStatement";
import { processingFailure } from "../../../server/utils/taskPreparationOutcome";
import { allZeroEvaluation, cannotAssessAnswer, readingAnswer, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

const route = vi.hoisted(() => ({ token: "tok-e2e", navigate: vi.fn() }));
vi.mock("wouter", () => ({ useRoute: () => [true, { token: route.token }], useLocation: () => ["/capture-upload/test", route.navigate] }));

/** The existing job's one click (owner decision 2026-11-07): the step that lets Blueprint run it. */
const CONFIRM_STEP = "Confirm your task: the one step that lets Blueprint run it";
const TOKEN = "tok-e2e";
const videoUpload = vi.hoisted(() => ({ send: vi.fn(), retry: vi.fn() }));
vi.mock("@/lib/selfCaptureVideo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/selfCaptureVideo")>()),
  uploadSelfCaptureVideo: videoUpload.send,
  retrySelfCaptureProcessing: videoUpload.retry,
}));

function mockFetch() {
  return vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          state: "open",
          accepts: ["mov", "mp4"],
          expiresAt: "2099-01-01T00:00:00Z",
        }),
      });
    }
    if (url.startsWith("/api/site-task-brief/") && url.endsWith("/status")) {
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }
    if (url.includes("/clarification?mode=assessment")) return Promise.resolve({ok:true,json:async()=>({revision:"a".repeat(64),needed:false,questions:[],assessmentState:"queued"})});
    if (url.includes("/items")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "film" }) });
  });
}

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

beforeEach(() => {
  route.token = TOKEN;
  route.navigate.mockReset();
  videoUpload.send.mockReset();
  videoUpload.retry.mockReset();
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUserAgent("");
  window.history.replaceState(null, "", "/");
});

describe("video first owner return", () => {
  function ownerFetch(held: boolean, saved = false) {
    let granted = false;
    return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken: "synthetic-qa" }) });
      if (url.endsWith("/recording-consent")) {
        granted = true;
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) return Promise.resolve({ ok: true,
        json: async () => ({ ok: true, state: held && !granted ? "held" : "ready", recordingConsentAvailable: held && !granted,
          accepts: ["mov", "mp4"], ...(saved ? { captureReceived: true, uploadState: "processing_ready" } : {}), holdReason: "recording_consent_required", detail: "Confirm recording permission before adding footage.", blockers: [], openQuestions: [] }) });
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        ready: true, scope: "owner", brief: { summary: "Pack cartons", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: "2026-10-01T00:00:00Z" },
      }) });
      return mockFetch()(input);
    });
  }
  it.each(["confirm_brief", "add_views"])("keeps legacy %s hints optional for a received recording", async decision => {
    const fallback = ownerFetch(false, true);
    const read = vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input) === `/api/site-task-brief/${TOKEN}/status`
      ? Promise.resolve({ ok: true, json: async () => ({ captureReceived: true, status: {
        decision, headline: "Review your saved job brief.", operatorAction: "Please record another view before continuing.",
        missingViews: ["rear of shelf"], nextUpdateIso: null,
      } }) }) : fallback(input, init));
    vi.stubGlobal("fetch", read);
    render(<SelfCaptureUpload />);
    await screen.findByText("Blueprint is preparing your reconstruction.", { selector: "strong" });
    expect(screen.queryByText("Please record another view before continuing.")).not.toBeInTheDocument();
    expect(screen.queryByText("Review your saved job brief.")).not.toBeInTheDocument();
    expect(read.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });
  it("keeps one current update when a processing stop becomes unavailable and resumes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let available = true, stopped = true;
    const outcome = processingFailure(), fallback = ownerFetch(false, true);
    const read = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        ready: true, scope: "owner", brief: { summary: "Move a ball from floor to tabletop", captureMode: "self_capture",
          proposed: [], unresolved: [], confirmedAtIso: null },
      }) });
      if (url === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: available,
        json: async () => available ? { captureReceived: true, status: stopped
          ? { decision: outcome.category, headline: outcome.title, outcome, operatorAction: null, missingViews: [] }
          : { decision: "confirm_brief", headline: "Review the saved brief.", operatorAction: null, missingViews: [] } }
          : { error: "Status unavailable" } });
      if (url === `/api/job-workflow/owner/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        schemaVersion: "job_marketplace.v1", revision: "workflow-1", stage: "job_submitted", briefAgreed: false,
        optionsAssessed: false, reviewRequired: false, nextAction: "Review the saved brief.", actionOwner: "site",
        requirements: {}, review: null, proposals: [], selection: null, agreement: null, outcome: null,
      }) });
      return fallback(input, init);
    });
    vi.stubGlobal("fetch", read);
    const page = render(<SelfCaptureUpload />);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByRole("region", { name: "Preparation outcome" })).toBeVisible();
      available = false;
      await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
      expect(screen.getAllByText("Checking the current job status. Your saved job remains available.")).toHaveLength(1);
      expect(screen.queryByRole("region", { name: "Preparation outcome" })).not.toBeInTheDocument();
      available = true; stopped = false;
      await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
      expect(screen.getByText("Blueprint is preparing your reconstruction.", { selector: "strong" })).toBeVisible();
      expect(screen.getByLabelText("Review your job brief")).not.toHaveAttribute("open");
      expect(screen.queryByText("Review the saved brief.")).not.toBeInTheDocument();
      expect(read.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    } finally { page.unmount(); vi.useRealTimers(); }
  });
  it.each([null, "2026-10-01T00:00:00Z"])("keeps a Blueprint processing stop consistent with brief confirmation %s", async confirmedAtIso => {
    const fallback = ownerFetch(false, true);
    const outcome = processingFailure();
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        ready: true, scope: "owner", brief: { summary: "Move a ball from floor to tabletop", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso },
      }) });
      if (url === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({
        scope: "owner", captureReceived: true, status: { decision: outcome.category, headline: outcome.title,
          operatorAction: null, missingViews: [], nextUpdateIso: null, outcome },
      }) });
      if (url === `/api/job-workflow/owner/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        schemaVersion: "job_marketplace.v1", revision: "workflow-1", stage: "job_submitted", briefAgreed: false,
        optionsAssessed: false, reviewRequired: false, nextAction: "Review the saved brief.", actionOwner: "site",
        requirements: {}, review: null, proposals: [], selection: null, agreement: null, outcome: null,
      }) });
      return fallback(input, init);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("region", { name: "Preparation outcome" })).toHaveTextContent(outcome.scope);
    expect(screen.getByText(outcome.nextStep)).toBeVisible();
    expect(screen.getAllByText(outcome.nextStep)).toHaveLength(1);
    // A confirmed brief is read-only while Blueprint's step is open; an
    // unconfirmed one keeps its confirmation, since only the site can give it.
    if (confirmedAtIso) {
      expect(screen.getByText("Saved job brief")).toBeVisible();
      expect(screen.queryByLabelText("Review your job brief")).not.toBeInTheDocument();
    } else {
      expect(screen.queryByText("Saved job brief")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Review your job brief")).toBeInTheDocument();
      expect(screen.getByText(CONFIRM_STEP)).toBeVisible();
      expect(screen.getByRole("button", { name: "This is right — confirm it" })).toBeInTheDocument();
    }
    if (confirmedAtIso) expect(screen.queryByRole("button", { name: /confirm it/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Confirm your job brief" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry processing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit your answers" })).not.toBeInTheDocument();
    expect(screen.queryByText("Review the saved brief.")).not.toBeInTheDocument();
    expect(screen.queryByText(/checking whether it covers|If another recording is needed/)).not.toBeInTheDocument();
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });

  it("keeps account saving inside optional post-video job details", async () => {
    const fetcher = ownerFetch(false, true);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input) === `/api/site-task-brief/${TOKEN}`
      ? Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", account: { claimed: false, email: "owner@example.test", claimToken: "synthetic-claim-token" },
        brief: { summary: "Pack cartons", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } }) })
      : fetcher(input)));
    render(<SelfCaptureUpload />);
    await screen.findByLabelText("Review your job brief");
    expect(screen.queryByLabelText("Choose a password")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(CONFIRM_STEP));
    fireEvent.click(screen.getByLabelText("Also save this job to my account (optional)"));
    expect(screen.getByLabelText("Choose a password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This is right — confirm and save" })).toBeInTheDocument();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });
  it("preserves saved pilot plans on return, through an interrupted correction and retry", async () => {
    let attempts = 0;
    let savedPilotIntent = { pilotConsideration: "subject_to_review", deploymentPath: "multiple_sites" };
    const fetcher = ownerFetch(false, true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({
        ready: true, scope: "owner", brief: { summary: "Pack cartons", captureMode: "self_capture", proposed: [], unresolved: [],
          confirmedAtIso: "2026-10-01T00:00:00Z", successCriteria: { unknown: true },
          pilotIntent: savedPilotIntent },
      }) });
      if (url.endsWith("/confirm")) {
        attempts++;
        if (attempts === 2) savedPilotIntent = JSON.parse(init!.body as string).pilotIntent;
        return attempts === 1 ? Promise.reject(new Error("interrupted save")) : Promise.resolve({ ok: true,
          json: async () => ({ disposition: "needs_conversation", stage: "description_received", nextAction: "Review the open questions", stillNeeded: [], beforeRecording: [] }) });
      }
      return fetcher(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit your answers" }));
    fireEvent.click(screen.getByText("Your recorded pilot preferences (optional corrections)"));
    expect(screen.getByRole("combobox", { name: /would you consider a physical pilot/ })).toHaveValue("subject_to_review");
    expect(screen.getByRole("combobox", { name: /what could happen next/ })).toHaveValue("multiple_sites");
    fireEvent.change(screen.getByRole("combobox", { name: /would you consider a physical pilot/ }), { target: { value: "evaluation_only" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Your name/ }), { target: { value: "Synthetic Operator" } });
    fireEvent.click(screen.getByRole("button", { name: "This is right — confirm it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach Blueprint/);
    expect(screen.getByRole("combobox", { name: /would you consider a physical pilot/ })).toHaveValue("evaluation_only");
    fireEvent.click(screen.getByRole("button", { name: "This is right — confirm it" }));
    await screen.findByRole("button", { name: "Edit your answers" });
    const posts = fetchMock.mock.calls.filter(call => String(call[0]).endsWith("/confirm"));
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[1][1]!.body as string).pilotIntent).toEqual({ pilotConsideration: "evaluation_only", deploymentPath: "multiple_sites" });
    first.unmount();
    render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit your answers" }));
    fireEvent.click(screen.getByText("Your recorded pilot preferences (optional corrections)"));
    expect(screen.getByRole("combobox", { name: /would you consider a physical pilot/ })).toHaveValue("evaluation_only");
    expect(screen.getByRole("combobox", { name: /what could happen next/ })).toHaveValue("multiple_sites");
    expect(videoUpload.send).not.toHaveBeenCalled();
  });

  it("clears the old brief and assessment when Back/Forward opens another private link", async () => {
    const fetcher = ownerFetch(false);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({
        status: { decision: "description_received", headline: "Previous private assessment", operatorAction: "Previous owner action" },
      }) });
      if (url.includes("second-token")) return Promise.resolve({ ok: false, json: async () => ({ error: "This link was withdrawn." }) });
      return fetcher(input, init);
    }));
    const { rerender } = render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    await screen.findByText("Previous private assessment");
    route.token = "second-token";
    rerender(<SelfCaptureUpload />);
    expect(screen.queryByText("Previous private assessment")).toBeNull();
    expect(screen.queryByText("Previous owner action")).toBeNull();
    expect(screen.queryByText("Your job brief is confirmed.")).toBeNull();
    await screen.findByText("This link was withdrawn.");
    expect(screen.queryByRole("button", { name: /Choose or record|Upload a video|Confirm recording permission/ })).toBeNull();
    route.token = TOKEN;
    rerender(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    expect(screen.queryByText("This link was withdrawn.")).toBeNull();
  });
  it.each(["", PHONE_UA])("opens video capture immediately when recording is allowed (%s)", async ua => {
    setUserAgent(ua);
    vi.stubGlobal("fetch", ownerFetch(false));
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("button", { name: ua ? "Choose or record a video" : "Upload a video file" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Your job summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add footage when you are ready (optional)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Confirm your job brief" })).not.toBeInTheDocument();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });
  it("foregrounds required recording permission and keeps its grant explicit", async () => {
    const fetcher = ownerFetch(true);
    vi.stubGlobal("fetch", fetcher);
    render(<SelfCaptureUpload />);
    const permission = await screen.findByRole("region", { name: "Confirm recording permission" });
    expect(permission.closest("details")).toBeNull();
    expect(permission).toHaveTextContent(/need your video to build the site simulation/);
    expect(screen.queryByRole("heading", { name: "Your job summary" })).not.toBeInTheDocument();
    // Said before the grant: people in the work area are told, and sound is not analysed.
    expect(screen.getByText(/Tell people in the work area that you are filming for Blueprint, and avoid filming conversations\. We remove sound before any automated review\./)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Confirm recording permission" });
    expect(button).toBeDisabled();
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
    // The box is labelled with exactly the sentence its version records.
    // Nothing to withdraw yet: no recording permission given and no video, so "Stop using my video" is not offered.
    expect(screen.queryByText("Stop using my video")).toBeNull();
    expect(screen.queryByText("Withdraw recording permission")).toBeNull();
    const box = screen.getByRole("checkbox", { name: RECORDING_RIGHTS_STATEMENT });
    expect(permission).toContainElement(box);
    expect(permission).not.toHaveTextContent(/robot teams/i);
    fireEvent.click(box);
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Upload a video file" });
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toContain("/recording-consent");
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ granted: true, statementVersion: "2026-11-02.v2" });
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });
  it("keeps owner corrections optional when a saved job has a coverage gap", async () => {
    const fetcher = ownerFetch(false);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true,
        json: async () => ({ captureReceived: true, status: { decision: "footage_received", headline: "Blueprint is preparing your reconstruction.", operatorAction: null, missingViews: ["pallet"] } }) });
      return fetcher(input);
    }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("Video received.")).toBeVisible();
    expect(screen.getByText("Update walkthrough (optional)").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Update walkthrough" })).not.toBeVisible();
    fireEvent.click(screen.getByText("Update walkthrough (optional)"));
    expect(screen.getByRole("button", { name: "Update walkthrough" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Upload a video file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload a new recording" })).not.toBeInTheDocument();
    expect(screen.getByText(/your job and original video stay saved/i)).toBeInTheDocument();
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add footage when you are ready (optional)" })).not.toBeInTheDocument();
  });
  it.each([{ missingViews: [] }, { missingViews: ["pallet"] }])("opens one primary same-job update with missing views $missingViews without sending another upload", async ({ missingViews }) => {
    const fallback = ownerFetch(false, true);
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true,
        json: async () => ({ captureReceived: true, status: { decision: missingViews.length ? "add_views" : "footage_received",
          headline: "Your video is saved.", operatorAction: null, missingViews } }) });
      if (String(input).endsWith("/supplement")) return Promise.resolve({ ok: true,
        json: async () => ({ ok: true, url: "/capture-upload/signed-same-job-update" }) });
      return fallback(input);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<SelfCaptureUpload />);
    await screen.findByText("Video received.");
    expect(screen.queryByRole("button", { name: "Upload a replacement walkthrough" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Update walkthrough (optional)"));
    fireEvent.click(screen.getByRole("button", { name: "Update walkthrough" }));
    await waitFor(() => expect(route.navigate).toHaveBeenCalledWith("/capture-upload/signed-same-job-update"));
    const call = fetcher.mock.calls.find(([input]) => String(input).endsWith("/supplement"))!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({ mode: "replacement", requestId: expect.any(String) });
    expect(videoUpload.send).not.toHaveBeenCalled();
  });
  it("keeps what to tell people in view and puts how to film one tap away", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1");
    vi.stubGlobal("fetch", ownerFetch(false));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(/^Tell people in the work area that you are filming for Blueprint/)).toBeVisible();
    const howTo = screen.getByText("How to film ›").closest("details")!;
    expect(howTo).not.toHaveAttribute("open");
    expect(screen.getByText(/^Move slowly and overlap your passes/)).not.toBeVisible();
  });
  it("lets the owner link withdraw recording permission after an explicit confirmation", async () => {
    const fetcher = ownerFetch(false);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === `/api/self-capture/uploads/${TOKEN}/withdrawal` && init?.method === "POST") return Promise.resolve({ ok: true,
        json: async () => ({ ok: true, created: true, withdrawal: { state: "uploads_stopped_cleanup_pending", deletionConfirmed: false,
          pipelineAcknowledged: false, legalHold: false, requestedAtIso: "2026-10-13T00:00:00.000Z",
          storageDeletion: { state: "pending", deletedObjectCount: 0, lateUploadCheckAtIso: null, completedAtIso: null } } }) });
      return fetcher(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/capture-upload/test");
    render(<SelfCaptureUpload />);
    // The way to stop is on the Job settings screen, one tap from the page.
    fireEvent.click(await screen.findByRole("button", { name: "Job settings ›" }));
    fireEvent.click(await screen.findByText("Stop using my video"));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw permission…" }));
    expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith("/withdrawal") && call[1]?.method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw permission" }));
    expect(await screen.findByText("Recording permission withdrawn.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(await screen.findByText("Recording permission was withdrawn. This link no longer accepts footage.")).toBeInTheDocument();
    // A withdrawn recording takes no footage on this link again, so "keep this link to upload" is not said.
    expect(screen.queryByText(/Keep this link/)).toBeNull();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });
});

describe("withdrawal is owner-only on the page", () => {
  it("does not offer withdrawal on a filming link", async () => {
    render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: /Upload a video file|Choose or record a video/ });
    expect(screen.queryByText("Withdraw recording permission")).not.toBeInTheDocument();
  });
});

describe("retained video processing recovery", () => {
  function retainedFetch(data: Record<string, unknown>) {
    return vi.fn((input: RequestInfo | URL) => String(input).endsWith(`/api/self-capture/uploads/${TOKEN}/status`)
      ? Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "ready", accepts: ["mov", "mp4"], ...data }) })
      : mockFetch()(input));
  }

  it.each(["", PHONE_UA])("restores a saved upload with automatic recovery and optional details (%s)", async (ua) => {
    setUserAgent(ua);
    vi.stubGlobal("fetch", retainedFetch({ captureReceived: true, uploadState: "processing_pending", processingRetryAvailable: true }));
    const first = render(<SelfCaptureUpload />);
    expect(await screen.findByText(/Blueprint will continue from this saved recording/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry processing" })).not.toBeVisible();
    expect(screen.getByLabelText("Processing details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Processing details (optional)"));
    expect(screen.getByText(/You do not need to upload or record it again/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Open the camera|Upload a video file|Choose or record/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /phone|device/i })).not.toBeInTheDocument();
    first.unmount(); render(<SelfCaptureUpload />);
    await screen.findByText(/Blueprint will continue from this saved recording/);
    expect(screen.getByRole("button", { name: "Retry processing" })).not.toBeVisible();
    expect(videoUpload.retry).not.toHaveBeenCalled();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });

  it("keeps a manual retry inside optional details and guards repeated clicks", async () => {
    vi.stubGlobal("fetch", retainedFetch({ captureReceived: true, uploadState: "processing_pending", processingRetryAvailable: true }));
    let complete!: (result: { status: "done" }) => void;
    videoUpload.retry.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<SelfCaptureUpload />);
    await screen.findByText(/Blueprint will continue from this saved recording/);
    fireEvent.click(screen.getByText("Processing details (optional)"));
    const button = screen.getByRole("button", { name: "Retry processing" });
    expect(videoUpload.retry).not.toHaveBeenCalled();
    fireEvent.click(button); fireEvent.click(button);
    expect(videoUpload.retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Retrying processing…" })).toBeDisabled();
    complete({ status: "done" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Retry.*processing/ })).not.toBeInTheDocument());
    expect(screen.getByText("Video received.")).toBeInTheDocument();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });

  it("shows a current authorization hold ahead of a retained pending receipt", async () => {
    vi.stubGlobal("fetch", retainedFetch({ state: "held", detail: "Current consent must be confirmed before processing.", captureReceived: true, uploadState: "processing_pending", processingRetryAvailable: true }));
    render(<SelfCaptureUpload />);
    await screen.findByText(/Current consent must be confirmed/);
    expect(screen.queryByRole("button", { name: "Retry processing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /phone/ })).not.toBeInTheDocument();
  });

  it("keeps an existing-file route out of the camera even before any upload", async () => {
    setUserAgent(PHONE_UA);
    window.history.replaceState(null, "", "/capture-upload/tok-e2e?video=existing");
    render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    expect(document.querySelector('input[type="file"]')).not.toHaveAttribute("capture");
    expect(screen.queryByRole("button", { name: "Open the camera" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ask someone else to film")).not.toBeInTheDocument();
    expect(screen.getByText("Open this job on another device (optional)").closest("details")).not.toHaveAttribute("open");
  });

  it.each([
    [false, "not_received", "Your job is saved."],
    [true, "processing_pending", "Your video is saved."],
  ])("does not imply footage checking before confirmed processing (%s)", async (captureReceived, uploadState, headline) => {
    window.history.replaceState(null, "", "/capture-upload/tok-e2e?video=existing");
    const read = retainedFetch({ captureReceived, uploadState, processingRetryAvailable: false });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).startsWith("/api/site-task-brief/") && String(input).endsWith("/status")
      ? Promise.resolve({ ok: true, json: async () => ({ captureReceived, status: {
        decision: captureReceived ? "confirm_brief" : "footage_received", headline: "We are checking your footage.", operatorAction: null, missingViews: [], nextUpdateIso: null,
      } }) }) : read(input)));
    render(<SelfCaptureUpload />);
    await screen.findByText(headline, { selector: "strong" });
    expect(screen.queryByText("We are checking your footage.")).not.toBeInTheDocument();
  });

  it("keeps the selected file for a metadata retry and guards repeated upload events", async () => {
    let complete!: (result: { status: "failed"; message: string }) => void;
    videoUpload.send.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
      .mockResolvedValueOnce({ status: "processing_pending", message: "Saved; processing pending.", processingRetryAvailable: false });
    render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    const file = new File(["video"], "original.mov", { type: "video/quicktime" });
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    expect(videoUpload.send).toHaveBeenCalledTimes(1);
    complete({ status: "failed", message: "This browser could not read the video. Keep the original." });
    fireEvent.click(await screen.findByRole("button", { name: "Try the selected video again" }));
    await screen.findByText(/Blueprint will continue from this saved recording/);
    fireEvent.click(screen.getByText("Processing details (optional)"));
    expect(screen.getByText(/Saved; processing pending/)).toBeVisible();
    expect(videoUpload.send.mock.calls[1][1]).toBe(file);
    expect(window.location.search).toBe("?video=existing");
    expect(screen.queryByText(/Nothing was saved/)).not.toBeInTheDocument();
  });

  it("does not apply an interrupted page's late upload result after navigating back", async () => {
    let complete!: (result: { status: "done" }) => void;
    videoUpload.send.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const first = render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["video"], "original.mov")] } });
    first.unmount(); render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    complete({ status: "done" });
    await waitFor(() => expect(screen.queryByText("Video received.")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Upload your existing video" })).toBeInTheDocument();
  });
});

describe("explicit assessment retry", () => {
  const jobId = `advisory-${"a".repeat(64)}`, runId = `site-assessment-${"b".repeat(64)}`;
  function retryFetch(options: { available?: boolean; scope?: string; state?: string; jobId?: string | null; post?: () => Promise<unknown> } = {}) {
    return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken: "synthetic-qa" }) });
      if (url.endsWith("/advisory-retry")) return options.post?.() ?? Promise.resolve({ ok: false, status: 409, json: async () => ({ error: "private provider detail" }) });
      if (url.includes("second-token")) return Promise.resolve({ ok: false, json: async () => ({ error: "This link was withdrawn." }) });
      if (url === `/api/self-capture/uploads/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"], captureReceived: true, uploadState: "processing_ready" }) });
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: options.scope ?? "owner", brief: { summary: "Pack cartons", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } }) });
      if (url === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({ scope: options.scope ?? "owner", captureReceived: true,
        status: { decision: "confirm_brief", headline: "Review your job brief.", operatorAction: null, missingViews: [] },
        siteAdvisory: { schemaVersion: "site_customer_advisory.v1", state: options.state ?? "needs_review", correlationId: "bp-advisory-aaaaaaaaaaaaaaaa", sections: [], unknowns: [], nextAction: null },
        assessment_retry_available: options.available, assessment_job_id: options.jobId === undefined ? jobId : options.jobId, assessment_run_id: runId,
      }) });
      return mockFetch()(input);
    });
  }
  it.each([
    { available: false }, {}, { available: true, scope: "film" },
    { available: true, state: "queued" }, { available: true, jobId: null },
  ])("does not offer an unauthorized or inapplicable retry %j", async options => {
    const read = retryFetch(options); vi.stubGlobal("fetch", read);
    render(<SelfCaptureUpload />);
    await screen.findByRole("heading", { name: "Your job", exact: true });
    expect(screen.queryByRole("button", { name: "Try assessment again" })).not.toBeInTheDocument();
    expect(read.mock.calls.some(call => String(call[0]).endsWith("/advisory-retry"))).toBe(false);
  });
  it("keeps the acknowledged video and brief through a current-source retry refusal", async () => {
    const read = retryFetch({ available: true }); vi.stubGlobal("fetch", read);
    render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByText("Processing details"));
    fireEvent.click(screen.getByRole("button", { name: "Try assessment again" }));
    await screen.findByText("The current assessment could not be retried. Your recording is saved. Check this page for the next step.");
    expect(screen.queryByText("private provider detail")).not.toBeInTheDocument();
    expect(await screen.findByText("Video received.")).toBeVisible();
    expect(screen.getByText("Reference: bp-advisory-aaaaaaaaaaaaaaaa")).toBeVisible();
    expect(screen.getByText("Processing details").closest("details")).toHaveAttribute("open");
    // The draft remains available without interrupting the job after refusal.
    expect(screen.getByText(CONFIRM_STEP)).toBeVisible();
    expect(screen.getByLabelText("Review your job brief")).not.toHaveAttribute("open");
    expect(read.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });
  it("ignores an old retry acknowledgement when another private link opens", async () => {
    let finish!: (value: unknown) => void;
    const read = retryFetch({ available: true, post: () => new Promise(resolve => { finish = resolve; }) });
    vi.stubGlobal("fetch", read);
    const { rerender } = render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByText("Processing details"));
    fireEvent.click(screen.getByRole("button", { name: "Try assessment again" }));
    await waitFor(() => expect(read.mock.calls.some(call => String(call[0]).endsWith("/advisory-retry"))).toBe(true));
    route.token = "second-token"; rerender(<SelfCaptureUpload />);
    await screen.findByText("This link was withdrawn.");
    finish({ ok: true, json: async () => ({ ok: true, state: "queued", job_id: jobId, run_id: "new-run" }) });
    await waitFor(() => expect(screen.queryByText(/Your assessment retry is recorded/)).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Try assessment again" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your video is saved and its job assessment is queued.")).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload by device", () => {
  it("shows a phone handoff and no camera on a desktop", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    );
    render(<SelfCaptureUpload />);

    expect(
      await screen.findByRole("heading", { name: "Point your phone at this." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload a video file" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/self-capture/uploads/${TOKEN}/status`);
    expect(fetch).not.toHaveBeenCalledWith(`/api/self-capture/uploads/${TOKEN}`);
    // The one thing a desktop must never offer: a webcam pointed at the operator.
    expect(screen.queryByRole("button", { name: "Open the camera" })).not.toBeInTheDocument();
  });

  it("shows the camera first on a phone", async () => {
    setUserAgent(PHONE_UA);
    // The recorder offers itself only where an mp4-capable MediaRecorder
    // exists; a phone browser has one, happy-dom does not.
    vi.stubGlobal("MediaRecorder", class {
      static isTypeSupported() {
        return true;
      }
    });
    render(<SelfCaptureUpload />);

    expect(await screen.findByRole("button", { name: "Open the camera" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Point your phone at this." }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy the link" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose or record a video" }),
    ).toBeInTheDocument();
  });
});

describe("SelfCaptureUpload after the phone has uploaded", () => {
  const DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

  it("shows the saved layout with the brief confirmation on a laptop, instead of the QR code", async () => {
    setUserAgent(DESKTOP_UA);
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/site-task-brief/") && url.endsWith("/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, captureReceived: true, status: {
          decision: "confirm_brief", headline: "We drafted your task brief.", operatorAction: "Review and confirm the brief.", missingViews: [], nextUpdateIso: null,
        } }) });
      }
      if (url.includes("/items")) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [{itemId:"dishes",label:"Dishes",basis:"suggested",imageCount:0,coverageStatus:"needs_images",imagesStillWanted:2,assetStatus:"pending"}], allItemsCovered: false, requestedShots: [] }) });
      }
      if (url.includes("/clarification?mode=assessment")) {
        return Promise.resolve({ ok: true, json: async () => ({ revision:"a".repeat(64),needed:true,questions:["What throughput is required?"],assessmentState:"ready" }) });
      }
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
          summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null,
        } }) });
      }
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "film" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SelfCaptureUpload />);

    // Reviewing the inferred brief is optional after the video is saved.
    const brief = await screen.findByLabelText("Review your job brief");
    expect(brief).not.toHaveAttribute("open");
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    // The site sends its video and nothing else: no follow-up questions, item photos or measurements.
    expect(screen.queryByText("What throughput is required?")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {name:"What would a good result look like?"})).not.toBeInTheDocument();
    expect(screen.queryByText("Add photos of the job items")).not.toBeInTheDocument();
    expect(screen.queryByText(/Add measurements/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => /\/(clarification|items|measurements|follow-up)\b/.test(url))).toEqual([]);
    expect(screen.getByRole("button", { name: "Update walkthrough" })).not.toBeVisible();
  });

  it("shows a held video's status on a return visit, and asks nothing", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/clarification?mode=assessment")) return Promise.resolve({ ok: true, json: async () => ({ revision:"a".repeat(64),needed:true,questions:["How much payload must the robot handle?"],assessmentState:"ready" }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
        summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null,
      } }) });
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({
        ok: true, state: "held", captureReceived: true, detail: "Review is still in progress.", accepts: ["mov", "mp4"],
      }) });
      if (url.startsWith("/api/site-task-brief/") && url.endsWith("/status")) return Promise.resolve({ ok: false, json: async () => ({}) });
      if (url.includes("/items")) return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "film" }) });
    }));
    render(<SelfCaptureUpload />);

    expect(await screen.findByText(/Review is still in progress/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    expect(screen.queryByText("How much payload must the robot handle?")).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload once robot teams have run", () => {
  const DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

  function mockFetchWithStatus(status: Record<string, unknown>, claimUrl: string | null, sceneViewUrl: string | null = null) {
    return vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" }),
        });
      }
      if (url.startsWith("/api/site-task-brief/") && url.endsWith("/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, status, claimUrl, sceneViewUrl }) });
      }
      if (url.includes("/items")) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "film" }) });
    });
  }

  const results = {
    decision: "results",
    headline: "Results are in from 2 screening runs. Best so far: 41 of 50 episodes.",
    operatorAction: "Review the results.",
    missingViews: [],
    nextUpdateIso: null,
  };

  it("keeps account saving optional when the private job already shows results", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, "http://localhost/claim/tok-claim"));
    render(<SelfCaptureUpload />);

    expect(await screen.findAllByText(/41 of 50 episodes/)).not.toHaveLength(0);
    const optional = screen.getByText("Save this job to an account (optional)");
    expect(optional.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Save this job to your account")).not.toBeVisible();
    expect(screen.queryByText(/claim your site to see the results/i)).not.toBeInTheDocument();
    fireEvent.click(optional);
    const link = screen.getByRole("link", { name: "Save this job to your account" });
    expect(link).toHaveAttribute("href", "http://localhost/claim/tok-claim");
  });

  it("does not require an account while Blueprint prepares a saved recording", async () => {
    setUserAgent(DESKTOP_UA);
    const waiting = { decision: "footage_received", headline: "We have your recording and are checking whether it covers the work area.", operatorAction: null, missingViews: [], nextUpdateIso: null };
    vi.stubGlobal("fetch", mockFetchWithStatus(waiting, "http://localhost/claim/tok-claim"));
    render(<SelfCaptureUpload />);

    const optional = await screen.findByText("Save this job to an account (optional)");
    expect(optional.closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByText(/Create and verify your site account before Blueprint builds the scene/)).not.toBeInTheDocument();
    fireEvent.click(optional);
    const link = screen.getByRole("link", { name: "Save this job to your account" });
    expect(link).toHaveAttribute("href", "http://localhost/claim/tok-claim");
    expect(link).toBeVisible();
  });

  it("offers no claim link when the server offered none", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, null));
    render(<SelfCaptureUpload />);

    expect(await screen.findAllByText(/41 of 50 episodes/)).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: /claim your site/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Save this job to an account (optional)")).not.toBeInTheDocument();
  });

  it("shows the owner-only persisted scene viewer returned by status", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, null, "https://viewer.example/world-1"));
    render(<SelfCaptureUpload />);

    const link = await screen.findByRole("link", { name: /view your scene/i });
    expect(link).toHaveAttribute("href", "https://viewer.example/world-1");
  });

  it("opens the scene directly while account saving stays optional", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus({ ...results, decision: "assessing",
      headline: "Preparing your task", operatorAction: null }, "/claim/scene-owner", "https://viewer.example/world-1"));
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("link", { name: "View your scene" })).toBeVisible();
    const optional = screen.getByText("Save this job to an account (optional)");
    expect(optional.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Save this job to your account")).not.toBeVisible();
    fireEvent.click(optional);
    expect(screen.getByRole("link", { name: "Save this job to your account" })).toHaveAttribute("href", "/claim/scene-owner");
    expect(screen.queryByText(/41 of 50 episodes/)).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload for a site that asked for a visit", () => {
  it("shows the ordinary film-it-yourself page, with no visit wording or switch (visits retired 2026-11-11)", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    );
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({ ready: false, scope: "owner" }) });
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        // Even if a status still offered the old switch, the page has no visit to offer.
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "ready", holdReason: null,
          accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z", selfCaptureSwitchAvailable: true }) });
      }
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);

    expect(await screen.findByRole("heading", { name: "Point your phone at this." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I'll film it myself instead" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Visits|Austin metro|someone to come/i)).not.toBeInTheDocument();
  });

  it("does not offer the switch unless the server does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        return Promise.resolve({ ok: true, json: async () => ({
          ok: true, state: "held", holdReason: "not_qualified", detail: "Something is in the way.",
          blockers: [], openQuestions: [], selfCaptureSwitchAvailable: false,
        }) });
      }
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("Something is in the way.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I'll film it myself instead" })).not.toBeInTheDocument();
  });
});

/**
 * Audit N1: robot teams can evaluate only a confirmed job (`teamJobAccess`), so
 * once footage is in, confirming the brief is a visible, required step on the
 * owner page, never a collapsed "optional" correction.
 */
describe("SelfCaptureUpload keeps an existing job's confirmation one click away during automatic evaluation", () => {
  const DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

  function ownerFetch(options: { captureReceived: boolean; confirmedAtIso: string | null }) {
    return vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"],
          expiresAt: "2099-01-01T00:00:00Z", ...(options.captureReceived ? { captureReceived: true, uploadState: "processing_ready" } : {}) }) });
      }
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, scope: "owner", captureReceived: options.captureReceived,
          status: options.confirmedAtIso
            ? { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null }
            : { decision: "confirm_brief", headline: "We have your recording. Next, confirm your job brief: we can evaluate your job only after you confirm it.",
              operatorAction: "Open your job brief, check the summary and answers, correct anything that is wrong, and confirm it.", missingViews: [], nextUpdateIso: null } }) });
      }
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
          summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: options.confirmedAtIso,
        } }) });
      }
      if (url.includes("/clarification?mode=assessment")) {
        return Promise.resolve({ ok: true, json: async () => ({ revision: "a".repeat(64), needed: false, questions: [], assessmentState: "queued" }) });
      }
      if (url.includes("/items")) return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "film" }) });
    });
  }

  it("keeps draft review collapsed while automatic evaluation continues", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", ownerFetch({ captureReceived: true, confirmedAtIso: null }));
    render(<SelfCaptureUpload />);

    const step = await screen.findByLabelText("Review your job brief");
    expect(step).not.toHaveAttribute("open");
    // Preparation continues from the recording; the existing job's one click is
    // the step that lets Blueprint run it, never worded as optional (2026-11-07).
    expect(step).toHaveTextContent(/Blueprint keeps preparing your job from the recording meanwhile, and runs it on the task you confirm/);
    expect(step.querySelector("summary")).toHaveTextContent(CONFIRM_STEP);
    expect(step.querySelector("summary")).not.toHaveTextContent(/optional/i);
    expect(screen.getByRole("button", { name: "This is right — confirm it" })).not.toBeVisible();
    fireEvent.click(screen.getByText(CONFIRM_STEP));
    expect(screen.getByRole("button", { name: "This is right — confirm it" })).toBeVisible();
    // The draft remains directly editable without claiming evaluation waits for it.
    expect(screen.queryByText("Correct job details (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText(/no confirmation is required|without confirming/i)).not.toBeInTheDocument();
  });

  it("offers an existing job's one click before anything is filmed", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", ownerFetch({ captureReceived: false, confirmedAtIso: null }));
    render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    const step = await screen.findByLabelText("Review your job brief");
    expect(step.querySelector("summary")).toHaveTextContent(CONFIRM_STEP);
    fireEvent.click(screen.getByText(CONFIRM_STEP));
    expect(screen.getByRole("button", { name: "This is right — confirm it" })).toBeVisible();
  });

  it("says a brief confirmed at submission was confirmed then, and never shows the submitter's job identity as a name", async () => {
    setUserAgent(DESKTOP_UA);
    const base = ownerFetch({ captureReceived: true, confirmedAtIso: "2026-11-07T14:00:00.000Z" });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).endsWith(`/api/site-task-brief/${TOKEN}`)
      ? Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
        summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [],
        confirmedAtIso: "2026-11-07T14:00:00.000Z", confirmedBy: "site-job-0123456789abcdef0123456789abcdef01234567",
        confirmedAtSubmission: true } }) })
      : base(input)));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(/You confirmed this task when you submitted it\./)).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM_STEP)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit your answers" }));
    expect(screen.getByText("Changing the task or what counts as success means confirming it again.")).toBeVisible();
    expect(screen.getByLabelText(/Your name/)).toHaveValue("");
    expect(screen.getByLabelText(/What is the job, in one sentence/)).toHaveValue("Cartons onto a pallet");
  });

  it("keeps a confirmed brief to one line with an edit link", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", ownerFetch({ captureReceived: true, confirmedAtIso: "2026-10-18T00:00:00Z" }));
    render(<SelfCaptureUpload />);

    expect(await screen.findByText(/Your job brief is confirmed\./)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Confirm your job brief" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit your answers" })).toBeInTheDocument();
  });

  it("keeps video ahead of brief confirmation before footage is received", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", ownerFetch({ captureReceived: false, confirmedAtIso: null }));
    render(<SelfCaptureUpload />);

    await screen.findByRole("button", { name: "Upload a video file" });
    expect(screen.queryByRole("heading", { name: "Your job summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Confirm your job brief" })).not.toBeInTheDocument();
    expect(screen.queryByText("Review and confirm your job brief")).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload for footage sent with no description", () => {
  it("collects the video without asking for a manual description or showing the placeholder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner",
        brief: { summary: "Your site task", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } }) });
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Upload a video file" });
    expect(screen.queryByText(/Describe the job in one sentence/)).not.toBeInTheDocument();
    expect(screen.queryByText("Your site task")).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload shows the current update without a generic waiting checklist", () => {
  function withStatus(decision: string) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision, headline: `Status for ${decision}.`, operatorAction: null, missingViews: [], nextUpdateIso: null } }) });
      return mockFetch()(input);
    }));
  }
  it.each([
    ["assessing", "We confirm the checks needed for your job and explain the next step. Timing depends on the evidence and compatible systems available."],
    ["awaiting_teams", "We are checking compatible options and delivery support. Your job page shows who needs to act next; we email you when there is an update."],
    ["received", "We usually reply within an hour."],
  ])("shows the current %s update without another timeline", async (decision, line) => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    withStatus(decision);
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(`Status for ${decision}.`)).toBeInTheDocument();
    expect(screen.queryByText(line)).not.toBeInTheDocument();
  });
  it("shows no wait for a step that is the site's own", async () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    withStatus("confirm_brief");
    render(<SelfCaptureUpload />);
    await screen.findByText("Status for confirm_brief.");
    expect(screen.queryByText(/We reply within|Building the simulation usually|Evaluations start once/)).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload once evaluations settle without a pass", () => {
  it.each(["no_team_passed", "no_qualified_evaluation"])("keeps settled results independent of optional account saving (%s)", async (decision) => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision, headline: "Evaluations on your job have finished.", operatorAction: null, missingViews: [], nextUpdateIso: null },
        claimUrl: "/claim/settled" }) });
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);
    const optional = await screen.findByText("Save this job to an account (optional)");
    expect(optional.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Save this job to your account")).not.toBeVisible();
    fireEvent.click(optional);
    expect(screen.getByRole("link", { name: "Save this job to your account" })).toHaveAttribute("href", "/claim/settled");
    expect(screen.queryByText(/before Blueprint builds the scene/)).not.toBeInTheDocument();
  });
});

/**
 * Owner decision 2026-10-18: footage waits for a saved job. Until the job is
 * saved to an account, its link is a status page whose next step is the account.
 */
describe("SelfCaptureUpload before the job is saved to an account", () => {
  const ACCOUNT_HOLD = "Save this job to your account before you send its video. We can evaluate a job only if its video is sent after the job is saved to an account.";
  function heldForAccount(scope: "owner" | "film") {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({
        ok: true, state: "held", holdReason: "site_account_required", detail: ACCOUNT_HOLD, blockers: [], openQuestions: [] }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision: "confirm_brief", headline: "Confirm your job brief.", operatorAction: null, missingViews: [], nextUpdateIso: null },
        claimUrl: scope === "owner" ? "/claim/owner-claim" : null }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope }) });
      return mockFetch()(input);
    }));
  }

  it("offers the owner the account as the way to send the video", async () => {
    heldForAccount("owner");
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(ACCOUNT_HOLD)).toBeInTheDocument();
    const create = await screen.findByRole("link", { name: "Create an account for this job" });
    expect(create).toHaveAttribute("href", "/claim/owner-claim");
    expect(screen.getByRole("link", { name: "Sign in to save this job" })).toHaveAttribute("href", "/claim/owner-claim?mode=signin");
    // One account step on the page, not a second generic claim link.
    expect(screen.queryByRole("link", { name: /Claim your site/ })).not.toBeInTheDocument();
  });

  it("tells someone filming for the owner that the owner saves it first", async () => {
    heldForAccount("film");
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(/The job's owner needs to save it to their Blueprint account before the video can be sent/)).toBeInTheDocument();
    expect(screen.queryByText(ACCOUNT_HOLD)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create an account for this job" })).not.toBeInTheDocument();
  });
});

/**
 * Owner decision 2026-10-18: a job whose video arrived before its account says
 * so, and its link never invites a second video that could not be used.
 */
describe("SelfCaptureUpload for a video that arrived before the job's account", () => {
  const ARRIVED = "Your video arrived before this job was saved to an account, so we can't use it to build your scene yet. Blueprint needs to review this older recording. You don't need to send it again.";
  function heldForArrival(claimUrl: string | null) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({
        ok: true, state: "held", holdReason: "footage_before_account", detail: ARRIVED, blockers: [], openQuestions: [] }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision: "footage_before_account", headline: ARRIVED, operatorAction: claimUrl ? "Save this job to your account." : null,
          missingViews: [], nextUpdateIso: null }, claimUrl }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope: "owner" }) });
      return mockFetch()(input);
    }));
  }

  it("offers an unsaved job the account, once, and no uploader", async () => {
    heldForArrival("/claim/owner-claim");
    render(<SelfCaptureUpload />);
    expect((await screen.findAllByText(ARRIVED)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "Create an account for this job" })).toHaveAttribute("href", "/claim/owner-claim");
    expect(screen.queryByRole("link", { name: /Claim your site/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload|Record/ })).not.toBeInTheDocument();
  });

  it("tells a saved job the same, with nothing to do", async () => {
    heldForArrival(null);
    render(<SelfCaptureUpload />);
    expect((await screen.findAllByText(ARRIVED)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Create an account for this job" })).not.toBeInTheDocument();
  });
});

describe("the site sends its video and nothing else", () => {
  it("asks the person filming for no measurements, item photos or follow-up answers", async () => {
    setUserAgent(PHONE_UA);
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("button", { name: "Choose or record a video" })).toBeInTheDocument();
    expect(screen.queryByText(/Add measurements/)).not.toBeInTheDocument();
    expect(screen.queryByText("Add photos of the job items")).not.toBeInTheDocument();
    expect(screen.queryByText(/printer paper/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => /\/(clarification|items|measurements|follow-up)\b/.test(url))).toEqual([]);
  });
});

describe("the robot readiness report on the owner's page", () => {
  const READINESS = { ok: true, summary: "Sort parcels", briefPath: "/readiness-brief/brief-token.signature",
    tracker: { steps: [{ id: "video", label: "Video received", state: "done", owner: "site" }], meanwhile: null },
    report: { robotFit: { needs: ["It has to pick the object up and put it down at another spot."], forms: [
      { id: "humanoid", label: "Walking humanoid", description: "", verdict: "fits", reasons: [] }], note: "A first read." },
      checklist: [], successFactors: [], safety: ["Blueprint's evaluation runs in a simulation of your site."], examples: [], examplesFootnote: "" } };
  function fetchFor(scope: "owner" | "film") {
    const fallback = mockFetch();
    return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false, scope }) });
      if (url.endsWith("/readiness")) return Promise.resolve({ ok: true, json: async () => READINESS });
      // Footage has arrived: the owner's page leaves description-first for the saved layout.
      if (url === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision: "processing", headline: "Your video arrived.", operatorAction: null, missingViews: [],
          nextUpdateIso: null }, captureReceived: true, claimUrl: null, sceneViewUrl: null }) });
      return fallback(input, init);
    });
  }

  it("shows the owner the shared report, folded, with the brief by its own link", async () => {
    setUserAgent(PHONE_UA);
    vi.stubGlobal("fetch", fetchFor("owner"));
    render(<SelfCaptureUpload />);
    const summary = await screen.findByText("Your robot readiness report · 1 kind of robot fits");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Print or save the brief" })).toHaveAttribute("href", READINESS.briefPath);
    expect(screen.queryByRole("heading", { name: "Your next steps" })).not.toBeInTheDocument();
  });

  it("never reads it on a film-only link", async () => {
    setUserAgent(PHONE_UA);
    const fetchMock = fetchFor("film");
    vi.stubGlobal("fetch", fetchMock);
    render(<SelfCaptureUpload />);
    expect((await screen.findAllByText("Your video arrived.")).length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/readiness"))).toBe(false);
    expect(screen.queryByText(/Your robot readiness report/)).not.toBeInTheDocument();
  });
});

describe("the site's answer leads its job page", () => {
  const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
  const robotFit = { route: "full", status: "completed", reason: null, counts: { fits: 1, fitsSpec: 0, doesntFit: 0, unknown: 0 },
    models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict: "fits", openChecks: [] }], modelsTruncated: false };
  const jobWorkflow = (managedEvidence: unknown[]) => ({ schemaVersion: "job_marketplace.v1", revision: "workflow-1", stage: "brief_agreed",
    requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null, installationBudget: null, ongoingBudget: null,
      currentProcessCost: null, targetStartDate: null },
    briefAgreed: true, optionsAssessed: false, reviewRequired: false, nextAction: "Blueprint is preparing your job.", actionOwner: "blueprint",
    review: null, managedEvidence });
  function answerFetch({ answer, scope = "owner", decision = "footage_received", confirmedAtIso = null, workflow = null,
    headline = "We have your recording.", operatorAction = null, outcome = null }: {
    answer: unknown; scope?: "owner" | "film"; decision?: string; confirmedAtIso?: string | null; workflow?: unknown;
    headline?: string; operatorAction?: string | null; outcome?: unknown;
  }) {
    return vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({
        ok: true, state: "open", accepts: ["mov", "mp4"], captureReceived: true, uploadState: "processing_ready" }) });
      if (url === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({
        scope, captureReceived: true, answer, robotFit,
        status: { decision, headline, operatorAction, outcome, missingViews: [], nextUpdateIso: null } }) });
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope, brief: {
        summary: "Move cartons from the end of the conveyor onto the pallet.", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso } }) });
      if (url.startsWith("/api/job-workflow/owner/")) return Promise.resolve(workflow
        ? { ok: true, json: async () => workflow } : { ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false }) });
    });
  }

  it("shows the answer under the title instead of the separate robot fit, with no status card repeating a wait", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: readyAnswer }));
    render(<SelfCaptureUpload />);
    const answer = await screen.findByRole("region", { name: "Your answer" });
    const title = screen.getByRole("heading", { level: 1, name: "Your job" });
    expect(title.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing is asked of the site, so the card does not speak as if the job were waiting.
    expect(screen.queryByText("We have your recording.")).toBeNull();
    expect(screen.getByText("UR10e")).toBeVisible();
    expect(screen.getByText("by Universal Robots")).toBeVisible();
    // The drafted job, in grey under the title, said as what we read.
    expect(screen.getByText("We read your job as: “Move cartons from the end of the conveyor onto the pallet.”")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Robot fit" })).toBeNull();
    // A settled answer is the update; no "will update" line under it.
    expect(screen.queryByText("Blueprint will update this job as the work progresses.")).toBeNull();
    // The brief no longer gates the answer: correcting it is a job setting.
    expect(screen.queryByText(CONFIRM_STEP)).toBeNull();
  });

  it("says where things stand once, in the answer's own headline, while the video is read and once it is settled", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: readingAnswer }));
    const { unmount } = render(<SelfCaptureUpload />);
    expect(await screen.findByText("We're watching your video.")).toBeVisible();
    // "We're watching your video." is the update: no status card or update line repeats it.
    expect(screen.queryByText("Blueprint will update this job as the work progresses.")).toBeNull();
    expect(screen.queryByText("We have your recording.")).toBeNull();
    expect(screen.queryByText("Video received.")).toBeNull();
    unmount();
    vi.stubGlobal("fetch", answerFetch({ answer: cannotAssessAnswer }));
    render(<SelfCaptureUpload />);
    // The server's reason, in plain words: the video did not show the job clearly enough to size it.
    expect(await screen.findByText("Your video didn't show the job clearly enough for us to measure it.")).toBeVisible();
    expect(screen.queryByText("Blueprint will update this job as the work progresses.")).toBeNull();
  });

  it.each([
    ["a new video is needed", { decision: "insufficient_evidence", headline: "We need a new video of the job.",
      outcome: { category: "insufficient_evidence", basis: "missing_evidence", title: "We need a new video of the job.",
        reason: "The video ends before the carton is put down.", scope: "The saved video.", nextStep: "Film the whole carry once more.",
        actionOwner: "site", evidence: [] } }],
    // Main's ask for a smaller video in the same job (`largeVideoRecaptureOutcome`): never hidden by an answer.
    ["the video was too large to process", { decision: "insufficient_evidence", headline: "We need a new video to build the simulation of your site",
      outcome: { category: "insufficient_evidence", basis: "missing_evidence", title: "We need a new video to build the simulation of your site",
        reason: "Your video is too large for us to process.",
        scope: "This is for the simulation of your site only. It is not a finding about any robot or about your site, and your answer stays on your job page.",
        nextStep: "Please film a shorter clip, or record at 1080p. Then send us the new video.",
        actionOwner: "site", evidence: [{ label: "Video size check", digest: `sha256:${"b".repeat(64)}` }] } }],
    ["the site has a step of its own", { decision: "save_account", headline: "Save this job to an account to continue." }],
    ["Blueprint names a step for the site", { decision: "processing_failure", headline: "Upload a longer video.", operatorAction: "Upload a longer video of the pallet." }],
    ["recording permission was withdrawn", { headline: "Your video is saved. Recording consent was withdrawn, so we can no longer review the video or show the scene preview." }],
    ["the job has ended", { decision: "ended", headline: "This job's work window has ended." }],
  ] as const)("keeps the status card under a settled answer when %s", async (_, card) => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: readyAnswer, ...card }));
    render(<SelfCaptureUpload />);
    const answer = await screen.findByRole("region", { name: "Your answer" });
    const headline = await screen.findByText(card.headline, { selector: "strong" });
    expect(headline).toBeVisible();
    // The site's own step comes first, and the answer's button stays, quiet, with its sentence: one filled button at most.
    expect(headline.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const find = screen.getByRole("button", { name: "Find a company to set it up" });
    expect(find).toHaveClass("bare-quiet-button");
    expect(screen.getByText(/^Shares a summary of your job and this answer, without saying who you are/)).toBeVisible();
  });

  it("puts every optional control on its own Job settings screen, and every detail on its own details screen, each with a way back", async () => {
    setUserAgent(DESKTOP_UA);
    window.history.replaceState(null, "", "/capture-upload/test");
    vi.stubGlobal("fetch", answerFetch({ answer: readyAnswer }));
    const { container } = render(<SelfCaptureUpload />);
    await screen.findByRole("region", { name: "Your answer" });
    // The answer screen: one filled button, two quiet links, one h1.
    expect([...container.querySelectorAll(".bare-button, .ms-button")].map(button => button.textContent)).toEqual(["Find a company to set it up"]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByText("Video received.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Job settings ›" }));
    expect(window.location.hash).toBe("#settings");
    expect(await screen.findByRole("heading", { level: 1, name: "Job settings" })).toBeVisible();
    const settings = screen.getByRole("list", { name: "Job settings" });
    expect(within(settings).getAllByRole("listitem").map(item => item.querySelector("summary, a, button")?.textContent)).toEqual([
      "Send a new video", "Change my job description", "Share settings", "Contact Blueprint about this job", "Stop using my video"]);
    expect(within(settings).getByText("Stop using my video").closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByRole("region", { name: "Your answer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    await screen.findByRole("region", { name: "Your answer" });
    // Details is a short menu; each row opens its own screen, and focus follows the screens both ways.
    const seeDetails = screen.getByRole("button", { name: "See details ›" });
    fireEvent.click(seeDetails);
    const menuTitle = await screen.findByRole("heading", { level: 1, name: "Details" });
    await waitFor(() => expect(document.activeElement).toBe(menuTitle));
    fireEvent.click(screen.getByRole("button", { name: "On paper: why this robot" }));
    expect(window.location.hash).toBe("#details/why");
    const whyTitle = await screen.findByRole("heading", { level: 1, name: "On paper: why this robot" });
    await waitFor(() => expect(document.activeElement).toBe(whyTitle));
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "On paper: why this robot" })));
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(await screen.findByRole("region", { name: "Your answer" })).toBeVisible();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "See details ›" })));
    window.history.replaceState(null, "", "/capture-upload/test");
  });

  it("says the job is shared without this answer when Share settings re-saved the card under the older box, and offers the button again", async () => {
    setUserAgent(DESKTOP_UA);
    window.history.replaceState(null, "", "/capture-upload/test");
    const base = answerFetch({ answer: { ...readyAnswer, introductionRequestedAtIso: "2026-11-10T09:00:00.000Z", jobCardListed: true } });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => String(input) === `/api/task-listings/owner/${TOKEN}`
      ? Promise.resolve({ ok: true, json: async () => ({ listing: { enabled: true, consentVersion: "public-task-card-v1" }, thumbnailPng: null }) })
      : base(input, init)));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("Your job is shared without this answer. Press the button to share the answer too.")).toBeVisible();
    expect(screen.queryByText(/✓ Shared/)).toBeNull();
    expect(screen.getByRole("button", { name: "Find a company to set it up" })).toBeVisible();
  });

  it("offers the owner's processing details, with its retry, from Job settings under an answer", async () => {
    setUserAgent(DESKTOP_UA);
    window.history.replaceState(null, "", "/capture-upload/test");
    const base = answerFetch({ answer: readyAnswer });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === `/api/site-task-brief/${TOKEN}/status`) return Promise.resolve({ ok: true, json: async () => ({
        scope: "owner", captureReceived: true, answer: readyAnswer, siteAdvisory: { schemaVersion: "site_customer_advisory.v1", state: "needs_review",
          correlationId: "ref-1", sections: [], unknowns: [], nextAction: "" },
        assessment_retry_available: true, assessment_job_id: "job-1", assessment_run_id: "run-1",
        status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, outcome: null, missingViews: [], nextUpdateIso: null } }) });
      return base(input, init);
    }));
    render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByRole("button", { name: "Job settings ›" }));
    fireEvent.click(await screen.findByText("Processing details"));
    expect(await screen.findByRole("button", { name: "Try assessment again" })).toBeVisible();
    window.history.replaceState(null, "", "/capture-upload/test");
  });

  it("offers the one thing a site can do about an answer that cannot be checked, next to the reason", async () => {
    setUserAgent(DESKTOP_UA);
    window.history.replaceState(null, "", "/capture-upload/test");
    // The video could not be sized: a new video, through the page's own update.
    const unsized = answerFetch({ answer: cannotAssessAnswer });
    vi.stubGlobal("fetch", unsized);
    const { unmount } = render(<SelfCaptureUpload />);
    expect(await screen.findByText("Your video didn't show the job clearly enough for us to measure it.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Send a new video" }));
    await waitFor(() => expect(unsized.mock.calls.some(([input]) => String(input).endsWith(`/api/self-capture/uploads/${TOKEN}/supplement`))).toBe(true));
    unmount();
    // Another kind of job: the job description, on the Job settings screen, opened.
    const other = { ...cannotAssessAnswer, reason: "From your video, the job looks like more than picking an object up and putting it down (folding), which we can't check robots against yet. If that is not right, edit the job description to say what the robot should do, and we will read the video again." };
    vi.stubGlobal("fetch", answerFetch({ answer: other }));
    render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByRole("button", { name: "Change my job description" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Job settings" })).toBeVisible();
    expect(document.getElementById("job-brief-editor")).toHaveAttribute("open");
    window.history.replaceState(null, "", "/capture-upload/test");
  });

  it("stops offering footage, edits and sharing once a withdrawal is read back, and keeps saying what withdrawal does", async () => {
    setUserAgent(DESKTOP_UA);
    const base = answerFetch({ answer: null, headline: "Your video is saved. Recording consent was withdrawn, so we can no longer review the video or show the scene preview." });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => String(input).endsWith(`/api/self-capture/uploads/${TOKEN}/withdrawal`)
      ? Promise.resolve({ ok: true, json: async () => ({ ok: true, withdrawn: true, withdrawal: { state: "withdrawn", requestedAtIso: "2026-11-11T16:00:00Z",
        pipelineAcknowledged: true, deletionConfirmed: false, legalHold: false,
        storageDeletion: { state: "pending", deletedObjectCount: 0, lateUploadCheckAtIso: null, completedAtIso: null } } }) })
      : base(input)));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("Recording permission withdrawn.")).toBeVisible();
    await waitFor(() => expect(screen.queryByText("Update walkthrough (optional)")).toBeNull());
    expect(screen.queryByText("Manage opportunity sharing (optional)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit your answers" })).toBeNull();
    expect(screen.getByText(/Withdrawal is not deletion/)).toBeVisible();
  });

  it("puts the proof in simulation inside the answer from the workspace's one workflow read", async () => {
    setUserAgent(DESKTOP_UA);
    const fetchMock = answerFetch({ answer: readyAnswer, workflow: jobWorkflow([winnerEvaluation]) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SelfCaptureUpload />);
    const answer = await screen.findByRole("region", { name: "Your answer" });
    // The test leads: the fixture's 7 of 10 against 3 of 10 is "ahead" under the probability rule, not "did best".
    expect(await within(answer).findByRole("heading", { level: 2, name: "Was ahead on your job" })).toBeVisible();
    expect(answer.querySelector(".bare-big")).toHaveTextContent(/^Franka arm \+ π0\.5$/);
    expect(screen.queryByRole("region", { name: "Tested in simulation" })).toBeNull();
    // The ranked list is the first details screen; the scene's line about the paper pick is on the paper screen.
    fireEvent.click(screen.getByRole("button", { name: "See details ›" }));
    fireEvent.click(await screen.findByRole("button", { name: "The simulation test" }));
    expect(await screen.findByRole("region", { name: "Ranked" })).toHaveTextContent("1. Franka arm + π0.5");
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    fireEvent.click(await screen.findByRole("button", { name: "On paper: why this robot" }));
    expect(await screen.findByText(/In the scene rebuilt from your video, the Universal Robots UR10e reaches/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    fireEvent.click(await screen.findByRole("button", { name: "‹ Back" }));
    window.history.replaceState(null, "", "/capture-upload/test");
    const reads = fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/job-workflow/owner/"));
    expect(reads).toHaveLength(1);
  });

  it("shows the proof on its own, where the folded block was, for an older job with evaluations and no answer", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: null, workflow: jobWorkflow([allZeroEvaluation]) }));
    render(<SelfCaptureUpload />);
    const proof = await screen.findByRole("region", { name: "Tested in simulation" });
    expect(screen.queryByRole("region", { name: "Your answer" })).toBeNull();
    expect(proof.closest("details")).toBeNull();
    // None of the AI robots finished: said in one line, with the ranked list behind it.
    expect(proof.textContent).toMatch(/None of the AI robots finished your job yet\./);
    // With no answer, the status card stays as it was.
    expect(screen.getByText("We have your recording.", { selector: "strong" })).toBeVisible();
  });

  it("says nothing more will update on an ended job", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: null, decision: "ended" }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("We have your recording.", { selector: "strong" })).toBeVisible();
    expect(screen.queryByText("Blueprint will update this job as the work progresses.")).toBeNull();
  });

  it("keeps the separate robot fit and the confirmation step when there is no answer, and never shows a malformed one", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: { ...readyAnswer, schemaVersion: "site_answer.v0" } }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("region", { name: "Robot fit" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Your answer" })).toBeNull();
    expect(screen.getByText(CONFIRM_STEP)).toBeInTheDocument();
    expect(screen.getByText("Blueprint will update this job as the work progresses.")).toBeVisible();
  });

  it("never shows the answer on a film-only link", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", answerFetch({ answer: readyAnswer, scope: "film" }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("We have your recording.", { selector: "strong" })).toBeVisible();
    expect(screen.queryByText(readyAnswer.headline)).toBeNull();
  });
});
