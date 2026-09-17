/**
 * Filming the workcell without leaving the page.
 *
 * ## Why in-page rather than the phone's camera app
 *
 * Handing someone off to their camera roll and asking them to come back and
 * pick a file works, and it is what this page did. What it cannot do is show
 * them what we still need while they are standing in front of it — which is the
 * whole reason a checklist exists. So the guided path keeps the stream in the
 * page, and the file picker stays as the fallback for every case below.
 *
 * ## The format constraint, stated rather than assumed
 *
 * `MediaRecorder` gives Safari `video/mp4` and Chrome mostly `video/webm`. The
 * upload route accepts `mov` and `mp4`, and whether the extractor and the
 * reconstruction path handle webm is **not something this component gets to
 * decide** — assuming they do would be the same mistake as applying one
 * provider's capture requirements to another.
 *
 * So the guided recorder offers itself only where an mp4 variant is actually
 * supported, and everywhere else the page says plainly that recording in the
 * phone's own camera and uploading the file is the way through. That is a
 * narrower feature than it could be and an honest one.
 *
 * ## Parts, because the connection will drop
 *
 * `MediaRecorder` is given a timeslice, so it emits the recording in pieces
 * while filming rather than one blob at the end. Each piece is uploaded as it
 * arrives and is durable the moment it lands, so a connection that dies at 80%
 * costs the remaining 20% rather than the walk back to the pallet.
 *
 * Only the composed object is a video. A piece on its own is a fragment, which
 * is why nothing downstream reads one — see `captureParts.ts`.
 *
 * ## What it does not do
 *
 * It does not listen, talk, or send frames anywhere. There is no microphone
 * request and no third-party stream, which means it introduces no consent
 * question beyond the one the site already answered at intake. A coach is a
 * later, separate decision with its own boundary.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";

/** Emitted often enough that a dropped connection costs seconds, not minutes. */
const TIMESLICE_MS = 4_000;

/**
 * The mp4 variants worth trying, best first.
 *
 * Checked at runtime rather than sniffed from the user agent: a browser that
 * says it can record mp4 is the only evidence that matters, and user-agent
 * strings have been wrong about this for years.
 */
const MP4_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E"',
  "video/mp4",
] as const;

function supportedMp4Type(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of MP4_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // A browser that throws on the question has answered it.
    }
  }
  return null;
}

export type ChecklistItem = {
  id: string;
  /** What to show, in the operator's terms rather than a gate id. */
  label: string;
};

type State =
  /** No mp4 recording here. The file picker is the path, and we say so. */
  | { status: "unsupported" }
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "ready" }
  | { status: "recording"; sentParts: number; pendingParts: number }
  | { status: "uploading"; sentParts: number; pendingParts: number }
  /** Server has the whole recording. Distinct from "accepted". */
  | { status: "saved"; message: string }
  /** Saved, and something in it needs a person or a retry. */
  | { status: "held"; message: string; retryable: boolean }
  | { status: "failed"; message: string; recoverable: boolean };

export function CaptureRecorder(props: {
  token: string;
  /** Derived from the confirmed brief. Empty is valid and means "film the area". */
  checklist: readonly ChecklistItem[];
  /** So the page can stop offering the file picker once a recording is saved. */
  onSaved?: () => void;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  /** Index of the next part to send, and the bytes still queued. */
  const nextIndexRef = useRef(0);
  const queueRef = useRef<Blob[]>([]);
  const sendingRef = useRef(false);
  const sentBytesRef = useRef(0);
  const mimeRef = useRef<string>("video/mp4");

  useEffect(() => {
    if (!supportedMp4Type()) setState({ status: "unsupported" });
  }, []);

  const releaseWakeLock = useCallback(() => {
    // Released rather than left to the browser, and failure ignored: a lock we
    // cannot give back is not worth a visible error on a page that has just
    // finished the thing the operator came to do.
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    releaseWakeLock();
  }, [releaseWakeLock]);

  useEffect(() => stopStream, [stopStream]);

  /** Send queued parts in order, one at a time, retrying the one that failed. */
  const drainQueue = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      while (queueRef.current.length) {
        const part = queueRef.current[0]!;
        const index = nextIndexRef.current;
        const body = new FormData();
        body.append("part", part, `part-${index}`);

        let ok = false;
        // Three attempts, then leave it queued: the recording is still in the
        // page and the operator can retry, which is a better outcome than
        // dropping a part and composing a video with a hole in it.
        for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
          try {
            const response = await fetch(
              `/api/self-capture/uploads/${props.token}/parts/${index}?extension=mp4`,
              { method: "PUT", credentials: "include", body },
            );
            ok = response.ok;
            if (!ok && response.status === 409) {
              // Permission was withdrawn mid-upload. Stop rather than retry.
              const detail = (await response.json().catch(() => ({}))) as { error?: string };
              setState({
                status: "failed",
                message: detail.error || "This capture is on hold. Nothing more was uploaded.",
                recoverable: false,
              });
              return;
            }
          } catch {
            // Network. Retried below.
          }
        }

        if (!ok) {
          setState({
            status: "failed",
            message:
              "Your connection dropped. What has uploaded is saved — press resume to send the rest.",
            recoverable: true,
          });
          return;
        }

        queueRef.current.shift();
        nextIndexRef.current = index + 1;
        sentBytesRef.current += part.size;
        setState((current) =>
          current.status === "recording" || current.status === "uploading"
            ? {
                ...current,
                sentParts: nextIndexRef.current,
                pendingParts: queueRef.current.length,
              }
            : current,
        );
      }
    } finally {
      sendingRef.current = false;
    }
  }, [props.token]);

  const start = useCallback(async () => {
    const mime = supportedMp4Type();
    if (!mime) {
      setState({ status: "unsupported" });
      return;
    }
    mimeRef.current = mime;
    setState({ status: "requesting" });

    let stream: MediaStream;
    try {
      // Video only. No microphone is requested because nothing here listens,
      // and asking for a permission we have no use for is how a page teaches
      // someone to refuse the next one.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      setState({
        status: "failed",
        message:
          "We could not open the camera. You can still record in your phone's camera app and "
          + "upload the file below.",
        recoverable: false,
      });
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }

    // Best effort. A denied or released lock is not a failure -- it means the
    // screen may sleep, and the recording survives that on most browsers but
    // not all, which is why the copy below tells them to keep the page open.
    try {
      const wakeLock = (navigator as unknown as {
        wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (wakeLock) wakeLockRef.current = await wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }

    setState({ status: "ready" });
  }, []);

  const record = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    nextIndexRef.current = 0;
    queueRef.current = [];
    sentBytesRef.current = 0;

    const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) {
        queueRef.current.push(event.data);
        void drainQueue();
      }
    };

    recorder.start(TIMESLICE_MS);
    setState({ status: "recording", sentParts: 0, pendingParts: 0 });
  }, [drainQueue]);

  const finish = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    // `stop` flushes a final chunk through `ondataavailable`, so the queue is
    // only settled after that callback has run.
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    stopStream();

    setState({
      status: "uploading",
      sentParts: nextIndexRef.current,
      pendingParts: queueRef.current.length,
    });
    await drainQueue();

    if (queueRef.current.length) {
      setState({
        status: "failed",
        message: "Some of your recording has not uploaded yet. Press resume to finish sending it.",
        recoverable: true,
      });
      return;
    }

    const video = videoRef.current;
    const response = await fetch(
      `/api/self-capture/uploads/${props.token}/parts/complete`,
      {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          parts: nextIndexRef.current,
          extension: "mp4",
          sizeBytes: sentBytesRef.current,
          metadata: {
            widthPx: video?.videoWidth ?? 0,
            heightPx: video?.videoHeight ?? 0,
            fps: 30,
            durationSeconds: Math.max(1, Math.round((nextIndexRef.current * TIMESLICE_MS) / 1000)),
            recordedAtEpochMs: Date.now(),
          },
        }),
      },
    ).catch(() => null);

    const body = (await response?.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      state?: string;
      retryable?: boolean;
      missing?: number[];
    };

    if (!response || !response.ok) {
      setState({
        status: "failed",
        message:
          body?.error
          || "We could not finish your upload. What we have is saved — press resume to retry.",
        recoverable: true,
      });
      return;
    }

    if (body.state === "held") {
      setState({
        status: "held",
        message: body.message || "Your capture is saved. Something in it needs checking.",
        retryable: Boolean(body.retryable),
      });
      props.onSaved?.();
      return;
    }

    setState({
      status: "saved",
      message: body.message || "Your capture is saved. You can close this page.",
    });
    props.onSaved?.();
  }, [drainQueue, props, stopStream]);

  const resume = useCallback(async () => {
    setState({
      status: "uploading",
      sentParts: nextIndexRef.current,
      pendingParts: queueRef.current.length,
    });
    await drainQueue();
    if (!queueRef.current.length) await finish();
  }, [drainQueue, finish]);

  if (state.status === "unsupported") {
    return (
      <p className="ms-field-hint">
        This browser cannot record in a format our reconstruction accepts. Record in your phone's
        own camera app and upload the file below — it works exactly as well.
      </p>
    );
  }

  return (
    <div className="ms-form" aria-live="polite">
      {/* The checklist is the operator's, not ours. Each item is ticked by the
          person who filmed it, because at one frame a second nothing we could
          run would know a pallet had been shown -- and a progress bar that
          guesses is worse than a short honest one. */}
      {props.checklist.length > 0 && (
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="ms-field-hint" style={{ padding: 0 }}>
            What to show. Tick each one as you film it — we are not guessing.
          </legend>
          {props.checklist.map((item) => (
            <label
              key={item.id}
              htmlFor={`shot-${item.id}`}
              style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}
            >
              <input
                id={`shot-${item.id}`}
                type="checkbox"
                checked={ticked.has(item.id)}
                onChange={(event) =>
                  setTicked((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })
                }
                style={{ width: "auto", minHeight: 0 }}
              />
              <span style={{ fontWeight: 400 }}>{item.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: "100%",
          maxHeight: "60vh",
          background: "#000",
          display: state.status === "idle" || state.status === "requesting" ? "none" : "block",
        }}
      />

      {state.status === "idle" && (
        <button className="ms-button ms-button-large" type="button" onClick={start}>
          Open the camera
        </button>
      )}

      {state.status === "requesting" && <p className="ms-field-hint">Opening the camera…</p>}

      {state.status === "ready" && (
        <>
          <button className="ms-button ms-button-large" type="button" onClick={record}>
            Start recording
          </button>
          <p className="ms-field-hint">
            Film the work, not the worker. Keep this page open while it uploads.
          </p>
        </>
      )}

      {state.status === "recording" && (
        <>
          <button className="ms-button ms-button-large" type="button" onClick={finish}>
            Finish
          </button>
          <p className="ms-field-hint">
            Recording, and uploading as you go — {state.sentParts} piece
            {state.sentParts === 1 ? "" : "s"} saved so far. Finish whenever you have shown what
            you need to; there is no minimum length.
          </p>
        </>
      )}

      {state.status === "uploading" && (
        <p className="ms-field-hint">
          Uploading — {state.pendingParts} piece{state.pendingParts === 1 ? "" : "s"} left. Keep
          this page open until it says saved.
        </p>
      )}

      {state.status === "saved" && (
        <>
          <h2 style={{ marginTop: 0 }}>Saved.</h2>
          {/* Deliberately not "accepted" and not "your scene is being built".
              Saved means the server has the bytes. Whether the footage can
              support a reconstruction is a later answer, and promising it here
              would be a claim we have not checked. */}
          <p className="ms-field-hint">{state.message}</p>
        </>
      )}

      {state.status === "held" && (
        <>
          <h2 style={{ marginTop: 0 }}>Saved, and we are checking it.</h2>
          <p className="ms-field-hint">{state.message}</p>
          {state.retryable && (
            <p className="ms-field-hint">
              Nothing for you to do — this is on our side and we will come back to you.
            </p>
          )}
        </>
      )}

      {state.status === "failed" && (
        <>
          <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
            {state.message}
          </p>
          {state.recoverable && (
            <button className="ms-button" type="button" onClick={resume}>
              Resume upload
            </button>
          )}
        </>
      )}
    </div>
  );
}
