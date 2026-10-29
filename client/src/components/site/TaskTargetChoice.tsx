import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

export type TaskTargetChoiceView = {
  questionDigest: string;
  semanticLabel: string;
  candidates: Array<{ id: string; label: string; referenceTimeMs: number | null }>;
};

function at(ms: number | null): string {
  if (ms === null) return "";
  const seconds = Math.floor(ms / 1000);
  return ` · at ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} in your video`;
}

/** The one question a job can wait on. Answering never starts a new job or upload. */
export function TaskTargetChoice({ token, question, onAnswered }: {
  token: string; question: TaskTargetChoiceView; onAnswered: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/task-target-choice`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ questionDigest: question.questionDigest,
          choice: selected === "none" ? { kind: "none_of_these" } : { kind: "candidate", candidate_id: selected } }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Your answer could not be saved. Try again shortly.");
      onAnswered();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Try again shortly."); }
    finally { setBusy(false); }
  }
  return <section className="job-review" aria-labelledby="task-target-choice-title">
    <h3 id="task-target-choice-title">Which object should the robot move?</h3>
    <p className="ms-field-hint">Blueprint could not tell for sure which {question.semanticLabel.toLowerCase()} in your video the robot should move. Pick it and Blueprint keeps preparing this same job from your saved video.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "12px 0" }}>
      <legend className="ms-field-hint">Choose one</legend>
      {question.candidates.map(candidate => <label key={candidate.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
        <input type="radio" name="task-target-choice" value={candidate.id} checked={selected === candidate.id}
          onChange={() => setSelected(candidate.id)} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
        <span>{candidate.label}{at(candidate.referenceTimeMs)}</span>
      </label>)}
      <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
        <input type="radio" name="task-target-choice" value="none" checked={selected === "none"}
          onChange={() => setSelected("none")} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
        <span>None of these. I will send an updated walkthrough of this job that shows the object clearly.</span>
      </label>
    </fieldset>
    <button type="button" className="ms-button" disabled={!selected || busy} onClick={() => void submit()}>
      {busy ? "Saving your answer…" : "Save answer"}
    </button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
