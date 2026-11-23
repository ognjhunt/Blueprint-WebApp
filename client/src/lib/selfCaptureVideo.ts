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
      || "Your original video is saved. No new video was accepted. Email hello@tryblueprint.io for help starting a new job.");
    if (data.uploadState === "processing_pending") return { status: "processing_pending", message,
      processingRetryAvailable: data.processingRetryAvailable === true };
    return { status: data.uploadState === "processing_ready" ? "done" : "held", message };
  }
  if (data.state === "held") {
    return { status: "held", message: String(data.detail || data.message || data.error
      || "Your video is saved, but we can't use it yet. This page shows when that changes.") };
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
    || "Your video is saved. We're checking it.") };
}

/**
 * After an upload or retry whose receipt is unknown. `serverSentence` is the server's own refusal, when it gave one: it
 * may carry the only step the site can take (reload the page, wait for another upload). The browser's own technical
 * reasons (a dropped connection, a response with no receipt) are not shown.
 */
async function reconcileUpload(token: string, serverSentence?: string): Promise<VideoUploadResult> {
  try {
    // This endpoint is read-only. An uncertain upload never starts processing
    // merely because the browser checks whether its bytes arrived.
    const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
    const data = await response.json().catch(() => null);
    const received = receivedVideoResult(data);
    if (received) return received;
  } catch { /* Keep uncertainty explicit when receipt cannot be checked. */ }
  return { status: "failed", message: `${serverSentence ? `${serverSentence} ` : ""}We couldn't confirm your video arrived. Keep the original file and check this page before you send it again.` };
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
    return reconcileUpload(token, typeof data?.error === "string" && data.error.trim() ? data.error.trim() : undefined);
  } catch {
    return reconcileUpload(token);
  }
}

/**
 * Post the original file to the token route with progress.
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
  // Send the original file immediately. The server measures its real streams;
  // browser codec support and frame callbacks are not upload prerequisites.
  const body = new FormData();
  body.append("video", file);
  const appCheckHeaders = await withAppCheckHeader();

  return new Promise<VideoUploadResult>((resolve) => {
    try {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);
      for (const [name, value] of Object.entries(appCheckHeaders)) request.setRequestHeader(name, value);
      // Matches the server's one-hour limit for this route (server/utils/requestBodyDeadline.ts).
      request.timeout = 60 * 60 * 1000;

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
          void reconcileUpload(token).then(resolve);
          return;
        }
        const serverSentence = typeof parsed?.error === "string" && parsed.error.trim() ? parsed.error.trim() : undefined;
        void reconcileUpload(token, serverSentence).then(resolve);
      });

      request.addEventListener("error", () => {
        void reconcileUpload(token).then(resolve);
      });

      for (const event of ["abort", "timeout"]) request.addEventListener(event, () => {
        void reconcileUpload(token).then(resolve);
      });

      request.send(body);
    } catch {
      void reconcileUpload(token).then(resolve);
    }
  });
}
