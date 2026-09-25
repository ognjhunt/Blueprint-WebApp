import { isLikelyPhone } from "@/lib/device";
import { PublicTaskListing } from "@/components/site/PublicTaskListing";
import { NextTaskUpdate } from "@/components/site/NextTaskUpdate";
/**
 * The page a site employee opens from a link in an email.
 *
 * They have no account, and no reason to trust a long form. The link is
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
import { TaskBriefReview, type DraftedBrief, type SiteAccount } from "@/components/site/TaskBriefReview";
import { TaskItemsPanel } from "@/components/site/TaskItemsPanel";
import { TaskFollowUp } from "@/components/site/TaskFollowUp";
import { FilmLinkHandoff } from "@/components/site/FilmLinkHandoff";
import { captureBlockingGates } from "@/lib/siteTaskReadiness";
import { withCsrfHeader } from "@/lib/csrf";
import { isCaptureMode, defaultCaptureMode } from "@/data/siteTaskQualification";

/** Mirrors the server's `projectTaskStatus`; the shared truth about where a task stands. */
type TaskStatus = {
  decision: string;
  headline: string;
  operatorAction: string | null;
  missingViews: string[];
  nextUpdateIso: string | null;
  /**
   * Offered by the server at exactly one moment: robot teams have run against
   * the scene and nobody owns the site yet. Everything before that stays
   * account-free; everything after it (results, listing control) needs an
   * authority a forwardable link cannot carry.
   */
  claimUrl?: string | null;
  /** Owner-only URL projected from a persisted ready reconstruction. */
  sceneViewUrl?: string | null;
  /** The server holds a recording, whichever device sent it. */
  captureReceived?: boolean;
  /** Coverage is checked automatically; false means a person reviews it. */
  footageReviewAutomated?: boolean;
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
  | {
      status: "held";
      detail: string;
      blockers: string[];
      openQuestions: string[];
      /** Why it is held, from the dispatch rule. */
      holdReason?: string | null;
      /** The site asked for a visit and may film it itself instead. */
      selfCaptureSwitch?: boolean;
    }
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
  const onFollowUpAnswered = useCallback((id: string, answer: string) => {
    if (id !== "success_target") return;
    setBrief((current) => current ? {
      ...current,
      successCriteria: {
        successDefinition: answer,
        successRate: current.successCriteria?.successRate ?? null,
        cycleTimeSeconds: current.successCriteria?.cycleTimeSeconds ?? null,
        unknown: false,
      },
    } : current);
  }, []);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  // Links expire after a week; the expired page asks for a new one itself.
  const [freshLink, setFreshLink] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  async function requestFreshLink() {
    setFreshLink("sending");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token ?? "")}/fresh-link`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: "{}",
      });
      setFreshLink(response.ok ? "sent" : "failed");
    } catch {
      setFreshLink("failed");
    }
  }
  // A site set up for a visit can film it itself instead. Visits are booked by
  // hand, so this is the path that does not wait on anyone.
  const [switching, setSwitching] = useState<"idle" | "sending" | "failed">("idle");
  async function filmItMyself() {
    setSwitching("sending");
    try {
      // The link is the credential here, exactly as for the upload itself.
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token ?? "")}/self-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error("switch_failed");
      setSwitching("idle");
      setLink(data.state === "held"
        ? {
            status: "held",
            detail: String(data.detail || "This capture cannot start yet."),
            blockers: Array.isArray(data.blockers) ? data.blockers.map(String) : [],
            openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions.map(String) : [],
            holdReason: typeof data.holdReason === "string" ? data.holdReason : null,
            selfCaptureSwitch: data.selfCaptureSwitchAvailable === true,
          }
        : {
            status: "valid",
            accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
            expiresAt: String(data.expiresAt || ""),
          });
    } catch {
      setSwitching("failed");
    }
  }
  // A confirmed brief can be reopened: emails tell a site that was not cleared
  // to update its answers when something changes, so the answers stay editable.
  const [editingBrief, setEditingBrief] = useState(false);
  const [siteAccount, setSiteAccount] = useState<SiteAccount | null>(null);
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
    isLikelyPhone();
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const inputRef = useRef<HTMLInputElement>(null);
  /** One-tap copy on the desktop handoff, where the QR alone asks too much. */
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 4_000);
    } catch {
      // Clipboard unavailable (permissions, non-secure context). The URL is
      // rendered beside the button, so selecting it by hand still works.
    }
  }, [pageUrl]);

  useEffect(() => {
    if (!token) {
      setLink({ status: "invalid", message: "This link is missing its code." });
      return;
    }

    let cancelled = false;

    // A missing brief must not prevent the capture page from opening.
    (async () => {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}`);
        const data = (await response.json().catch(() => null)) as {
          ready?: boolean;
          scope?: "owner" | "film";
          brief?: (DraftedBrief & { shotList?: ChecklistItem[]; confirmedAtIso?: string | null });
          account?: SiteAccount | null;
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
          successCriteria: data.brief.successCriteria ?? null,
          operatorAnswers: data.brief.operatorAnswers ?? null,
          operatorUnknown: data.brief.operatorUnknown ?? null,
        });
        setBriefConfirmed(Boolean(data.brief.confirmedAtIso));
        setSiteAccount(data.account ?? null);
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

        if (data.captureReceived === true) {
          setLink({
            status: "valid",
            accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
            expiresAt: String(data.expiresAt || ""),
          });
          setUpload(data.state === "held"
            ? { status: "held", message: String(data.detail || "The review is still in progress.") }
            : { status: "done" });
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
            holdReason: typeof data.holdReason === "string" ? data.holdReason : null,
            selfCaptureSwitch: data.selfCaptureSwitchAvailable === true,
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

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/status`);
        const data = await response.json();
        if (alive && response.ok && data?.status) setStatus({
          ...data.status,
          claimUrl: data.claimUrl ?? null,
          sceneViewUrl: data.sceneViewUrl ?? null,
          captureReceived: data.captureReceived === true,
          footageReviewAutomated: data.footageReviewAutomated !== false,
        });
      } catch { /* The capture remains usable during a status outage. */ }
      if (alive) timer = setTimeout(poll, 6000);
    }
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [token, upload.status, briefConfirmed]);

  const accepts =
    link.status === "valid" ? link.accepts.map((item) => `.${item}`).join(",") : ".mov,.mp4";

  // Saved on this device, or on another one: the laptop that showed the QR
  // code reaches the same layout once the phone's recording lands.
  // A named coverage gap keeps the camera in front instead.
  const saved = upload.status === "done"
    || (upload.status === "idle" && status?.captureReceived === true && status.decision !== "add_views");

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
      <NextTaskUpdate nextUpdateIso={status.nextUpdateIso} />
      {status.sceneViewUrl && (
        <p style={{ margin: "10px 0 0" }}>
          <a className="ms-text-link" href={status.sceneViewUrl} target="_blank" rel="noreferrer">
            View your scene
          </a>
        </p>
      )}
      {status.claimUrl && (
        /* The account moment. Offered from the confirmed brief onward. The URL is minted
           server-side for the owner's link alone; a film-only link never
           receives one. */
        <p style={{ margin: "10px 0 0" }}>
          <a className="ms-text-link" href={status.claimUrl}>
            {status.decision === "results" || status.decision === "screening"
              ? "Claim your site to see the results"
              : status.sceneViewUrl
                ? "Save your scene and follow progress"
                : "Claim your site to follow this task"}
          </a>
          {status.decision !== "results" && status.decision !== "screening" && (
            <span className="ms-field-hint" style={{ display: "block", marginTop: "4px" }}>
              Create and verify your site account before Blueprint builds the scene. Your filming link keeps working while you do that.
            </span>
          )}
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
      <header className="ms-container ms-capture-header" style={{ maxWidth: "680px" }}>
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <a className="ms-back" href="/contact/site-operator">Back to Blueprint</a>
      </header>
      <div className="ms-container ms-capture-body" style={{ paddingBlock: "24px 48px", maxWidth: "680px" }}>
        <Helmet>
        <title>Upload your walkthrough | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "34px", letterSpacing: "-1.2px", marginBottom: "12px" }}>
        {link.status === "held" ? "Your task assessment" : saved || upload.status === "held" ? "A few details about the task" : onAPhone ? "Film the work area" : "Your task assessment"}
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
          {link.selfCaptureSwitch && (
            <section aria-label="Film it yourself" style={{ marginBottom: "24px" }}>
              <p style={{ marginBottom: "12px" }}>
                You asked for someone to come and record the work area. Visits are booked by hand,
                so they take longer. The quickest way to start is to film it yourself: about a
                minute on any phone, with no account or booking.
              </p>
              <button type="button" className="ms-button" disabled={switching === "sending"} onClick={filmItMyself}>
                {switching === "sending" ? "Switching…" : "I'll film it myself instead"}
              </button>
              {switching === "failed" && (
                <p role="alert" style={{ marginTop: "8px" }}>That did not go through. Try again in a moment.</p>
              )}
              <p style={{ color: "var(--ms-muted)", marginTop: "12px" }}>
                Would rather someone came? Visits cover the Austin metro for now and are booked by
                email. Keep this link either way.
              </p>
            </section>
          )}
          {link.holdReason !== "capturer_visit_scheduled" && (
            <p style={{ color: "var(--ms-muted)", marginBottom: "24px" }}>{link.detail}</p>
          )}

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
        <div>
          <p style={{ color: "var(--ms-muted)" }}>{link.message}</p>
          {token && freshLink !== "sent" && (
            <button
              type="button"
              className="ms-button"
              disabled={freshLink === "sending"}
              onClick={() => void requestFreshLink()}
            >
              {freshLink === "sending" ? "Sending…" : "Email me a fresh link"}
            </button>
          )}
          {freshLink === "sent" && (
            <p role="status">
              If this link was one of ours, a fresh one is on its way to the email address your
              task was sent from.
            </p>
          )}
          {freshLink === "failed" && (
            <p role="alert">We could not send that just now. Try again shortly.</p>
          )}
        </div>
      )}

      {link.status === "valid" && (
        <>
          {upload.status !== "held" && (
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
          )}
          {upload.status === "held" ? (
            <>
              <div style={{ marginBottom: "8px" }}>
                <strong>Video received.</strong>
                <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                  {upload.message} You can answer the questions below while review is pending.
                </p>
              </div>
              {scope === "owner" && <TaskFollowUp token={token} onAnswered={onFollowUpAnswered} />}
            </>
          ) : saved ? (
            <>
              <div
                style={{ marginBottom: "8px" }}
              >
                <strong>Video received.</strong>
                <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                  {status?.footageReviewAutomated === false
                    ? "Our team is reviewing whether it covers the work area."
                    : "We are checking whether it covers the work area."}{" "}
                  A few answers can help define the task while review continues.
                </p>
              </div>
              {scope === "owner" && <TaskFollowUp token={token} onAnswered={onFollowUpAnswered} />}
              {/* Saved is not finished. The brief confirmation is the site's
                  attestation — the thing that lets a robot team be matched — and
                  the item photos are the objects the task turns on. Hiding both
                  the moment a video lands used to end the visit with the
                  qualification undone, recoverable only by knowing to reload. */}
              {statusCard}

              {scope === "owner" && brief && briefConfirmed && !editingBrief && (
                <p className="ms-field-hint" style={{ marginBottom: "8px" }}>
                  Your task brief is confirmed.{" "}
                  <button type="button" className="ms-text-link" onClick={() => setEditingBrief(true)}>
                    Edit your answers
                  </button>
                </p>
              )}
              {scope === "owner" && brief && (!briefConfirmed || editingBrief) && (
                /* Open, not collapsed: this is the one step left, and a closed
                   disclosure under a "you can close this page" card read as
                   optional. */
                <details open style={{ marginBottom: "8px" }}>
                  <summary>{editingBrief ? "Edit your task brief" : "Next: check your task brief"}</summary>
                  <p className="ms-field-hint">
                    {brief.proposed.some((answer) => answer.basis !== "assumption")
                      ? "We drafted this from what you sent. Correct anything wrong, then confirm."
                      : "Answer a few questions about the task, then confirm."}{" "}
                    That is what lets a robot team be matched to your site.
                  </p>
                  <TaskBriefReview
                    key={brief.successCriteria?.successDefinition ?? ""}
                    token={token}
                    brief={brief}
                    account={siteAccount}
                    onConfirmed={() => { setBriefConfirmed(true); setEditingBrief(false); }}
                  />
                </details>
              )}

              {scope === "film" && <details className="ms-task-interest"><summary>Add photos of the task items</summary><TaskItemsPanel token={token} scope={scope} /></details>}

              <p className="ms-field-hint" style={{ marginBlock: "16px" }}>
                Filmed another angle? We will use whichever views cover the work area best.{" "}
                <button type="button" className="ms-text-link" onClick={() => inputRef.current?.click()}>
                  Add another video
                </button>
              </p>
            </>
          ) : !onAPhone ? (
            /*
             * A desktop cannot film a workcell, and a webcam that can see the
             * operator's face is worse than useless here. So the desktop page
             * is not the recorder with a handoff bolted on — it IS the
             * handoff: the code, a copyable link, and a status line that
             * reflects the phone. The camera button exists only where a rear
             * camera exists.
             */
            <div className="ms-form" aria-live="polite">
              <h2 style={{ marginTop: 0 }}>Point your phone at this.</h2>
              <p className="ms-field-hint">
                Scan to film the work area. Keep this page open to follow progress.
              </p>
              <CaptureHandoffQr url={pageUrl} label="Scan to open the recorder on your phone" />
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}
              >
                <button type="button" className="ms-button" onClick={copyLink}>
                  {linkCopied ? "Link copied" : "Copy the link"}
                </button>
                <span
                  className="ms-field-hint"
                  style={{ wordBreak: "break-all", maxWidth: "100%" }}
                >
                  {pageUrl}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* The phone: the camera is the page. One hero action — the guided
                  recorder, which offers itself only where the browser records a
                  format our reconstruction accepts and steps aside to the file
                  picker below otherwise — then one line of how, and everything
                  else optional and beneath it. */}
              <CaptureRecorder
                token={token}
                checklist={shotList}
                onSaved={() => setUpload({ status: "done" })}
              />

              <p className="ms-field-hint" style={{ marginTop: "12px" }}>
                Move slowly and overlap your passes. Cover every surface near where the work
                happens, from a few heights. Keep the scene still, with nobody in frame.
              </p>
            </>
          )}

          {upload.status !== "held" && !saved && (
            <>
              <p className="ms-field-hint" style={{ marginTop: "20px" }}>
                {onAPhone
                  ? "Already have a video of the work area? Upload it instead."
                  : "Already have the recording on this computer? Upload a .mov or .mp4 file."}
              </p>

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
                {upload.status === "uploading"
                  ? "Uploading…"
                  : onAPhone
                    ? "Choose or record a video"
                    : "Upload a video file"}
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
              {scope === "owner" && brief && briefConfirmed && !editingBrief && (
                <p className="ms-field-hint" style={{ marginTop: "28px", marginBottom: "8px" }}>
                  Your task brief is confirmed.{" "}
                  <button type="button" className="ms-text-link" onClick={() => setEditingBrief(true)}>
                    Edit your answers
                  </button>
                </p>
              )}
              {scope === "owner" && brief && (!briefConfirmed || editingBrief) && (
                <details open={editingBrief || undefined} style={{ marginTop: "28px", marginBottom: "8px" }}>
                  <summary>
                    {briefBlocksCapture
                      ? "A couple of answers refine what to film"
                      : "Review your task brief"}
                  </summary>
                  <p className="ms-field-hint">
                    {brief.proposed.some((answer) => answer.basis !== "assumption")
                      ? "We drafted this from what you sent."
                      : "A few questions about the task."}{" "}
                    Film whenever you like — confirming the brief
                    is what lets a robot team be matched to your site, before or after you film.
                  </p>
                  <TaskBriefReview
                    key={brief.successCriteria?.successDefinition ?? ""}
                    token={token}
                    brief={brief}
                    account={siteAccount}
                    onConfirmed={() => { setBriefConfirmed(true); setEditingBrief(false); }}
                  />
                </details>
              )}

              {/* The room is not the objects. A robot grasps the tote and stacks
                  the cartons, and those are often filmed clear -- so we list the
                  items and take a few photos of each to build sim-ready versions.
                  A film-only link can add the photos; only an owner edits the list. */}
              <details className="ms-task-interest"><summary>Add photos of the task items</summary><TaskItemsPanel token={token} scope={scope} /></details>

              {/* Least privilege for the person who actually films. An owner who
                  is handing this to a colleague sends a link that can record and
                  upload but cannot attest -- so a forwarded QR never carries the
                  authority to confirm operating facts on the site's behalf. */}
              {scope === "owner" && <details className="ms-task-interest"><summary>Ask someone else to film</summary><FilmLinkHandoff token={token} /></details>}


            </>
          )}
        </>
      )}
      {link.status === "valid" && scope === "owner" && !saved && upload.status !== "held" && <PublicTaskListing token={token} />}
      {!saved && upload.status !== "held" && (
        <p className="ms-field-hint" style={{ marginTop: "28px" }}>Next: we check the footage and ask you to confirm the task. We then assess provider fit and use a scene evaluation where it helps. Keep this link to follow progress.</p>
      )}
      </div>
    </div>
  );
}
