/**
 * What a run showed, and what that entitles us to claim.
 *
 * ## The loop that was never closed
 *
 * `recordEvaluationOutcome` and `recordMeasuredCapability` are the two
 * functions that write a result back into the registry, and until this module
 * nothing called either of them. The consequences were quiet and total: the
 * `measured` grade had no writer, so the top rung of the ladder that governs
 * the whole registry was empty in practice; a `self_registered` team could
 * never be promoted into the supply sites are shown, because the only path in
 * was an uncalled function; and a team could buy evaluations and had no way to
 * learn what they showed.
 *
 * Money settled. Results went nowhere.
 *
 * ## Why a band is not just a number rounded
 *
 * `demonstratedSuccessRate` is a band — `ninety`, `ninetyfive`, `ninetynine`,
 * `ninetynine_plus` — and once a run writes one at `measured`, nothing can
 * outrank it. Not the team's own answer, not a later datasheet. That is the
 * point of the ladder, and it is exactly why the mapping has to be pessimistic:
 * a run that reports 50 successes in 50 episodes has *not* demonstrated better
 * than 99%, and writing that permanently would make `measured` less
 * trustworthy than the dropdown it supersedes.
 *
 * So the band comes from the lower bound of a Wilson interval rather than from
 * the observed ratio. Fifty-for-fifty lands at `ninety`, which is what fifty
 * trials can actually support; claiming `ninetynine_plus` needs the sample to
 * justify it. The observed numbers are still stored verbatim, so nothing is
 * lost — only the *claim* is bounded.
 *
 * ## What it refuses to say
 *
 * There is no band below `ninety`. A robot measured at sixty per cent has
 * nowhere honest to land: `unsure` means "not measured on a task like this",
 * which would be false, and `ninety` would be an inflation. So this writes no
 * band at all in that case. The result record still carries the real figures,
 * and a reader can see exactly what happened — the registry simply does not
 * gain a claim the evidence does not support.
 */

import { isDeepStrictEqual } from "node:util";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  invalidateMeasuredCapability,
  recordMeasuredCapability,
} from "./robotCheckpoints";
import type { RobotCapabilityField } from "../types/robot-team-registry";
import { recordCohortEpisodes } from "./cohortEconomics";
import { settlementAmountUsd } from "./agentEvalRuns";
import { recordEvaluationOutcome } from "./robotTeamRegistry";
import { enqueueTaskLifecycleNotification } from "./taskLifecycleNotifications";
import type { EvalRunRecord } from "./agentEvalRuns";

const RUNS_COLLECTION = "evaluationRuns";

/** What the Pipeline observed. Numbers, not claims. */
export interface RunOutcomeReport {
  episodesRun: number;
  episodesSucceeded: number;
  medianCycleSeconds?: number | null;
  /** Spread, when the Pipeline measured it. Used only to say "it varies". */
  cycleSecondsP10?: number | null;
  cycleSecondsP90?: number | null;
  /** Free text from the run, for a person. Never parsed. */
  note?: string | null;
  /** Where the artifacts live, if the run produced any. */
  artifactUri?: string | null;
}

/** What we store and hand back, observation and claim kept apart. */
export interface EvalRunResult {
  runId: string;
  teamId: string;
  checkpointId: string;
  sceneId: string;
  observed: {
    episodesRun: number;
    episodesSucceeded: number;
    successRate: number | null;
    medianCycleSeconds: number | null;
  };
  /**
   * What the observation supports claiming, which is deliberately less than
   * the observation itself. Null where the sample cannot support any band.
   */
  claimed: {
    demonstratedSuccessRate: string | null;
    cycleTime: string | null;
  };
  note: string | null;
  artifactUri: string | null;
  reportedAtIso: string;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * The lower end of what this sample can support, at roughly 95% confidence.
 *
 * Wilson rather than the naive ratio, because the naive ratio is unbounded
 * nonsense at small n: ten-for-ten is not evidence of 99.9%, and a normal
 * approximation says the interval has zero width, which is worse than nonsense.
 */
export function wilsonLowerBound(successes: number, trials: number): number {
  if (trials <= 0) return 0;
  const z = 1.96;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin =
    z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return Math.max(0, (centre - margin) / denominator);
}

/**
 * The upper end of the same interval.
 *
 * Needed for the opposite question. `wilsonLowerBound` answers "what can this
 * run claim"; this answers "what can this run rule out" -- and only the second
 * one justifies withdrawing somebody else's claim.
 */
export function wilsonUpperBound(successes: number, trials: number): number {
  if (trials <= 0) return 1;
  const z = 1.96;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin =
    z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return Math.min(1, (centre + margin) / denominator);
}

/**
 * What each band asserts to whoever reads it.
 *
 * Deliberately the *name's* claim rather than the threshold the band is awarded
 * at. `successRateBand` hands out `ninety` at a lower bound of 0.85, so the two
 * numbers differ -- and when the question is "has this claim been disproved",
 * the honest reference is what a site is being told, which is 90%.
 *
 * (That gap between a band's name and its award threshold is a separate defect,
 * and it is not fixed here: changing the thresholds changes which bands get
 * written, and this change is about what happens to a claim that is already
 * written.)
 */
export const SUCCESS_RATE_BAND_CLAIM: Record<string, number> = {
  ninety: 0.9,
  ninetyfive: 0.95,
  ninetynine: 0.99,
  ninetynine_plus: 0.99,
};

/**
 * Whether this run rules out a band somebody already claimed.
 *
 * ## Why "no band" is the wrong test
 *
 * My first attempt withdrew a claim whenever the run earned no band of its own.
 * That is wrong, and wrong in a way that punishes honesty: ten-for-ten earns no
 * band, because ten trials cannot separate 90% from 99% -- but it is a perfect
 * result, and it contradicts nothing. Withdrawing a claim on the strength of it
 * would mean a team's good short run cost it the claim its long run earned.
 *
 * So the test is contradiction, not silence. The claim goes only when the whole
 * interval this run supports sits below what the claim asserts -- 30 of 50 has
 * an upper bound near 73%, which rules out 95%, while 10 of 10 rules out
 * nothing. Same rule the footage review uses on a site: `contradicts` revokes,
 * and an absence of corroboration does not.
 */
export function measurementContradictsBand(
  successes: number,
  trials: number,
  heldBand: string | null | undefined,
): boolean {
  if (trials <= 0) return false;
  const claimed = heldBand ? SUCCESS_RATE_BAND_CLAIM[heldBand] : undefined;
  // Nothing recognisable is claimed, so there is nothing to disprove. An
  // unknown band is left alone rather than guessed at.
  if (claimed === undefined) return false;
  return wilsonUpperBound(successes, trials) < claimed;
}

/**
 * The highest band this run can honestly claim, or null.
 *
 * Null is a real answer and the common one for a short run. It means the
 * registry keeps whatever it had rather than gaining a worse-founded claim that
 * nothing could later outrank.
 */
export function successRateBand(successes: number, trials: number): string | null {
  if (trials <= 0) return null;
  const bound = wilsonLowerBound(successes, trials);
  if (bound >= 0.99) return "ninetynine_plus";
  if (bound >= 0.97) return "ninetynine";
  if (bound >= 0.93) return "ninetyfive";
  if (bound >= 0.85) return "ninety";
  // Below the lowest band on the scale. `unsure` would be a lie -- it means
  // "not measured" and this was measured -- so nothing is claimed.
  return null;
}

/** Which cycle-time band a measured median falls in. */
export function cycleTimeBand(
  medianSeconds: number | null | undefined,
  p10?: number | null,
  p90?: number | null,
): string | null {
  if (medianSeconds == null || !Number.isFinite(medianSeconds) || medianSeconds <= 0) {
    return null;
  }
  // A band describes a job that holds a pace. When the Pipeline measured the
  // spread and it is wide, the honest band is the one that says so.
  if (p10 != null && p90 != null && p10 > 0 && p90 >= p10 * 3) return "varies";
  if (medianSeconds < 30) return "under_30s";
  if (medianSeconds < 120) return "thirty_to_two_min";
  if (medianSeconds < 600) return "two_to_ten_min";
  return "over_ten_min";
}

/**
 * Record what a run showed, and let it supersede what was claimed.
 *
 * Returns null when there is no run to attach it to: a result for a run we
 * never reserved money for has no team, no checkpoint and no scene, and
 * inventing them to have somewhere to write would put a measured-grade claim
 * on a robot nobody evaluated.
 */
export async function recordRunResult(params: {
  runId: string;
  report: RunOutcomeReport;
}): Promise<EvalRunResult | null> {
  if (!db) return null;

  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    logger.warn({ runId: params.runId }, "Result reported for a run we hold no record of");
    return null;
  }
  const run = snapshot.data() as EvalRunRecord;

  const episodesRun = Math.max(0, Math.round(params.report.episodesRun));
  const episodesSucceeded = Math.min(
    episodesRun,
    Math.max(0, Math.round(params.report.episodesSucceeded)),
  );
  const medianCycleSeconds =
    params.report.medianCycleSeconds != null && Number.isFinite(params.report.medianCycleSeconds)
      ? params.report.medianCycleSeconds
      : null;

  const result: EvalRunResult = {
    runId: run.runId,
    teamId: run.teamId,
    checkpointId: run.checkpointId,
    sceneId: run.sceneId,
    observed: {
      episodesRun,
      episodesSucceeded,
      successRate: episodesRun > 0 ? round2(episodesSucceeded / episodesRun) : null,
      medianCycleSeconds,
    },
    claimed: {
      demonstratedSuccessRate: successRateBand(episodesSucceeded, episodesRun),
      cycleTime: cycleTimeBand(
        medianCycleSeconds,
        params.report.cycleSecondsP10,
        params.report.cycleSecondsP90,
      ),
    },
    note: params.report.note ?? null,
    artifactUri: params.report.artifactUri ?? null,
    reportedAtIso: new Date().toISOString(),
  };

  let firstReport = false;
  await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    const prior = current.data()?.result as EvalRunResult | undefined;
    firstReport = !prior;
    if (prior) {
      const { reportedAtIso: _priorTime, ...priorEvidence } = prior;
      const { reportedAtIso: _newTime, ...newEvidence } = result;
      if (!isDeepStrictEqual(priorEvidence, newEvidence)) throw new Error("Run result conflicts with the recorded evidence");
      result.reportedAtIso = prior.reportedAtIso;
      return;
    }
    transaction.set(ref, { result, resultReportedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  // The site hears when a team's result lands, once per run.
  if (firstReport) {
    try {
      await enqueueTaskLifecycleNotification({
        requestId: run.sceneId,
        milestone: "results_ready",
        eventId: run.runId,
        detail: `${episodesSucceeded} of ${episodesRun} simulated episodes succeeded`,
      });
    } catch (error) {
      logger.warn({ error, runId: run.runId }, "Could not enqueue a results notice");
    }
  }

  // The registry write. `recordEvaluationOutcome` is the one that also promotes
  // a self-registered team into the supply sites are shown, which is the only
  // path there is -- a team earns that place by being measured, never by
  // registering.
  try {
    await recordEvaluationOutcome({
      robotTeamId: run.teamId,
      runId: run.runId,
      demonstratedSuccessRate: result.claimed.demonstratedSuccessRate,
      cycleTime: result.claimed.cycleTime,
      observedAt: result.reportedAtIso,
    });

    // Meter it. The run executed against a prepared site, so this is the
    // moment the cost side of that site's economics becomes knowable -- and
    // the published arithmetic says a thin field cannot bear much. Recorded
    // rather than assumed, because the per-episode cost is the unknown the
    // whole exercise exists to find out.
    await recordCohortEpisodes({
      sceneId: run.sceneId,
      runId: run.runId,
      round: "screening",
      episodes: episodesRun,
      // One entry per checkpoint's first run against this scene. A second run
      // of the same checkpoint is more episodes, not another paid entry.
      newEntry: true,
      revenueUsd: settlementAmountUsd({
        quotedUsd: run.quotedUsd,
        quotedEpisodes: run.quotedEpisodes,
        episodesRun,
      }),
    });

    // Anything else the run established, attributed to the checkpoint that
    // produced it rather than to the team in general.
    const measured: Record<string, string> = {};
    if (result.claimed.demonstratedSuccessRate) {
      measured.demonstratedSuccessRate = result.claimed.demonstratedSuccessRate;
    }
    if (result.claimed.cycleTime) measured.cycleTime = result.claimed.cycleTime;
    if (Object.keys(measured).length) {
      await recordMeasuredCapability({
        teamId: run.teamId,
        checkpointId: run.checkpointId,
        runId: run.runId,
        measured,
      });
    }

    // And the other half, which was missing: a field this run measured and
    // could not support a claim for.
    //
    // `successRateBand` writing null is a finding, not a gap -- it means the
    // attempts happened and did not reach the lowest band we are willing to
    // state. Skipping the registry in that case left whatever was claimed
    // before standing, so a self-reported rate survived the measurement that
    // disproved it.
    //
    // Episodes having run is what makes it a measurement. Zero episodes is a
    // run that never happened, and it must not erase anything.
    // Cycle time has no case here: `cycleTimeBand` returns a band for every
    // valid median and null only when none was reported, which is "not
    // measured" rather than "measured and disproved". Nothing to withdraw.
    if (episodesRun > 0) {
      await invalidateMeasuredCapability({
        teamId: run.teamId,
        checkpointId: run.checkpointId,
        runId: run.runId,
        fields: ["demonstratedSuccessRate"],
        contradicts: (_field, heldValue) =>
          measurementContradictsBand(episodesSucceeded, episodesRun, heldValue),
        note:
          `${episodesSucceeded}/${episodesRun} attempts succeeded, which rules out the band ` +
          "that was on file.",
      });
    }
  } catch (error) {
    // The result is already stored. A registry write that failed is worth
    // knowing about and is not worth losing the result over.
    logger.warn(
      { error, runId: run.runId, teamId: run.teamId },
      "Stored a run result but could not update the registry from it",
    );
  }

  logger.info(
    {
      runId: run.runId,
      teamId: run.teamId,
      episodesRun,
      episodesSucceeded,
      claimed: result.claimed,
    },
    "Evaluation run result recorded",
  );
  return result;
}

/**
 * One run, for the team that bought it.
 *
 * Scoped by team rather than filtered afterwards: a run id is guessable from a
 * reservation id, and a team must never be able to read another team's results
 * by constructing one.
 */
export async function getRunForTeam(
  teamId: string,
  runId: string,
): Promise<(EvalRunRecord & { result?: EvalRunResult }) | null> {
  if (!db) return null;
  const snapshot = await db.collection(RUNS_COLLECTION).doc(runId).get();
  if (!snapshot.exists) return null;
  const run = snapshot.data() as EvalRunRecord & { result?: EvalRunResult };
  if (run.teamId !== teamId) return null;
  return run;
}

/** Every run this team has bought, newest first, resolved or not. */
export async function listRunsForTeam(
  teamId: string,
  limit = 50,
): Promise<(EvalRunRecord & { result?: EvalRunResult })[]> {
  if (!db) return [];
  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("teamId", "==", teamId)
    .limit(Math.max(1, Math.min(limit * 4, 500)))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as EvalRunRecord & { result?: EvalRunResult })
    .sort((a, b) => (a.requestedAtIso < b.requestedAtIso ? 1 : -1))
    .slice(0, limit);
}
