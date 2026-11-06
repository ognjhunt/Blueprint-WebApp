import { useId, useState, type ReactNode } from "react";
import type { JobCandidateSelection, JobManagedEvidenceSummary } from "@/types/jobMarketplace";
import { screeningCandidateStateLabel, screeningChoiceLabel, screeningPartnerLabel, screeningReasonLabels,
  screeningRelationshipLabel } from "@/lib/screeningPlainLanguage";

type Screening = NonNullable<JobManagedEvidenceSummary["screening"]>;
type Candidate = Screening["candidates"][number];
type SuccessRange = NonNullable<Candidate["successRange"]>;

/** States in which a candidate never got a scored try in this evaluation (its row says why). */
const NOT_RUN_STATES = new Set(["blocked", "unavailable", "deferred", "infeasible"]);

/** A candidate that ran, is running, or is still queued to run; the rest did not run and are folded away. */
export const candidateTookPart = (candidate: Pick<Candidate, "state" | "scored" | "void">) =>
  candidate.scored > 0 || candidate.void > 0 || !NOT_RUN_STATES.has(candidate.state);

/** A bounded estimate in plain words: where the success rate likely lies. */
const likelyBetween = (range: SuccessRange) => `likely between ${range.lowerPercent}% and ${range.upperPercent}%`;

/** A candidate's scored outcomes, with the range its success rate likely lies in. */
function scoredOutcomes(candidate: Screening["candidates"][number]) {
  const rest = `${candidate.failed} failed · ${candidate.void} unscorable`;
  if (!candidate.successRange || candidate.scored <= 0) return `${candidate.succeeded} succeeded · ${rest}`;
  return <><span className="block">Succeeded in {candidate.succeeded} of {candidate.scored} scored tries; {likelyBetween(candidate.successRange)}.</span>
    <span className="block">{rest}</span></>;
}

/** The rule's choice, stated as a simulation estimate; companies only where the catalog records them. */
function CandidateChoice({ selection, names, ranges, showCodes }: { selection: JobCandidateSelection; names: Map<string, string>;
  ranges: Map<string, SuccessRange>; showCodes: boolean }) {
  const chosen = selection.chosen;
  const range = chosen ? ranges.get(chosen.candidateId) : undefined;
  const relationship = chosen?.relationship ? showCodes ? chosen.relationship : screeningRelationshipLabel(chosen.relationship) : null;
  const partnerLimits = chosen ? showCodes ? chosen.partnerBlockers : [...new Set(chosen.partnerBlockers.map(screeningPartnerLabel))] : [];
  return <div className="mb-3 grid gap-1" aria-label="Candidate choice">
    <p className="font-medium">{chosen
      ? `Chosen in simulation: ${chosen.name}. ${chosen.succeeded} of ${chosen.scored} scored episodes succeeded (estimated success rate ${Math.round(chosen.successRate * 100)}%${range ? `; ${likelyBetween(range)}` : ""}).`
      : selection.status === "no_successful_candidate" ? "No successful candidate: no evaluated candidate succeeded in simulation."
        : "No successful candidate: no candidate policy finished a scored simulation run."}</p>
    {selection.tiedWith.length > 0 && <p>Tied with the same estimate: {selection.tiedWith.map(id => names.get(id) ?? id).join(", ")}.</p>}
    {chosen && (chosen.deploymentCompanies.length
      ? <p>Deployment companies recorded for this configuration: {chosen.deploymentCompanies.join(", ")}
        {relationship && ` (${relationship})`}
        {chosen.evidenceUrl?.startsWith("https://") && <> · <a className="underline" href={chosen.evidenceUrl} target="_blank" rel="noreferrer">source</a></>}.
        A recorded association, not a commitment to this site.</p>
      : <p>No recorded deployment partner for this configuration.</p>)}
    {chosen && chosen.registryTeams.length > 0 && <p>In Blueprint's robot team registry by name: {chosen.registryTeams.map(team => team.name).join(", ")}.</p>}
    {partnerLimits.length > 0 && <details><summary>Partner limitations</summary>
      <ul>{partnerLimits.map(limit => <li key={limit}>{showCodes ? <code>{limit}</code> : limit}</li>)}</ul></details>}
    <p className="ms-field-hint">Chosen by a fixed rule from the simulation results, without a person. A simulation result is a bounded estimate; it does not certify physical performance or safety.</p>
  </div>;
}

function choiceOutcome(selection: JobCandidateSelection, candidateId: string, showCodes: boolean) {
  const row = selection.candidates.find(value => value.candidateId === candidateId);
  if (selection.chosen?.candidateId === candidateId) return "Chosen";
  if (selection.tiedWith.includes(candidateId)) return "Tied with the choice";
  if (row?.resultRank) return `Ranked ${row.resultRank}`;
  if (!row?.choiceBlocker) return "Not recorded";
  return showCodes ? `Not chosen: ${row.choiceBlocker}` : screeningChoiceLabel(row.choiceBlocker);
}

/**
 * The same accepted job evaluation appears in the site and operations
 * workspaces. A site reads plain words; `showCodes` (operations views only)
 * shows the raw state and reason codes instead.
 *
 * Only the candidates that took part are listed; those that did not run sit
 * behind one toggle, each still saying why. When none took part, every row
 * shows, since the reasons are then the whole result. `practiceRuns` puts a
 * candidate's practice runs directly under its own row.
 */
export function PolicyScreeningCandidates({ screening, showCodes = false, practiceRuns }: {
  screening: Screening; showCodes?: boolean; practiceRuns?: (candidate: Candidate) => ReactNode;
}) {
  const [showNotRun, setShowNotRun] = useState(false);
  const notRunId = useId();
  const selection = screening.selection;
  const ranges = new Map(screening.candidates.flatMap(row => row.successRange && row.scored > 0
    ? [[row.candidateId, row.successRange] as const] : []));
  const confidence = [...ranges.values()][0]?.confidencePercent;
  const tookPart = screening.candidates.filter(candidateTookPart);
  const listed = tookPart.length ? tookPart : screening.candidates;
  const notRun = tookPart.length ? screening.candidates.filter(candidate => !candidateTookPart(candidate)) : [];
  const columns = selection ? 4 : 3;
  const row = (candidate: Candidate) => {
    const limits = showCodes ? candidate.blockers : screeningReasonLabels(candidate.blockers);
    const runs = practiceRuns && candidate.practiceRuns?.length ? practiceRuns(candidate) : null;
    const developmentOnly = selection?.candidates.some(value => value.candidateId === candidate.candidateId
      && value.choiceBlocker === "development_only_reference");
    return [<tr key={candidate.candidateId}>
      <th scope="row" className="py-2 pr-3 font-medium">{candidate.name}
        {candidate.executionEvidence?.execution_evidence_kind === "scripted_simulator_state_baseline"
          && <p className="font-normal">Scripted baseline: a hand-coded reference run, not a learned or vendor policy. It does not show how those policies perform.</p>}
        {developmentOnly && <p className="font-normal">Development check: run for internal development only. It is not ranked against the other candidates or chosen, and it does not qualify this robot or policy.</p>}</th>
      <td className="py-2 pr-3">{showCodes ? candidate.state : screeningCandidateStateLabel(candidate.state)} · {candidate.scored}/{candidate.planned} scored
        {limits.length > 0 && <details><summary>Recorded limitations</summary>
          <ul>{limits.map((limit, index) => <li key={index}>{showCodes ? <code>{limit}</code> : limit}</li>)}</ul></details>}</td>
      <td className="py-2">{scoredOutcomes(candidate)}</td>
      {selection && <td className="py-2 pl-3">{choiceOutcome(selection, candidate.candidateId, showCodes)}</td>}
    </tr>, runs && <tr key={`${candidate.candidateId}-practice-runs`}><td colSpan={columns} className="pb-4">{runs}</td></tr>];
  };
  return <div className="overflow-x-auto">{selection && <CandidateChoice selection={selection} showCodes={showCodes} ranges={ranges}
    names={new Map(screening.candidates.map(candidate => [candidate.candidateId, candidate.name]))} />}<table className="w-full text-left text-sm">
    <caption className="sr-only">Candidates evaluated for your job</caption>
    <thead><tr><th scope="col">Candidate</th><th scope="col">Progress</th><th scope="col">Scored outcomes</th>
      {selection && <th scope="col">Choice</th>}</tr></thead>
    <tbody>{listed.map(row)}</tbody>
    {notRun.length > 0 && <tbody id={notRunId} hidden={!showNotRun}>{notRun.map(row)}</tbody>}
  </table>{notRun.length > 0 && <button type="button" className="ws-link mt-2" aria-expanded={showNotRun} aria-controls={notRunId}
    onClick={() => setShowNotRun(value => !value)}>{showNotRun ? "Hide" : "Show"} the {notRun.length} {notRun.length === 1
      ? "candidate that" : "candidates that"} did not run, and why</button>}
  {confidence !== undefined && <p className="ms-field-hint">“Likely between” is a {confidence}% confidence range from the scored tries,
    for this simulated scene only. It assumes each try is independent; fewer tries give a wider range.</p>}</div>;
}
