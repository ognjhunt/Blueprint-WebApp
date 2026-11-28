import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import {
  CUSTOM_JOB_FACT_ID, JOB_FACT_CHOICES, JOB_FACT_KEYS, JOB_FACT_NUMBERS, JOB_FACTS_HEADING, KG_PER_LB, NOT_SURE_LABEL,
  isJobFactCode, jobFactKeysFor, jobFactQuestion, jobFactQuestionHint, sanitizeJobFacts, siteAskOrder, typedJobFactNumber,
  type JobFactKey, type JobFacts as JobFactsValue, type JobReading,
} from "@/lib/jobFacts";
import type { JobBriefQuestion, SiteJobBrief } from "@/lib/jobBrief";

export const JOB_FACTS_SAVED = "Saved";
export const JOB_FACTS_NOT_SAVED = "Your answer could not be saved. Try again shortly.";
/** When the job's questions are answered ("Not sure" and "Just looking" count). */
export const JOB_FACTS_DONE = "Thanks. Your answers help companies decide.";
export const JOB_FACTS_CHANGE = "Change";
/** Moves on without an answer: nothing is saved, so a company sees no line for it (unlike "Not sure"). */
export const JOB_FACTS_SKIP = "Skip";
/** When every question was skipped and none answered. */
export const JOB_FACTS_ALL_SKIPPED = "You skipped these for now.";
export const JOB_FACTS_ANSWER_THEM = "Answer them";
export const jobFactsStep = (step: number, total: number) => `${step} of ${total}`;

/**
 * One question on the page, by its slot: a catalog question by its key ("weight"), or one of the job brief's own by its
 * row id ("custom:how_often_moved"). Answers and skips are kept by slot.
 */
type Slot = JobFactKey | `custom:${string}`;
type Question = { slot: Slot } & JobBriefQuestion;
type Answers = Partial<Record<Slot, string>>;
const customSlot = (id: string): Slot => `custom:${id}`;
const isSlot = (value: unknown): value is Slot => (JOB_FACT_KEYS as readonly unknown[]).includes(value)
  || (typeof value === "string" && value.startsWith("custom:") && CUSTOM_JOB_FACT_ID.test(value.slice(7)));

/** The questions the page walks: the brief's while it asks any, else the catalog's for the job (`jobFactKeysFor`). */
function questionsFor(taskFamily: string | undefined, reading: JobReading | null | undefined, brief: SiteJobBrief | null | undefined): Question[] {
  // The kind's heaviest-item question, its rate question and when come first on the site's page (`siteAskOrder`).
  const keyOf = (question: Question) => question.kind === "catalog" ? question.key : null;
  if (brief?.questions.length) return siteAskOrder(brief.questions.map((question): Question => question.kind === "catalog"
    ? { ...question, slot: question.key } : { ...question, slot: customSlot(question.id) }), keyOf);
  return siteAskOrder(jobFactKeysFor(taskFamily, reading).map((key): Question => ({ kind: "catalog", key, slot: key })), keyOf);
}

/**
 * Skipped questions, for this tab only (sessionStorage): a skip is "not now", so a later visit asks again. The key is a
 * short hash of the link, not the link. Storage that throws or is missing only means a reload asks again.
 */
const skippedStorageKey = (token: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 0x01000193);
  return `blueprint.jobFacts.skipped.${(hash >>> 0).toString(36)}`;
};
function readSkipped(token: string): Set<Slot> {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(skippedStorageKey(token)) ?? "[]");
    return new Set((Array.isArray(raw) ? raw : []).filter(isSlot));
  } catch { return new Set(); }
}
function writeSkipped(token: string, skipped: ReadonlySet<Slot>) {
  try { window.sessionStorage.setItem(skippedStorageKey(token), JSON.stringify([...skipped])); } catch { /* asks again after a reload */ }
}

const answersOf = (facts: unknown): Answers => {
  const clean = sanitizeJobFacts(facts);
  const answers: Answers = {};
  if (clean) for (const key of JOB_FACT_KEYS) if (clean[key]) answers[key] = clean[key];
  // A brief's question is answered with the index of the choice tapped, or "unsure".
  for (const [id, answer] of Object.entries(clean?.custom ?? {})) answers[customSlot(id)] = String(answer);
  return answers;
};

/**
 * The site's quick questions (PACKAGE_E E1; planner, 2026-11-12: one at a time), on its job page. Its heading and ONE
 * question, with a small progress indicator, a "Not sure" choice and a Skip. Choices save on tap. A number is saved when
 * the site submits it. Skip saves nothing and moves on. A "Change" link walks the answers again. Once the video reading
 * gives a kind of job, the kind chooses the questions (`jobFactKeysFor`), and weight and size name the object it names
 * (`reading`); before then the keyword match (`taskFamily`) chooses. Once the job has a brief that is used
 * (`client/src/lib/jobBrief.ts`), its questions are asked instead, in its order: the catalog questions it reads answers
 * from and its own, each of its own with "Not sure" added. The choices wrap at phone width. Saves through its
 * own route with the site's signed link. Blocks of different kinds sit at least 8 px apart (the job page's phone
 * layout check).
 */
export function JobFacts({ token, facts, onSaved, taskFamily, reading, brief }: {
  token: string; facts?: Partial<JobFactsValue> | null; onSaved?: (facts: JobFactsValue) => void; taskFamily?: string;
  reading?: JobReading | null; brief?: SiteJobBrief | null;
}) {
  const [answers, setAnswers] = useState<Answers>(() => answersOf(facts));
  const [skipped, setSkipped] = useState<Set<Slot>>(() => readSkipped(token));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  /** While changing earlier answers: which question is shown; null otherwise. */
  const [changing, setChanging] = useState<number | null>(null);
  const groupId = useId();

  // A fresh read of the job (the page polls) replaces the answers only when the stored value changed.
  const factsKey = JSON.stringify(answersOf(facts));
  useEffect(() => { setAnswers(JSON.parse(factsKey) as Answers); }, [factsKey]);

  const questions = questionsFor(taskFamily, reading, brief);
  const total = questions.length;
  const currentQuestion: Question | null = changing !== null ? questions[changing] ?? null
    : questions.find(question => !answers[question.slot] && !skipped.has(question.slot)) ?? null;
  const current: Slot | null = currentQuestion?.slot ?? null;
  const catalogKey: JobFactKey | null = currentQuestion?.kind === "catalog" ? currentQuestion.key : null;
  const answeredCount = questions.filter(question => answers[question.slot]).length;
  const step = currentQuestion ? questions.indexOf(currentQuestion) + 1 : total;
  const numeric = catalogKey ? JOB_FACT_NUMBERS[catalogKey] : undefined;

  // After each step, focus moves to the new question (or the closing line), so a keyboard or screen-reader user keeps
  // their place in the block (review S5).
  const stepRef = useRef<HTMLElement | null>(null);
  const [moved, setMoved] = useState(0);
  useEffect(() => { if (moved > 0) stepRef.current?.focus(); }, [moved]);

  const advance = () => { setChanging(index => index === null ? null : index + 1 >= total ? null : index + 1); setMoved(count => count + 1); };

  /** Skip: nothing is saved. While changing, it moves on and keeps the stored answer. */
  function skip(key: Slot) {
    if (saving.current || status === "saving") return;
    setStatus("idle"); setError("");
    if (changing !== null) { advance(); return; }
    const next = new Set(skipped).add(key);
    setSkipped(next); writeSkipped(token, next);
    setMoved(count => count + 1);
  }

  // A save in flight, read synchronously: two presses in the same tick (before a re-render) send one request.
  const saving = useRef(false);
  async function choose(key: Slot, code: string) {
    if (saving.current || status === "saving") return;
    // The answer already chosen: moving on, nothing to save.
    if (answers[key] === code) { advance(); return; }
    saving.current = true;
    setStatus("saving"); setError("");
    try {
      // A brief's own question is saved by its row id, with the index of the choice tapped or "unsure".
      // With the version of the brief shown, so a brief written again since refuses the tap rather than record another
      // answer under the same index.
      const body = key.startsWith("custom:") ? { custom: key.slice(7), code: code === "unsure" ? "unsure" : Number(code),
        version: brief?.version } : { key, code };
      const response = await fetch(`/api/job-facts/${encodeURIComponent(token)}`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify(body),
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

  function submitNumber(event: FormEvent<HTMLFormElement>, key: JobFactKey) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = Number(form.get("value"));
    // A weight in pounds is saved as typed ("44lb"), and read in kilograms where a number is needed (`jobFactNumber`).
    const fromPounds = form.get("unit") === "lb";
    const code = `${value}${fromPounds ? "lb" : ""}`;
    if (!isJobFactCode(key, code)) {
      setStatus("error"); setError("Enter a positive number with up to three decimal places, or choose Not sure.");
      return;
    }
    void choose(key, code);
  }

  const hint = catalogKey ? jobFactQuestionHint(catalogKey, reading) : null;
  // The choices of the question shown: the catalog's own, or the brief's with "Not sure" added.
  const choices: ReadonlyArray<{ code: string; label: string }> = currentQuestion?.kind === "custom"
    ? [...currentQuestion.choices.map((label, index) => ({ code: String(index), label })), { code: "unsure", label: NOT_SURE_LABEL }]
    : catalogKey ? JOB_FACT_CHOICES[catalogKey] : [];
  const restart = () => { setChanging(0); setStatus("idle"); setMoved(count => count + 1); };
  return <section aria-labelledby={`${groupId}-heading`} className="site-job-facts" data-testid="job-facts" style={{ margin: "16px 0 24px" }}>
    <h2 id={`${groupId}-heading`} className="site-job-facts-heading">{JOB_FACTS_HEADING}</h2>
    {current ? <div role="group" aria-labelledby={`${groupId}-question`} aria-describedby={hint ? `${groupId}-hint` : undefined} key={current}>
      {/* Buttons, not radios: arrow keys never save; Enter or Space on a choice does (review S5). */}
      <p id={`${groupId}-question`} className="site-job-fact-question" ref={node => { stepRef.current = node; }} tabIndex={-1}>
        {currentQuestion?.kind === "custom" ? currentQuestion.question : jobFactQuestion(catalogKey!, reading)}</p>
      {hint && <p id={`${groupId}-hint`} className="ms-field-hint site-job-fact-hint">{hint}</p>}
      {numeric && catalogKey && <form className="ms-form ms-job-number" onSubmit={event => submitNumber(event, catalogKey)}>
        <label>{catalogKey === "maxLoadedWeightKg" ? "Weight" : numeric.unit}
          <input name="value" type="number" required min={numeric.min} step={numeric.whole ? 1 : "any"}
            max={catalogKey === "maxLoadedWeightKg" ? Math.floor(numeric.max / KG_PER_LB) : numeric.max}
            inputMode={numeric.whole ? "numeric" : "decimal"} defaultValue={typedJobFactNumber(catalogKey, answers[catalogKey])?.value} />
        </label>
        {catalogKey === "maxLoadedWeightKg" && <label>Unit<select name="unit" defaultValue={typedJobFactNumber(catalogKey, answers[catalogKey])?.unit ?? "lb"}>
          <option value="lb">lb</option><option value="kg">kg</option>
        </select></label>}
        <button type="submit" className="ms-button" disabled={status === "saving"}>Save</button>
      </form>}
      <div className="site-job-fact-choices">
        {choices.map(choice => {
          const chosen = answers[current] === choice.code;
          // `aria-disabled`, not `disabled`, while a save runs: a disabled button drops keyboard focus, and nothing would put
          // it back after a failed save. `choose` ignores a press while saving.
          return <button key={choice.code} type="button" className="site-job-fact-choice" aria-pressed={chosen}
            aria-disabled={status === "saving" || undefined} onClick={() => void choose(current, choice.code)}>{choice.label}</button>;
        })}
      </div>
      <div className="site-job-fact-footer">
        <span className="site-job-fact-progress">
          <span className="site-job-fact-bar" aria-hidden="true"><span style={{ width: `${Math.round((step / total) * 100)}%` }} /></span>
          <span className="ms-field-hint">{jobFactsStep(step, total)}</span>
        </span>
        <button type="button" className="ms-inline-link site-job-fact-skip" aria-disabled={status === "saving" || undefined}
          onClick={() => skip(current)}>{JOB_FACTS_SKIP}</button>
      </div>
    </div> : <p ref={node => { stepRef.current = node; }} tabIndex={-1} style={{ margin: 0 }}>
      {answeredCount === 0 && skipped.size > 0 ? JOB_FACTS_ALL_SKIPPED : JOB_FACTS_DONE}{" "}
      <button type="button" className="ms-inline-link" onClick={restart}>
        {answeredCount === 0 && skipped.size > 0 ? JOB_FACTS_ANSWER_THEM : JOB_FACTS_CHANGE}</button>
    </p>}
    <p role="status" aria-live="polite" className="ms-field-hint" style={{ minHeight: "1.4em", margin: "8px 0 0" }}>
      {status === "saving" ? "Saving…" : status === "saved" && current ? JOB_FACTS_SAVED : ""}
    </p>
    {status === "error" && <p role="alert">{error}</p>}
  </section>;
}

export default JobFacts;
