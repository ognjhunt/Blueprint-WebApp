import { UNNAMED_POLICY } from "@/data/simulationPolicies";
import type { SimulationProof as SimulationProofView } from "@/lib/simulationProof";

type Row = NonNullable<SimulationProofView["policyComparison"]>["rows"][number];

/** At the start of a row, the plain phrase for a policy not in our list starts with a capital. */
const rowName = (name: string) => (name.startsWith(UNNAMED_POLICY) ? `A${name.slice(1)}` : name);

/** The leader's mark says as much as the comparison does: "Did best" only when the gap is unlikely to be chance. */
function PolicyRow({ row, separated }: { row: Row; separated: boolean }) {
  return <li className={row.chosen ? "site-proof-row site-proof-best" : "site-proof-row"}>
    <span className="site-proof-name"><strong>{rowName(row.policy)}</strong>{row.maker && <span className="ms-field-hint"> from {row.maker}</span>}</span>
    <span>{row.succeeded} of {row.scored} {row.scored === 1 ? "try" : "tries"}{row.rangeText && <span className="ms-field-hint"> · {row.rangeText}</span>}
      {/* A row left out of the comparison says which robot it ran on. */}
      {!row.compared && <span className="ms-field-hint"> · on {row.robot ?? "a robot we could not confirm"}, not compared</span>}
      {/* How far a policy that completed nothing got, when another one did complete the job: a fact, never a rank. */}
      {row.furthestShown && row.furthestDetail && <span className="ms-field-hint"> · {row.furthestDetail}</span>}</span>
    {row.chosen && <span className="site-proof-mark">{separated ? "Did best" : "Ahead"}</span>}
  </li>;
}

/**
 * "Tested in simulation", as part of the site's answer: what the simulation of
 * the site has shown about the picked robot's reach and arm path and about how
 * public AI control policies compared on the job, how far published studies say
 * such a simulation can be trusted, and which of their conditions hold for this
 * job. Renders a `SimulationProof` as projected; it adds no claim of its own.
 */
export function SimulationProof({ proof }: { proof: SimulationProofView }) {
  const comparison = proof.policyComparison;
  const done = proof.state === "done";
  // The headline already says the comparison's first sentence; only what the rest adds is said below.
  const line = comparison ? (comparison.line.startsWith(proof.headline) ? comparison.line.slice(proof.headline.length).trim() : comparison.line) || null : null;
  // Which robot the policies ran on is said where the results are, not only at the foot of the section,
  // so a result is never read as a test of the picked robot.
  const otherRobot = done && comparison && !comparison.sameRobotAsPick
    ? proof.forThisJob.find(item => item.includes(comparison.robotName)) ?? null : null;
  const forThisJob = proof.forThisJob.filter(item => item !== otherRobot);
  return <section className="site-answer-proof" aria-labelledby="simulation-proof-title">
    <h3 id="simulation-proof-title">Tested in simulation</h3>
    <p className="site-proof-headline">{proof.headline}</p>
    {proof.robotCheck && <>
      <h4>{proof.robotCheck.pickChecked === null ? "The robots in your scene" : "Your robot in your scene"}</h4>
      <p>{proof.robotCheck.line}</p>
    </>}
    {done && comparison && <>
      <h4>Control policies on your job</h4>
      {otherRobot && <p className="site-proof-robot">{otherRobot}</p>}
      {line && <p>{line}</p>}
      {!comparison.winner && comparison.sceneNotes.length > 0 && <ul className="site-proof-notes">
        {comparison.sceneNotes.map(note => <li key={note}>{note}</li>)}
      </ul>}
      {comparison.rows.length > 0 && <ul className="site-proof-rows" aria-label="Control policies tried">
        {comparison.rows.map((row, index) => <PolicyRow key={`${index}:${row.policy}`} row={row} separated={comparison.separated} />)}
      </ul>}
      {comparison.winner && comparison.sceneNotes.length > 0 && <ul className="site-proof-notes">
        {comparison.sceneNotes.map(note => <li key={note}>{note}</li>)}
      </ul>}
      {comparison.didNotRunLine && <p className="ms-field-hint">{comparison.didNotRunLine}</p>}
    </>}
    {done && <>
      <h4>How far to trust this</h4>
      <p>{proof.accuracy.statement}</p>
      <p>{proof.accuracy.conditions}</p>
      <p className="ms-field-hint">Sources:</p>
      <ul className="site-proof-sources">{proof.accuracy.sources.map(source => <li key={source.url}>
        <a className="ms-text-link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      </li>)}</ul>
      {forThisJob.length > 0 && <>
        <p className="site-proof-for-job">For your job:</p>
        <ul>{forThisJob.map(item => <li key={item}>{item}</li>)}</ul>
      </>}
    </>}
  </section>;
}
