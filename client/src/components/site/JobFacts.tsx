import { useEffect, useId, useRef, useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, JOB_FACT_QUESTIONS, JOB_FACTS_HEADING, sanitizeJobFacts,
  type JobFactKey, type JobFacts as JobFactsValue,
} from "@/lib/jobFacts";

export const JOB_FACTS_SAVED = "Saved";
export const JOB_FACTS_NOT_SAVED = "Your answer could not be saved. Try again shortly.";
/** When all five are answered ("Not sure" and "Just looking" count). */
export const JOB_FACTS_DONE = "Thanks. Your answers help companies decide.";
export const JOB_FACTS_CHANGE = "Change";
export const jobFactsStep = (step: number, total: number) => `${step} of ${total}`;

type Answers = Partial<Record<JobFactKey, string>>;

const answersOf = (facts: unknown): Answers => {
  const clean = sanitizeJobFacts(facts);
  const answers: Answers = {};
  if (clean) for (const key of JOB_FACT_KEYS) if (clean[key]) answers[key] = clean[key];
  return answers;
};

/**
 * The site's quick questions (PACKAGE_E E1; planner, 2026-11-12: one at a time), on its job page. Its heading and ONE
 * question, a row of tap choices with "Not sure"; a tap saves at once and shows the next unanswered question, with a
 * small "1 of 5". When all five are answered, one line and a "Change" link that walks them again. Taps, never typing.
 * Each question is a radio group with a legend, so it works with a keyboard and a screen reader, and the choices wrap
 * at phone width. Saves through its own route with the site's signed link. Blocks of different kinds sit at least
 * 8 px apart (the job page's phone layout check).
 */
export function JobFacts({ token, facts, onSaved }: {
  token: string; facts?: Partial<JobFactsValue> | null; onSaved?: (facts: JobFactsValue) => void;
}) {
  const [answers, setAnswers] = useState<Answers>(() => answersOf(facts));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  /** While changing earlier answers: which question is shown (walks all five in order); null otherwise. */
  const [changing, setChanging] = useState<number | null>(null);
  const groupId = useId();

  // A fresh read of the job (the page polls) replaces the answers only when the stored value changed.
  const factsKey = JSON.stringify(answersOf(facts));
  useEffect(() => { setAnswers(JSON.parse(factsKey) as Answers); }, [factsKey]);

  const total = JOB_FACT_KEYS.length;
  const current: JobFactKey | null = changing !== null ? JOB_FACT_KEYS[changing] ?? null
    : JOB_FACT_KEYS.find(key => !answers[key]) ?? null;
  const step = current ? JOB_FACT_KEYS.indexOf(current) + 1 : total;

  // After each step, focus moves to the new question (or the closing line), so a keyboard or screen-reader user keeps
  // their place in the block (review S5).
  const stepRef = useRef<HTMLElement | null>(null);
  const [moved, setMoved] = useState(0);
  useEffect(() => { if (moved > 0) stepRef.current?.focus(); }, [moved]);

  const advance = () => { setChanging(index => index === null ? null : index + 1 >= total ? null : index + 1); setMoved(count => count + 1); };

  // A save in flight, read synchronously: two presses in the same tick (before a re-render) send one request.
  const saving = useRef(false);
  async function choose(key: JobFactKey, code: string) {
    if (saving.current || status === "saving") return;
    // The answer already chosen: moving on, nothing to save.
    if (answers[key] === code) { advance(); return; }
    saving.current = true;
    setStatus("saving"); setError("");
    try {
      const response = await fetch(`/api/job-facts/${encodeURIComponent(token)}`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ key, code }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(typeof result?.error === "string" ? result.error : JOB_FACTS_NOT_SAVED);
      const stored = sanitizeJobFacts(result.jobFacts);
      setAnswers(stored ? answersOf(stored) : { ...answers, [key]: code });
      if (stored) onSaved?.(stored);
      setStatus("saved");
      advance();
    } catch (cause) {
      // A failed save stays on the same question, in Change mode too, and says so.
      setStatus("error");
      setError(cause instanceof Error && cause.message ? cause.message : JOB_FACTS_NOT_SAVED);
    } finally {
      saving.current = false;
    }
  }

  return <section aria-labelledby={`${groupId}-heading`} data-testid="job-facts" style={{ margin: "16px 0 24px" }}>
    <h2 id={`${groupId}-heading`} style={{ fontSize: "1.05rem", margin: "0 0 12px" }}>{JOB_FACTS_HEADING}</h2>
    {current ? <div role="group" aria-labelledby={`${groupId}-question`} key={current}>
      {/* Buttons, not radios: arrow keys never save; Enter or Space on a choice does (review S5). */}
      <p id={`${groupId}-question`} ref={node => { stepRef.current = node; }} tabIndex={-1}
        style={{ fontWeight: 600, margin: "0 0 8px" }}>{JOB_FACT_QUESTIONS[current]}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {JOB_FACT_CHOICES[current].map(choice => {
          const chosen = answers[current] === choice.code;
          // `aria-disabled`, not `disabled`, while a save runs: a disabled button drops keyboard focus, and nothing would put
          // it back after a failed save. `choose` ignores a press while saving.
          return <button key={choice.code} type="button" aria-pressed={chosen} aria-disabled={status === "saving" || undefined}
            onClick={() => void choose(current, choice.code)} style={{
              display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "6px 12px", font: "inherit", color: "inherit",
              background: "transparent", border: `1px solid ${chosen ? "currentColor" : "rgba(127,127,127,0.45)"}`, borderRadius: "999px",
              fontWeight: chosen ? 600 : 400, cursor: "pointer", maxWidth: "100%",
            }}>{choice.label}</button>;
        })}
      </div>
      <p className="ms-field-hint" style={{ margin: "12px 0 0" }}>{jobFactsStep(step, total)}</p>
    </div> : <p ref={node => { stepRef.current = node; }} tabIndex={-1} style={{ margin: 0 }}>
      {JOB_FACTS_DONE}{" "}
      <button type="button" className="ms-inline-link" onClick={() => { setChanging(0); setStatus("idle"); setMoved(count => count + 1); }}>{JOB_FACTS_CHANGE}</button>
    </p>}
    <p role="status" aria-live="polite" className="ms-field-hint" style={{ minHeight: "1.4em", margin: "8px 0 0" }}>
      {status === "saving" ? "Saving…" : status === "saved" && current ? JOB_FACTS_SAVED : ""}
    </p>
    {status === "error" && <p role="alert">{error}</p>}
  </section>;
}

export default JobFacts;
