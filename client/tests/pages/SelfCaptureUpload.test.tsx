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
import { render, screen } from "@testing-library/react";
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
});
