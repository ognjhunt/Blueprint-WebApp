import { UNNAMED_POLICY } from "@/data/simulationPolicies";
import { BareRows } from "@/components/bare/Bare";
import {
  COULD_NOT_RUN, HEADLINES, SCENE_SETUP_CAVEAT, WAITING, type SimulationProof as SimulationProofView,
} from "@/lib/simulationProof";
import type { JobScreeningOutcome } from "@/types/jobMarketplace";

type Row = NonNullable<SimulationProofView["policyComparison"]>["rows"][number];

/** At the start of a row, the plain phrase for a policy not in our list starts with a capital. */
const rowName = (name: string) => (name.startsWith(UNNAMED_POLICY) ? `A${name.slice(1)}` : name);
const tries = (succeeded: number, scored: number) => `${succeeded} of ${scored} ${scored === 1 ? "try" : "tries"}`;

/**
 * The computer test said in words a child can read: each the plain form of the projection's own sentence for the
 * same case (`simulationProof.ts`), so it is true whenever that one is. The projection's sentences stay in the
 * details, word for word, and in the email.
 */
const PLAIN_COULD_NOT_RUN: Readonly<Partial<Record<JobScreeningOutcome, string>>> = {
  reference_only: "Only our own test moves ran. No robot program could be tried yet.",
  held_capability: "Our computer test can't do this kind of job yet.",
  held_unprepared: "The robots that could do this job aren't set up in our computer test yet.",
  infeasible: "In the computer copy of your site, none of the robots we can test could reach the job.",
  no_match: "None of the robots we can test matched this job. At least one couldn't reach it in the computer copy of your site.",
  held_setup: "A problem on our side stopped the test before it finished.",
  held_budget: "The test reached the most the free trial can run for one job, before it finished.",
  held_scene_check: "The computer copy of your site failed our check, so no robot was tested in it.",
};
const PLAIN_WAITING: Readonly<Partial<Record<JobScreeningOutcome, string>>> = {
  awaiting_spend_approval: "We're deciding whether to keep testing.",
  setup_repair: "An update on our side stopped the test before it finished. If a later test finishes, it shows here.",
  superseded: "The test goes on in a newer run.",
};
const PLAIN_STATE = { preparing: "Getting ready.", running: "Running now." } as const;
/** The set-up caveat in plain words: it changes what a result means, so it is said beside the line. */
export const PLAIN_SETUP_CAVEAT = "This result may come from how we set up the computer copy of your site, not from the robots.";

const outcomeOf = (table: Partial<Record<JobScreeningOutcome, string>>, sentence: string) =>
  (Object.keys(table) as JobScreeningOutcome[]).find(key => table[key] === sentence) ?? null;

/**
 * The one computer-test line under the answer, or null when there is nothing to report (not started). The leader,
 * "did best" or "was ahead" or no clear winner, is the projection's own rule; the robot the programs ran on is
 * always named, and said not to be the pick when it is not.
 */
export function computerTestLine(proof: SimulationProofView | null | undefined, pickName: string | null): string | null {
  if (!proof) return null;
  if (proof.state === "not_started") return null;
  if (proof.state === "could_not_run") {
    const outcome = outcomeOf(COULD_NOT_RUN, proof.headline);
    return `Computer test: ${(outcome && PLAIN_COULD_NOT_RUN[outcome]) ?? "It could not run."}`;
  }
  if (proof.state !== "done") {
    const waiting = outcomeOf(WAITING, proof.headline);
    if (waiting && PLAIN_WAITING[waiting]) return `Computer test: ${PLAIN_WAITING[waiting]}`;
    return proof.headline === HEADLINES[proof.state] ? `Computer test: ${PLAIN_STATE[proof.state]}` : null;
  }
  const comparison = proof.policyComparison;
  const compared = comparison?.rows.filter(row => row.compared) ?? [];
  if (!comparison || !comparison.rows.length) return "Computer test: It finished, but no robot program could be scored.";
  if (!compared.length) return "Computer test: We couldn't confirm the robot programs ran on the same robot, so they aren't compared.";
  const on = `on ${comparison.robotName}${!comparison.sameRobotAsPick && pickName ? `, not the ${pickName}` : ""}`;
  const leader = compared.find(row => row.chosen);
  if (leader) {
    return `Computer test: ${rowName(leader.policy)} ${comparison.separated ? "did best" : "was ahead"}, finishing the job in ${tries(leader.succeeded, leader.scored)}, ${on}.`
      + (comparison.separated ? "" : " It could still be chance.");
  }
  if (compared.length === 1) return `Computer test: Only one robot program could be compared, ${on}.`;
  if (!compared.some(row => row.succeeded > 0)) return `Computer test: None of the robot programs finished the job, ${on}.`;
  return `Computer test: No clear winner yet, ${on}.`;
}

/** Whether the line carries the set-up caveat beside it. */
export const setupCaveatShown = (proof: SimulationProofView | null | undefined) =>
  Boolean(proof?.state === "done" && proof.policyComparison?.sceneNotes.includes(SCENE_SETUP_CAVEAT));

/**
 * Everything the computer test found, on the details screen, in short rows: the projection's own sentences word for
 * word, each program's count, what the scene showed about the pick, and how far such a test can be trusted, with
 * its sources. Renders a `SimulationProof` as projected; it adds no claim of its own.
 */
export function ComputerTestDetails({ proof }: { proof: SimulationProofView }) {
  const comparison = proof.policyComparison;
  const done = proof.state === "done";
  const rows: Row[] = comparison?.rows ?? [];
  return <>
    <BareRows title="Computer test" rows={[
      { key: "result", value: comparison?.line ?? proof.headline },
      ...(proof.robotCheck ? [{ key: "scene", value: proof.robotCheck.line }] : []),
      ...rows.map((row, index) => ({ key: `row-${index}`, label: <>{rowName(row.policy)}{row.maker && <span className="bare-helper"> {row.maker}</span>}</>,
        value: <>Finished {tries(row.succeeded, row.scored)}{row.rangeText && <span className="bare-helper"> · {row.rangeText}</span>}
          {!row.compared && <span className="bare-helper"> · on {row.robot ?? "a robot we could not confirm"}, not compared</span>}
          {/* How far a row got, where the result sentence does not already say it (the projection's rule). */}
          {row.furthestShown && row.furthestDetail && <span className="bare-helper"> · {row.furthestDetail}</span>}
          {row.chosen && <strong> · {comparison!.separated ? "Did best" : "Ahead"}</strong>}</> })),
      ...(comparison?.sceneNotes ?? []).map((note, index) => ({ key: `note-${index}`, value: note })),
      ...(comparison && comparison.didNotRun > 0
        ? [{ key: "did-not-run", value: `${comparison.didNotRun} more robot ${comparison.didNotRun === 1 ? "program was" : "programs were"} planned but did not run. Job settings › Simulation details says why.` }] : []),
    ]} />
    {done && <BareRows title="How far to trust a computer test" rows={[
      { key: "statement", value: proof.accuracy.statement },
      { key: "conditions", value: proof.accuracy.conditions },
      ...proof.forThisJob.map((item, index) => ({ key: `job-${index}`, value: item })),
      ...proof.accuracy.sources.map(source => ({ key: source.url, label: "Source",
        value: <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> })),
    ]} />}
  </>;
}

/**
 * "Tested in simulation" on its own, for an older job that has evaluations and no answer to carry them: the one
 * line, then everything behind it.
 */
export function SimulationProof({ proof, pickName = null }: { proof: SimulationProofView; pickName?: string | null }) {
  const line = computerTestLine(proof, pickName);
  return <section className="bare-screen site-proof-standalone" aria-labelledby="simulation-proof-title">
    <h2 className="bare-label" id="simulation-proof-title">Tested in simulation</h2>
    <p className="bare-lead">{line ?? proof.headline}</p>
    {setupCaveatShown(proof) && <p className="bare-notice">{PLAIN_SETUP_CAVEAT}</p>}
    {proof.state !== "not_started" && <ComputerTestDetails proof={proof} />}
  </section>;
}
