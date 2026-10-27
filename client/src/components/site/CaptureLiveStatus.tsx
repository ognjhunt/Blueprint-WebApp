import type { SiteAdvisory } from "@/types/siteAdvisory";
import { SiteAdvisoryReport } from "./SiteAdvisoryReport";
import { TaskOutcomeNotice } from "./TaskOutcomeNotice";
import type { TaskOutcome } from "@/types/taskOutcome";
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
  scope?: "owner" | "film";
  siteAdvisory?: SiteAdvisory | null;
  headline: string;
  outcome?: TaskOutcome | null;
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
  compact = false,
}: {
  captureUrl: string;
  /** Fired once the server holds the recording, so the page can move past the handoff. */
  onCaptureReceived?: () => void;
  /** Intake confirmation groups progress with the receipt, without repeating the full advisory. */
  compact?: boolean;
}) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const token = tokenFromCaptureUrl(captureUrl);

  useEffect(() => {
    setStatus(null);
    setLoadError(false);
    if (!token) return;
    let alive = true;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let timeout: number | undefined;

    async function poll() {
      controller = new AbortController();
      timeout = window.setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token!)}/status`, {signal: controller.signal});
        if (response.ok) {
          const data = (await response.json()) as { status?: LiveStatus; captureReceived?: boolean; siteAdvisory?: SiteAdvisory | null; scope?: "owner" | "film" };
          if (alive && data?.captureReceived === true) onCaptureReceived?.();
          if (alive && data?.status?.headline) {
            setLoadError(false);
            setStatus({ scope: data.scope, siteAdvisory: data.siteAdvisory ?? null, headline: data.status.headline,
              outcome: data.scope === "film" ? null : data.status.outcome ?? null,
              stage: data.status.stage ?? null, nextUpdateIso: data.status.nextUpdateIso });
          } else if (alive) setLoadError(true);
        } else if (alive) { setLoadError(true); setStatus(previous => previous ? { ...previous, siteAdvisory: null } : null); }
      } catch {
        if (alive) { setLoadError(true); setStatus(previous => previous ? { ...previous, siteAdvisory: null } : null); }
      } finally {
        window.clearTimeout(timeout);
      }
      if (alive) timer = window.setTimeout(poll, 6000);
    }

    void poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(timeout);
      controller?.abort();
    };
  }, [token, loadAttempt]);

  if (!status) return compact && token ? <div className="ms-intake-progress">
    <p role={loadError ? "alert" : "status"}>{loadError ? "Job updates could not be loaded. Your saved job is still here." : "Loading job updates…"}</p>
    {loadError && <button type="button" className="ms-text-link" onClick={() => setLoadAttempt(value => value + 1)}>Retry job updates</button>}
  </div> : null;

  if (compact) {
    const advisory = status.siteAdvisory;
    const sections = advisory?.state === "ready" ? advisory.sections.filter(section => section.claims.length > 0) : [];
    return <div className="ms-intake-progress">
      <p role="status">{status.headline}</p>
      <TaskOutcomeNotice showTitle={false} outcome={loadError ? null : status.outcome} />
      {/* What the video shows, never a question or a step for the site: the
          site sends its video and nothing else (founder direction, 2026-10-20). */}
      {sections.length > 0 && <details className="ms-intake-assessment">
        <summary>Assessment notes</summary>
        {sections.map(section => <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.claims.map(claim => <li key={claim.text}>{claim.text}</li>)}</ul>
        </section>)}
      </details>}
      {(advisory?.state === "needs_review" || advisory?.state === "unavailable") && <p>
        {advisory.state === "needs_review" ? "We need to review an assessment issue." : "We could not check the assessment."} Keep your original video.
      </p>}
      {advisory?.state !== "authority_ended" && advisory?.correlationId && <details className="ms-intake-reference">
        <summary>Support reference</summary>
        <p>{advisory.correlationId}</p>
      </details>}
    </div>;
  }

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
      <TaskOutcomeNotice showTitle={false} outcome={loadError ? null : status.outcome} />
      <SiteAdvisoryReport advisory={status.siteAdvisory} />
      <p className="ms-field-hint" style={{ marginTop: "4px", opacity: 0.8 }}>
        This updates on its own — you can leave it open, or close it and come back to the link.
      </p>
    </div>
  );
}
