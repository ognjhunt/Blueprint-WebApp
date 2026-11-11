import type { SimulationProof as SimulationProofView } from "@/lib/simulationProof";

type Row = NonNullable<SimulationProofView["policyComparison"]>["rows"][number];

/** A name that would read to a site as our own working words is never shown as a policy's name. */
const plainPolicy = (name: string) => (/candidate|screening|episode|embodiment|checkpoint/i.test(name) ? "A policy we could not name" : name);

function PolicyRow({ row }: { row: Row }) {
  return <li className={row.chosen ? "site-proof-row site-proof-best" : "site-proof-row"}>
    <span className="site-proof-name"><strong>{plainPolicy(row.policy)}</strong>{row.maker && <span className="ms-field-hint"> from {row.maker}</span>}</span>
    <span>{row.succeeded} of {row.scored} {row.scored === 1 ? "try" : "tries"}{row.rangeText && <span className="ms-field-hint"> · {row.rangeText}</span>}</span>
    {row.chosen && <span className="site-proof-mark">Did best</span>}
  </li>;
}

/**
 * Proof in simulation, as part of the site's answer: what the simulation of
 * the site has shown about the picked robot and about which AI control policy
 * did best, how far published studies say such a simulation can be trusted,
 * and which of their conditions hold for this job. Renders a `SimulationProof`
 * as projected; it adds no claim of its own.
 */
export function SimulationProof({ proof }: { proof: SimulationProofView }) {
  const comparison = proof.policyComparison;
  const done = proof.state === "done";
  // The headline already says the comparison's first sentence; only what it adds is repeated below.
  const line = comparison && comparison.line !== proof.headline && !comparison.separated ? comparison.line : null;
  // Which robot the policies ran on is said where the results are, not only at the foot of the section,
  // so a result is never read as a test of the picked robot.
  const otherRobot = done && comparison && !comparison.sameRobotAsPick
    ? proof.forThisJob.find(item => item.includes(comparison.robotName)) ?? null : null;
  const forThisJob = proof.forThisJob.filter(item => item !== otherRobot);
  return <section className="site-answer-proof" aria-labelledby="simulation-proof-title">
    <h3 id="simulation-proof-title">Proof in simulation</h3>
    <p className="site-proof-headline">{proof.headline}</p>
    {proof.robotCheck && <>
      <h4>{proof.robotCheck.pickChecked === null ? "The robots in your scene" : "Your robot in your scene"}</h4>
      <p>{proof.robotCheck.line}</p>
    </>}
    {done && comparison && <>
      <h4>Control policies on your job</h4>
      {otherRobot && <p className="site-proof-robot">{otherRobot}</p>}
      {line && <p>{line}</p>}
      {!comparison.separated && comparison.sceneNotes.length > 0 && <ul className="site-proof-notes">
        {comparison.sceneNotes.map(note => <li key={note}>{note}</li>)}
      </ul>}
      {comparison.rows.length > 0 && <ul className="site-proof-rows" aria-label="Control policies tried">
        {comparison.rows.map(row => <PolicyRow key={row.policy} row={row} />)}
      </ul>}
      {comparison.separated && comparison.sceneNotes.length > 0 && <ul className="site-proof-notes">
        {comparison.sceneNotes.map(note => <li key={note}>{note}</li>)}
      </ul>}
      {comparison.didNotRun > 0 && <p className="ms-field-hint">
        {comparison.didNotRun} other {comparison.didNotRun === 1 ? "policy" : "policies"} we set up did not run. “Simulation details” further down says why.
      </p>}
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
