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

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureRecorder, type ChecklistItem } from "@/components/site/CaptureRecorder";
import { TaskBriefReview, type DraftedBrief } from "@/components/site/TaskBriefReview";
import { TaskItemsPanel } from "@/components/site/TaskItemsPanel";
import { FilmLinkHandoff } from "@/components/site/FilmLinkHandoff";
import { captureBlockingGates } from "@/lib/siteTaskReadiness";
import { isCaptureMode, defaultCaptureMode } from "@/data/siteTaskQualification";

/** Mirrors the server's `projectTaskStatus`; the shared truth about where a task stands. */
type TaskStatus = {
  decision: string;
  headline: string;
  operatorAction: string | null;
  missingViews: string[];
  nextUpdateIso: string | null;
};
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
  /**
   * The upload worked and what is in it needs a person.
   *
   * Distinct from `failed` because telling someone their upload failed when it
   * did not would send them off to re-film a video we already have.
   */
  | { status: "held"; message: string }
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

export default function SelfCaptureUpload() {
  const [, params] = useRoute("/capture-upload/:token");
  const token = params?.token ?? "";

  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  /**
   * What to film, from the brief we drafted and they confirmed.
   *
   * Empty is a valid answer and the recorder handles it: a submission whose
   * brief we have not read yet still gets a camera, just without a list. What
   * it must never be is invented here -- a shot list that named views the task
   * does not have would be us telling somebody to film a room we imagined.
   */
  const [shotList, setShotList] = useState<ChecklistItem[]>([]);
  /**
   * The drafted brief, when there is one to confirm.
   *
   * The brief comes before the camera on purpose: confirming what we
   * understood is the attestation that lets a submission reach `qualified`, and
   * a walkthrough filmed against a brief nobody corrected is a video we cannot
   * turn into supply. So an unconfirmed brief is shown first, and the recorder
   * appears once it is confirmed — or immediately when there is no brief yet,
   * because a blank capture is still better than a blocked one.
   */
  const [brief, setBrief] = useState<DraftedBrief | null>(null);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  /**
   * What this link may do. A film-only colleague link never shows the brief
   * confirm UI -- confirming is an attestation only the operator's own link
   * carries -- so the recorder is what they see. Defaults to owner, matching
   * the server, which reads an absent scope as owner.
   */
  const [scope, setScope] = useState<"owner" | "film">("owner");

  // Whether the operator can clear the loose items before filming. A cleared
  // space films as a clean plate -- nothing to remove later -- but it is a real
  // ask, so it is offered, not required. Either way the objects themselves come
  // from the item photos, not this walkthrough. Purely a client hint that steers
  // the filming guidance; it changes nothing about how the video is stored.
  const [clearItems, setClearItems] = useState<"in_place" | "cleared">("in_place");

  // Whether the brief still gates the *camera*, as opposed to the *sale*. Only
  // the capture-blocking gates change what to film; if one of those is still
  // unresolved we genuinely do not know what to record, so the brief comes
  // first. If only evaluation-blocking gates remain, the camera opens and the
  // rest of the brief settles afterwards -- the readiness ladder's own
  // distinction, applied to the UI instead of a blanket "confirm everything
  // first".
  const briefBlocksCapture = (() => {
    if (!brief) return false;
    const mode = isCaptureMode(brief.captureMode) ? brief.captureMode : defaultCaptureMode;
    const captureIds = new Set(captureBlockingGates(mode).map((field) => field.id));
    return brief.unresolved.some((id) => captureIds.has(id));
  })();
  /** Where the task stands, for the operator who has no account to check. */
  const [status, setStatus] = useState<TaskStatus | null>(null);

  // Whether the camera button below is worth anything on this device. A coarse
  // check on purpose: the cost of being wrong is one extra QR code on a phone,
  // or one missing QR code on a laptop that can still copy the URL out of its
  // own address bar.
  const onAPhone =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLink({ status: "invalid", message: "This link is missing its code." });
      return;
    }

    let cancelled = false;

    // Separate request, and deliberately not awaited with the link check: a
    // brief we cannot load is a missing checklist, not a broken capture page.
    (async () => {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/status`);
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          status?: TaskStatus;
        } | null;
        if (cancelled || !response.ok || !data?.status) return;
        setStatus(data.status);
      } catch {
        // No status line. The rest of the page still works.
      }
    })();

    (async () => {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}`);
        const data = (await response.json().catch(() => null)) as {
          ready?: boolean;
          scope?: "owner" | "film";
          brief?: (DraftedBrief & { shotList?: ChecklistItem[]; confirmedAtIso?: string | null });
        } | null;
        if (cancelled || !response.ok) return;
        if (data?.scope === "film" || data?.scope === "owner") setScope(data.scope);
        if (!data?.ready || !data.brief) return;
        if (Array.isArray(data.brief.shotList)) setShotList(data.brief.shotList);
        setBrief({
          summary: data.brief.summary,
          captureMode: data.brief.captureMode,
          proposed: data.brief.proposed ?? [],
          unresolved: data.brief.unresolved ?? [],
        });
        setBriefConfirmed(Boolean(data.brief.confirmedAtIso));
      } catch {
        // No list. The camera still works.
      }
    })();

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
          // A 2xx is not automatically "done": the privacy screen answers with
          // a held state on a successful upload.
          let body: { state?: string; message?: string } = {};
          try {
            body = JSON.parse(request.responseText) || {};
          } catch {
            // No body we can read means the plain success it has always been.
          }
          if (body.state === "held") {
            setUpload({
              status: "held",
              message:
                body.message
                || "Your video reached us. Someone is looking at it before anything is processed.",
            });
            return;
          }
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

  // "Where this stands", for the operator who has no account. It carries a
  // re-film request when there is one, so it is never dropped -- but on a
  // recordable link the camera is the page, so it moves below the camera. When
  // there is no camera yet (a held or checking link) it stays at the top.
  const statusCard = status ? (
    <div
      style={{
        border: "1px solid var(--ms-rule)",
        padding: "16px",
        marginBottom: "24px",
        background: "var(--ms-paper)",
      }}
    >
      <strong>{status.headline}</strong>
      {status.operatorAction && (
        <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
          {status.operatorAction}
        </p>
      )}
      {status.nextUpdateIso ? (
        <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
          Next update by {new Date(status.nextUpdateIso).toLocaleString()}.
        </p>
      ) : (
        <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
          We will email you when there is something to say. Nothing to watch here.
        </p>
      )}
    </div>
  ) : null;

  return (
    // This page renders in the "bare" shell, outside SiteLayout/MinimalSiteLayout,
    // so it has to establish the minimal-site theme itself. Without this wrapper the
    // `--ms-*` tokens and `color-scheme: light` are undefined here, and a phone in
    // dark mode paints every un-coloured element with the browser's own dark-mode
    // defaults: that is the washed-out body text and the invisible `--ms-green`
    // buttons (the "Open the camera" control rendered cream-on-cream). The wrapper
    // carries the theme only -- no header or footer -- so the bare shell is intact.
    <div className="minimal-site">
      <div className="ms-container" style={{ paddingBlock: "64px", maxWidth: "640px" }}>
        <Helmet>
        <title>Upload your walkthrough | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "34px", letterSpacing: "-1.2px", marginBottom: "12px" }}>
        {link.status === "held" ? "Not yet — here is what is in the way" : "Film the work area"}
      </h1>

      {/* Where the task stands. Above the fold only when there is no camera on
          this page yet -- a held or checking link. On a recordable link it moves
          below the camera, because the camera is the page. */}
      {link.status !== "valid" && statusCard}

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
          {!onAPhone && upload.status === "idle" && (
            /*
             * Opened on a laptop, where the camera button below is useless.
             * Without this the page is a dead end that asks someone to get a
             * URL onto their own phone by hand.
             *
             * Hidden once an upload is under way, because by then they are on
             * the device that is doing it.
             */
            <div style={{ marginBottom: "32px" }}>
              <p style={{ marginBottom: 0 }}>Record this on your phone.</p>
              <CaptureHandoffQr url={pageUrl} label="Scan to open this page on your phone" />
            </div>
          )}

          {upload.status === "held" ? (
            <div
              style={{
                border: "1px solid var(--ms-rule)",
                padding: "20px",
                background: "var(--ms-paper)",
              }}
            >
              <strong>We have your video. Nothing is being processed from it yet.</strong>
              <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                {upload.message} There is nothing to re-film and nothing for you to do — we will
                come back to you about it.
              </p>
            </div>
          ) : upload.status === "done" ? (
            <div
              style={{
                border: "1px solid var(--ms-rule)",
                padding: "20px",
                background: "var(--ms-paper)",
              }}
            >
              <strong>Your capture is saved.</strong>
              <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                You can close this page. We check next whether it covers the work area well enough to
                build the scene, and we will come back to you either way — including if one more
                view would finish the job.
              </p>
            </div>
          ) : (
            <>
              {/* Bare bones: the camera is the page. One hero action -- the guided
                  recorder, which offers itself only where the browser records a
                  format our reconstruction accepts and steps aside to the file
                  picker below otherwise -- then one line of how, and everything
                  else optional and beneath it. */}
              <CaptureRecorder
                token={token}
                checklist={shotList}
                onSaved={() => setUpload({ status: "done" })}
              />

              {/* The clean-plate option. Clearing the loose items and filming the
                  empty space rebuilds cleaner than filming around them and having
                  to remove them later -- but it is a real ask, so it is offered,
                  not required. Either way the items come from the photos below. */}
              <fieldset style={{ border: "none", padding: 0, margin: "16px 0 0" }}>
                <legend className="ms-field-hint" style={{ padding: 0, marginBottom: "6px" }}>
                  Can you move the loose items out of the way first?
                </legend>
                <label htmlFor="cap-in-place" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
                  <input
                    id="cap-in-place"
                    type="radio"
                    name="clear-items"
                    checked={clearItems === "in_place"}
                    onChange={() => setClearItems("in_place")}
                    style={{ width: "auto", minHeight: 0 }}
                  />
                  <span style={{ fontWeight: 400 }}>No — film it as it normally is</span>
                </label>
                <label htmlFor="cap-cleared" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
                  <input
                    id="cap-cleared"
                    type="radio"
                    name="clear-items"
                    checked={clearItems === "cleared"}
                    onChange={() => setClearItems("cleared")}
                    style={{ width: "auto", minHeight: 0 }}
                  />
                  <span style={{ fontWeight: 400 }}>Yes — I’ll clear it and film the empty space</span>
                </label>
              </fieldset>

              {/* Coverage is about occlusion, not thoroughness: whatever the camera
                  never sees gets guessed, so the instruction is overlap and angles,
                  not "a lap". And the pass is static -- motion is a ghost in the
                  result. */}
              <p className="ms-field-hint" style={{ marginTop: "12px" }}>
                {clearItems === "cleared"
                  ? "Clear the loose items, then film the empty space. Move slowly and overlap your "
                    + "passes — cover every surface from a few heights, especially right around where "
                    + "the work happens. Keep it still: no people, nothing moving. Photograph the "
                    + "items themselves below."
                  : "Move slowly and overlap your passes — cover every surface from a few heights, "
                    + "especially right around where the work happens. Keep the scene still: no people "
                    + "or moving items in frame."}
              </p>

              {/* A re-film request or "where this stands" lands right under the
                  camera, so someone who came back to add an angle sees what we
                  need before the optional sections. */}
              {statusCard}

              {/* Optional, and never in front of the camera. Permission to
                  capture, the answers that refine what to film, and task
                  qualification are three different things, and only the first is
                  needed to record -- so the brief is a collapsed disclosure here,
                  not a gate. Confirming it is the attestation that turns the site
                  into supply, before or after filming. A film-only link never
                  sees it: attestation is not theirs to make. */}
              {scope === "owner" && brief && !briefConfirmed && (
                <details style={{ marginTop: "28px", marginBottom: "8px" }}>
                  <summary>
                    {briefBlocksCapture
                      ? "A couple of answers refine what to film"
                      : "Review your task brief"}
                  </summary>
                  <p className="ms-field-hint">
                    We drafted this from what you sent. Film whenever you like — confirming the brief
                    is what lets a robot team be matched to your site, before or after you film.
                  </p>
                  <TaskBriefReview
                    token={token}
                    brief={brief}
                    onConfirmed={() => setBriefConfirmed(true)}
                  />
                </details>
              )}

              {/* The room is not the objects. A robot grasps the tote and stacks
                  the cartons, and those are often filmed clear -- so we list the
                  items and take a few photos of each to build sim-ready versions.
                  A film-only link can add the photos; only an owner edits the list. */}
              <TaskItemsPanel token={token} scope={scope} />

              {/* Least privilege for the person who actually films. An owner who
                  is handing this to a colleague sends a link that can record and
                  upload but cannot attest -- so a forwarded QR never carries the
                  authority to confirm operating facts on the site's behalf. */}
              {scope === "owner" && <FilmLinkHandoff token={token} />}

              <p className="ms-field-hint" style={{ marginTop: "20px" }}>
                Already have a video? Upload it instead — if it covers the work area we will use
                it rather than ask you to film again.
              </p>

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
    </div>
  );
}
