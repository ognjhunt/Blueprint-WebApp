import type { JobCandidateSelection, JobManagedEvidenceSummary } from "@/types/jobMarketplace";
import { screeningCandidateStateLabel, screeningChoiceLabel, screeningPartnerLabel, screeningReasonLabels,
  screeningRelationshipLabel } from "@/lib/screeningPlainLanguage";

type Screening = NonNullable<JobManagedEvidenceSummary["screening"]>;
type SuccessRange = NonNullable<Screening["candidates"][number]["successRange"]>;

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
 */
export function PolicyScreeningCandidates({ screening, showCodes = false }: {
  screening: Screening; showCodes?: boolean;
}) {
  const selection = screening.selection;
  const ranges = new Map(screening.candidates.flatMap(row => row.successRange && row.scored > 0
    ? [[row.candidateId, row.successRange] as const] : []));
  const confidence = [...ranges.values()][0]?.confidencePercent;
  return <div className="overflow-x-auto">{selection && <CandidateChoice selection={selection} showCodes={showCodes} ranges={ranges}
    names={new Map(screening.candidates.map(row => [row.candidateId, row.name]))} />}<table className="w-full text-left text-sm">
    <caption className="sr-only">Candidates evaluated for your job</caption>
    <thead><tr><th scope="col">Candidate</th><th scope="col">Progress</th><th scope="col">Scored outcomes</th>
      {selection && <th scope="col">Choice</th>}</tr></thead>
    <tbody>{screening.candidates.map(candidate => {
      const limits = showCodes ? candidate.blockers : screeningReasonLabels(candidate.blockers);
      return <tr key={candidate.candidateId}>
        <th scope="row" className="py-2 pr-3 font-medium">{candidate.name}
          {candidate.executionEvidence?.execution_evidence_kind === "scripted_simulator_state_baseline"
            && <p className="font-normal">Scripted baseline: a hand-coded reference run, not a learned or vendor policy. It does not show how those policies perform.</p>}</th>
        <td className="py-2 pr-3">{showCodes ? candidate.state : screeningCandidateStateLabel(candidate.state)} · {candidate.scored}/{candidate.planned} scored
          {limits.length > 0 && <details><summary>Recorded limitations</summary>
            <ul>{limits.map((limit, index) => <li key={index}>{showCodes ? <code>{limit}</code> : limit}</li>)}</ul></details>}</td>
        <td className="py-2">{scoredOutcomes(candidate)}</td>
        {selection && <td className="py-2 pl-3">{choiceOutcome(selection, candidate.candidateId, showCodes)}</td>}
      </tr>;
    })}</tbody>
  </table>{confidence !== undefined && <p className="ms-field-hint">“Likely between” is a {confidence}% confidence range from the scored tries,
    for this simulated scene only. It assumes each try is independent; fewer tries give a wider range.</p>}</div>;
}
