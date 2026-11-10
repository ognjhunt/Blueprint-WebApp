import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

export type SuccessThresholdsHoldReason = "wrong_goal" | "too_strict" | "too_loose" | "wrong_task" | "other";
type Row = { label: string; value: string };

export type SuccessThresholdsView = {
  proposalDigest: string;
  rows: Row[];
  otherValues: Row[];
  decision: { kind: "confirmed" | "held"; reason: SuccessThresholdsHoldReason | null; decidedAt: string } | null;
};

const REASONS: Record<SuccessThresholdsHoldReason, string> = {
  wrong_goal: "The goal area is in the wrong place",
  too_strict: "These limits are stricter than the job needs",
  too_loose: "These limits are looser than the job needs",
  wrong_task: "This is not the job the robot should do",
  other: "Something else is wrong",
};
const REASON_IDS = Object.keys(REASONS) as SuccessThresholdsHoldReason[];

const isRows = (value: unknown): value is Row[] => Array.isArray(value)
  && value.every(row => typeof row?.label === "string" && typeof row.value === "string");

export function isSuccessThresholds(value: unknown): value is SuccessThresholdsView {
  const view = value as Partial<SuccessThresholdsView> | null;
  if (!view || typeof view.proposalDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(view.proposalDigest)
    || !isRows(view.rows) || !isRows(view.otherValues) || view.rows.length + view.otherValues.length === 0) return false;
  const decision = view.decision;
  return decision === null || (Boolean(decision) && typeof decision!.decidedAt === "string"
    && (decision!.kind === "confirmed" ? decision!.reason === null
      : decision!.kind === "held" && REASON_IDS.includes(decision!.reason as SuccessThresholdsHoldReason)));
}

const list = (rows: Row[]) => <dl style={{ margin: "8px 0" }}>
  {rows.map(row => <div key={`${row.label}:${row.value}`} style={{ margin: "6px 0" }}>
    <dt style={{ fontWeight: 600 }}>{row.label}</dt>
    <dd style={{ margin: 0 }}>{row.value}</dd>
  </div>)}
</dl>;

/** The job's proposed success thresholds for its owner: confirm them, or say they are wrong (the job holds).
 * The owner never edits a number here. */
export function SuccessThresholds({ token, view, onDecided }: {
  token: string; view: SuccessThresholdsView; onDecided: () => void;
}) {
  const [wrongOpen, setWrongOpen] = useState(false);
  const [reason, setReason] = useState<SuccessThresholdsHoldReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decision = view.decision;
  async function send(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/success-thresholds`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ proposalDigest: view.proposalDigest, ...body }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Your answer could not be saved. Try again shortly.");
      setWrongOpen(false);
      onDecided();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Try again shortly."); }
    finally { setBusy(false); }
  }
  return <section aria-label="How success is judged" style={{ marginBottom: "24px" }}>
    <h2>How success is judged</h2>
    <p className="ms-field-hint">Blueprint scores each robot candidate in the simulation of your site against these goals.
      Blueprint set them from its standard settings for this kind of task and the scene it built from your video.
      Nothing was measured at your site.</p>
    {list(view.rows)}
    {view.otherValues.length > 0 && <details>
      <summary>All values Blueprint checks</summary>
      {list(view.otherValues)}
    </details>}
    {decision?.kind === "confirmed"
      ? <p role="status">You confirmed these goals. Blueprint scores robot candidates against them.</p>
      : <>
        {decision?.kind === "held" && decision.reason && <p role="status">
          You said these goals are wrong: {REASONS[decision.reason].toLowerCase()}. Blueprint’s team is alerted with
          your reason. Blueprint will review it and contact you. These numbers stay as they are
          until then; if Blueprint proposes new goals, they appear here for you to confirm.</p>}
        <p className="ms-field-hint" style={{ marginTop: "12px" }}>{decision?.kind === "held"
          ? "If you change your mind, you can still use these goals."
          : "You can confirm these goals, or tell us what is wrong."}</p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="ms-button" disabled={busy} onClick={() => void send({ decision: "confirm" })}>
            {busy && !wrongOpen ? "Saving…" : "Use these goals"}
          </button>
          <button type="button" className="ms-text-button" aria-expanded={wrongOpen} aria-controls="success-thresholds-wrong"
            disabled={busy} onClick={() => setWrongOpen(value => !value)}>{wrongOpen ? "Close" : "Something is wrong"}</button>
        </div>
        {wrongOpen && <div id="success-thresholds-wrong">
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "12px 0" }}>
            <legend className="ms-field-hint">What is wrong? Blueprint’s team reviews your reason; no number changes.</legend>
            {REASON_IDS.map(id => <label key={id} style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
              <input type="radio" name="success-thresholds-reason" value={id} checked={reason === id}
                onChange={() => setReason(id)} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
              <span>{REASONS[id]}</span>
            </label>)}
          </fieldset>
          <button type="button" className="ms-button" disabled={!reason || busy}
            onClick={() => void send({ decision: "wrong", reason })}>{busy ? "Saving…" : "Send this reason"}</button>
        </div>}
      </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
