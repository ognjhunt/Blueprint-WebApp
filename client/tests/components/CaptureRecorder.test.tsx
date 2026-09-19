// @vitest-environment jsdom
/**
 * The recorded video's dimensions come from the camera track at record start.
 *
 * By the time the recording is completed the stream has been stopped, and on
 * iOS the preview element then reports 0x0. Sending that had the server refuse
 * every in-browser recording with "could not read this video's dimensions".
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CaptureRecorder } from "@/components/site/CaptureRecorder";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));

const fetchMock = vi.fn();

class FakeRecorder {
  static isTypeSupported() { return true; }
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.ondataavailable?.({ data: new Blob(["frames"]) });
    this.state = "inactive";
    this.onstop?.();
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/parts/complete")) return { ok: true, json: async () => ({ message: "Saved." }) };
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  const track = { getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }), stop: () => undefined };
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getVideoTracks: () => [track], getTracks: () => [track] }) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
});

afterEach(() => vi.unstubAllGlobals());

it("reports the camera track's dimensions even though the stopped preview reports none", async () => {
  render(<CaptureRecorder token="tok" checklist={[{ id: "a", label: "The conveyor" }]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Open the camera" }));
  fireEvent.click(await screen.findByRole("button", { name: "Start recording" }));
  await screen.findByText(/Show: The conveyor/);
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  await screen.findByText("Saved.", { selector: "h2" });

  const complete = fetchMock.mock.calls.find((call) => String(call[0]).includes("/parts/complete"))!;
  const { metadata } = JSON.parse(complete[1].body);
  expect(document.querySelector("video")!.videoWidth).toBe(0);
  expect(metadata).toMatchObject({ widthPx: 1920, heightPx: 1080, fps: 30 });
  expect(screen.queryByRole("alert")).toBeNull();
});
