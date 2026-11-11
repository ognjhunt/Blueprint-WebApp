/**
 * Every sentence the simulation result can say has a precondition in the data. A seeded generator
 * (no dependency: a small deterministic PRNG) builds a few thousand evaluation summaries, junk
 * included, and checks each projected result against rules computed here from the same input.
 */
import { describe, expect, it } from "vitest";

import { readyAnswer } from "../fixtures/siteAnswer";
import { SIMULATION_POLICIES, UNNAMED_POLICY } from "@/data/simulationPolicies";
import type { AnswerRobot } from "@/lib/siteAnswer";
import { AHEAD, CLEAR, HOW_FAR_EACH_GOT, PROGRESS_LADDER, PROGRESS_NOT_APPROACHED, PROGRESS_NOT_TOUCHED, PROGRESS_PHRASES,
  probabilityAhead, projectSimulationProof, type SimulationProof } from "@/lib/simulationProof";
import type { JobManagedEvidenceSummary, JobScreeningOutcome } from "@/types/jobMarketplace";

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];

/** mulberry32: a 32-bit seeded generator, the same sequence on every run. */
function prng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  return { next, int, pick, chance: (p: number) => next() < p };
}

const KNOWN_IDS = ["pi05_droid", "pi0_droid_jointpos_polaris", "pi0_fast_droid_jointpos_polaris", "groot_n17_droid",
  "cosmos3_nano_policy_droid", "molmoact2_droid", "cosmos3_edge_policy_droid", "humanoidarena_pi05_g1_dex3_sonic"];
/** Names an unknown id may carry: plain ones, and codes, markup and working labels that must never be shown. */
const UNKNOWN_NAMES = ["Acme Grasp", "Northwind Picker", "Guaranteed safe production-ready policy", "acme_grasp_v2_ckpt", "gs://bucket/model", "<b>Grip</b>", "<i>Grip",
  "sha256:abcdef0123456789", "Current candidate", "Policy v2.1", "hf://org/model", "pi05_droid_checkpoint_9000", "{policy}", ""];
const REFERENCE_NAME = "Reference Grasp";
const SCRIPTED_NAME = "Scripted Mover";
const NOTES = ["Our scene check measured one step of the job as beyond a robot arm's reach from where it stands in the scene."];
const OUTCOMES: Array<JobScreeningOutcome | null | undefined> = ["estimate", "estimate", "estimate", "estimate", "reference_only", "held_capability",
  "held_unprepared", "infeasible", "no_match", "held_setup", "held_budget", "held_scene_check", "awaiting_spend_approval", "setup_repair",
  "superseded", null, undefined];
const STATES = ["completed", "deferred", "blocked", "running", "pending", "unavailable", "launching"];

const ur10e = readyAnswer.pick!;
const franka: AnswerRobot = { ...ur10e, modelId: "franka_emika_panda", name: "Panda (FER)", manufacturer: "Franka Robotics" };

interface Generated { input: Parameters<typeof projectSimulationProof>[0]; ranked: Array<{ succeeded: number; scored: number }>;
  /** Each policy row's progress as generated, well formed or not. */
  progress: unknown[] }

/**
 * Progress for a row, from its own generator so the rest of the sequence is the one it always was: mostly
 * well formed (with or without `approached`, counts that never increase), sometimes junk (counts that
 * increase or exceed the graded tries, unknown or reordered stages, more graded tries than scored ones).
 */
function generateProgress(random: ReturnType<typeof prng>, scored: number): unknown {
  if (random.chance(0.45)) return undefined;
  const ladder = random.chance(0.5) ? PROGRESS_LADDER : PROGRESS_LADDER.slice(1);
  const graded = random.chance(0.05) ? scored + 1 : random.int(scored > 0 ? 1 : 0, Math.max(scored, 0));
  let previous = graded;
  const stages = ladder.map(stage => {
    const episodes = random.chance(0.15) ? 0 : random.int(0, previous);
    previous = episodes;
    return { stage, episodes };
  });
  if (random.chance(0.04)) stages[stages.length - 1].episodes = graded + 2;
  if (random.chance(0.03)) stages.reverse();
  if (random.chance(0.03)) stages[1] = { stage: "grasped" as never, episodes: 0 };
  // The closest approach: with `approached` as a rule, sometimes missing, misplaced or malformed.
  const median = random.pick([0, 0.004, 0.0429, 0.065, 0.2, 0.995, 1.37]);
  const approach = random.chance(0.05) ? { median, min: median + 0.01 } : { median, min: Math.min(median, 0.001) };
  const carries = ladder.length === 7 ? !random.chance(0.05) : random.chance(0.05);
  return { graded, stages, meanScore: 0.5, ...(carries ? { closestApproachM: approach } : {}) };
}
/** The deepest stage a well-formed progress reached, or undefined when it is not well formed; null when it reached none. */
function deepestOf(value: unknown, scored: number): { stage: string; episodes: number; graded: number } | null | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { graded, stages } = value as { graded: number; stages: Array<{ stage: string; episodes: number }> };
  if (!Number.isInteger(graded) || graded < 1 || graded > scored || !Array.isArray(stages)) return undefined;
  const ladder = stages.length === 7 ? PROGRESS_LADDER : PROGRESS_LADDER.slice(1);
  const approach = (value as { closestApproachM?: { median: number; min: number } }).closestApproachM;
  if ((ladder[0] === "approached") !== (approach !== undefined) || (approach && approach.min > approach.median)) return undefined;
  if (stages.length !== ladder.length || stages.some((entry, index) => entry.stage !== ladder[index]
    || !Number.isInteger(entry.episodes) || entry.episodes < 0 || entry.episodes > (index ? stages[index - 1].episodes : graded))) return undefined;
  const reached = stages.filter(entry => entry.episodes > 0);
  return reached.length ? { ...reached[reached.length - 1], graded } : null;
}
const CLOSED_PHRASES = new Set([...Object.values(PROGRESS_PHRASES), PROGRESS_NOT_APPROACHED, PROGRESS_NOT_TOUCHED]);
/** The one phrase with a figure in it: how close a policy that reached no stage typically came. */
const DISTANCE = /^did not get its gripper within 2 cm of the object; it typically came within about (?:[1-9]\d? cm|\d+\.\d m) of it$/;
const closed = (text: string) => CLOSED_PHRASES.has(text) || DISTANCE.test(text);

function generate(random: ReturnType<typeof prng>, index: number, progressRandom = prng(index + 7)): Generated {
  const rows: Candidate[] = [];
  const references: string[] = [];
  const ranked: Array<{ succeeded: number; scored: number }> = [];
  const progress: unknown[] = [];
  const count = random.int(0, 6);
  for (let i = 0; i < count; i += 1) {
    const kind = random.pick(["known", "known", "unknown", "reference", "scripted"] as const);
    const candidateId = kind === "known" ? random.pick(KNOWN_IDS) : `${kind}_${index}_${i}`;
    const name = kind === "reference" ? `${REFERENCE_NAME} ${i}` : kind === "scripted" ? `${SCRIPTED_NAME} ${i}`
      : kind === "unknown" ? random.pick(UNKNOWN_NAMES) : candidateId;
    // Mostly sane counts, sometimes junk: more successes than tries, negatives, fractions, strings.
    // Few tries often, so a row with one or two tries can set the leader's smallest chance.
    let scored: unknown = random.chance(0.3) ? 0 : random.chance(0.35) ? random.int(1, 2) : random.int(1, 40);
    let succeeded: unknown = random.chance(0.3) ? Number(scored) || 0 : random.int(0, Number(scored) || 0);
    if (random.chance(0.05)) succeeded = Number(scored) + 3;
    if (random.chance(0.03)) scored = -2;
    if (random.chance(0.03)) succeeded = 1.5;
    if (random.chance(0.02)) scored = "7";
    const range = random.chance(0.7)
      ? { lowerPercent: random.int(-10, 60), upperPercent: random.int(40, 120), confidencePercent: 95 }
      : random.chance(0.5) ? { lowerPercent: Number.NaN, upperPercent: 50, confidencePercent: 95 } : undefined;
    const generatedProgress = kind === "reference" || kind === "scripted" ? undefined
      : generateProgress(progressRandom, typeof scored === "number" ? scored : 0);
    if (generatedProgress !== undefined) progress.push(generatedProgress);
    rows.push({ candidateId, name, state: random.pick(STATES), planned: random.int(0, 10), scored: scored as number, succeeded: succeeded as number,
      ...(generatedProgress !== undefined ? { progress: generatedProgress as never } : {}),
      failed: 0, void: 0, blockers: random.chance(0.2) ? ["site_screening_budget_insufficient"] : [],
      ...(range ? { successRange: range } : {}),
      ...(kind === "scripted" ? { executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline" as const,
        action_source: "scripted_simulator_state", scripted_rollout_count: 10, learned_policy_rollout_count: 0,
        scripted_controller_invoked: true, candidate_policy_queried: false } } : {}) } as Candidate);
    if (kind === "reference") references.push(candidateId);
    const s = typeof scored === "number" && Number.isInteger(scored) && scored > 0 ? scored : 0;
    const k = typeof succeeded === "number" && Number.isInteger(succeeded) && succeeded >= 0 ? Math.min(succeeded, s) : 0;
    if (kind !== "reference" && kind !== "scripted" && s > 0) ranked.push({ succeeded: k, scored: s });
  }
  const evaluation: JobManagedEvidenceSummary = { runId: `run-${index}`, state: random.pick(["completed", "running", "queued", "blocked"]),
    current: true, resultDigest: null, outcome: random.pick(OUTCOMES) as JobScreeningOutcome | null, summary: "", nextAction: "", limitations: [],
    href: "#", ...(random.chance(0.2) ? { outcomeCaveat: "scene_setup" as const } : {}),
    screening: { candidates: rows, ...(random.chance(0.3) ? { setupNotes: NOTES } : {}),
      ...(references.length || random.chance(0.3) ? { selection: { status: random.pick(["chosen", "no_successful_candidate"]) as never,
        selectionDigest: `sha256:${"a".repeat(64)}`, tiedWith: [],
        // A Pipeline choice that may disagree with the counts: the counts must decide the sentence.
        chosen: rows.length ? { candidateId: random.pick(rows).candidateId } as never : null,
        candidates: [...references.map(candidateId => ({ candidateId, resultRank: null,
          choiceBlocker: random.pick(["development_only_reference", "scripted_baseline_reference_only"]) })),
        ...rows.filter(row => !references.includes(row.candidateId)).map(row => ({ candidateId: row.candidateId, resultRank: 1, choiceBlocker: null }))] } } : {}) },
  };
  const robotFit = random.chance(0.5) ? { models: [{ name: random.pick(["UR10e", "Panda (FER)", "Other"]),
    manufacturer: random.pick(["Universal Robots", "Franka Robotics"]), verdict: random.pick(["fits", "fits_spec", "doesnt_fit", "unknown"] as const), openChecks: [] }] } : null;
  return { input: { evaluation: random.chance(0.05) ? null : evaluation, robotFit, pick: random.pick([ur10e, franka, null]), scaleMeasured: random.chance(0.3) },
    ranked, progress };
}

/** Every sentence the result can show or email. */
function sentencesOf(proof: SimulationProof): string[] {
  const comparison = proof.policyComparison;
  return [proof.headline, proof.robotCheck?.line ?? "", ...proof.forThisJob, comparison?.line ?? "", comparison?.didNotRunLine ?? "",
    ...(comparison?.rows ?? []).flatMap(row => [row.policy, row.maker ?? "", row.rangeText ?? "", row.furthestText ?? ""])].filter(Boolean);
}

/** Words that say a policy was run, tried, completed the job, or compared. */
const SAYS_POLICIES_RAN = /\bran\b|\btried\b|\btries\b|\btry\b|completed the job in|did best|was ahead|\bahead\b|compared|no clear difference/i;
/** A raw checkpoint string, a snake_case code, a link or digest, or markup. */
const RAW = /_|[<>{}]|gs:\/\/|hf:\/\/|sha256|checkpoint|DROID|jointpos|polaris|ckpt/i;
const MAPPED_NAMES = new Set(Object.values(SIMULATION_POLICIES).map(entry => entry.policy));
/** Stored display names the generator writes; none may appear in any sentence. */
const STORED_NAMES = [...UNKNOWN_NAMES.filter(name => name.length >= 4 && !/^an AI control policy/.test(name)), REFERENCE_NAME, SCRIPTED_NAME];
const mean = (row: { succeeded: number; scored: number }) => (row.succeeded + 1) / (row.scored + 2);

describe("every sentence of the simulation result has a precondition in the data (seeded generated input)", () => {
  it("holds over 2500 generated evaluations", () => {
    const random = prng(20261111);
    let compared = 0;
    let winners = 0;
    let separated = 0;
    let mixedRobots = 0;
    let unknownOnly = 0;
    let howFar = 0;
    let rowShown = 0;
    let distances = 0;
    let partlyGraded = 0;
    for (let index = 0; index < 2500; index += 1) {
      const { input, ranked, progress } = generate(random, index);
      const proof = projectSimulationProof(input);
      const sentences = sentencesOf(proof);
      const comparison = proof.policyComparison;
      const context = JSON.stringify({ index, proof });

      // Nothing says a policy ran, was tried, completed the job or did best unless tries were scored.
      if (!ranked.length) for (const sentence of sentences) expect(sentence, context).not.toMatch(SAYS_POLICIES_RAN);
      // No raw checkpoint string, snake_case code or markup in any sentence.
      for (const sentence of sentences) expect(sentence, context).not.toMatch(RAW);
      if (!comparison) continue;
      compared += 1;

      // A name we did not write never reaches the page: every row is a mapped policy or the neutral phrase.
      for (const row of comparison.rows) {
        expect(MAPPED_NAMES.has(row.policy) || row.policy.replace(/ \([A-Z]+\)$/, "") === UNNAMED_POLICY, context).toBe(true);
      }
      for (const sentence of sentences) for (const stored of STORED_NAMES) expect(sentence, context).not.toContain(stored);
      // No winner is ever named among rows whose robot is unknown.
      if (comparison.rows.length && comparison.rows.every(row => row.robot === null)) {
        unknownOnly += 1;
        expect(comparison.winner, context).toBeNull();
        expect(comparison.separated, context).toBe(false);
        expect(comparison.rows.some(row => row.chosen || row.compared), context).toBe(false);
        expect(comparison.line, context).not.toMatch(/did best|was ahead|No clear difference/);
      }
      // No reference or scripted row is ever ranked, and the rows are exactly the scored policies.
      expect(comparison.rows.some(row => row.policy.startsWith(REFERENCE_NAME) || row.policy.startsWith(SCRIPTED_NAME)), context).toBe(false);
      expect(comparison.rows.map(row => [row.succeeded, row.scored]).sort(), context).toEqual(ranked.map(row => [row.succeeded, row.scored]).sort());
      // Only policies that ran on one robot are compared: the compared rows come first, all on the same
      // robot, and that robot is the one most scored rows ran on. The rest are never chosen.
      const onOneRobot = comparison.rows.filter(row => row.compared);
      const elsewhere = comparison.rows.filter(row => !row.compared);
      expect(comparison.rows, context).toEqual([...onOneRobot, ...elsewhere]);
      expect(new Set(onOneRobot.map(row => row.robot)).size, context).toBeLessThanOrEqual(1);
      const groups = new Map<string, number>();
      for (const row of comparison.rows) groups.set(String(row.robot), (groups.get(String(row.robot)) ?? 0) + 1);
      if (onOneRobot.length && onOneRobot[0].robot) {
        mixedRobots += elsewhere.length ? 1 : 0;
        expect(onOneRobot[0].robot, context).toBe(comparison.robotName);
        for (const [robot, n] of groups) if (robot !== "null") expect(onOneRobot.length, context).toBeGreaterThanOrEqual(n);
      }
      for (const row of elsewhere) expect(row.chosen, context).toBe(false);
      // Ordered by the mean of each rate's posterior within each group, so the first row is the leader.
      for (const group of [onOneRobot, elsewhere]) {
        for (let i = 1; i < group.length; i += 1) expect(mean(group[i - 1]), context).toBeGreaterThanOrEqual(mean(group[i]));
      }

      // A winner only when the leader's smallest chance of beating any other compared row is ≥ AHEAD;
      // separated only when it is ≥ CLEAR; and both whenever the rule says so on a finished run.
      const [leader] = onOneRobot;
      const p = leader && onOneRobot.length > 1 && leader.succeeded > 0
        ? Math.min(...onOneRobot.slice(1).map(row => probabilityAhead(leader, row))) : 0;
      const TOLERANCE = 1e-6;
      if (comparison.winner) {
        winners += 1;
        expect(p, context).toBeGreaterThanOrEqual(AHEAD - TOLERANCE);
        expect(comparison.winner.policy, context).toBe(leader.policy);
      }
      if (comparison.separated) {
        separated += 1;
        expect(p, context).toBeGreaterThanOrEqual(CLEAR - TOLERANCE);
        expect(comparison.winner, context).not.toBeNull();
      }
      if (proof.state === "done") {
        expect(Boolean(comparison.winner), context).toBe(p >= AHEAD - TOLERANCE);
        expect(comparison.separated, context).toBe(p >= CLEAR - TOLERANCE);
        // A ranking sentence names the robot the onOneRobot policies ran on, whenever it is known.
        if (onOneRobot[0]?.robot && /did best|was ahead|No clear difference|scored one policy/.test(comparison.line)) {
          expect(comparison.line.split(/(?<=\.)\s/)[0], context).toContain(onOneRobot[0].robot);
        }
      }
      // Only the named winner's row is marked.
      expect(comparison.rows.filter(row => row.chosen).length, context).toBe(comparison.winner ? 1 : 0);
      if (comparison.winner) expect(comparison.rows[0].chosen, context).toBe(true);

      // A likely range only beside a row with at least one success.
      for (const row of comparison.rows) if (row.rangeText) expect(row.succeeded, context).toBeGreaterThan(0);

      // How far each got: facts only. Never said without progress data, counts equal to the rows' data,
      // phrases only from the closed mapping, never a deeper stage than the data, and nothing ranked on it.
      const [ranking, howFarSentence] = comparison.line.split(` ${HOW_FAR_EACH_GOT} `);
      const wellFormed = progress.filter(value => deepestOf(value, Number.MAX_SAFE_INTEGER) !== undefined);
      if (!wellFormed.length) expect(howFarSentence, context).toBeUndefined();
      for (const row of comparison.rows) {
        if (row.furthestText !== null) expect(closed(row.furthestText), context).toBe(true);
        expect(row.furthestDetail === null, context).toBe(row.furthestText === null);
        if (row.furthestText && DISTANCE.test(row.furthestText)) distances += 1;
        // The distance is said only for a row that reached no stage.
        if (row.furthest) expect(row.furthestText, context).not.toMatch(/typically/);
        else expect(row.furthest, context).toBeNull();
        if (row.furthest) {
          // Some generated row's data reached exactly this stage, with these counts, and went no deeper.
          expect(progress.some(value => JSON.stringify(deepestOf(value, row.scored)) === JSON.stringify(row.furthest)), context).toBe(true);
          expect(row.furthestText, context).toBe(PROGRESS_PHRASES[row.furthest.stage]);
          expect(row.furthest.episodes, context).toBeGreaterThan(0);
          expect(row.furthest.episodes, context).toBeLessThanOrEqual(row.furthest.graded);
          expect(row.furthest.graded, context).toBeLessThanOrEqual(row.scored);
        }
        if (row.furthestDetail !== null) {
          // The tries a phrase is said of are the row's graded tries, and "we could grade" says so exactly
          // when fewer were graded than scored.
          let graded: number;
          if (row.furthest) {
            const { stage, episodes } = row.furthest;
            graded = row.furthest.graded;
            expect(row.furthestDetail, context).toBe(`${PROGRESS_PHRASES[stage]} ${graded === row.scored
              ? `in ${episodes} of ${graded} ${graded === 1 ? "try" : "tries"}`
              : graded === 1 ? "in the one try we could grade" : `in ${episodes} of the ${graded} tries we could grade`}`);
          } else {
            // Reached nothing: said of all its graded tries, and how close it came only when the phrase says so.
            const match = row.furthestDetail.match(/^(did not touch the object|did not get its gripper within 2 cm of the object) in (?:its one try|any of its (\d+) tries|the one try we could grade|any of the (\d+) tries we could grade)(?:, typically coming within about (.+) of it)?$/);
            expect(match, context).not.toBeNull();
            graded = Number(match![2] ?? match![3] ?? 1);
            expect(graded === 1 ? !match![2] && !match![3] : graded > 1, context).toBe(true);
            expect(progress.some(value => deepestOf(value, row.scored) === null && (value as { graded: number }).graded === graded), context).toBe(true);
            expect(row.furthestText, context).toBe(match![4] ? `${match![1]}; it typically came within about ${match![4]} of it` : match![1]);
          }
          expect(graded, context).toBeLessThanOrEqual(row.scored);
          expect(/we could grade/.test(row.furthestDetail), context).toBe(graded < row.scored);
          if (graded < row.scored) partlyGraded += 1;
        }
        if (row.furthestShown) {
          rowShown += 1;
          expect(row.furthestDetail, context).not.toBeNull();
          expect(row.furthestDetail, context).not.toMatch(/did not .* in \d+ of \d+ tr/);
          expect(row.succeeded, context).toBe(0);
          expect(comparison.rows.some(other => other.succeeded > 0), context).toBe(true);
        }
      }
      if (howFarSentence !== undefined) {
        howFar += 1;
        const onRobot = comparison.rows.filter(row => row.compared);
        expect(proof.state, context).toBe("done");
        expect(onRobot.some(row => row.succeeded > 0), context).toBe(false);
        const named = onRobot.filter(row => row.furthestText !== null);
        const parts = howFarSentence.split(/(?<=\.) /)[0].replace(/\.$/, "").split("; ");
        expect(parts.length, context).toBe(named.length);
        parts.forEach((part, i) => {
          const row = named[i];
          // Each item is the policy and the row's own detail, which restates its phrase with its tries.
          expect(part, context).toBe(`${row.policy} ${row.furthestDetail}`);
        });
        // The headline stays the first sentence, which says nothing about progress.
        expect(proof.headline, context).not.toContain(HOW_FAR_EACH_GOT);
      }
      // Without any progress the comparison is exactly the same: order, marks, winner and every word before it.
      if (input.evaluation) {
        const stripped = projectSimulationProof({ ...input, evaluation: { ...input.evaluation, screening: { ...input.evaluation.screening!,
          candidates: input.evaluation.screening!.candidates.map(({ progress: _progress, ...row }) => row) } } }).policyComparison!;
        expect(comparison.rows.map(row => [row.policy, row.succeeded, row.scored, row.chosen, row.compared, row.robot]), context)
          .toEqual(stripped.rows.map(row => [row.policy, row.succeeded, row.scored, row.chosen, row.compared, row.robot]));
        expect([comparison.winner, comparison.separated], context).toEqual([stripped.winner, stripped.separated]);
        expect(stripped.line.startsWith(ranking), context).toBe(true);
        expect(comparison.line.replace(` ${HOW_FAR_EACH_GOT} ${howFarSentence?.split(/(?<=\.) /)[0] ?? ""}`, ""), context)
          .toBe(stripped.line);
      }

      // The counts in the ranking sentence are the rows' counts, in the rows' order.
      const said = [...ranking.matchAll(/(\d+) of (\d+)/g)].map(match => [Number(match[1]), Number(match[2])]);
      if (said.length) expect(said, context).toEqual(comparison.rows.map(row => [row.succeeded, row.scored]).slice(0, said.length));
      if (proof.state === "done" && onOneRobot.some(row => row.succeeded > 0)) {
        expect(said.length, context).toBe(onOneRobot.length);
        expect(proof.headline, context).toBe(comparison.line.split(/(?<=\.)\s/)[0]);
      }
      // "Did best" and "was ahead" only with a winner; "did best" only when separated.
      expect(/did best/.test(comparison.line), context).toBe(proof.state === "done" && comparison.separated);
      expect(/was ahead/.test(comparison.line), context).toBe(proof.state === "done" && Boolean(comparison.winner) && !comparison.separated);
      // "More policies did not run" only beside policies that ran.
      if (comparison.didNotRunLine && !comparison.rows.length) expect(comparison.didNotRunLine, context).not.toMatch(/\bmore\b/);
    }
    // The generator reaches every branch the rules cover.
    expect(compared).toBeGreaterThan(500);
    expect(winners).toBeGreaterThan(20);
    expect(separated).toBeGreaterThan(5);
    expect(mixedRobots).toBeGreaterThan(20);
    expect(unknownOnly).toBeGreaterThan(20);
    expect(howFar).toBeGreaterThan(8);
    expect(rowShown).toBeGreaterThan(20);
    expect(distances).toBeGreaterThan(20);
    expect(partlyGraded).toBeGreaterThan(20);
  }, 60_000);
});
