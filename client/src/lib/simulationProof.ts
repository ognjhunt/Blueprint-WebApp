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
 * about the simulation, never about the site's job. How far each policy got
 * (`furthest`, from the Pipeline's graded stages) is said as a fact, from a
 * closed list of phrases, and never ranks, chooses or orders a policy.
 */
import type { RobotFitView } from "../components/site/RobotFit";
import { SIMULATION_ACCURACY } from "../data/simulationAccuracy";
import { SIMULATION_POLICIES, UNNAMED_POLICY, simulationPolicyFor, type SimulatedRobot } from "../data/simulationPolicies";
import { sameRobot } from "./robotNameMatch";
import type { AnswerRobot } from "./siteAnswer";
import type { JobManagedEvidenceSummary, JobScreeningOutcome, JobScreeningProgressStage } from "../types/jobMarketplace";

export type SimulationProofState = "not_started" | "preparing" | "running" | "done" | "could_not_run";
export type ProgressStage = JobScreeningProgressStage;

/** The pick-and-place ladder, in order. `approached` is first only when the run measured it. */
export const PROGRESS_LADDER: readonly ProgressStage[] = ["approached", "contact", "moved", "lifted", "translated", "placed", "released_and_settled"];
/** What each stage says, past tense: the only words a site reads about how far a policy got. */
export const PROGRESS_PHRASES: Readonly<Record<ProgressStage, string>> = {
  approached: "got within reach of the object",
  contact: "touched the object",
  moved: "moved the object",
  lifted: "lifted the object",
  translated: "carried the object toward where it goes",
  placed: "put the object in place",
  released_and_settled: "put the object in place and let go",
};
/** No stage reached, on a ladder that measured the approach. */
export const PROGRESS_NOT_APPROACHED = "did not get within reach of the object";
/** No stage reached, on a ladder that starts at contact. */
export const PROGRESS_NOT_TOUCHED = "did not touch the object";
/**
 * How close a policy that reached no stage typically came, from the median closest approach in metres:
 * whole centimetres, at least 1; from 100 cm up, metres with one decimal. Rounded half up on the
 * Pipeline's 4-decimal metres, in whole tenths of a millimetre so no float error moves it.
 */
export function closestApproachText(medianM: number): string {
  const tenthsOfMm = Math.round(medianM * 10_000);
  const cm = Math.max(1, Math.floor((tenthsOfMm + 50) / 100));
  const distance = cm >= 100 ? `${(Math.floor((tenthsOfMm + 500) / 1000) / 10).toFixed(1)} m` : `${cm} cm`;
  return `${PROGRESS_NOT_APPROACHED}; it typically came within about ${distance} of it`;
}
/** The start of the sentence that says how far each compared policy got when none completed the job. */
export const HOW_FAR_EACH_GOT = "How far each got:";

export interface SimulationProof {
  state: SimulationProofState;
  headline: string;
  robotCheck: { line: string; pickChecked: boolean | null } | null;
  policyComparison: {
    /** In a sentence: "a Franka research arm". */
    robotName: string;
    sameRobotAsPick: boolean;
    /**
     * The compared rows (all on one robot) first, leader on top, then rows that ran on another robot or
     * one we could not confirm: shown with their robot, `compared: false`, never ranked or chosen.
     */
    rows: Array<{ policy: string; maker: string | null; succeeded: number; scored: number;
      rangeText: string | null; chosen: boolean; compared: boolean; robot: string | null;
      /** The deepest stage at least one graded try reached; null without progress data or when none did. */
      furthest: { stage: ProgressStage; episodes: number; graded: number } | null;
      /** How far it got, from `PROGRESS_PHRASES` only; null without progress data. */
      furthestText: string | null;
      /**
       * True when the row itself says `furthestText`: some policy completed the job, this one completed
       * nothing, and the comparison sentence does not already say how far it got.
       */
      furthestShown: boolean }>;
    /** The leader, named only when P(leader beats every other compared policy) ≥ `AHEAD`, each pair weighed. */
    winner: { policy: string; maker: string | null } | null;
    /** The smallest P(leader beats another compared policy) ≥ `CLEAR`: a gap this size is unlikely to be chance. */
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
/** Said when no scored policy's robot is known: their counts are listed and never ranked. */
export const ROBOT_NOT_CONFIRMED = "We could not confirm that these policies ran on the same robot in the simulation of your site, so they are not compared.";
export const GAP_UNLIKELY_CHANCE = "A gap this size is unlikely to be chance.";
export const GAP_COULD_BE_CHANCE = "With this few tries the gap could still be chance.";

/**
 * How sure the comparison of the leader with every other policy run on the same robot must be before
 * the page says so: the smallest of those chances decides. With s
 * successes in n scored tries, a policy's success rate is uncertain: Beta(s + 1, n − s + 1) from a
 * uniform prior. P(leader's rate > next best's rate) at or above `CLEAR` says the leader "did best";
 * at or above `AHEAD` it "was ahead", and the gap could still be chance; below `AHEAD` there is no
 * clear difference. 1 of 1 against 0 of 1 is 5/6 (no clear difference); 7 of 10 against 3 of 10 is
 * about 0.96 (ahead); 9 of 10 against 3 of 10 is above 0.99 (did best).
 */
export const CLEAR = 0.975;
export const AHEAD = 0.85;
/** Numeric slack for the thresholds: a pair whose exact probability is 0.85 or 0.975 stays on the line. */
const THRESHOLD_TOLERANCE = 1e-6;

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

/**
 * How far a row got, read only from well-formed progress: the ladder in order (with or without
 * `approached`), whole counts that never increase down it, none above the graded tries, and no more
 * graded tries than scored ones. Anything else says nothing. `episodes` is the number of tries the
 * phrase is true of: those that reached the furthest stage, or every graded try when none reached any.
 */
function furthestOf(progress: unknown, scored: number): { furthest: { stage: ProgressStage; episodes: number; graded: number } | null;
  text: string; episodes: number; graded: number; distanceText: string | null } | null {
  if (!isRecord(progress) || !Array.isArray(progress.stages)) return null;
  const graded = progress.graded;
  if (typeof graded !== "number" || !Number.isInteger(graded) || graded < 1 || graded > scored) return null;
  const stages = progress.stages as unknown[];
  const ladder = stages.length === PROGRESS_LADDER.length ? PROGRESS_LADDER : PROGRESS_LADDER.slice(1);
  if (stages.length !== ladder.length) return null;
  // The closest approach comes exactly with the `approached` stage, well formed.
  const approach = progress.closestApproachM;
  if ((ladder[0] === "approached") !== (approach !== undefined)) return null;
  const metres = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (approach !== undefined && (!isRecord(approach) || !metres(approach.median) || !metres(approach.min) || approach.min > approach.median)) return null;
  let previous = graded;
  let furthest: { stage: ProgressStage; episodes: number; graded: number } | null = null;
  for (let index = 0; index < ladder.length; index += 1) {
    const entry = stages[index];
    if (!isRecord(entry) || entry.stage !== ladder[index]) return null;
    const episodes = entry.episodes;
    if (typeof episodes !== "number" || !Number.isInteger(episodes) || episodes < 0 || episodes > previous) return null;
    previous = episodes;
    if (episodes > 0) furthest = { stage: ladder[index], episodes, graded };
  }
  if (furthest) return { furthest, text: PROGRESS_PHRASES[furthest.stage], episodes: furthest.episodes, graded, distanceText: null };
  // A row that reached no stage says how close it typically came, when that was measured.
  if (isRecord(approach)) return { furthest: null, text: closestApproachText(approach.median as number), episodes: graded, graded,
    distanceText: closestApproachText(approach.median as number).slice(PROGRESS_NOT_APPROACHED.length + 2) };
  return { furthest: null, text: ladder[0] === "approached" ? PROGRESS_NOT_APPROACHED : PROGRESS_NOT_TOUCHED, episodes: graded, graded,
    distanceText: null };
}

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

/** True when the candidate id is in our closed mapping of policies. */
const isListed = (row: Candidate) => Object.prototype.hasOwnProperty.call(SIMULATION_POLICIES, String(row.candidateId ?? ""));
/** A, B, … Z, then AA, AB, … */
const letterOf = (index: number): string => (index < 26 ? "" : letterOf(Math.floor(index / 26) - 1)) + String.fromCharCode(65 + (index % 26));

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
  const scored = policies.filter(row => count(row.scored) > 0).map(row => ({ row, ...simulationPolicyFor(String(row.candidateId ?? "")),
    succeeded: Math.min(count(row.succeeded), count(row.scored)), scored: count(row.scored) }));
  // Ordered by the mean of each rate's Beta(s + 1, n − s + 1): 9 of 10 leads 1 of 1. Ties keep the
  // policy with more scored tries first, then the evaluation's own order.
  const mean = (entry: { succeeded: number; scored: number }) => (entry.succeeded + 1) / (entry.scored + 2);
  scored.sort((a, b) => mean(b) - mean(a) || b.scored - a.scored);
  // Policies not in our mapping are never shown by a stored name; several are told apart by a letter,
  // in the order of their ids so the same run always gives the same letters.
  const unlisted = [...new Set(scored.filter(entry => !isListed(entry.row)).map(entry => String(entry.row.candidateId ?? "")))].sort();
  if (unlisted.length > 1) for (const entry of scored) {
    if (!isListed(entry.row)) entry.policy = `${UNNAMED_POLICY} (${letterOf(unlisted.indexOf(String(entry.row.candidateId ?? "")))})`;
  }
  // A comparison is among policies that ran on the same robot: the one most scored rows ran on. A row
  // on another robot, or on one we cannot name, is shown and counted but never ranked, never in the
  // comparison and never chosen. When no scored row's robot is known, nothing is ranked.
  const robot = simulatedRobot(scored);
  const ranked = robot ? scored.filter(entry => entry.robot?.modelId === robot.modelId) : [];
  const elsewhere = robot ? scored.filter(entry => entry.robot?.modelId !== robot.modelId) : [];
  const leader = ranked[0] ?? null;
  const next = ranked[1] ?? null;
  const anySuccess = ranked.some(entry => entry.succeeded > 0);
  // The wording rests on the leader against EVERY other ranked policy: the smallest chance that it beats
  // one of them. The counts decide, never the Pipeline's own `selection.chosen`. A policy that never
  // completed the job is never ahead. The tolerance keeps integration error from moving a pair whose
  // exact probability sits on a threshold.
  const ahead = leader && next && leader.succeeded > 0
    ? Math.min(...ranked.slice(1).map(entry => probabilityAhead(leader, entry))) : 0;
  const separated = ahead >= CLEAR - THRESHOLD_TOLERANCE;
  const winnerEntry = ahead >= AHEAD - THRESHOLD_TOLERANCE ? leader : null;
  const notes = [...new Set([...(screening?.setupNotes ?? []).filter(note => typeof note === "string" && note.trim()),
    ...(evaluation.outcomeCaveat === "scene_setup" ? [SCENE_SETUP_CAVEAT] : [])])];
  const counted = (entries: typeof scored) => entries.map(entry => `${entry.policy}, ${entry.succeeded} of ${entry.scored}`).join("; ");
  // How far each row got: facts read from its own progress, never used to order, rank or choose a row.
  const reached = new Map(scored.map(entry => [entry, furthestOf(entry.row.progress, entry.scored)]));
  const comparedReached = ranked.filter(entry => reached.get(entry));
  // Said only on a finished run in which no compared policy completed the job.
  const howFar = !couldNotRun && robot && !anySuccess && comparedReached.length
    ? `${HOW_FAR_EACH_GOT} ${comparedReached.map(entry => {
      const got = reached.get(entry)!;
      // The count goes with what was reached; how close a row that reached nothing came follows it.
      return got.distanceText
        ? `${entry.policy} ${PROGRESS_NOT_APPROACHED} in ${triesText(got.episodes, got.graded)}, and ${got.distanceText}`
        : `${entry.policy} ${got.text} in ${triesText(got.episodes, got.graded)}`;
    }).join("; ")}.` : null;
  const someCompleted = scored.some(entry => entry.succeeded > 0);

  let line: string;
  if (couldNotRun) line = couldNotRun;
  else if (!scored.length) line = NO_POLICY_SCORED;
  else if (!scored.some(entry => entry.succeeded > 0)) line = NO_POLICY_COMPLETED;
  else if (!robot) {
    line = scored.length === 1
      ? `The simulation scored one policy: ${scored[0].policy} completed the job in ${triesText(scored[0].succeeded, scored[0].scored)}. With nothing to compare it to, it could not rank policies.`
      : `${ROBOT_NOT_CONFIRMED} Tries that completed the job: ${counted(scored)}.`;
  } else if (!anySuccess) line = `No policy run on ${robot.name} completed the job in the simulation of your site, so it could not rank them.`;
  else if (!next) {
    line = `The simulation scored one policy on ${robot.name}: ${leader!.policy} completed the job in ${triesText(leader!.succeeded, leader!.scored)}. `
      + "With nothing to compare it to on that robot, it could not rank policies.";
  } else if (winnerEntry) {
    const against = `against ${next.succeeded} of ${next.scored} for ${ranked.length > 2 ? "the next best, " : ""}${next.policy}`;
    const rest = ranked.slice(2);
    line = `In a simulation of your site, on ${robot.name}, ${policyPhrase(leader!)} ${separated ? "did best" : "was ahead"}: it completed the job in `
      + `${triesText(leader!.succeeded, leader!.scored)}, ${against}. ${separated ? GAP_UNLIKELY_CHANCE : GAP_COULD_BE_CHANCE}`
      + (rest.length ? ` The others: ${counted(rest)}.` : "");
  } else {
    line = `No clear difference yet between the policies tried on ${robot.name} in a simulation of your site. Tries that completed the job: ${counted(ranked)}.`;
  }
  if (howFar) line += ` ${howFar}`;
  if (!couldNotRun && elsewhere.length) line += ` ${elsewhereSentence(elsewhere.map(entry => entry.robot))}`;

  const didNotRun = policies.filter(plannedButNotRun).length;
  const named = robot ?? simulatedRobot(policies.map(row => simulationPolicyFor(String(row.candidateId ?? ""))));
  const toRow = (entry: (typeof scored)[number], compared: boolean) => ({ policy: entry.policy, maker: entry.maker,
    succeeded: entry.succeeded, scored: entry.scored,
    // A likely range only beside a row that has a success: zero successes is never an estimate.
    rangeText: entry.succeeded > 0 ? rangeTextOf(entry.row.successRange) : null,
    chosen: compared && entry === winnerEntry, compared, robot: entry.robot?.name ?? null,
    furthest: reached.get(entry)?.furthest ?? null, furthestText: reached.get(entry)?.text ?? null,
    furthestShown: Boolean(reached.get(entry)) && !couldNotRun && someCompleted && entry.succeeded === 0
      && !(howFar && compared) });
  return {
    robotName: named?.name ?? "the simulated robot",
    sameRobotAsPick: Boolean(named && pick && named.modelId === pick.modelId),
    // The compared rows first, leader on top; then the rows on another robot.
    rows: robot ? [...ranked.map(entry => toRow(entry, true)), ...elsewhere.map(entry => toRow(entry, false))]
      : scored.map(entry => toRow(entry, false)),
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

/**
 * One sentence per robot for policies left out of the comparison: "1 more policy ran on a Unitree G1
 * humanoid, a different robot, and is not compared with these." A robot we cannot name is said so.
 */
function elsewhereSentence(robots: Array<SimulatedRobot | null>): string {
  const groups = new Map<string, { robot: SimulatedRobot | null; n: number }>();
  for (const robot of robots) {
    const key = robot?.modelId ?? "";
    groups.set(key, { robot, n: (groups.get(key)?.n ?? 0) + 1 });
  }
  return [...groups.values()].map(({ robot, n }) => `${n} more ${n === 1 ? "policy" : "policies"} ran on `
    + `${robot ? `${robot.name}, a different robot,` : "a robot we could not confirm is the same,"} and ${n === 1 ? "is" : "are"} not compared with these.`).join(" ");
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
function forThisJobOf(state: SimulationProofState, pick: AnswerRobot | null, scaleMeasured: boolean, robot: SimulatedRobot | null,
  mixed = false): string[] {
  if (state === "not_started") return [];
  const lines: string[] = [];
  if (!scaleMeasured) lines.push(SCALE_ESTIMATED);
  if (pick && robot && robot.modelId !== pick.modelId) {
    const noun = robot.kind === "arm" ? "arm" : "robot";
    const policiesForPick = Object.values(SIMULATION_POLICIES).some(entry => entry.robot.modelId === pick.modelId);
    // When some scored policy ran on another robot, say only what is true of the compared ones.
    lines.push(mixed
      ? policiesForPick
        ? `The policies compared here are the ones that run on ${robot.name}; they ran on that ${noun} in a simulation of your site, not on the ${pickName(pick)}.`
        : `We have no public AI policy to run on the ${pickName(pick)}. The policies compared here are the ones that run on ${robot.name}, in a simulation of your site.`
      : policiesForPick
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
  const scoredRobots = scoredPolicies.map(row => simulationPolicyFor(String(row.candidateId ?? "")));
  const robot = simulatedRobot(scoredRobots);
  const mixed = Boolean(robot) && scoredRobots.some(entry => entry.robot?.modelId !== robot!.modelId);
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
    forThisJob: forThisJobOf(state, pick, input?.scaleMeasured === true, robot, mixed),
  };
}
