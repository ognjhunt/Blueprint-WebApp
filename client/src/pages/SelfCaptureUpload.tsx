/**
 * The page a site employee opens from a link in an email.
 *
 * They have no account, no app, and no reason to trust a long form. The link is
 * the credential and the video is the payload, so this page is deliberately one
 * screen: what to film, a file picker, and a progress bar.
 *
 * It says nothing about the site, the buyer, or the request. The API behind it
 * is careful not to leak who a customer is to anyone holding a forwarded link,
 * and a page that undid that by rendering the company name would make the
 * restraint pointless.
 *
 * `XMLHttpRequest` rather than `fetch`, for one reason: a walkthrough is
 * hundreds of megabytes over a phone connection, and `fetch` cannot report
 * upload progress. A silent two-minute wait is how someone decides the page is
 * broken and closes it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";

import { Helmet } from "@/lib/helmet";

type LinkState =
  | { status: "checking" }
  | { status: "valid"; accepts: string[]; expiresAt: string }
  /**
   * A real link for a submission that cannot be recorded against yet.
   *
   * Distinct from `invalid` on purpose. An invalid link is a dead end and says
   * so; a held one is the site's own submission with something specific in the
   * way, and the difference matters because the second one becomes an upload
   * page on its own the moment that thing resolves.
   */
  | { status: "held"; detail: string; blockers: string[]; openQuestions: string[] }
  | { status: "invalid"; message: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "done" }
  | { status: "failed"; message: string };

type VideoMetadata = {
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
async function readVideoMetadata(file: File): Promise<VideoMetadata | null> {
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

const FILM_STEPS = [
  "Stand where someone doing the job would stand, and start recording.",
  "Walk one slow lap around the work area — all the way around if you can.",
  "Keep the things that get handled in frame: the items, the surfaces, the machine.",
  "About 45 seconds is plenty. Steady beats thorough.",
];

export default function SelfCaptureUpload() {
  const [, params] = useRoute("/capture-upload/:token");
  const token = params?.token ?? "";

  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLink({ status: "invalid", message: "This link is missing its code." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !data?.ok) {
          setLink({
            status: "invalid",
            message: data?.error || "This upload link is not valid or has expired.",
          });
          return;
        }

        if (data.state === "held") {
          setLink({
            status: "held",
            detail: String(data.detail || "This capture cannot start yet."),
            blockers: Array.isArray(data.blockers) ? data.blockers.map(String) : [],
            openQuestions: Array.isArray(data.openQuestions)
              ? data.openQuestions.map(String)
              : [],
          });
          return;
        }

        setLink({
          status: "valid",
          accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
          expiresAt: String(data.expiresAt || ""),
        });
      } catch {
        if (!cancelled) {
          setLink({ status: "invalid", message: "We could not check this link. Try again shortly." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const send = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setUpload({ status: "uploading", percent: 0 });

      // The server cannot read these: it has no ffprobe, and the extractor
      // refuses a manifest without width, height and a frame rate. So they are
      // measured here, off the real file, and a failure to measure stops the
      // upload rather than shipping a guess that would ride along in the
      // capture record as though somebody had observed it.
      const metadata = await readVideoMetadata(file);
      if (!metadata) {
        setUpload({
          status: "failed",
          message:
            "We could not read this video. Record it in your phone's camera app and pick it from your library, rather than using a link or a screen recording.",
        });
        return;
      }

      // Metadata first, file second. Multer buffers the whole request either
      // way, but a streaming parser reaches the small field before the hundreds
      // of megabytes behind it, and nothing is gained by the other order.
      const body = new FormData();
      body.append("metadata", JSON.stringify(metadata));
      body.append("video", file);

      const request = new XMLHttpRequest();
      request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        setUpload({ status: "uploading", percent: Math.round((event.loaded / event.total) * 100) });
      });

      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          setUpload({ status: "done" });
          return;
        }
        let message = "The upload did not finish. Try again.";
        try {
          message = JSON.parse(request.responseText)?.error || message;
        } catch {
          // Keep the generic message; the server said nothing we can quote.
        }
        setUpload({ status: "failed", message });
      });

      request.addEventListener("error", () => {
        setUpload({ status: "failed", message: "The connection dropped before the video finished." });
      });

      request.send(body);
    },
    [token],
  );

  const accepts =
    link.status === "valid" ? link.accepts.map((item) => `.${item}`).join(",") : ".mov,.mp4";

  return (
    <div className="ms-container" style={{ paddingBlock: "64px", maxWidth: "640px" }}>
      <Helmet>
        <title>Upload your walkthrough | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "34px", letterSpacing: "-1.2px", marginBottom: "12px" }}>
        {link.status === "held" ? "Not yet — here is what is in the way" : "Film the work area"}
      </h1>

      {link.status === "checking" && (
        <p style={{ color: "var(--ms-muted)" }}>Checking your link…</p>
      )}

      {link.status === "held" && (
        <>
          <p style={{ color: "var(--ms-muted)", marginBottom: "24px" }}>{link.detail}</p>

          {link.blockers.length > 0 && (
            <ul style={{ paddingLeft: "20px", marginBottom: "24px", lineHeight: 1.7 }}>
              {link.blockers.map((blocker) => (
                <li key={blocker} style={{ marginBottom: "8px" }}>
                  {blocker}
                </li>
              ))}
            </ul>
          )}

          {link.openQuestions.length > 0 && (
            <>
              <p style={{ marginBottom: "8px" }}>What a short call would settle:</p>
              <ul style={{ paddingLeft: "20px", marginBottom: "24px", lineHeight: 1.7 }}>
                {link.openQuestions.map((question) => (
                  <li key={question} style={{ marginBottom: "8px" }}>
                    {question}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p style={{ color: "var(--ms-muted)" }}>
            Keep this link. It is the same page you will record on — when the above changes,
            open it again and it will let you upload. Nothing needs to be re-submitted and
            nobody needs to email you.
          </p>
        </>
      )}

      {link.status === "invalid" && (
        <p style={{ color: "var(--ms-muted)" }}>
          {link.message} If you were sent this by email, reply to that message and we will send a
          fresh one.
        </p>
      )}

      {link.status === "valid" && (
        <>
          <p style={{ color: "var(--ms-muted)", marginBottom: "28px" }}>
            One video of one work area. No app, no account, nothing to fill in.
          </p>

          <ol style={{ paddingLeft: "20px", marginBottom: "32px", lineHeight: 1.7 }}>
            {FILM_STEPS.map((step) => (
              <li key={step} style={{ marginBottom: "8px" }}>
                {step}
              </li>
            ))}
          </ol>

          {upload.status === "done" ? (
            <div
              style={{
                border: "1px solid var(--ms-rule)",
                padding: "20px",
                background: "var(--ms-paper)",
              }}
            >
              <strong>That is everything we need.</strong>
              <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                We will turn it into a 3D scene and run the shortlisted robots against it. You do
                not need to do anything else — we will email you when there is something to look at.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={accepts}
                capture="environment"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void send(file);
                }}
              />

              <button
                type="button"
                className="ms-button"
                disabled={upload.status === "uploading"}
                onClick={() => inputRef.current?.click()}
                style={{
                  background: "var(--ms-green)",
                  color: "var(--ms-paper)",
                  border: "none",
                  padding: "14px 24px",
                  fontSize: "15px",
                  cursor: upload.status === "uploading" ? "default" : "pointer",
                }}
              >
                {upload.status === "uploading" ? "Uploading…" : "Choose or record a video"}
              </button>

              {upload.status === "uploading" && (
                <div style={{ marginTop: "20px" }}>
                  <div
                    role="progressbar"
                    aria-valuenow={upload.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                    style={{ height: "4px", background: "var(--ms-rule)" }}
                  >
                    <div
                      style={{
                        width: `${upload.percent}%`,
                        height: "100%",
                        background: "var(--ms-green)",
                        transition: "width 200ms ease",
                      }}
                    />
                  </div>
                  <p style={{ color: "var(--ms-muted)", marginTop: "10px", fontSize: "14px" }}>
                    {upload.percent}% — keep this page open{fileName ? ` (${fileName})` : ""}.
                  </p>
                </div>
              )}

              {upload.status === "failed" && (
                <p style={{ color: "var(--ms-muted)", marginTop: "20px" }}>
                  {upload.message} Nothing was saved, so it is safe to pick the video again.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
