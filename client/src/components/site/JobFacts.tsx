import { useEffect, useId, useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, JOB_FACT_QUESTIONS, JOB_FACTS_HEADING, sanitizeJobFacts,
  type JobFactKey, type JobFacts as JobFactsValue,
} from "@/lib/jobFacts";

export const JOB_FACTS_INTRO = "Optional. Tap an answer; it saves at once.";
export const JOB_FACTS_SAVED = "Saved";
export const JOB_FACTS_NOT_SAVED = "Your answer could not be saved. Try again shortly.";

type Answers = Partial<Record<JobFactKey, string>>;

const answersOf = (facts: unknown): Answers => {
  const clean = sanitizeJobFacts(facts);
  const answers: Answers = {};
  if (clean) for (const key of JOB_FACT_KEYS) if (clean[key]) answers[key] = clean[key];
  return answers;
};

/**
 * The site's quick questions (PACKAGE_E E1), under the job sentence on its job page. Taps, never
 * typing; "Not sure" on each; a tap saves at once and another tap changes it. Each question is a radio
 * group with a legend, so it works with a keyboard and a screen reader, and the choices wrap at phone
 * width. Saves through its own route with the site's signed link.
 */
export function JobFacts({ token, facts, onSaved }: {
  token: string; facts?: Partial<JobFactsValue> | null; onSaved?: (facts: JobFactsValue) => void;
}) {
  const [answers, setAnswers] = useState<Answers>(() => answersOf(facts));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const groupId = useId();

  // A fresh read of the job (the page polls) replaces the answers only when the stored value changed.
  const factsKey = JSON.stringify(answersOf(facts));
  useEffect(() => { setAnswers(JSON.parse(factsKey) as Answers); }, [factsKey]);

  async function choose(key: JobFactKey, code: string) {
    if (answers[key] === code) return;
    const before = answers;
    setAnswers({ ...answers, [key]: code });
    setStatus("saving"); setError("");
    try {
      const response = await fetch(`/api/job-facts/${encodeURIComponent(token)}`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ key, code }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(typeof result?.error === "string" ? result.error : JOB_FACTS_NOT_SAVED);
      const stored = sanitizeJobFacts(result.jobFacts);
      if (stored) { setAnswers(answersOf(stored)); onSaved?.(stored); }
      setStatus("saved");
    } catch (cause) {
      setAnswers(before);
      setStatus("error");
      setError(cause instanceof Error && cause.message ? cause.message : JOB_FACTS_NOT_SAVED);
    }
  }

  return <section aria-labelledby={`${groupId}-heading`} data-testid="job-facts" style={{ margin: "16px 0 24px" }}>
    <h2 id={`${groupId}-heading`} style={{ fontSize: "1.05rem", margin: "0 0 4px" }}>{JOB_FACTS_HEADING}</h2>
    <p className="ms-field-hint" style={{ margin: "0 0 8px" }}>{JOB_FACTS_INTRO}</p>
    {JOB_FACT_KEYS.map(key => <fieldset key={key} style={{ border: 0, padding: 0, margin: "12px 0", minWidth: 0 }}>
      <legend style={{ fontWeight: 600, padding: 0, marginBottom: "6px" }}>{JOB_FACT_QUESTIONS[key]}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {JOB_FACT_CHOICES[key].map(choice => {
          const checked = answers[key] === choice.code;
          return <label key={choice.code} style={{
            display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "44px", padding: "6px 12px",
            border: `1px solid ${checked ? "currentColor" : "rgba(127,127,127,0.45)"}`, borderRadius: "999px",
            fontWeight: checked ? 600 : 400, cursor: "pointer", maxWidth: "100%",
          }}>
            <input type="radio" name={`${groupId}-${key}`} value={choice.code} checked={checked}
              onChange={() => void choose(key, choice.code)} style={{ width: "auto", minHeight: 0, margin: 0 }} />
            <span>{choice.label}</span>
          </label>;
        })}
      </div>
    </fieldset>)}
    <p role="status" aria-live="polite" className="ms-field-hint" style={{ minHeight: "1.4em", margin: "4px 0 0" }}>
      {status === "saving" ? "Saving…" : status === "saved" ? JOB_FACTS_SAVED : ""}
    </p>
    {status === "error" && <p role="alert">{error}</p>}
  </section>;
}

export default JobFacts;
