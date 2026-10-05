/**
 * Sending one walkthrough video through a capture link.
 *
 * Two places do this: the capture page a site opens from its emailed link, and
 * the start form, when the operator already has the video. The link is the
 * credential in both, so both post to the same token route and get the same
 * privacy screen, manifest and marker on the server. One implementation, so a
 * second copy cannot drift into skipping a step.
 *
 * `XMLHttpRequest` rather than `fetch`, for one reason: a walkthrough is
 * hundreds of megabytes over a phone connection, and `fetch` cannot report
 * upload progress. A silent two-minute wait is how someone decides the page is
 * broken and closes it.
 */

/** What the server accepts. Mirrors `ALLOWED_EXTENSIONS` in the upload route. */
export const CAPTURE_VIDEO_EXTENSIONS = ["mov", "mp4"] as const;

/** For an `<input type="file" accept>`: the extensions plus their MIME types. */
export const CAPTURE_VIDEO_ACCEPT = ".mov,.mp4,video/quicktime,video/mp4";

export function isCaptureVideoFile(file: { name: string }): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (CAPTURE_VIDEO_EXTENSIONS as readonly string[]).includes(extension);
}

/** The signed token inside a `/capture-upload/<token>` link, or null. */
export function captureTokenFromUrl(captureUrl: string): string | null {
  const match = /\/capture-upload\/([^/?#]+)/.exec(captureUrl);
  return match ? decodeURIComponent(match[1]) : null;
}

export type VideoMetadata = {
  widthPx: number;
  heightPx: number;
  fps: number;
  durationSeconds: number;
  recordedAtEpochMs: number;
};

/**
 * Measure the video, rather than describe it.
 *
 * Width, height and duration come off the element once metadata loads. Frame
 * rate is the awkward one: no browser exposes it as a property, so it is
 * counted. `requestVideoFrameCallback` reports how many frames have actually
 * been presented and the media time they cover, and dividing one by the other
 * is a real measurement over a real sample.
 *
 * Where that API is missing, this returns null and the caller refuses the
 * upload. That is deliberate. The alternative is defaulting to 30 and writing
 * it into the capture record as an observation, and a number nobody measured
 * is worse than a failure somebody can see.
 */
export async function readVideoMetadata(file: File): Promise<VideoMetadata | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => resolve(ok);
      video.onloadedmetadata = () => done(true);
      video.onerror = () => done(false);
      // A file the browser cannot decode would otherwise hang here forever.
      setTimeout(() => done(false), 15_000);
    });

    if (!loaded || !video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
      return null;
    }

    const fps = await measureFps(video);
    if (!fps) return null;

    return {
      widthPx: video.videoWidth,
      heightPx: video.videoHeight,
      fps: Math.round(fps * 100) / 100,
      durationSeconds: video.duration,
      // What the phone recorded, when we can tell. `lastModified` is the file's
      // own timestamp rather than the moment it was uploaded.
      recordedAtEpochMs: file.lastModified || Date.now(),
    };
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void,
  ) => number;
};

function measureFps(video: HTMLVideoElement): Promise<number | null> {
  const withCallback = video as FrameCallbackVideo;
  if (typeof withCallback.requestVideoFrameCallback !== "function") {
    return Promise.resolve(null);
  }

  return new Promise<number | null>((resolve) => {
    let first: { mediaTime: number; presentedFrames: number } | null = null;
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      video.pause();
      resolve(value);
    };

    const onFrame = (_now: number, metadata: { mediaTime: number; presentedFrames: number }) => {
      if (!first) {
        first = metadata;
      } else {
        const elapsed = metadata.mediaTime - first.mediaTime;
        const frames = metadata.presentedFrames - first.presentedFrames;
        // Sample about a second of real playback before dividing; a couple of
        // frames is not enough to tell 24 from 30.
        if (elapsed >= 0.75 && frames > 0) {
          const fps = frames / elapsed;
          finish(Number.isFinite(fps) && fps > 0 && fps < 1000 ? fps : null);
          return;
        }
      }
      withCallback.requestVideoFrameCallback?.(onFrame);
    };

    withCallback.requestVideoFrameCallback?.(onFrame);
    void video.play().catch(() => finish(null));
    // Autoplay refused, a still frame, or a stalled decode all land here.
    setTimeout(() => finish(null), 8_000);
  });
}

export type VideoUploadResult =
  | { status: "done" }
  /**
   * The upload worked and what is in it needs a person.
   *
   * Distinct from `failed` because telling someone their upload failed when it
   * did not would send them off to re-film a video we already have.
   */
  | { status: "held"; message: string }
  | { status: "processing_pending"; message: string; processingRetryAvailable: boolean }
  | { status: "failed"; message: string };

/** Only storage-verified receipt may replace an upload with a saved layout. */
export function receivedVideoResult(data: Record<string, unknown> | null): VideoUploadResult | null {
  if (data?.captureReceived !== true) return null;
  if (data.state === "held") {
    return { status: "held", message: String(data.detail || data.message || data.error
      || "Your video is retained. Processing is on hold while authorization or review is resolved.") };
  }
  if (data.state === "processing_pending" || data.uploadState === "processing_pending") {
    return {
      status: "processing_pending",
      message: "Your video is saved. We could not confirm that processing started. You do not need to upload or record it again.",
      processingRetryAvailable: data.processingRetryAvailable === true,
    };
  }
  if (data.state === "processing_ready" || data.uploadState === "processing_ready") return { status: "done" };
  // Retained bytes with no execution proof must not imply processing started.
  return { status: "held", message: String(data.detail || data.message
    || "Your video is retained. We are checking its processing status.") };
}

async function reconcileUpload(token: string, message: string): Promise<VideoUploadResult> {
  try {
    // This endpoint is read-only. An uncertain upload never starts processing
    // merely because the browser checks whether its bytes arrived.
    const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
    const data = await response.json().catch(() => null);
    const received = receivedVideoResult(data);
    if (received) return received;
  } catch { /* Keep uncertainty explicit when receipt cannot be checked. */ }
  return { status: "failed", message: `${message} We could not confirm whether your video was received. Keep the original file and check this job page before sending it again.` };
}

/** Explicit retry of the retained receipt; the server rechecks current authority. */
export async function retrySelfCaptureProcessing(token: string): Promise<VideoUploadResult> {
  try {
    const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/processing-retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json().catch(() => null);
    const received = receivedVideoResult(data);
    if (received) return received;
    return reconcileUpload(token, String(data?.error || "We could not confirm that processing started."));
  } catch {
    return reconcileUpload(token, "The connection interrupted the processing retry.");
  }
}

/**
 * Measure the file, then post it to the token route with progress.
 *
 * Never rejects: every outcome is a result the caller can render, because the
 * callers are forms with a person waiting on them.
 */
export async function uploadSelfCaptureVideo(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<VideoUploadResult> {
  // The server cannot read these: it has no ffprobe, and the extractor
  // refuses a manifest without width, height and a frame rate. So they are
  // measured here, off the real file, and a failure to measure stops the
  // upload rather than shipping a guess that would ride along in the
  // capture record as though somebody had observed it.
  let metadata: VideoMetadata | null = null;
  try {
    metadata = await readVideoMetadata(file);
  } catch {
    // A browser without object URLs or video decoding is the same answer as a
    // file it cannot decode.
  }
  if (!metadata) {
    return {
      status: "failed",
      message:
        "This browser could not read the video's dimensions or frame rate. Keep your original video. Try selecting that file again or open this job page in another browser that can play it; you do not need to record it again.",
    };
  }

  // Metadata first, file second. Multer buffers the whole request either
  // way, but a streaming parser reaches the small field before the hundreds
  // of megabytes behind it, and nothing is gained by the other order.
  const body = new FormData();
  body.append("metadata", JSON.stringify(metadata));
  body.append("video", file);

  return new Promise<VideoUploadResult>((resolve) => {
    try {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);
      request.timeout = 15 * 60 * 1000;

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      });

      request.addEventListener("load", () => {
        let parsed: Record<string, unknown> | null = null;
        try { parsed = JSON.parse(request.responseText); } catch { /* Receipt remains unknown. */ }
        const received = receivedVideoResult(parsed);
        if (received) { resolve(received); return; }
        if (request.status >= 200 && request.status < 300) {
          // A 2xx is not automatically "done": the privacy screen answers with
          // a held state on a successful upload.
          void reconcileUpload(token, "The upload response did not confirm receipt.").then(resolve);
          return;
        }
        let message = "The upload did not finish. Try again.";
        try {
          message = String(parsed?.error || message);
        } catch {
          // Keep the generic message; the server said nothing we can quote.
        }
        void reconcileUpload(token, message).then(resolve);
      });

      request.addEventListener("error", () => {
        void reconcileUpload(token, "The upload connection dropped.").then(resolve);
      });

      for (const event of ["abort", "timeout"]) request.addEventListener(event, () => {
        void reconcileUpload(token, "The upload was interrupted.").then(resolve);
      });

      request.send(body);
    } catch {
      void reconcileUpload(token, "This browser could not send the video.").then(resolve);
    }
  });
}
