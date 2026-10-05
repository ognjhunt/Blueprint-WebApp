import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { receivedVideoResult, retrySelfCaptureProcessing, uploadSelfCaptureVideo } from "@/lib/selfCaptureVideo";

const token = "synthetic-upload-token";
const pending = { captureReceived: true, state: "processing_pending", processingRetryAvailable: true };
const xhrOutcome = { status: 502, body: pending as Record<string, unknown>, event: "load" };

class UploadRequest extends EventTarget {
  upload = new EventTarget();
  status = xhrOutcome.status;
  responseText = JSON.stringify(xhrOutcome.body);
  timeout = 0;
  open = vi.fn();
  send = vi.fn(() => queueMicrotask(() => this.dispatchEvent(new Event(xhrOutcome.event))));
}

beforeEach(() => {
  vi.useFakeTimers();
  xhrOutcome.status = 502; xhrOutcome.body = pending; xhrOutcome.event = "load";
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, state: "ready", uploadState: "processing_pending", ...pending }) }));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((name: string, ...args: unknown[]) => {
    if (name !== "video") return originalCreateElement(name, ...args as []);
    let frame = 0;
    return {
      videoWidth: 1920, videoHeight: 1080, duration: 10,
      set onloadedmetadata(callback: () => void) { queueMicrotask(callback); },
      requestVideoFrameCallback(callback: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void) {
        callback(0, { mediaTime: frame, presentedFrames: 1 + frame++ * 30 }); return frame;
      },
      play: () => Promise.resolve(), pause: () => undefined,
    } as unknown as HTMLVideoElement;
  }) as typeof document.createElement);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("verified receipt versus processing", () => {
  it("does not interpret an unsupported retained claim as receipt", () => {
    expect(receivedVideoResult({ state: "processing_pending", processingRetryAvailable: true })).toBeNull();
    expect(receivedVideoResult({ ok: true })).toBeNull();
  });

  it("preserves a current authorization hold even when a pending receipt exists", () => {
    expect(receivedVideoResult({ ...pending, state: "held", uploadState: "processing_pending", detail: "Consent is on hold." }))
      .toEqual({ status: "held", message: "Consent is on hold." });
  });

  it("handles non-2xx storage proof without asking for another upload", async () => {
    expect(await uploadSelfCaptureVideo(token, new File(["synthetic"], "original.mov")))
      .toMatchObject({ status: "processing_pending", processingRetryAvailable: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["error", "abort", "timeout"])("checks receipt with GET only after %s", async (event) => {
    xhrOutcome.event = event;
    expect(await uploadSelfCaptureVideo(token, new File(["synthetic"], "original.mp4")))
      .toMatchObject({ status: "processing_pending" });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/self-capture/uploads/${token}`);
  });

  it("keeps receipt uncertainty explicit when an interrupted upload cannot be checked", async () => {
    xhrOutcome.event = "error";
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const outcome = await uploadSelfCaptureVideo(token, new File(["synthetic"], "original.mov"));
    expect(outcome.status).toBe("failed");
    expect("message" in outcome && outcome.message).toMatch(/could not confirm whether your video was received/);
    expect("message" in outcome && outcome.message).not.toMatch(/Nothing was saved|Nothing was lost/);
  });

  it("does not treat a bare 2xx response as proof of receipt", async () => {
    xhrOutcome.status = 201; xhrOutcome.body = { ok: true };
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    expect((await uploadSelfCaptureVideo(token, new File(["synthetic"], "original.mp4"))).status).toBe("failed");
  });

  it("makes a processing retry explicit and never reuploads file bytes", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ captureReceived: true, state: "processing_ready" }) } as Response);
    expect(await retrySelfCaptureProcessing(token)).toEqual({ status: "done" });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/self-capture/uploads/${token}/processing-retry`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
  });

  it("rechecks current consent after a retry is refused", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ state: "held", error: "Consent changed." }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ captureReceived: true, state: "held", detail: "Consent changed." }) } as Response);
    expect(await retrySelfCaptureProcessing(token)).toEqual({ status: "held", message: "Consent changed." });
    expect(fetch).toHaveBeenLastCalledWith(`/api/self-capture/uploads/${token}`);
  });
});
