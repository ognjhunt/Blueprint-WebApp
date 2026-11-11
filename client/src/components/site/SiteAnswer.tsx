import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { JOB_CARD_ANSWER_STATEMENT, JOB_CARD_ANSWER_STATEMENT_VERSION } from "@/lib/jobCardAnswerConsent";
import type { SimulationProof as SimulationProofView } from "@/lib/simulationProof";
import { SimulationProof } from "./SimulationProof";
import {
  ANSWER_CONFIDENCE_LABELS, ANSWER_VERDICT_LABELS, EVIDENCE_LEVEL_LABELS,
  type AnswerBasis, type AnswerEvidence, type AnswerRobot, type SiteAnswer as SiteAnswerView,
} from "@/lib/siteAnswer";

const BASIS_LABELS: Readonly<Record<AnswerBasis, string>> = {
  site_measured: "measured at your site",
  site_stated: "you told us",
  video_observed: "seen in your video",
  video_estimate: "estimated from your video",
  scene_measured: "measured in the scene built from your video",
};

const INTRODUCTION_FAILED = "We could not send your request just now. Try again shortly.";
export const FIND_COMPANY_LABEL = "Find a deployment company for this job";
/** Rendered from the statement the introduction route records, so the two never drift. */
export const FIND_COMPANY_CONSENT = JOB_CARD_ANSWER_STATEMENT;
const askedListed = (date: string) => `You asked on ${date}. Your job card is now visible to approved deployment companies. When one responds, Blueprint will introduce you by email.`;
const askedUnlisted = (date: string) => `You asked on ${date}. Blueprint will set up your job card and email you.`;

/** A date in words. A bare `YYYY-MM-DD` is read as that calendar day, whatever the viewer's time zone. */
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

function Specs({ robot }: { robot: AnswerRobot }) {
  if (!robot.specs.length) return null;
  return <p className="site-answer-specs">Published figures:{" "}
    {robot.specs.map((spec, index) => <span key={spec.label}>{index > 0 && " · "}{spec.label} {spec.display}{" "}
      (<a className="ms-text-link" href={spec.sourceUrl} target="_blank" rel="noreferrer">source</a>)</span>)}
  </p>;
}

/** The pick: what it is, why it fits, its published figures and who has used it on this kind of job. */
function PickCard({ robot, familyLabel }: { robot: AnswerRobot; familyLabel: string | null }) {
  return <article className="site-answer-robot" aria-label="Our pick">
    <p className="job-eyebrow">Our pick</p>
    <h3>{robot.manufacturer} {robot.name}</h3>
    <p className="ms-field-hint">{robot.formLabel}</p>
    <p className="site-answer-verdict">{ANSWER_VERDICT_LABELS[robot.verdict]}</p>
    {robot.checks.length > 0 && <ul>{robot.checks.map(check => <li key={check.key}>{check.text}</li>)}</ul>}
    <Specs robot={robot} />
    <h4>{familyLabel ? `Track record for ${familyLabel}` : "Track record"}</h4>
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

/** The runner-up, the same way but shorter: the verdict, its figures and its strongest evidence in one line. */
function RunnerUp({ robot }: { robot: AnswerRobot }) {
  const evidence = robot.evidence[0];
  return <article className="site-answer-runner-up" aria-label="Runner-up">
    <p className="job-eyebrow">Runner-up</p>
    <h3>{robot.manufacturer} {robot.name}</h3>
    <p className="ms-field-hint">{robot.formLabel} · {ANSWER_VERDICT_LABELS[robot.verdict]}</p>
    <Specs robot={robot} />
    {evidence
      ? <p>{EVIDENCE_LEVEL_LABELS[evidence.level]}: {evidence.summary} <span className="ms-field-hint">Source: <SourceLink evidence={evidence} /></span></p>
      : <p className="ms-field-hint">We found no documented use of this robot on this kind of job.</p>}
  </article>;
}

function Facts({ facts }: { facts: SiteAnswerView["facts"] }) {
  if (!facts.length) return null;
  return <div className="job-review">
    <h3>The numbers this rests on</h3>
    <ul>{facts.map(fact => <li key={fact.label}>{fact.label}: {fact.display} <span className="ms-field-hint">({BASIS_LABELS[fact.basis]})</span></li>)}</ul>
  </div>;
}

function JobLine({ job }: { job: SiteAnswerView["job"] }) {
  if (!job.sentence) return null;
  const sentence = job.sentence.trim().replace(/[.!?]+$/, "");
  return <p className="site-answer-job">{job.drafted
    ? <>We read your job as: “{sentence}”. If that is wrong, correct it below.</>
    : <>Your job: “{sentence}”.</>}</p>;
}

/**
 * One button: find a deployment company. One click is the site's explicit choice to share an
 * anonymised summary with approved companies; asked once, it says so and the date.
 */
function Introduction({ token, answer, onRequested }: { token: string; answer: SiteAnswerView; onRequested?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  // Only a response that says the card is not listed changes the confirmation; a stored request reads as listed.
  const [listed, setListed] = useState(true);
  const asked = requestedAt ?? answer.introductionRequestedAtIso;
  async function ask() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/introduction-request`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ statementVersion: JOB_CARD_ANSWER_STATEMENT_VERSION }),
      });
      const result = await response.json().catch(() => null);
      // A 409 says why in the server's words (for example, the wording on the page changed); the button stays.
      if (response.status === 409 && typeof result?.error === "string") { setError(result.error); return; }
      if (!response.ok || result?.ok !== true) throw new Error(INTRODUCTION_FAILED);
      setListed(result.listed !== false);
      setRequestedAt(typeof result.requestedAtIso === "string" ? result.requestedAtIso : new Date().toISOString());
      onRequested?.();
    } catch { setError(INTRODUCTION_FAILED); }
    finally { setBusy(false); }
  }
  return <div className="job-next-action site-answer-next">
    <p className="job-eyebrow">Next step</p>
    {asked
      ? <p role="status">{(listed ? askedListed : askedUnlisted)(dateInWords(asked))}</p>
      : <>
        <button type="button" className="ms-button" disabled={busy} onClick={() => void ask()}>
          {busy ? "Sending…" : FIND_COMPANY_LABEL}
        </button>
        <p className="ms-field-hint site-answer-consent">{FIND_COMPANY_CONSENT}</p>
        {error && <p role="alert">{error}</p>}
      </>}
  </div>;
}

/**
 * The site's answer, at the top of its job page: which robot most likely fits
 * the job, the runner-up, the proof in simulation, what was ruled out, how sure
 * we are and one next step. While there is no pick it says why, and offers no button.
 */
export function SiteAnswer({ token, answer, proof, onIntroductionRequested }: {
  token: string; answer: SiteAnswerView; proof?: SimulationProofView | null; onIntroductionRequested?: () => void;
}) {
  const pick = answer.state === "ready" ? answer.pick : null;
  return <section className="site-answer" aria-labelledby="site-answer-title">
    <h2 id="site-answer-title">Your answer</h2>
    <p className="site-answer-headline">{answer.headline}</p>
    {!pick ? <>
      {answer.reason && <p>{answer.reason}</p>}
      {answer.formNote && <p>{answer.formNote}</p>}
      {proof && <SimulationProof proof={proof} />}
      <Facts facts={answer.facts} />
    </> : <>
      <JobLine job={answer.job} />
      <PickCard robot={pick} familyLabel={answer.job.familyLabel} />
      {answer.approach && <p className="site-answer-approach">How it would be controlled: {answer.approach.text}</p>}
      {answer.formNote && <p>{answer.formNote}</p>}
      {answer.runnerUp && <RunnerUp robot={answer.runnerUp} />}
      {answer.alsoFit.length > 0 && <p>Also fit on paper: {answer.alsoFit.map(robot => `${robot.manufacturer} ${robot.name}`).join(", ")}.</p>}
      {proof && <SimulationProof proof={proof} />}
      {answer.ruledOut.length > 0 && <details className="ms-task-interest">
        <summary>Ruled out ({answer.ruledOut.length + answer.ruledOutMore})</summary>
        <ul>{answer.ruledOut.map(robot => <li key={`${robot.manufacturer} ${robot.name}`}>
          <strong>{robot.manufacturer} {robot.name}.</strong> {robot.reason}</li>)}</ul>
        {answer.ruledOutMore > 0 && <p className="ms-field-hint">And {answer.ruledOutMore} more.</p>}
      </details>}
      {answer.unknowns.length > 0 && <div className="job-review">
        <h3>What we could not tell from your video</h3>
        <ul>{answer.unknowns.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      <div className="job-review">
        <h3>How sure we are: {ANSWER_CONFIDENCE_LABELS[answer.confidence.level]}</h3>
        {answer.confidence.reasons.length > 0 && <ul>{answer.confidence.reasons.map(item => <li key={item}>{item}</li>)}</ul>}
        {answer.confidence.raiseIt.length > 0 && <>
          <h4>What would raise it</h4>
          <ul>{answer.confidence.raiseIt.map(item => <li key={item}>{item}</li>)}</ul>
        </>}
      </div>
      <Facts facts={answer.facts} />
    </>}
    {answer.state === "ready" && <p className="ms-field-hint">
      We checked {answer.checked.models} robots from {answer.checked.makers} makers against their published specifications, retrieved on {dateInWords(answer.checked.specsRetrievedOn)}.{" "}
      {answer.note}
    </p>}
    {pick && answer.nextStep.kind === "introduction" && <Introduction token={token} answer={answer} onRequested={onIntroductionRequested} />}
  </section>;
}
