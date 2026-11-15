import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { SceneScreening } from "./taskStatusProjection";
import { readEvaluation, type PassMark, type RunWithResult } from "./pilotRecommendationEvidence";
import { isSiteEvaluation, type EvalRunRecord } from "./agentRunRecord";

const RUNS_COLLECTION = "evaluationRuns";

/**
 * What the runs against one scene add up to, for the site that owns it.
 *
 * Counts only. Observed runs are counted without comparing their outcomes:
 * different protocols and resets are not proven comparable. A blocked or
 * zero-episode completion is counted explicitly as no result.
 *
 * With the job's pass mark, `passed` counts reported runs whose result meets
 * it (`readEvaluation`). A recorded result is final evidence and settlement can
 * land after it, so it is judged as recorded: this can only over-count passes,
 * which keeps "no team passed" from being said early.
 */
export async function loadSceneScreening(sceneId: string, passMark?: PassMark): Promise<SceneScreening> {
  const empty: SceneScreening = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0, ...(passMark ? { passed: 0, ineligible: 0 } : {}) };
  if (!db || !sceneId) return empty;

  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("sceneId", "==", sceneId)
    .limit(500)
    .get();

  const teams = new Set<string>();
  const screening: SceneScreening = { ...empty };

  for (const doc of snapshot.docs) {
    const run = doc.data() as EvalRunRecord & {
      result?: { observed?: { episodesRun?: number; episodesSucceeded?: number } } | null;
    };
    if (!isSiteEvaluation(run)) continue;
    const observed = run.result?.observed;
    const episodes = Math.max(0, Math.round(observed?.episodesRun ?? 0));

    if (observed && episodes > 0) {
      screening.reported += 1;
      if (passMark) {
        const reading = readEvaluation({ ...run, state: "completed" } as RunWithResult, sceneId, passMark);
        if (reading.passed === true) screening.passed = (screening.passed ?? 0) + 1;
        // Missing qualification, measurements or accounting is unknown evidence,
        // never proof that the team's policy failed the job.
        const ineligible = reading.refusals.some(refusal => !["evaluation_below_pass_mark", "evaluation_cycle_time_missed"].includes(refusal));
        if (ineligible) screening.ineligible = (screening.ineligible ?? 0) + 1;
        // A qualified run short of the pass mark says what would change the
        // outcome; keep the one that came closest (audit A).
        else if (reading.passed === false && reading.episodesRun && reading.episodesSucceeded !== null) {
          const candidate = { episodesRun: reading.episodesRun, episodesSucceeded: reading.episodesSucceeded,
            medianCycleSeconds: typeof reading.medianCycleSeconds === "number" ? reading.medianCycleSeconds : null,
            passMarkRate: passMark.successRate, cycleTimeSeconds: passMark.cycleTimeSeconds,
            belowPassMark: reading.refusals.includes("evaluation_below_pass_mark"),
            cycleTimeMissed: reading.refusals.includes("evaluation_cycle_time_missed") };
          const best = screening.closestQualified;
          if (!best || candidate.episodesSucceeded / candidate.episodesRun > best.episodesSucceeded / best.episodesRun)
            screening.closestQualified = candidate;
        }
      }
      teams.add(run.teamId);
      continue;
    }

    if (run.state === "blocked" || run.state === "completed") {
      screening.noResult += 1;
      teams.add(run.teamId);
      continue;
    }

    if (run.state === "requested") {
      if (run.dispatch?.startedAtIso) screening.running += 1;
      else screening.queued += 1;
      teams.add(run.teamId);
    }
  }

  screening.teams = teams.size;
  return screening;
}
