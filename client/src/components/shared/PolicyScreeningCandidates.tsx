import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

/** The same accepted job evaluation appears in the site and operations workspaces. */
export function PolicyScreeningCandidates({ screening }: { screening: NonNullable<JobManagedEvidenceSummary["screening"]> }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">Candidates evaluated for your job</caption>
    <thead><tr><th scope="col">Candidate</th><th scope="col">Progress</th><th scope="col">Scored outcomes</th></tr></thead>
    <tbody>{screening.candidates.map(candidate => <tr key={candidate.candidateId}>
      <th scope="row" className="py-2 pr-3 font-medium">{candidate.name}
        {candidate.executionEvidence?.execution_evidence_kind === "scripted_simulator_state_baseline"
          && <p className="font-normal">Scripted baseline: a hand-coded reference run, not a learned or vendor policy. It does not show how those policies perform.</p>}</th>
      <td className="py-2 pr-3">{candidate.state.replace(/_/g, " ")} · {candidate.scored}/{candidate.planned} scored
        {candidate.blockers.length > 0 && <details><summary>Recorded limitations</summary>
          <ul>{candidate.blockers.map((blocker, index) => <li key={index}>{blocker.replace(/_/g, " ")}</li>)}</ul></details>}</td>
      <td className="py-2">{candidate.succeeded} succeeded · {candidate.failed} failed · {candidate.void} unscorable</td>
    </tr>)}</tbody>
  </table></div>;
}
