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
import { fireEvent, render, screen } from "@testing-library/react";
import SelfCaptureUpload from "@/pages/SelfCaptureUpload";

vi.mock("wouter", () => ({
  useRoute: () => [true, { token: "tok-e2e" }],
}));

const TOKEN = "tok-e2e";

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
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUserAgent("");
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

    await screen.findByRole("heading", { name: "Your capture is saved" });
    expect(screen.queryByRole("heading", { name: "Point your phone at this." })).not.toBeInTheDocument();
    expect(screen.getByText(/One thing left for you: check the task brief below/)).toBeInTheDocument();
    const details = screen.getByText("Next: check your task brief").closest("details")!;
    expect(details.open).toBe(true);
    expect(screen.getByRole("button", { name: "Add another video" })).toBeInTheDocument();
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

    const link = await screen.findByRole("link", { name: /claim your site to follow this task/i });
    expect(link).toHaveAttribute("href", "http://localhost/claim/tok-claim");
    expect(screen.getByText(/Optional\. This link keeps working/)).toBeInTheDocument();
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
