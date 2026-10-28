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

import { withAppCheckHeader } from "./appCheck";

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

/**
 * What this browser happened to read about the video. Every field is optional.
 *
 * Only a hint: the server reads the file's own container header, and the
 * pipeline measures the video it decodes. A browser that cannot play the file
 * (an iPhone HEVC `.MOV` in Chrome on Windows or Android, for one) sends
 * nothing here and the upload goes ahead anyway.
 */
export type VideoMetadataHint = {
  widthPx?: number;
  heightPx?: number;
  durationSeconds?: number;
  recordedAtEpochMs?: number;
};

/**
 * Read width, height and duration off a `<video>` element, if it will load.
 *
 * Frame rate is not read here at all: no browser exposes it, and counting
 * played frames needs a file the browser can decode. The server reads it from
 * the container header instead.
 *
 * Resolves to whatever was readable, `{}` at worst, and never rejects. Nothing
 * is defaulted: a field the browser could not read is left out.
 */
export async function readVideoMetadata(file: File): Promise<VideoMetadataHint> {
  const hint: VideoMetadataHint = {};
  // The file's own timestamp rather than the moment it was uploaded.
  if (Number.isFinite(file.lastModified) && file.lastModified > 0) hint.recordedAtEpochMs = file.lastModified;

  let url: string | null = null;
  const video = document.createElement("video");
  try {
    url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const loaded = await new Promise<boolean>((resolve) => {
      video.onloadedmetadata = () => resolve(true);
      video.onerror = () => resolve(false);
      // A file the browser cannot decode can hang here; the upload must not.
      setTimeout(() => resolve(false), 5_000);
    });
    if (loaded) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        hint.widthPx = video.videoWidth;
        hint.heightPx = video.videoHeight;
      }
      if (Number.isFinite(video.duration) && video.duration > 0) hint.durationSeconds = video.duration;
    }
  } catch {
    // No object URLs or no video element: the hint stays as it is.
  } finally {
    video.src = "";
    if (url) URL.revokeObjectURL(url);
  }
  return hint;
}

export type VideoUploadResult =
  | { status: "done"; message?: string }
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
  if (data.code === "capture_replacement_requires_new_job") {
    const message = String(data.message || data.detail || data.error
      || "Your original recording is saved. No new recording was accepted. Contact Blueprint for help starting a new job.");
    if (data.uploadState === "processing_pending") return { status: "processing_pending", message,
      processingRetryAvailable: data.processingRetryAvailable === true };
    return { status: data.uploadState === "processing_ready" ? "done" : "held", message };
  }
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
 * Post the file to the token route with progress, plus whatever the browser
 * could read about it.
 *
 * Never rejects: every outcome is a result the caller can render, because the
 * callers are forms with a person waiting on them. A browser that cannot read
 * the video still sends it; the server and the pipeline measure the file.
 */
export async function uploadSelfCaptureVideo(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<VideoUploadResult> {
  const metadata = await readVideoMetadata(file).catch((): VideoMetadataHint => ({}));

  // Metadata first, file second. Multer buffers the whole request either
  // way, but a streaming parser reaches the small field before the hundreds
  // of megabytes behind it, and nothing is gained by the other order.
  const body = new FormData();
  if (Object.keys(metadata).length) body.append("metadata", JSON.stringify(metadata));
  body.append("video", file);
  const appCheckHeaders = await withAppCheckHeader();

  return new Promise<VideoUploadResult>((resolve) => {
    try {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);
      for (const [name, value] of Object.entries(appCheckHeaders)) request.setRequestHeader(name, value);
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
