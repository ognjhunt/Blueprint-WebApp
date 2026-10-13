/**
 * The evidence a recommended pilot stands on.
 *
 * ## What the beta promises
 *
 * Blueprint recommends ONE robot team for a site's job, and that team is one
 * whose evaluation of THAT job passed. Until this module the promise was not
 * enforced: a recommendation named any admitted team and the "capability
 * basis" was free text. Now a recommendation must cite one evaluation run, and
 * the server checks the run itself, in the same transaction that writes the
 * recommendation:
 *
 * - the run exists and was run against this job (`run.sceneId === requestId`,
 *   the same link the site's result notification uses);
 * - it is a site evaluation, not a team's private run (a private run's numbers
 *   were never agreed to be shown to the site);
 * - it completed with a recorded result of at least `MINIMUM_EVIDENCE_EPISODES`
 *   episodes;
 * - the result meets the job's pass mark (below); and
 * - the run's team is the team being recommended (see `robotTeamIdentity`).
 *
 * ## The pass mark
 *
 * A pass mark written after the results are read is not a test. So the mark is
 * whatever the job already said before any run, in this order:
 *
 * 1. `workspace_task.terms.successRate` on the job — the target the site
 *    confirmed, and the one the site's own workspace compares results against
 *    (`targetsMet`);
 * 2. `successCriteria.successRate` on the site-task brief;
 * 3. otherwise `DEFAULT_PASS_MARK_SUCCESS_RATE` (90%), the lowest success rate
 *    the confidence policy is willing to state as a band at all
 *    (`SUCCESS_RATE_BAND_CLAIM.ninety`). A recommendation made on the default
 *    says so: the threshold and its source are stored in the snapshot.
 *
 * The comparison is the observed success rate against the mark, the same
 * comparison the site's workspace shows, so the site never sees "passed" next
 * to a number its own page calls a miss. The Wilson band is stored beside it
 * as the confidence context. A job cycle-time target, when one exists and the
 * run measured a median, must also be met; an unmeasured cycle time is stored
 * as `cycleTimeMet: null`, never as a pass.
 *
 * ## What the evidence is not
 *
 * Every run is a simulation. Beta results are `development_only`; they are
 * the beta's evaluation and a recommendation may rest on them, but the scope
 * is carried into the recommendation and the boundary sentence travels with
 * it: a simulation estimate does not certify physical performance or safety,
 * and the physical pilot measures the real result.
 */
import { humanDecisionDigest } from "./human-reply-admission";
import { isSiteEvaluation, type EvalRunRecord } from "./agentRunRecord";
import type { EvalRunResult } from "./agentRunResults";
import { CONFIDENCE_POLICY_VERSION, SUCCESS_RATE_BAND_CLAIM, successRateBand } from "./successRateConfidence";

/** The lowest success rate the confidence policy states as a band. */
export const DEFAULT_PASS_MARK_SUCCESS_RATE = SUCCESS_RATE_BAND_CLAIM.ninety;
/** Fewer episodes than this is a smoke test, not an evaluation of the job. */
export const MINIMUM_EVIDENCE_EPISODES = 10;

export const SIMULATION_EVIDENCE_BOUNDARY =
  "Simulation estimate. It does not certify physical performance or safety; the physical pilot measures the real result.";

export type PassMarkSource = "job_terms" | "site_task_brief" | "blueprint_default";

export interface PassMark {
  /** A fraction, 0..1. */
  successRate: number;
  source: PassMarkSource;
  minimumEpisodes: number;
  /** Seconds; null when the job set no cycle-time target. */
  cycleTimeSeconds: number | null;
}

export type EvidenceScope = "development_only" | "simulation";

/** Immutable once written on a recommendation. */
export interface PilotRecommendationEvidence {
  schemaVersion: "pilot_recommendation_evidence.v1";
  runId: string;
  /** sha256 of the stored result; a re-reported or edited result would differ. */
  resultId: string;
  teamId: string;
  checkpointId: string;
  sceneId: string;
  episodesRun: number;
  episodesSucceeded: number;
  /** A fraction, 0..1, as recorded on the result. */
  successRate: number;
  medianCycleSeconds: number | null;
  /** Wilson-bounded band label, or null when the sample supports none. */
  confidenceBand: string | null;
  confidencePolicyVersion: string;
  passMark: PassMark;
  /** Null when the job set no cycle-time target or the run measured none. */
  cycleTimeMet: boolean | null;
  passed: true;
  evaluatedAtIso: string;
  evidenceScope: EvidenceScope;
  boundary: string;
}

export type EvidenceRefusal =
  | "evaluation_run_missing"
  | "evaluation_run_other_job"
  | "evaluation_run_private"
  | "evaluation_result_missing"
  | "evaluation_result_changed"
  | "evaluation_too_few_episodes"
  | "evaluation_below_pass_mark"
  | "evaluation_cycle_time_missed";

export const EVIDENCE_REFUSAL_MESSAGES: Record<EvidenceRefusal, string> = {
  evaluation_run_missing: "No evaluation run with that id exists. Recommend a team from one of this job's completed evaluations.",
  evaluation_run_other_job: "That evaluation ran against a different job. A recommendation must cite an evaluation of this job.",
  evaluation_run_private: "That evaluation is a team's private run; its result was not agreed to be shown to the site.",
  evaluation_result_missing: "That evaluation has no recorded result yet. Recommend only after it completes with episodes.",
  evaluation_result_changed: "The evaluation result changed since it was listed. Reload this job's evaluations and review it again.",
  evaluation_too_few_episodes: `That evaluation ran fewer than ${MINIMUM_EVIDENCE_EPISODES} episodes, which is too few to recommend on.`,
  evaluation_below_pass_mark: "That evaluation did not meet this job's pass mark. Recommend only a team whose evaluation passed.",
  evaluation_cycle_time_missed: "That evaluation's measured cycle time is slower than this job's target.",
};

function percentToFraction(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) return null;
  return value / 100;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The job's pass mark, from what the job said before any run. */
export function passMarkForJob(
  record: Record<string, any> | null | undefined,
  brief: Record<string, any> | null | undefined,
): PassMark {
  const terms = record?.workspace_task?.terms ?? {};
  const criteria = brief?.successCriteria ?? {};
  const fromTerms = percentToFraction(terms.successRate);
  const fromBrief = percentToFraction(criteria.successRate);
  return {
    successRate: fromTerms ?? fromBrief ?? DEFAULT_PASS_MARK_SUCCESS_RATE,
    source: fromTerms !== null ? "job_terms" : fromBrief !== null ? "site_task_brief" : "blueprint_default",
    minimumEpisodes: MINIMUM_EVIDENCE_EPISODES,
    cycleTimeSeconds: positiveNumber(terms.cycleTimeSeconds) ?? positiveNumber(criteria.cycleTimeSeconds),
  };
}

export type RunWithResult = EvalRunRecord & { result?: EvalRunResult | null };

export function resultIdFor(result: EvalRunResult): string {
  return humanDecisionDigest(result);
}

/** How one run reads against the job's pass mark, whether or not it passed. */
export interface EvaluationReading {
  runId: string;
  teamId: string;
  checkpointId: string;
  state: string;
  evaluationPurpose: "private" | "pilot" | null;
  requestedAtIso: string | null;
  resultId: string | null;
  evaluatedAtIso: string | null;
  episodesRun: number | null;
  episodesSucceeded: number | null;
  successRate: number | null;
  medianCycleSeconds: number | null;
  confidenceBand: string | null;
  evidenceScope: EvidenceScope | null;
  cycleTimeMet: boolean | null;
  passed: boolean | null;
  /** Empty when the run can back a recommendation (team eligibility aside). */
  refusals: EvidenceRefusal[];
}

export function readEvaluation(run: RunWithResult, requestId: string, passMark: PassMark): EvaluationReading {
  const result = run.result ?? null;
  const observed = result?.observed ?? null;
  const refusals: EvidenceRefusal[] = [];
  if (run.sceneId !== requestId) refusals.push("evaluation_run_other_job");
  if (!isSiteEvaluation(run)) refusals.push("evaluation_run_private");
  const hasResult = run.state === "completed" && Boolean(observed) && (observed!.episodesRun ?? 0) > 0;
  let passed: boolean | null = null;
  let cycleTimeMet: boolean | null = null;
  if (!hasResult) refusals.push("evaluation_result_missing");
  else {
    const episodesRun = observed!.episodesRun;
    const rate = observed!.episodesSucceeded / episodesRun;
    const meetsRate = rate >= passMark.successRate;
    const median = observed!.medianCycleSeconds;
    // Null means no target or no measurement: never a pass, never a miss.
    cycleTimeMet = passMark.cycleTimeSeconds !== null && typeof median === "number" && Number.isFinite(median) && median >= 0
      ? median <= passMark.cycleTimeSeconds
      : null;
    if (episodesRun < passMark.minimumEpisodes) refusals.push("evaluation_too_few_episodes");
    if (!meetsRate) refusals.push("evaluation_below_pass_mark");
    if (cycleTimeMet === false) refusals.push("evaluation_cycle_time_missed");
    passed = episodesRun >= passMark.minimumEpisodes && meetsRate && cycleTimeMet !== false;
  }
  return {
    runId: run.runId,
    teamId: run.teamId,
    checkpointId: run.checkpointId,
    state: run.state,
    evaluationPurpose: run.evaluationPurpose ?? null,
    requestedAtIso: run.requestedAtIso ?? null,
    resultId: result ? resultIdFor(result) : null,
    evaluatedAtIso: result?.reportedAtIso ?? null,
    episodesRun: observed?.episodesRun ?? null,
    episodesSucceeded: observed?.episodesSucceeded ?? null,
    successRate: observed?.successRate ?? null,
    medianCycleSeconds: observed?.medianCycleSeconds ?? null,
    confidenceBand: observed ? successRateBand(observed.episodesSucceeded, observed.episodesRun) : null,
    evidenceScope: result ? (result.evidenceScope === "development_only" ? "development_only" : "simulation") : null,
    cycleTimeMet,
    passed,
    refusals,
  };
}

/**
 * Verify one run backs a recommendation for this job, and freeze what it
 * showed. Returns the first refusal otherwise. Pure: the caller supplies the
 * run read inside its transaction.
 */
export function verifyRecommendationEvidence(params: {
  run: RunWithResult | null | undefined;
  requestId: string;
  passMark: PassMark;
  /** When the reviewer saw a specific result, it must still be that result. */
  expectedResultId?: string | null;
}): { ok: true; evidence: PilotRecommendationEvidence } | { ok: false; refusal: EvidenceRefusal } {
  const { run, requestId, passMark } = params;
  if (!run) return { ok: false, refusal: "evaluation_run_missing" };
  const reading = readEvaluation(run, requestId, passMark);
  if (reading.refusals.length) return { ok: false, refusal: reading.refusals[0] };
  const result = run.result!;
  if (params.expectedResultId && params.expectedResultId !== reading.resultId) {
    return { ok: false, refusal: "evaluation_result_changed" };
  }
  return {
    ok: true,
    evidence: {
      schemaVersion: "pilot_recommendation_evidence.v1",
      runId: run.runId,
      resultId: reading.resultId!,
      teamId: run.teamId,
      checkpointId: run.checkpointId,
      sceneId: run.sceneId,
      episodesRun: result.observed.episodesRun,
      episodesSucceeded: result.observed.episodesSucceeded,
      successRate: result.observed.successRate ?? result.observed.episodesSucceeded / result.observed.episodesRun,
      medianCycleSeconds: result.observed.medianCycleSeconds ?? null,
      confidenceBand: reading.confidenceBand,
      confidencePolicyVersion: CONFIDENCE_POLICY_VERSION,
      passMark,
      cycleTimeMet: reading.cycleTimeMet,
      passed: true,
      evaluatedAtIso: result.reportedAtIso,
      evidenceScope: reading.evidenceScope!,
      boundary: SIMULATION_EVIDENCE_BOUNDARY,
    },
  };
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/** One sentence for the capability-basis line when the reviewer leaves it blank. */
export function evidenceCapabilityBasis(evidence: PilotRecommendationEvidence): string {
  const scope = evidence.evidenceScope === "development_only" ? "development simulation" : "simulation";
  return `Evaluated on this job in ${scope}: ${evidence.episodesSucceeded} of ${evidence.episodesRun} episodes succeeded, `
    + `against a pass mark of ${percent(evidence.passMark.successRate)}. ${SIMULATION_EVIDENCE_BOUNDARY}`;
}

/** What the site is shown of the evidence. No checkpoint, no run internals. */
export function projectEvidenceForSite(
  evidence: PilotRecommendationEvidence | null | undefined,
  options: { resultUrl: string | null },
) {
  if (!evidence || evidence.schemaVersion !== "pilot_recommendation_evidence.v1") return null;
  return {
    episodesRun: evidence.episodesRun,
    episodesSucceeded: evidence.episodesSucceeded,
    successRate: evidence.successRate,
    passMarkSuccessRate: evidence.passMark.successRate,
    passMarkSource: evidence.passMark.source,
    cycleTimeTargetSeconds: evidence.passMark.cycleTimeSeconds,
    medianCycleSeconds: evidence.medianCycleSeconds,
    cycleTimeMet: evidence.cycleTimeMet,
    confidenceBand: evidence.confidenceBand,
    evaluatedAtIso: evidence.evaluatedAtIso,
    evidenceScope: evidence.evidenceScope,
    boundary: evidence.boundary,
    resultUrl: options.resultUrl,
  };
}

export type SiteRecommendationEvidence = NonNullable<ReturnType<typeof projectEvidenceForSite>>;
