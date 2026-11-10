import { PolicyScreeningCandidates } from "@/components/shared/PolicyScreeningCandidates";
import { ScreeningPracticeRuns } from "@/components/shared/ScreeningPracticeRuns";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

type PracticeRunVideoUrls = (runId: string, candidateId: string, videoIds: string[]) => Promise<Record<string, string>>;

/** The screenings of a job that are current, unless a corrected object selection superseded them. */
export function currentScreenings(evidence: JobManagedEvidenceSummary[] | undefined, superseded = false) {
  return superseded ? [] : (evidence ?? []).filter(item => item.current && item.screening);
}

/**
 * What Blueprint's own checks recorded about the scene a run used, one plain sentence each (the server
 * turns each flag into its sentence; no code reaches the page). Shown only when something was recorded.
 */
function SceneSetupNotes({ notes }: { notes: string[] | undefined }) {
  if (!notes?.length) return null;
  return <div aria-label="What our checks recorded about the simulated scene">
    <p className="ms-field-hint">What our own checks recorded about the scene this ran in:</p>
    <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul>
  </div>;
}

/** An evaluation with something to look at: a scored try or a kept practice run. */
const hasResults = (item: JobManagedEvidenceSummary) => item.screening!.candidates
  .some(candidate => candidate.scored > 0 || (candidate.practiceRuns?.length ?? 0) > 0);

/**
 * Blueprint's current screening results for a job, said the same way on its
 * job page and in the signed-in workspace. With `practiceRunVideoUrls` (the
 * owner's own task page) each candidate's practice runs can be watched, under
 * that candidate's row.
 *
 * Evaluations arrive newest first. The newest is shown, and so is every
 * earlier one with scored results: a candidate that finished before a
 * Blueprint update keeps its result there, not in the newer run. Earlier
 * evaluations with nothing scored are folded under one "Earlier evaluation
 * runs" toggle.
 */
export function ManagedScreeningResults({ evidence, superseded = false, className, practiceRunVideoUrls }: {
  evidence: JobManagedEvidenceSummary[] | undefined;
  superseded?: boolean;
  className?: string;
  practiceRunVideoUrls?: PracticeRunVideoUrls;
}) {
  const screenings = currentScreenings(evidence, superseded);
  const shown = screenings.filter((item, index) => index === 0 || hasResults(item));
  const earlier = screenings.filter((item, index) => index > 0 && !hasResults(item));
  return <>{shown.map((item, index) => <section
    key={item.runId} className={className} aria-label="Simulation results for your job">
    {/* Only an estimate is called one: scripted reference baselines alone are not (F-03). */}
    <h3>{item.outcome === "estimate" ? "Your simulation estimate" : "Simulation evaluation"}</h3>
    {index > 0 && <p className="ms-field-hint">From an earlier evaluation run of your job.</p>}
    <p>{item.summary}</p>
    <SceneSetupNotes notes={item.screening!.setupNotes} />
    <PolicyScreeningCandidates screening={item.screening!} practiceRuns={practiceRunVideoUrls && (candidate => <ScreeningPracticeRuns
      candidate={candidate} loadUrls={(candidateId, videoIds) => practiceRunVideoUrls(item.runId, candidateId, videoIds)} />)} />
    {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
  </section>)}
  {earlier.length > 0 && <details className={className}>
    <summary>Earlier evaluation runs ({earlier.length})</summary>
    <p className="ms-field-hint">Runs that a Blueprint update replaced, or that stopped before they gave an estimate. None has a scored practice run.</p>
    {earlier.map(item => <article key={item.runId} className="mt-3" aria-label="Earlier evaluation run">
      <p>{item.summary}</p>
      <SceneSetupNotes notes={item.screening!.setupNotes} />
      <PolicyScreeningCandidates screening={item.screening!} />
    </article>)}
  </details>}</>;
}
