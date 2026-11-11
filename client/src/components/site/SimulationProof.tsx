import { UNNAMED_POLICY } from "@/data/simulationPolicies";
import { BareRows } from "@/components/bare/Bare";
import {
  COULD_NOT_RUN, GAP_COULD_BE_CHANCE, GAP_UNLIKELY_CHANCE, SCENE_SETUP_CAVEAT, WAITING,
  testResultOf, type SimulationProof as SimulationProofView,
} from "@/lib/simulationProof";
import { SIMULATION_ACCURACY_ROWS } from "@/data/simulationAccuracy";
import type { JobScreeningOutcome } from "@/types/jobMarketplace";

type Row = NonNullable<SimulationProofView["policyComparison"]>["rows"][number];

/** At the start of a row, the plain phrase for a policy not in our list starts with a capital. */
const rowName = (name: string) => (name.startsWith(UNNAMED_POLICY) ? `A${name.slice(1)}` : name);
const tries = (succeeded: number, scored: number) => `${succeeded} of ${scored} ${scored === 1 ? "try" : "tries"}`;

/**
 * The simulation test said in words a child can read: each the plain form of the projection's own sentence for the
 * same case (`simulationProof.ts`), so it is true whenever that one is. The projection's sentences stay in the
 * details, word for word, and in the email.
 */
const PLAIN_COULD_NOT_RUN: Readonly<Partial<Record<JobScreeningOutcome, string>>> = {
  reference_only: "Only our own test moves ran. No robot program could be tried yet.",
  held_capability: "Our simulation test can't do this kind of job yet.",
  held_unprepared: "The robots that could do this job aren't set up in our simulation test yet.",
  infeasible: "In the simulation of your site, none of the robots we can test could reach the job.",
  no_match: "None of the robots we can test matched this job. At least one couldn't reach it in the simulation of your site.",
  held_setup: "A problem on our side stopped the test before it finished.",
  held_budget: "The test reached the most the free beta can run for one job, before it finished.",
  held_scene_check: "The simulation of your site failed our check, so no robot was tested in it.",
};
const PLAIN_WAITING: Readonly<Partial<Record<JobScreeningOutcome, string>>> = {
  awaiting_spend_approval: "We're deciding whether to keep testing.",
  setup_repair: "An update on our side stopped the test before it finished. If a later test finishes, it shows here.",
  superseded: "The test goes on in a newer run.",
};
const PLAIN_STATE = { preparing: "Getting ready.", running: "Running now." } as const;
/** The set-up caveat in plain words: it changes what a result means, so it is said beside the line. */
export const PLAIN_SETUP_CAVEAT = "This result may come from how we set up the simulation of your site, not from the robots.";

const outcomeOf = (table: Partial<Record<JobScreeningOutcome, string>>, sentence: string) =>
  (Object.keys(table) as JobScreeningOutcome[]).find(key => table[key] === sentence) ?? null;

export { testResultOf, type TestResult } from "@/lib/simulationProof";
/** The paper screen's one line on why the simulation test is not the answer, or null when nothing is known. */
export function testNotRunLine(proof: SimulationProofView | null | undefined): string | null {
  if (!proof || proof.state === "not_started") return null;
  if (proof.state === "could_not_run") {
    const outcome = outcomeOf(COULD_NOT_RUN, proof.headline);
    return `The simulation test did not run. ${(outcome && PLAIN_COULD_NOT_RUN[outcome]) ?? ""}`.trim();
  }
  if (proof.state !== "done") {
    const waiting = outcomeOf(WAITING, proof.headline);
    return waiting && PLAIN_WAITING[waiting] ? `Simulation test: ${PLAIN_WAITING[waiting]}` : null;
  }
  if (proof.options.options.length) return null;
  return proof.options.unconfirmed.length
    ? "The simulation test ran, but we couldn't confirm which robot each AI program ran on, so none is compared."
    : "The simulation test finished, but no AI robot could be scored in it.";
}

/** The one line for an older job's standalone view and its email-shaped places, by the same rules. */
export function computerTestLine(proof: SimulationProofView | null | undefined, _pickName?: string | null): string | null {
  const result = testResultOf(proof);
  if (!result) {
    const line = testNotRunLine(proof);
    if (line) return line;
    if (proof && (proof.state === "preparing" || proof.state === "running")) return `Simulation test: ${PLAIN_STATE[proof.state]}`;
    return null;
  }
  if (result.kind === "testing") return `Simulation test: ${result.entered} AI ${result.entered === 1 ? "robot" : "robots"} on your job, now.`;
  if (result.kind === "winner") return `Simulation test: ${result.top.label} ${result.wording === "did_best" ? "did best" : "was ahead"}, doing your job in ${tries(result.top.succeeded, result.top.scored)}.`;
  if (result.kind === "none_finished") return "Simulation test: None of the AI robots finished your job yet.";
  if (result.kind === "one_option") return `Simulation test: ${result.top.label} did your job in ${tries(result.top.succeeded, result.top.scored)}, the only AI robot tested.`;
  return "Simulation test: No clear winner yet.";
}

/** Whether a set-up flag says our simulation may have shaped the result. */
export const setupCaveatShown = (proof: SimulationProofView | null | undefined) => Boolean(proof?.state === "done" && proof.options.setupFlag);

/**
 * The simulation test as a ranked list, on its own details screen: one lead line, then one row per option in the
 * display order (its maker, its count, and how far it got when it finished none), the rows we could not compare,
 * the set-up notes, and what was planned but did not run. Every fact of the projection's comparison is here as rows.
 */
export function SimulationTestRows({ proof }: { proof: SimulationProofView }) {
  const { options, unconfirmed, winner, triesEach, didNotRun, setupNotes } = proof.options;
  const ran = options.length + unconfirmed.length;
  return <BareRows title="Ranked" rows={[
    ...(ran ? [{ key: "lead", value: `We ran ${ran} AI ${ran === 1 ? "robot" : "robots"} on your job, about ${triesEach} ${triesEach === 1 ? "try" : "tries"} each, in a simulation of your site.` }] : []),
    ...options.map((option, index) => ({ key: option.id, label: <>{index + 1}. {option.label}{option.maker && <span className="bare-helper"> · {option.maker}</span>}</>,
      value: <>Finished {tries(option.succeeded, option.scored)}{option.rangeText && <span className="bare-helper"> · {option.rangeText}</span>}
        {option.succeeded === 0 && option.furthestDetail && <span className="bare-helper"> · {option.furthestDetail}</span>}
        {index === 0 && winner && <strong> · {winner === "did_best" ? "Did best" : "Ahead"}</strong>}</> })),
    ...(winner ? [{ key: "gap", value: winner === "did_best" ? GAP_UNLIKELY_CHANCE : GAP_COULD_BE_CHANCE }] : []),
    ...unconfirmed.map((row, index) => ({ key: `unconfirmed-${index}`, label: rowName(row.policy),
      value: `Finished ${tries(row.succeeded, row.scored)} · on a robot we could not confirm, not compared` })),
    ...(didNotRun > 0 ? [{ key: "did-not-run", value: `${didNotRun} more AI ${didNotRun === 1 ? "robot was" : "robots were"} planned but did not run. Job settings › Simulation details says why.` }] : []),
  ]}>
    {setupNotes.map(note => <p key={note} className="bare-notice">{note === SCENE_SETUP_CAVEAT ? PLAIN_SETUP_CAVEAT : note}</p>)}
    {proof.options.setupFlag && !setupNotes.includes(SCENE_SETUP_CAVEAT) && <p className="bare-notice">{PLAIN_SETUP_CAVEAT}</p>}
  </BareRows>;
}

/** How far a simulation test can be trusted, as published, in short rows with every source, and what holds for this job. */
export function TrustRows({ proof }: { proof: SimulationProofView }) {
  return <BareRows title="Published tests" rows={[
    ...SIMULATION_ACCURACY_ROWS.map(row => ({ key: row.label, label: row.label, value: row.value })),
    ...proof.forThisJob.map((item, index) => ({ key: `job-${index}`, label: index === 0 ? "Your job" : "", value: item })),
    ...proof.accuracy.sources.map(source => ({ key: source.url, label: "Source",
      value: <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> })),
  ]} />;
}

/** Both, for the standalone view of an older job. */
export function ComputerTestDetails({ proof }: { proof: SimulationProofView }) {
  return <>
    <SimulationTestRows proof={proof} />
    {proof.state === "done" && <TrustRows proof={proof} />}
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
