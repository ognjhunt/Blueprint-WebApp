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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SelfCaptureUpload from "@/pages/SelfCaptureUpload";

vi.mock("wouter", () => ({
  useRoute: () => [true, { token: "tok-e2e" }],
}));

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
    if (url.includes(`/api/self-capture/uploads/${TOKEN}`)) {
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
    if (url.includes("/status")) {
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }
    if (url.includes("/items")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false }) });
  });
}

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

beforeEach(() => {
  videoUpload.send.mockReset();
  videoUpload.retry.mockReset();
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUserAgent("");
  window.history.replaceState(null, "", "/");
});

describe("retained video processing recovery", () => {
  function retainedFetch(data: Record<string, unknown>) {
    return vi.fn((input: RequestInfo | URL) => String(input).endsWith(`/api/self-capture/uploads/${TOKEN}`)
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
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).endsWith("/status")
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

  it("shows the saved layout with the brief open on a laptop, instead of the QR code", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, captureReceived: true, status: {
          decision: "confirm_brief", headline: "We drafted your task brief.", operatorAction: "Review and confirm the brief.", missingViews: [], nextUpdateIso: null,
        } }) });
      }
      if (url.includes("/items")) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      }
      if (url.includes("/follow-up")) {
        return Promise.resolve({ ok: true, json: async () => ({ questions: [
          { id: "success_target", question: "What would a good result look like?", hint: "An estimate is fine." },
        ] }) });
      }
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
          summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null,
        } }) });
      }
      if (url.includes(`/api/self-capture/uploads/${TOKEN}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false }) });
    }));
    render(<SelfCaptureUpload />);

    await screen.findByRole("heading", { name: "A few details about the job" });
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "What would a good result look like?" })).toBeInTheDocument();
    const details = screen.getByText("Next: check your job brief").closest("details")!;
    expect(details.open).toBe(true);
    expect(screen.queryByRole("button", { name: "Add another video" })).not.toBeInTheDocument();
  });

  it("shows questions on a return visit while the received video remains held", async () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/follow-up")) return Promise.resolve({ ok: true, json: async () => ({ questions: [
        { id: "item_weight", question: "About how much do the handled items weigh?", hint: "A range is fine." },
      ] }) });
      if (url.endsWith(`/api/site-task-brief/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({ ready: true, scope: "owner", brief: {
        summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null,
      } }) });
      if (url.includes(`/api/self-capture/uploads/${TOKEN}`)) return Promise.resolve({ ok: true, json: async () => ({
        ok: true, state: "held", captureReceived: true, detail: "Review is still in progress.", accepts: ["mov", "mp4"],
      }) });
      if (url.includes("/status")) return Promise.resolve({ ok: false, json: async () => ({}) });
      if (url.includes("/items")) return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false }) });
    }));
    render(<SelfCaptureUpload />);

    expect(await screen.findByRole("heading", { name: "About how much do the handled items weigh?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    expect(screen.getByText(/Review is still in progress/)).toBeInTheDocument();
  });
});

describe("SelfCaptureUpload once robot teams have run", () => {
  const DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

  function mockFetchWithStatus(status: Record<string, unknown>, claimUrl: string | null, sceneViewUrl: string | null = null) {
    return vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(`/api/self-capture/uploads/${TOKEN}`)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" }),
        });
      }
      if (url.includes("/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, status, claimUrl, sceneViewUrl }) });
      }
      if (url.includes("/items")) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [], allItemsCovered: false, requestedShots: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, ready: false }) });
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
  it("offers to film it themselves and opens the recorder when they do", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    );
    const calls: Array<{ url: string; method: string }> = [];
    let switched = false;
    const ready = { ok: true, state: "ready", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}/self-capture`)) {
        switched = true;
        return Promise.resolve({ ok: true, json: async () => ({ ...ready, switched: true }) });
      }
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}`)) {
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

    expect(await screen.findByRole("heading", { name: "Point your phone at this." })).toBeInTheDocument();
    expect(calls).toContainEqual({ url: `/api/self-capture/uploads/${TOKEN}/self-capture`, method: "POST" });
  });

  it("does not offer the switch unless the server does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/self-capture/uploads/${TOKEN}`)) {
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
