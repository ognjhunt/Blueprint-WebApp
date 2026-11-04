import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

export type RobotAccessView = {
  proposalDigest: string;
  what: string;
  why: string;
  question: string;
  note: string;
  items: string[];
  approve: string;
  decline: string;
  approved: string;
  declined: string;
  decision: { kind: "approved" | "declined"; decidedAt: string } | null;
};

const TEXT_FIELDS = ["what", "why", "question", "note", "approve", "decline", "approved", "declined"] as const;

export function isRobotAccess(value: unknown): value is RobotAccessView {
  const view = value as Partial<RobotAccessView> | null;
  if (!view || typeof view.proposalDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(view.proposalDigest)
    || TEXT_FIELDS.some(field => typeof view[field] !== "string" || !view[field])
    || !Array.isArray(view.items) || !view.items.length || !view.items.every(item => typeof item === "string")) return false;
  const decision = view.decision;
  return decision === null || (Boolean(decision) && typeof decision!.decidedAt === "string"
    && (decision!.kind === "approved" || decision!.kind === "declined"));
}

/** Blueprint's proposal to move chairs or stools out of the robot's way in the job's simulation, for its owner:
 * approve it, or keep them where they are (the job holds). Nothing changes without an answer. */
export function RobotAccess({ token, view, onDecided }: { token: string; view: RobotAccessView; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decision = view.decision;
  async function send(choice: "approve" | "decline") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/robot-access`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ proposalDigest: view.proposalDigest, decision: choice }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Your answer could not be saved. Try again shortly.");
      onDecided();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Try again shortly."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Room for the robot" style={{ marginBottom: "24px" }}>
    <h2>Room for the robot</h2>
    <p>{view.why}</p>
    <p style={{ fontWeight: 600 }}>{view.question}</p>
    <ul style={{ margin: "8px 0" }}>{view.items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>
    <p className="ms-field-hint">{view.note}</p>
    {decision?.kind === "approved"
      ? <p role="status">{view.approved}</p>
      : <>
        {decision?.kind === "declined" && <p role="status">{view.declined}</p>}
        {!decision && <p className="ms-field-hint">Nothing changes until you answer.</p>}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="ms-button" disabled={busy} onClick={() => void send("approve")}>
            {busy ? "Saving…" : view.approve}
          </button>
          {decision?.kind !== "declined" && <button type="button" className="ms-text-button" disabled={busy}
            onClick={() => void send("decline")}>{view.decline}</button>}
        </div>
      </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
