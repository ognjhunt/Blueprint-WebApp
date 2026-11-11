/**
 * Proof in simulation, in plain words: what the simulation of the site has
 * shown so far about the robot the answer picked and about which AI control
 * policy did best, with what published studies say about how far such a
 * simulation agrees with a real test, and which of their conditions hold here.
 *
 * A pure projection of what the job page already loads: the job evaluation
 * summary (`/api/job-workflow/owner/:token`, `JobManagedEvidenceSummary`), the
 * status read's measured-scene robot table (`robotFit`) and the answer's pick.
 * Used by the page and, later, by email. It never claims more than the data:
 * zero successes is never an estimate, a tie is never a winner, and a run that
 * could not finish is said about the simulation, never about the site's job.
 */
import type { RobotFitView } from "../components/site/RobotFit";
import { SIMULATION_ACCURACY } from "../data/simulationAccuracy";
import { SIMULATION_POLICIES, simulationPolicyFor, type SimulatedRobot } from "../data/simulationPolicies";
import type { AnswerRobot } from "./siteAnswer";
import type { JobManagedEvidenceSummary, JobScreeningOutcome } from "../types/jobMarketplace";

export type SimulationProofState = "not_started" | "preparing" | "running" | "done" | "could_not_run";

export interface SimulationProof {
  state: SimulationProofState;
  headline: string;
  robotCheck: { line: string; pickChecked: boolean | null } | null;
  policyComparison: {
    /** In a sentence: "a Franka research arm". */
    robotName: string;
    sameRobotAsPick: boolean;
    rows: Array<{ policy: string; maker: string | null; succeeded: number; scored: number;
      rangeText: string | null; chosen: boolean }>;
    winner: { policy: string; maker: string | null } | null;
    /** Some policy succeeded, and the best is not tied with every other scored policy. */
    separated: boolean;
    line: string;
    sceneNotes: string[];
    /** Policies that were planned but never scored. */
    didNotRun: number;
  } | null;
  accuracy: { statement: string; conditions: string; sources: Array<{ title: string; url: string }> };
  /** Which of the studies' conditions hold for this job, one sentence each. */
  forThisJob: string[];
}

export interface SimulationProofInput {
  /** The job's current evaluation, or the list the page loads (newest first). */
  evaluation: JobManagedEvidenceSummary | readonly JobManagedEvidenceSummary[] | null | undefined;
  /** The status read's measured-scene robot table, when scene preparation produced one. */
  robotFit?: Pick<RobotFitView, "models"> | null;
  /** The answer's pick. */
  pick: AnswerRobot | null;
  /** True only when measured data fixed the scene's true size (a scale board, markers or the site's own measurements). */
  scaleMeasured?: boolean;
}

export const NO_POLICY_COMPLETED = "The simulation ran, but no policy completed the job in it, so it could not rank them.";
export const SCALE_ESTIMATED = "The scale of your scene was estimated from your video, not measured.";
/** Said by the server beside a zero-success result whose scene our checks flagged (`screeningOutcomeCaveat`). */
const SCENE_SETUP_CAVEAT = "Our scene check found a possible set-up cause, so this result may reflect how we set the scene up more than the robots.";

const HEADLINES = {
  not_started: "The simulation of your site has not started yet.",
  preparing: "We are preparing the simulation of your site.",
  running: "The simulation of your site is running.",
} as const;

/** Waiting or still in progress: said about the simulation. */
const WAITING: Partial<Record<JobScreeningOutcome, string>> = {
  awaiting_spend_approval: "Blueprint is deciding whether to continue the simulation.",
  setup_repair: "A Blueprint update stopped the simulation before it finished. If a later run finishes, it will show here.",
  superseded: "The simulation continues in a newer run.",
};

/** One plain sentence about why the simulation could not run, from the outcome sentences, never about "your job". */
const COULD_NOT_RUN: Partial<Record<JobScreeningOutcome, string>> = {
  reference_only: "The simulation scored only scripted reference checks; no AI policy could be tested in it yet.",
  held_capability: "The simulation can't model this kind of task yet.",
  held_unprepared: "The robots that could do this task aren't set up in the simulation yet.",
  infeasible: "From the robot position planned in the scene built from your video, none of the robots the simulation can run could reach the task.",
  no_match: "None of the robots the simulation can run matched this task; at least one was measured out of reach from the robot position planned in the scene built from your video.",
  held_setup: "A problem on our side stopped the simulation before it finished.",
  held_budget: "The simulation reached the most the free beta can run for one job before it finished.",
  held_scene_check: "The simulated scene failed the check we run before testing robots, so no robot was tested in it.",
};

const PREPARING_STATES = new Set(["queued", "pending", "waitlisted", "preparing", "launching", "unavailable"]);
const RUNNING_CANDIDATE_STATES = new Set(["launching", "running", "reconciliation_required"]);

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);
const pickName = (pick: AnswerRobot) => `${pick.manufacturer} ${pick.name}`;
const policyPhrase = (row: { policy: string; maker: string | null }) =>
  row.maker ? `${row.policy}, an AI control policy from ${row.maker},` : row.policy;
const triesText = (succeeded: number, scored: number) => `${succeeded} of ${scored} ${scored === 1 ? "try" : "tries"}`;

/** The current job evaluation: the newest current one with an outcome or results, else the newest current one. */
export function currentEvaluation(evaluation: SimulationProofInput["evaluation"]): JobManagedEvidenceSummary | null {
  const list = (Array.isArray(evaluation) ? evaluation : evaluation ? [evaluation] : []).filter(isRecord) as JobManagedEvidenceSummary[];
  const current = list.filter(item => item.current !== false);
  return current.find(item => item.outcome !== undefined || item.screening) ?? current[0] ?? null;
}

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];
const scripted = (row: Candidate) => row.executionEvidence?.execution_evidence_kind === "scripted_simulator_state_baseline";

function stateOf(evaluation: JobManagedEvidenceSummary | null): SimulationProofState {
  if (!evaluation) return "not_started";
  const outcome = evaluation.outcome ?? null;
  if (outcome === "estimate") return "done";
  if (outcome && COULD_NOT_RUN[outcome]) return "could_not_run";
  if (outcome) return "preparing";
  const candidates = (Array.isArray(evaluation.screening?.candidates) ? evaluation.screening!.candidates : []).filter(isRecord) as Candidate[];
  if (candidates.some(row => RUNNING_CANDIDATE_STATES.has(row.state) || count(row.scored) > 0)) return "running";
  return PREPARING_STATES.has(evaluation.state) ? "preparing" : evaluation.state === "running" ? "running" : "preparing";
}

function robotCheckOf(robotFit: SimulationProofInput["robotFit"], pick: AnswerRobot | null): SimulationProof["robotCheck"] {
  const models = Array.isArray(robotFit?.models) ? robotFit!.models.filter(isRecord) : [];
  if (!models.length) return null;
  if (!pick) return { line: `The scene measured from your video was checked against ${models.length} robot${models.length === 1 ? "" : "s"}.`, pickChecked: null };
  const name = pickName(pick);
  const row = models.find(entry => typeof entry.name === "string" && typeof entry.manufacturer === "string"
    && norm(entry.manufacturer) === norm(pick.manufacturer) && norm(entry.name) === norm(pick.name));
  if (!row) return { line: `The scene measured from your video has not been checked against the ${name} yet.`, pickChecked: false };
  switch (row.verdict) {
    case "fits": return { line: `In the scene measured from your video, the ${name} reaches the pick-up and put-down points with a clear arm path.`, pickChecked: true };
    case "fits_spec": return { line: `In the scene measured from your video, the ${name} fits on its published figures; its arm path there has not been confirmed.`, pickChecked: true };
    case "doesnt_fit": return { line: `In the scene measured from your video, the ${name} does not fit.`, pickChecked: true };
    default: return { line: `In the scene measured from your video, whether the ${name} fits is not settled yet.`, pickChecked: false };
  }
}

/** The robot most scored rows ran on; null when none is known. */
function simulatedRobot(rows: Array<{ robot: SimulatedRobot | null }>): SimulatedRobot | null {
  const tally = new Map<string, { robot: SimulatedRobot; n: number }>();
  for (const { robot } of rows) if (robot) tally.set(robot.modelId, { robot, n: (tally.get(robot.modelId)?.n ?? 0) + 1 });
  return [...tally.values()].sort((a, b) => b.n - a.n)[0]?.robot ?? null;
}

function comparisonOf(evaluation: JobManagedEvidenceSummary, state: SimulationProofState, pick: AnswerRobot | null,
  couldNotRun: string | null): SimulationProof["policyComparison"] {
  const screening = evaluation.screening;
  const all = (Array.isArray(screening?.candidates) ? screening!.candidates : []).filter(isRecord) as Candidate[];
  // Scripted reference rows and the known-good control are checks, not policies.
  const policies = all.filter(row => !scripted(row));
  if (!policies.length || (state !== "done" && state !== "could_not_run")) return null;
  const scored = policies.filter(row => count(row.scored) > 0).map(row => ({ row, ...simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? "")),
    succeeded: Math.min(count(row.succeeded), count(row.scored)), scored: count(row.scored) }));
  const rate = (entry: { succeeded: number; scored: number }) => entry.succeeded / entry.scored;
  scored.sort((a, b) => rate(b) - rate(a) || b.succeeded - a.succeeded || b.scored - a.scored);
  const best = scored[0] ?? null;
  const others = scored.slice(1);
  const anySuccess = scored.some(entry => entry.succeeded > 0);
  const separated = Boolean(best) && anySuccess && others.length > 0 && others.some(entry => rate(entry) !== rate(best!));
  const top = best ? scored.filter(entry => rate(entry) === rate(best)) : [];
  const selection = screening?.selection;
  const selected = selection?.status === "chosen" && selection.chosen ? scored.find(entry => entry.row.candidateId === selection.chosen!.candidateId) ?? null : null;
  const winnerEntry = separated ? (selected && rate(selected) === rate(best!) ? selected : top.length === 1 ? best : null) : null;
  const notes = [...new Set([...(screening?.setupNotes ?? []).filter(note => typeof note === "string" && note.trim()),
    ...(evaluation.outcomeCaveat === "scene_setup" ? [SCENE_SETUP_CAVEAT] : [])])];

  let line: string;
  if (couldNotRun) line = couldNotRun;
  else if (!scored.length) line = "The simulation finished, but no policy could be scored in it.";
  else if (!anySuccess) line = NO_POLICY_COMPLETED;
  else if (separated && winnerEntry) {
    const rest = scored.filter(entry => entry !== winnerEntry);
    line = `In a simulation of your site, ${policyPhrase(winnerEntry)} did best: it completed the job in ${triesText(winnerEntry.succeeded, winnerEntry.scored)}.`
      + (rest.length ? ` The others: ${rest.map(entry => `${entry.policy}, ${entry.succeeded} of ${entry.scored}`).join("; ")}.` : "");
  } else if (separated) {
    const rest = scored.filter(entry => !top.includes(entry));
    line = `In a simulation of your site, ${top.map(entry => entry.policy).join(" and ")} did equally well, ahead of the others: each completed the job in ${Math.round(rate(best!) * 100)}% of its tries.`
      + (rest.length ? ` The others: ${rest.map(entry => `${entry.policy}, ${entry.succeeded} of ${entry.scored}`).join("; ")}.` : "");
  } else if (others.length) {
    line = `The simulation ran, but the policies completed the job equally often, so it could not rank them: ${scored.map(entry => `${entry.policy}, ${entry.succeeded} of ${entry.scored}`).join("; ")}.`;
  } else {
    line = `The simulation scored one policy: ${best!.policy} completed the job in ${triesText(best!.succeeded, best!.scored)}. With nothing to compare it to, it could not rank policies.`;
  }

  const robot = simulatedRobot(scored.length ? scored : policies.map(row => simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? ""))));
  return {
    robotName: robot?.name ?? "the simulated robot",
    sameRobotAsPick: Boolean(robot && pick && robot.modelId === pick.modelId),
    rows: scored.map(entry => ({ policy: entry.policy, maker: entry.maker, succeeded: entry.succeeded, scored: entry.scored,
      // A likely range only beside a result that has a success: zero successes is never an estimate.
      rangeText: anySuccess && entry.row.successRange
        ? `likely between ${entry.row.successRange.lowerPercent}% and ${entry.row.successRange.upperPercent}%` : null,
      chosen: entry === winnerEntry })),
    winner: winnerEntry ? { policy: winnerEntry.policy, maker: winnerEntry.maker } : null,
    separated,
    line,
    sceneNotes: notes,
    didNotRun: policies.length - scored.length,
  };
}

/** What is known for this job about the studies' conditions, without inventing any. */
function forThisJobOf(state: SimulationProofState, pick: AnswerRobot | null, scaleMeasured: boolean, robot: SimulatedRobot | null): string[] {
  if (state === "not_started") return [];
  const lines: string[] = [];
  if (!scaleMeasured) lines.push(SCALE_ESTIMATED);
  if (pick && robot && robot.modelId !== pick.modelId) {
    const noun = robot.kind === "arm" ? "arm" : "robot";
    const policiesForPick = Object.values(SIMULATION_POLICIES).some(entry => entry.robot.modelId === pick.modelId);
    lines.push(policiesForPick
      ? `We ran the public policies on the ${noun} they are trained for, ${robot.name}, in a simulation of your site, not on the ${pickName(pick)}.`
      : `No public AI policy exists yet for the ${pickName(pick)}. We ran the public policies on the ${noun} they are trained for, ${robot.name}, in a simulation of your site.`);
  }
  return lines;
}

/** The simulation proof for a job page. Pure: the same inputs always give the same proof, and junk gives a smaller one. */
export function projectSimulationProof(input: SimulationProofInput): SimulationProof {
  const evaluation = currentEvaluation(input?.evaluation);
  const pick = isRecord(input?.pick) ? input.pick : null;
  const state = stateOf(evaluation);
  const outcome = evaluation?.outcome ?? null;
  const couldNotRun = state === "could_not_run" && outcome ? COULD_NOT_RUN[outcome] ?? null : null;
  const comparison = evaluation ? comparisonOf(evaluation, state, pick, couldNotRun) : null;
  const allPolicies = evaluation && Array.isArray(evaluation.screening?.candidates)
    ? (evaluation.screening!.candidates.filter(isRecord) as Candidate[]).filter(row => !scripted(row))
    : [];
  const robot = simulatedRobot(allPolicies.map(row => simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? ""))));
  const headline = state === "done" ? (comparison?.line.split(/(?<=\.)\s/)[0] ?? NO_POLICY_COMPLETED)
    : state === "could_not_run" ? couldNotRun ?? "The simulation could not run."
      : (outcome && WAITING[outcome]) ?? HEADLINES[state];
  return {
    state,
    headline,
    robotCheck: robotCheckOf(input?.robotFit ?? null, pick),
    policyComparison: comparison,
    accuracy: { statement: SIMULATION_ACCURACY.statement, conditions: SIMULATION_ACCURACY.conditions,
      sources: SIMULATION_ACCURACY.sources.map(source => ({ ...source })) },
    forThisJob: forThisJobOf(state, pick, input?.scaleMeasured === true, robot),
  };
}
