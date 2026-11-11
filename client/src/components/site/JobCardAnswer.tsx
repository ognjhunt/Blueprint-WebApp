import { useState } from "react";
import type { User } from "firebase/auth";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { ANSWER_CONFIDENCE_LABELS, EVIDENCE_LEVEL_LABELS, type AnswerBasis, type AnswerEvidence } from "@/lib/siteAnswer";
import type { JobCardAnswerRobot, JobCardAnswerSummary, TaskCardDetail } from "@/types/taskBrowse";

export const JOB_CARD_ANSWER_TITLE = "Blueprint's answer for this job";

/** Where a number came from, said about the site for a company reading the card. */
const BASIS_LABELS: Readonly<Record<AnswerBasis, string>> = {
  site_measured: "measured by the site",
  site_stated: "stated by the site",
  video_observed: "seen in the site's video",
  video_estimate: "estimated from the site's video",
  scene_measured: "measured in the scene built from the site's video",
};

function dateInWords(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function SourceLink({ evidence }: { evidence: AnswerEvidence }) {
  return <a className="ms-text-link" href={evidence.sourceUrl} target="_blank" rel="noreferrer">
    {evidence.sourceTitle}, {evidence.publisher}{evidence.publishedOn ? `, ${dateInWords(evidence.publishedOn)}` : ""}
  </a>;
}

function Robot({ robot, role }: { robot: JobCardAnswerRobot; role: "Pick" | "Runner-up" }) {
  return <article className={role === "Pick" ? "site-answer-robot" : "site-answer-runner-up"} aria-label={role}>
    <p className="job-eyebrow">{role}</p>
    <h4>{robot.manufacturer} {robot.name}</h4>
    <p className="site-answer-verdict">{robot.verdictLabel}</p>
    {robot.specs.length > 0 && <p className="site-answer-specs">Published figures:{" "}
      {robot.specs.map((spec, index) => <span key={spec.label}>{index > 0 && " · "}{spec.label} {spec.display}{" "}
        (<a className="ms-text-link" href={spec.sourceUrl} target="_blank" rel="noreferrer">source</a>)</span>)}
    </p>}
    {robot.evidence.length
      ? robot.evidence.map(item => <div key={item.sourceUrl} className="site-answer-evidence">
        <p className="job-eyebrow">{EVIDENCE_LEVEL_LABELS[item.level]}{item.scope === "maker" ? " (for this maker, not this model by name)" : ""}</p>
        <p>{item.summary}</p>
        <blockquote>“{item.quote}”</blockquote>
        <p className="ms-field-hint">Source: <SourceLink evidence={item} /></p>
      </div>)
      : <p className="ms-field-hint">We found no documented use of this robot on this kind of job.</p>}
  </article>;
}

/** The answer a site shared with its card, under the card's own content. */
export function JobCardAnswer({ answer }: { answer: JobCardAnswerSummary }) {
  return <section className="site-answer" aria-label={JOB_CARD_ANSWER_TITLE}>
    <h3>{JOB_CARD_ANSWER_TITLE}</h3>
    <p className="site-answer-headline">{answer.headline}</p>
    {answer.familyLabel && <p className="ms-field-hint">Kind of job: {answer.familyLabel}</p>}
    {answer.pick && <Robot robot={answer.pick} role="Pick" />}
    {answer.runnerUp && <Robot robot={answer.runnerUp} role="Runner-up" />}
    {answer.simulation && <p>Simulation: {answer.simulation}</p>}
    <div className="job-review">
      <h4>How sure: {ANSWER_CONFIDENCE_LABELS[answer.confidence.level]}</h4>
      {answer.confidence.reason && <p>{answer.confidence.reason}</p>}
    </div>
    {answer.facts.length > 0 && <div className="job-review">
      <h4>The numbers this rests on</h4>
      <ul>{answer.facts.map(fact => <li key={fact.label}>{fact.label}: {fact.display} <span className="ms-field-hint">({BASIS_LABELS[fact.basis]})</span></li>)}</ul>
    </div>}
    {answer.unknowns.length > 0 && <div className="job-review">
      <h4>What the video could not tell</h4>
      <ul>{answer.unknowns.map(item => <li key={item}>{item}</li>)}</ul>
    </div>}
    <p className="ms-field-hint">{answer.note}</p>
  </section>;
}

/** The browse list's one line, and the full answer when the company opens it. */
export function JobCardAnswerLine({ jobId, headline, user }: { jobId: string; headline: string; user: User | null }) {
  const [state, setState] = useState<"closed" | "loading" | "ready" | "error">("closed");
  const [answer, setAnswer] = useState<JobCardAnswerSummary | null>(null);
  async function load() {
    if (state === "loading" || state === "ready") return;
    setState("loading");
    try {
      const headers = await withFirebaseAuthHeaders(user).catch(() => ({}));
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}`, { headers });
      const body = await response.json() as { item?: TaskCardDetail };
      if (!response.ok || !body.item) throw new Error("unavailable");
      setAnswer(body.item.answerSummary ?? null);
      setState("ready");
    } catch { setState("error"); }
  }
  return <details className="ms-task-interest" onToggle={event => { if ((event.currentTarget as HTMLDetailsElement).open) void load(); }}>
    <summary>{JOB_CARD_ANSWER_TITLE}: {headline}</summary>
    {state === "loading" && <p role="status">Loading…</p>}
    {state === "error" && <p role="alert">The answer could not be loaded. Try again shortly.</p>}
    {state === "ready" && (answer ? <JobCardAnswer answer={answer} /> : <p className="ms-field-hint">This answer is no longer shared.</p>)}
  </details>;
}
