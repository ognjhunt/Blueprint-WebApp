import { NextTaskUpdate } from "./NextTaskUpdate";
/**
 * The desktop reflecting what the phone is doing — from the server, not a guess.
 *
 * The person who started the capture is often at a laptop while the recording
 * happens on a phone they handed to someone on the floor. Without this the
 * laptop is a dead end: it cannot tell whether the video has landed. So it polls
 * the same signed status the capture page reads and shows the current stage,
 * updating on its own.
 *
 * Two honesty rules, both from the brief that asked for this:
 *
 * - **Only events the server knows.** Whether the brief is drafted, confirmed,
 *   and whether a recording has been received and reviewed are real, stored
 *   facts. "Someone pointed a phone at the QR code" is not, and this never
 *   pretends to detect it.
 * - **A convenience, not a dependency.** If the status cannot be read, this
 *   renders nothing and the phone's capture is entirely unaffected. Closing the
 *   laptop changes nothing about the recording in progress.
 */
import { useEffect, useState } from "react";

interface LiveStatus {
  headline: string;
  stage: string | null;
  nextUpdateIso?: string | null;
}

/** Pull the signed token out of the capture URL the submit handed back. */
function tokenFromCaptureUrl(captureUrl: string): string | null {
  const marker = "/capture-upload/";
  const at = captureUrl.indexOf(marker);
  if (at < 0) return null;
  const token = captureUrl.slice(at + marker.length).split(/[?#]/)[0];
  return token || null;
}

export function CaptureLiveStatus({
  captureUrl,
  onCaptureReceived,
}: {
  captureUrl: string;
  /** Fired once the server holds the recording, so the page can move past the handoff. */
  onCaptureReceived?: () => void;
}) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const token = tokenFromCaptureUrl(captureUrl);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token!)}/status`);
        if (response.ok) {
          const data = (await response.json()) as { status?: LiveStatus; captureReceived?: boolean };
          if (alive && data?.captureReceived === true) onCaptureReceived?.();
          if (alive && data?.status?.headline) {
            setStatus({ headline: data.status.headline, stage: data.status.stage ?? null, nextUpdateIso: data.status.nextUpdateIso });
          }
        }
      } catch {
        // Transient. Keep the last state and try again; this must never surface
        // an error on a page whose job is already done.
      }
      if (alive) timer = window.setTimeout(poll, 6000);
    }

    void poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [token]);

  if (!status) return null;

  return (
    <div
      aria-live="polite"
      style={{
        marginTop: "20px",
        paddingTop: "16px",
        borderTop: "1px solid var(--ms-rule, #babdb3)",
      }}
    >
      <p className="ms-field-hint" style={{ margin: 0, fontWeight: 600, color: "var(--ms-ink, #22251e)" }}>
        Where this stands
      </p>
      <p className="ms-field-hint" style={{ marginTop: "4px" }}>
        {status.headline}
      </p>
      <NextTaskUpdate nextUpdateIso={status.nextUpdateIso} />
      <p className="ms-field-hint" style={{ marginTop: "4px", opacity: 0.8 }}>
        This updates on its own — you can leave it open, or close it and come back to the link.
      </p>
    </div>
  );
}
