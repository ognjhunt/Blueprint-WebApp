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
  | { status: "failed"; message: string };

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
        "We could not read this video. Record it in your phone's camera app and pick it from your library, rather than using a link or a screen recording.",
    };
  }

  // Metadata first, file second. Multer buffers the whole request either
  // way, but a streaming parser reaches the small field before the hundreds
  // of megabytes behind it, and nothing is gained by the other order.
  const body = new FormData();
  body.append("metadata", JSON.stringify(metadata));
  body.append("video", file);

  return new Promise<VideoUploadResult>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        // A 2xx is not automatically "done": the privacy screen answers with
        // a held state on a successful upload.
        let parsed: { state?: string; message?: string } = {};
        try {
          parsed = JSON.parse(request.responseText) || {};
        } catch {
          // No body we can read means the plain success it has always been.
        }
        if (parsed.state === "held") {
          resolve({
            status: "held",
            message:
              parsed.message
              || "Your video reached us. Someone is looking at it before anything is processed.",
          });
          return;
        }
        resolve({ status: "done" });
        return;
      }
      let message = "The upload did not finish. Try again.";
      try {
        message = JSON.parse(request.responseText)?.error || message;
      } catch {
        // Keep the generic message; the server said nothing we can quote.
      }
      resolve({ status: "failed", message });
    });

    request.addEventListener("error", () => {
      resolve({ status: "failed", message: "The connection dropped before the video finished." });
    });

    request.send(body);
  });
}
