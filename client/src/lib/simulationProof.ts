/**
 * "Tested in simulation", in plain words: what the simulation of the site has
 * shown so far about the robot the answer picked (its reach and arm path in the
 * scene rebuilt from the video) and how public AI control policies compared on
 * the job, with what published studies say about how far such a simulation
 * agrees with a real test, and which of their conditions hold here.
 *
 * A pure projection of what the job page already loads: the job evaluation
 * summary (`/api/job-workflow/owner/:token`, `JobManagedEvidenceSummary`), the
 * status read's measured-scene robot table (`robotFit`) and the answer's pick.
 * Used by the page and by the simulation email. It never claims more than the
 * data: every sentence that says something happened is emitted only by the
 * branch that checked it happened. Zero successes is never an estimate; a
 * comparison from a few tries is a probability, said by one fixed rule
 * (`probabilityAhead`, `CLEAR`, `AHEAD`); a run that could not finish is said
 * about the simulation, never about the site's job.
 */
import type { RobotFitView } from "../components/site/RobotFit";
import { SIMULATION_ACCURACY } from "../data/simulationAccuracy";
import { SIMULATION_POLICIES, UNNAMED_POLICY, simulationPolicyFor, type SimulatedRobot } from "../data/simulationPolicies";
import { sameRobot } from "./robotNameMatch";
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
    /** The leader, named only when P(leader beats the next best) ≥ `AHEAD`. */
    winner: { policy: string; maker: string | null } | null;
    /** P(leader beats the next best) ≥ `CLEAR`: a gap this size is unlikely to be chance. */
    separated: boolean;
    line: string;
    sceneNotes: string[];
    /**
     * Policies planned or attempted for this run that produced no score: deferred for budget,
     * or started and failed to launch or load. Catalog rows never available for the job
     * (unavailable, measured out of reach, refused, never registered) are not counted.
     */
    didNotRun: number;
    /** The sentence about `didNotRun`, or null when it is 0. */
    didNotRunLine: string | null;
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
/** A finished simulation in which no policy has a scored try: it says nothing ran. */
export const NO_POLICY_SCORED = "The simulation finished, but no policy could be scored in it.";
export const NO_CLEAR_DIFFERENCE = "No clear difference between the policies yet.";
export const GAP_UNLIKELY_CHANCE = "A gap this size is unlikely to be chance.";
export const GAP_COULD_BE_CHANCE = "With this few tries the gap could still be chance.";

/**
 * How sure the comparison of the leader with the next best must be before the page says so. With s
 * successes in n scored tries, a policy's success rate is uncertain: Beta(s + 1, n − s + 1) from a
 * uniform prior. P(leader's rate > next best's rate) at or above `CLEAR` says the leader "did best";
 * at or above `AHEAD` it "was ahead", and the gap could still be chance; below `AHEAD` there is no
 * clear difference. 1 of 1 against 0 of 1 is 5/6 (no clear difference); 7 of 10 against 3 of 10 is
 * about 0.96 (ahead); 9 of 10 against 3 of 10 is above 0.99 (did best).
 */
export const CLEAR = 0.975;
export const AHEAD = 0.85;

/** Lanczos approximation of ln Γ(x) for x > 0 (g = 7, nine coefficients): about 15 significant digits. */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < 9; i += 1) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}
/** k·ln(x), with 0·ln(0) = 0. */
const xLogY = (k: number, y: number) => (k === 0 ? 0 : k * Math.log(y));
const logBeta = (a: number, b: number) => logGamma(a) + logGamma(b) - logGamma(a + b);
/** Density of Beta(a, b) at x, given ln B(a, b). */
const betaPdf = (x: number, a: number, b: number, lnB: number) => Math.exp(xLogY(a - 1, x) + xLogY(b - 1, 1 - x) - lnB);
/**
 * Cumulative Beta(a, b) at x for whole a, b ≥ 1: P(Binomial(a + b − 1, x) ≥ a), summed term by term in
 * logs (each term from the one before), so no term overflows or is lost to underflow at the start.
 */
function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const m = a + b - 1;
  const lnX = Math.log(x);
  const ln1X = Math.log(1 - x);
  let lnTerm = logGamma(m + 1) - logGamma(a + 1) - logGamma(m - a + 1) + a * lnX + (m - a) * ln1X;
  let total = 0;
  for (let j = a; j <= m; j += 1) {
    total += Math.exp(lnTerm);
    lnTerm += Math.log((m - j) / (j + 1)) + lnX - ln1X;
  }
  return Math.min(1, total);
}
/** Even number of Simpson intervals on [0, 1]. */
const SIMPSON_INTERVALS = 2000;
const tally = (value: { succeeded: number; scored: number }) => {
  const scored = count(value?.scored);
  return { scored, succeeded: Math.min(count(value?.succeeded), scored) };
};

/**
 * P(A's success rate > B's), each rate Beta(s + 1, n − s + 1) from s successes in n scored tries (a
 * uniform prior): ∫ pdf_A(x) · cdf_B(x) dx over [0, 1], by Simpson's rule on a fixed grid. Equal counts
 * give 0.5; P(A > B) + P(B > A) = 1.
 */
export function probabilityAhead(a: { succeeded: number; scored: number }, b: { succeeded: number; scored: number }): number {
  const A = tally(a);
  const B = tally(b);
  const [aA, bA, aB, bB] = [A.succeeded + 1, A.scored - A.succeeded + 1, B.succeeded + 1, B.scored - B.succeeded + 1];
  const lnB = logBeta(aA, bA);
  const h = 1 / SIMPSON_INTERVALS;
  let sum = 0;
  for (let i = 0; i <= SIMPSON_INTERVALS; i += 1) {
    const x = i * h;
    const weight = i === 0 || i === SIMPSON_INTERVALS ? 1 : i % 2 ? 4 : 2;
    const density = betaPdf(x, aA, bA, lnB);
    if (density > 0) sum += weight * density * betaCdf(x, aB, bB);
  }
  return Math.min(1, Math.max(0, (sum * h) / 3));
}
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

/** Blockers that close a row in favour of a newer run of the same job: it runs there, not "did not run". */
const REPLANNED_BLOCKERS = new Set(["beta_screening_replanned_for_new_implementation", "beta_screening_implementation_commit_changed"]);
/**
 * Planned or attempted for this run, and no score. `deferred` rows passed every availability check and
 * were held back for money (the site allowance, the job's ceiling or a cost quote). `blocked` and
 * `completed` rows count only when episodes were planned for them, so they were selected and then failed
 * to start, launch or load. `unavailable` and `infeasible` rows were never runnable for the job.
 */
function plannedButNotRun(row: Candidate): boolean {
  if (count(row.scored) > 0) return false;
  const blockers = Array.isArray(row.blockers) ? row.blockers : [];
  if (blockers.some(code => REPLANNED_BLOCKERS.has(code))) return false;
  if (row.state === "deferred") return true;
  return (row.state === "blocked" || row.state === "completed") && count(row.planned) > 0;
}

const PREPARING_STATES = new Set(["queued", "pending", "waitlisted", "preparing", "launching", "unavailable"]);
const RUNNING_CANDIDATE_STATES = new Set(["launching", "running", "reconciliation_required"]);

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  if (!pick) return { line: `The scene rebuilt from your video was checked against ${models.length} robot${models.length === 1 ? "" : "s"}.`, pickChecked: null };
  const name = pickName(pick);
  const row = models.find(entry => typeof entry.name === "string" && typeof entry.manufacturer === "string"
    && typeof pick.name === "string" && typeof pick.manufacturer === "string" && sameRobot(entry, pick));
  if (!row) return { line: `The scene rebuilt from your video has not been checked against the ${name} yet.`, pickChecked: false };
  switch (row.verdict) {
    case "fits": return { line: `In the scene rebuilt from your video, the ${name} reaches the pick-up and put-down points with a clear arm path.`, pickChecked: true };
    case "fits_spec": return { line: `In the scene rebuilt from your video, the ${name} fits on its published figures; its arm path there has not been confirmed.`, pickChecked: true };
    case "doesnt_fit": return { line: `In the scene rebuilt from your video, the ${name} does not fit.`, pickChecked: true };
    default: return { line: `In the scene rebuilt from your video, whether the ${name} fits is not settled yet.`, pickChecked: false };
  }
}

/** The robot most scored rows ran on; null when none is known. */
function simulatedRobot(rows: Array<{ robot: SimulatedRobot | null }>): SimulatedRobot | null {
  const tally = new Map<string, { robot: SimulatedRobot; n: number }>();
  for (const { robot } of rows) if (robot) tally.set(robot.modelId, { robot, n: (tally.get(robot.modelId)?.n ?? 0) + 1 });
  return [...tally.values()].sort((a, b) => b.n - a.n)[0]?.robot ?? null;
}

/** Selection blockers that mark a reference row: shown, never ranked or chosen. */
const REFERENCE_BLOCKERS: ReadonlySet<string> = new Set(["development_only_reference", "scripted_baseline_reference_only"]);
/** Candidate ids the selection marks as references. */
function referenceIds(screening: JobManagedEvidenceSummary["screening"] | null | undefined): Set<string> {
  const selection = isRecord(screening) && isRecord(screening.selection) ? screening.selection : null;
  return new Set((Array.isArray(selection?.candidates) ? selection!.candidates : [])
    .filter(entry => isRecord(entry) && REFERENCE_BLOCKERS.has(String(entry.choiceBlocker)))
    .map(entry => String(entry.candidateId)));
}

function comparisonOf(evaluation: JobManagedEvidenceSummary, state: SimulationProofState, pick: AnswerRobot | null,
  couldNotRun: string | null): SimulationProof["policyComparison"] {
  const screening = evaluation.screening;
  const all = (Array.isArray(screening?.candidates) ? screening!.candidates : []).filter(isRecord) as Candidate[];
  // Scripted reference rows and the known-good control are checks, not policies. Rows the selection marks
  // as references (development-only or scripted-baseline) are shown elsewhere but never ranked or named the winner.
  const references = referenceIds(screening);
  const policies = all.filter(row => !scripted(row) && !references.has(String(row.candidateId ?? "")));
  if (!policies.length || (state !== "done" && state !== "could_not_run")) return null;
  const scored = policies.filter(row => count(row.scored) > 0).map(row => ({ row, ...simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? "")),
    succeeded: Math.min(count(row.succeeded), count(row.scored)), scored: count(row.scored) }));
  // Ordered by the mean of each rate's Beta(s + 1, n − s + 1): 9 of 10 leads 1 of 1. Ties keep the
  // policy with more scored tries first, then the evaluation's own order.
  const mean = (entry: { succeeded: number; scored: number }) => (entry.succeeded + 1) / (entry.scored + 2);
  scored.sort((a, b) => mean(b) - mean(a) || b.scored - a.scored);
  const leader = scored[0] ?? null;
  const next = scored[1] ?? null;
  const anySuccess = scored.some(entry => entry.succeeded > 0);
  // The comparison is the leader against the next best only, by one rule. The Pipeline's own
  // `selection.chosen` does not decide it: the counts do.
  // A policy that never completed the job is never said to be ahead, whatever the other's count.
  const ahead = leader && next && leader.succeeded > 0 ? probabilityAhead(leader, next) : 0;
  const separated = ahead >= CLEAR;
  const winnerEntry = ahead >= AHEAD ? leader : null;
  const notes = [...new Set([...(screening?.setupNotes ?? []).filter(note => typeof note === "string" && note.trim()),
    ...(evaluation.outcomeCaveat === "scene_setup" ? [SCENE_SETUP_CAVEAT] : [])])];
  const counted = (entries: typeof scored) => entries.map(entry => `${entry.policy}, ${entry.succeeded} of ${entry.scored}`).join("; ");

  let line: string;
  if (couldNotRun) line = couldNotRun;
  else if (!scored.length) line = NO_POLICY_SCORED;
  else if (!anySuccess) line = NO_POLICY_COMPLETED;
  else if (!next) {
    line = `The simulation scored one policy: ${leader!.policy} completed the job in ${triesText(leader!.succeeded, leader!.scored)}. With nothing to compare it to, it could not rank policies.`;
  } else if (winnerEntry) {
    const nextName = next.policy === leader!.policy && next.policy === UNNAMED_POLICY ? "another AI control policy" : next.policy;
    const against = `against ${next.succeeded} of ${next.scored} for ${scored.length > 2 ? "the next best, " : ""}${nextName}`;
    const rest = scored.slice(2);
    line = `In a simulation of your site, ${policyPhrase(leader!)} ${separated ? "did best" : "was ahead"}: it completed the job in `
      + `${triesText(leader!.succeeded, leader!.scored)}, ${against}. ${separated ? GAP_UNLIKELY_CHANCE : GAP_COULD_BE_CHANCE}`
      + (rest.length ? ` The others: ${counted(rest)}.` : "");
  } else {
    line = `${NO_CLEAR_DIFFERENCE} Tries that completed the job in a simulation of your site: ${counted(scored)}.`;
  }

  const didNotRun = policies.filter(plannedButNotRun).length;
  const robot = simulatedRobot(scored.length ? scored : policies.map(row => simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? ""))));
  return {
    robotName: robot?.name ?? "the simulated robot",
    sameRobotAsPick: Boolean(robot && pick && robot.modelId === pick.modelId),
    rows: scored.map(entry => ({ policy: entry.policy, maker: entry.maker, succeeded: entry.succeeded, scored: entry.scored,
      // A likely range only beside a row that has a success: zero successes is never an estimate.
      rangeText: entry.succeeded > 0 ? rangeTextOf(entry.row.successRange) : null,
      chosen: entry === winnerEntry })),
    winner: winnerEntry ? { policy: winnerEntry.policy, maker: winnerEntry.maker } : null,
    separated,
    line,
    sceneNotes: notes,
    didNotRun,
    // "More" only beside policies that were scored; otherwise none ran.
    didNotRunLine: didNotRun > 0
      ? `${didNotRun}${scored.length ? " more" : ""} ${didNotRun === 1 ? "policy was" : "policies were"} planned and did not run. “Simulation details” further down says why.`
      : null,
  };
}

/** "likely between 40% and 95%", only from a well-formed range. */
function rangeTextOf(range: Candidate["successRange"]): string | null {
  if (!isRecord(range)) return null;
  const { lowerPercent: lower, upperPercent: upper } = range as { lowerPercent: unknown; upperPercent: unknown };
  const percent = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  if (!percent(lower) || !percent(upper) || lower > upper) return null;
  return `likely between ${Math.round(lower)}% and ${Math.round(upper)}%`;
}

/**
 * What is known for this job about the studies' conditions, without inventing any. `robot` is the robot
 * the scored policies ran on, null when no policy has a scored try: "we ran" is said only after a run.
 */
function forThisJobOf(state: SimulationProofState, pick: AnswerRobot | null, scaleMeasured: boolean, robot: SimulatedRobot | null): string[] {
  if (state === "not_started") return [];
  const lines: string[] = [];
  if (!scaleMeasured) lines.push(SCALE_ESTIMATED);
  if (pick && robot && robot.modelId !== pick.modelId) {
    const noun = robot.kind === "arm" ? "arm" : "robot";
    const policiesForPick = Object.values(SIMULATION_POLICIES).some(entry => entry.robot.modelId === pick.modelId);
    lines.push(policiesForPick
      ? `We ran the public policies on the ${noun} they are trained for, ${robot.name}, in a simulation of your site, not on the ${pickName(pick)}.`
      : `We have no public AI policy to run on the ${pickName(pick)}, so we ran the public policies on the ${noun} they are trained for, ${robot.name}, in a simulation of your site.`);
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
  const references = referenceIds(evaluation?.screening);
  const scoredPolicies = evaluation && Array.isArray(evaluation.screening?.candidates)
    ? (evaluation.screening!.candidates.filter(isRecord) as Candidate[])
      .filter(row => !scripted(row) && !references.has(String(row.candidateId ?? "")) && count(row.scored) > 0)
    : [];
  const robot = simulatedRobot(scoredPolicies.map(row => simulationPolicyFor(String(row.candidateId ?? ""), String(row.name ?? ""))));
  const headline = state === "done" ? (comparison?.line.split(/(?<=\.)\s/)[0] ?? NO_POLICY_SCORED)
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
