import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

export type TaskTargetChoiceView = {
  questionDigest: string;
  semanticLabel: string;
  guessedCandidateId: string;
  candidates: Array<{ id: string; label: string; referenceTimeMs: number | null }>;
};

function at(ms: number | null): string {
  if (ms === null) return "";
  const seconds = Math.floor(ms / 1000);
  return ` · at ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} in your video`;
}

/** An optional correction: the job already continues with Blueprint's pick. Never a new job or upload. */
export function TaskTargetChoice({ token, question, onAnswered }: {
  token: string; question: TaskTargetChoiceView; onAnswered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guess = question.candidates.find(candidate => candidate.id === question.guessedCandidateId);
  const others = question.candidates.filter(candidate => candidate.id !== question.guessedCandidateId);
  if (!guess) return null;
  async function submit() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/task-target-choice`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ questionDigest: question.questionDigest,
          choice: selected === "confirm" ? { kind: "confirm_guess" } : selected === "none" ? { kind: "none_of_these" }
            : { kind: "other_candidate", candidate_id: selected } }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Your answer could not be saved. Try again shortly.");
      onAnswered();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Try again shortly."); }
    finally { setBusy(false); }
  }
  const option = (value: string, text: string) => <label key={value} style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
    <input type="radio" name="task-target-choice" value={value} checked={selected === value}
      onChange={() => setSelected(value)} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
    <span>{text}</span>
  </label>;
  return <section aria-label="Object selection">
    <p className="ms-field-hint">Object used: {guess.label}{at(guess.referenceTimeMs)}. Preparation continues automatically.</p>
    <button type="button" className="ms-text-button" aria-expanded={open} aria-controls="task-target-choice-options"
      onClick={() => setOpen(value => !value)}>{open ? "Close object selection" : "Review or correct object selection"}</button>
    {open && <div id="task-target-choice-options">
    <p className="ms-field-hint">This is Blueprint’s best supported selection. A correction updates this same job using your saved video.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "12px 0" }}>
      <legend className="ms-field-hint">Your answer</legend>
      {option("confirm", "Yes, that is the one")}
      {others.map(candidate => option(candidate.id, `No, it is ${candidate.label}${at(candidate.referenceTimeMs)}`))}
      {option("none", "None of these. I will send an updated walkthrough of this job that shows the object clearly.")}
    </fieldset>
    <button type="button" className="ms-button" disabled={!selected || busy} onClick={() => void submit()}>
      {busy ? "Saving your answer…" : "Save answer"}
    </button>
    {error && <p role="alert">{error}</p>}
    </div>}
  </section>;
}
