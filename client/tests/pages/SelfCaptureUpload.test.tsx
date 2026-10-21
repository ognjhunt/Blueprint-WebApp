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
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SelfCaptureUpload from "@/pages/SelfCaptureUpload";

const route = vi.hoisted(() => ({ token: "tok-e2e" }));
vi.mock("wouter", () => ({ useRoute: () => [true, { token: route.token }] }));

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
  it("keeps optional account saving inside the post-video brief confirmation", async () => {
    const fetcher = ownerFetch(false, true);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input) === `/api/site-task-brief/${TOKEN}`
      ? Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", account: { claimed: false, email: "owner@example.test", claimToken: "synthetic-claim-token" },
        brief: { summary: "Pack cartons", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } }) })
      : fetcher(input)));
    render(<SelfCaptureUpload />);
    await screen.findByRole("region", { name: "Confirm your job brief" });
    expect(screen.queryByLabelText("Choose a password")).not.toBeInTheDocument();
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
    expect(permission).toHaveTextContent(/video is needed to build the site simulation/);
    expect(screen.queryByRole("heading", { name: "Your job summary" })).not.toBeInTheDocument();
    // Said before the grant: people in the work area are told, and sound is not analysed.
    expect(screen.getByText(/Tell people in the work area that you are filming for Blueprint, and avoid filming conversations\. We remove sound before any automated review\./)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Confirm recording permission" });
    expect(button).toBeDisabled();
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: /I am authorized to record this site/ }));
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Upload a video file" });
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toContain("/recording-consent");
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ granted: true, statementVersion: "2026-09-18.v1" });
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });
  it("keeps a measured coverage gap on the saved job and routes a new recording through support", async () => {
    const fetcher = ownerFetch(false);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true,
        json: async () => ({ captureReceived: true, status: { decision: "add_views", headline: "Add a view of the pallet.", operatorAction: "Film the pallet.", missingViews: ["pallet"] } }) });
      return fetcher(input);
    }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByText("Video received.")).toBeVisible();
    expect(screen.getByRole("link", { name: "contact Blueprint" })).toHaveAttribute("href", expect.stringContaining("mailto:hello@tryblueprint.io"));
    expect(screen.queryByRole("button", { name: "Upload a video file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload a new recording" })).not.toBeInTheDocument();
    expect(screen.getByText(/fresh recording permission/)).toBeInTheDocument();
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add footage when you are ready (optional)" })).not.toBeInTheDocument();
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
    render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByText("Withdraw recording permission"));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw permission…" }));
    expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith("/withdrawal") && call[1]?.method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw permission" }));
    expect(await screen.findByText("Recording permission withdrawn.")).toBeInTheDocument();
    expect(await screen.findByText("Recording permission was withdrawn. This link no longer accepts footage.")).toBeInTheDocument();
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

  it.each(["", PHONE_UA])("restores a processing failure on refresh without a camera or QR (%s)", async (ua) => {
    setUserAgent(ua);
    vi.stubGlobal("fetch", retainedFetch({ captureReceived: true, uploadState: "processing_pending", processingRetryAvailable: true }));
    const first = render(<SelfCaptureUpload />);
    expect(await screen.findByRole("button", { name: "Retry processing" })).toBeInTheDocument();
    expect(screen.getByText(/You do not need to upload or record it again/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open the camera|Upload a video file|Choose or record/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /phone|device/i })).not.toBeInTheDocument();
    first.unmount(); render(<SelfCaptureUpload />);
    await screen.findByRole("button", { name: "Retry processing" });
    expect(videoUpload.retry).not.toHaveBeenCalled();
    expect(videoUpload.send).not.toHaveBeenCalled();
  });

  it("requires an explicit retry, guards repeated clicks, and keeps the saved layout", async () => {
    vi.stubGlobal("fetch", retainedFetch({ captureReceived: true, uploadState: "processing_pending", processingRetryAvailable: true }));
    let complete!: (result: { status: "done" }) => void;
    videoUpload.retry.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<SelfCaptureUpload />);
    const button = await screen.findByRole("button", { name: "Retry processing" });
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
        decision: "footage_received", headline: "We are checking your footage.", operatorAction: null, missingViews: [], nextUpdateIso: null,
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
    await screen.findByText(/Saved; processing pending/);
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
    fireEvent.click(await screen.findByRole("button", { name: "Try assessment again" }));
    await screen.findByText("The current assessment could not be retried. Your recording is saved. Check this page for the next step.");
    expect(screen.queryByText("private provider detail")).not.toBeInTheDocument();
    expect(await screen.findByText("Video received.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your saved job" })).toBeVisible();
    expect(screen.getByText("Job reference: bp-advisory-aaaaaaaaaaaaaaaa")).toBeVisible();
    // The brief stays the site's open, required step through the refusal.
    expect(screen.getByRole("region", { name: "Confirm your job brief" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Confirm your job brief" }).closest("details")).toBeNull();
    expect(read.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    expect(videoUpload.send).not.toHaveBeenCalled();
    expect(videoUpload.retry).not.toHaveBeenCalled();
  });
  it("ignores an old retry acknowledgement when another private link opens", async () => {
    let finish!: (value: unknown) => void;
    const read = retryFetch({ available: true, post: () => new Promise(resolve => { finish = resolve; }) });
    vi.stubGlobal("fetch", read);
    const { rerender } = render(<SelfCaptureUpload />);
    fireEvent.click(await screen.findByRole("button", { name: "Try assessment again" }));
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

    // Teams evaluate only a confirmed job: the brief is open on the page.
    const brief = await screen.findByRole("region", { name: "Confirm your job brief" });
    expect(brief.closest("details")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    // The site sends its video and nothing else: no follow-up questions, item photos or measurements.
    expect(screen.queryByText("What throughput is required?")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {name:"What would a good result look like?"})).not.toBeInTheDocument();
    expect(screen.queryByText("Add photos of the job items")).not.toBeInTheDocument();
    expect(screen.queryByText(/Add measurements/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => /\/(clarification|items|measurements|follow-up)\b/.test(url))).toEqual([]);
    expect(screen.queryByRole("button", { name: "Add another video" })).not.toBeInTheDocument();
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

  it("offers the claim link when results exist and nobody owns the site", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, "http://localhost/claim/tok-claim"));
    render(<SelfCaptureUpload />);

    expect(await screen.findAllByText(/41 of 50 episodes/)).not.toHaveLength(0);
    const link = screen.getByRole("link", { name: /claim your site to see the results/i });
    expect(link).toHaveAttribute("href", "http://localhost/claim/tok-claim");
  });

  it("offers the claim as a way to follow the task before any results exist", async () => {
    setUserAgent(DESKTOP_UA);
    const waiting = { decision: "footage_received", headline: "We have your recording and are checking whether it covers the work area.", operatorAction: null, missingViews: [], nextUpdateIso: null };
    vi.stubGlobal("fetch", mockFetchWithStatus(waiting, "http://localhost/claim/tok-claim"));
    render(<SelfCaptureUpload />);

    const link = await screen.findByRole("link", { name: /claim your site to follow this job/i });
    expect(link).toHaveAttribute("href", "http://localhost/claim/tok-claim");
    expect(screen.getByText(/Create and verify your site account before Blueprint builds the scene/)).toBeInTheDocument();
  });

  it("offers no claim link when the server offered none", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, null));
    render(<SelfCaptureUpload />);

    expect(await screen.findAllByText(/41 of 50 episodes/)).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: /claim your site/i })).not.toBeInTheDocument();
  });

  it("shows the owner-only persisted scene viewer returned by status", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus(results, null, "https://viewer.example/world-1"));
    render(<SelfCaptureUpload />);

    const link = await screen.findByRole("link", { name: /view your scene/i });
    expect(link).toHaveAttribute("href", "https://viewer.example/world-1");
  });

  it("offers signup at the visual scene milestone before any robot evaluation", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", mockFetchWithStatus({ ...results, decision: "assessing",
      headline: "Preparing your task", operatorAction: null }, "/claim/scene-owner", "https://viewer.example/world-1"));
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("link", { name: "Save your scene and follow progress" }))
      .toHaveAttribute("href", "/claim/scene-owner");
    expect(screen.getByRole("link", { name: "View your scene" })).toBeInTheDocument();
    expect(screen.queryByText(/41 of 50 episodes/)).not.toBeInTheDocument();
  });
});

describe("SelfCaptureUpload for a site that asked for a visit", () => {
  it.each([false, true])("offers self-recording while preserving any required recording permission (%s)", async (needsConsent) => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    );
    const calls: Array<{ url: string; method: string }> = [];
    let switched = false;
    const ready = { ok: true, state: needsConsent ? "held" : "ready", recordingConsentAvailable: needsConsent,
      holdReason: needsConsent ? "recording_consent_required" : null, detail: "Confirm recording permission.",
      accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === `/api/site-task-brief/${TOKEN}`) return Promise.resolve({ ok: true, json: async () => ({ ready: false, scope: "owner" }) });
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/self-capture`)) {
        switched = true;
        return Promise.resolve({ ok: true, json: async () => ({ ...ready, switched: true }) });
      }
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/status`)) {
        if (switched) return Promise.resolve({ ok: true, json: async () => ready });
        return Promise.resolve({ ok: true, json: async () => ({
          ok: true, state: "held", holdReason: "capturer_visit_scheduled",
          detail: "This site is set up for a capturer visit rather than a self-recorded walkthrough.",
          blockers: [], openQuestions: [], selfCaptureSwitchAvailable: true,
        }) });
      }
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);

    const button = await screen.findByRole("button", { name: "I'll film it myself instead" });
    expect(screen.getByText(/Visits are booked by hand, so they take longer/)).toBeInTheDocument();
    // The rule's internal wording is replaced by the offer, not shown beside it.
    expect(screen.queryByText(/set up for a capturer visit/)).not.toBeInTheDocument();
    fireEvent.click(button);

    if (needsConsent) {
      expect(await screen.findByRole("region", { name: "Confirm recording permission" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Confirm recording permission" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Upload a video file" })).not.toBeInTheDocument();
    } else {
      expect(await screen.findByRole("heading", { name: "Point your phone at this." })).toBeInTheDocument();
    }
    expect(calls).toContainEqual({ url: `/api/self-capture/uploads/${TOKEN}/self-capture`, method: "POST" });
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
describe("SelfCaptureUpload asks for the brief confirmation teams need", () => {
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
            : { decision: "confirm_brief", headline: "We have your recording. Next, confirm your job brief: robot teams can evaluate your job only after you confirm it.",
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

  it("shows an unconfirmed brief as an open, required step once footage is in", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", ownerFetch({ captureReceived: true, confirmedAtIso: null }));
    render(<SelfCaptureUpload />);

    const step = await screen.findByRole("region", { name: "Confirm your job brief" });
    expect(step.closest("details")).toBeNull();
    expect(step).toHaveTextContent(/robot teams can evaluate your job only after you confirm/i);
    // The confirm control is on the page, with nothing to open first.
    expect(screen.getByRole("button", { name: "This is right — confirm it" })).toBeVisible();
    // The brief, never the job card's own optional extras, is what must not read as optional.
    expect(screen.queryByText("Correct job details (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText(/no confirmation is required|without confirming/i)).not.toBeInTheDocument();
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

describe("SelfCaptureUpload says how long a waiting stage takes", () => {
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
    ["received", "We reply within two business days."],
  ])("shows the expected wait while %s", async (decision, line) => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    withStatus(decision);
    render(<SelfCaptureUpload />);
    expect(await screen.findByText(line)).toBeInTheDocument();
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
  it.each(["no_team_passed", "no_qualified_evaluation"])("offers the claim as the way to see the runs (%s)", async (decision) => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/site-task-brief/${TOKEN}/status`)) return Promise.resolve({ ok: true, json: async () => ({ ok: true,
        status: { decision, headline: "Evaluations on your job have finished.", operatorAction: null, missingViews: [], nextUpdateIso: null },
        claimUrl: "/claim/settled" }) });
      return mockFetch()(input);
    }));
    render(<SelfCaptureUpload />);
    expect(await screen.findByRole("link", { name: "Claim your site to see the results" })).toHaveAttribute("href", "/claim/settled");
    expect(screen.queryByText(/before Blueprint builds the scene/)).not.toBeInTheDocument();
  });
});

/**
 * Owner decision 2026-10-18: footage waits for a saved job. Until the job is
 * saved to an account, its link is a status page whose next step is the account.
 */
describe("SelfCaptureUpload before the job is saved to an account", () => {
  const ACCOUNT_HOLD = "Save this job to your account before you send its video. Robot teams can evaluate a job only if its video is sent after the job is saved to an account.";
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
  const ARRIVED = "Your video arrived before this job was saved to an account, so we can't use it to build your scene yet. You don't need to send it again; we email you when that changes.";
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
