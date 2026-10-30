import type { JobCandidateReadiness } from "../../types/jobMarketplace";

/** Preparation is separate from the scored simulation table, including its empty state. */
export function CandidatePreparation({preview}: {preview?: JobCandidateReadiness}) {
  if (!preview || preview.state === "available" && preview.candidates.length === 0) return null;
  if (preview.state === "unavailable") return <p role="status" className="ms-field-hint">{preview.message}</p>;
  return <section className="job-review" aria-label="Candidate preparation">
    <h3>Candidates not yet evaluated</h3>
    <p>These have not been tested on your job yet. Once the simulation of your site is ready, we check which ones are compatible and choose which configurations to test.</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Preparation status for each robot and policy configuration</caption>
        <thead><tr><th scope="col">Configuration</th><th scope="col">Status and remaining preparation</th></tr></thead>
        <tbody>{preview.candidates.map(row => <tr key={row.candidateId} className="border-t">
          <th scope="row" className="py-3 pr-4 font-medium">{row.name}
            {row.kind === "scripted_baseline" && <span className="block font-normal">Scripted simulation baseline</span>}</th>
          <td className="py-3"><p>Not yet evaluated</p>
            {row.notes.map(note => <p key={note} className="ms-field-hint">{note}</p>)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
