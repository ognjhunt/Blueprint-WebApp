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
 * - the simulator scored those episodes against the job's success contract,
 *   in an admitted runtime, on a scene whose robot-free probe passed
 *   (`runResultScoring.ts`). A team-reported, unverified or unlabelled count
 *   never backs a recommendation, whatever its numbers;
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
 * as confidence context, not a second pass threshold. A job cycle-time target
 * requires a measured median at or below that target. Missing is unknown and
 * prevents a recommendation.
 *
 * ## What the evidence is not
 *
 * Every run is a simulation. Development-only runs demonstrate engine operation
 * and cannot back a site recommendation. A qualified simulation must retain
 * the Pipeline's registration and fidelity receipts for the exact capture and
 * scene revision. Even that qualification does not certify physical performance
 * or safety; the physical pilot measures the real result.
 */
import { humanDecisionDigest } from "./human-reply-admission";
import { isSiteEvaluation, type EvalRunRecord } from "./agentRunRecord";
import type { EvalRunResult } from "./agentRunResults";
import { CONFIDENCE_POLICY_VERSION, SUCCESS_RATE_BAND_CLAIM, successRateBand, wilsonLowerBound, wilsonUpperBound } from "./successRateConfidence";
import { frozenSiteTaskQualification, episodeAccountingFor, MINIMUM_SCORED_EVIDENCE_EPISODES, scoringRefusal, SITE_TASK_SIMULATION_CLAIM_CEILING,
  type EpisodeAccounting, type ScoringRefusal, type SiteTaskQualification } from "./runResultScoring";
export { episodeAccountingFor, type EpisodeAccounting } from "./runResultScoring";

/** The lowest success rate the confidence policy states as a band. */
export const DEFAULT_PASS_MARK_SUCCESS_RATE = SUCCESS_RATE_BAND_CLAIM.ninety;
/**
 * A scored evaluation runs 200 episodes, of which at most 5% may be void (the
 * simulator, not the policy, failed) and go uncounted. Fewer counted episodes
 * than this cannot tell a 90% policy from a 75% one.
 */
export const MINIMUM_EVIDENCE_EPISODES = MINIMUM_SCORED_EVIDENCE_EPISODES;

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

export interface SuccessRateUncertainty {
  method: "wilson_two_sided_95";
  lower: number;
  upper: number;
  boundary: string;
}

export const SUCCESS_RATE_UNCERTAINTY_BOUNDARY =
  "95% Wilson interval assuming independent episodes in this tested scene; it does not account for correlated episodes or establish performance at other sites.";

/** Who scored the evidence, frozen with it. */
export interface EvidenceScoring {
  runtime: string;
  successSource: string;
  successContractDigest: string;
  robotFreeProbeReceiptDigest: string;
  sceneRevisionDigest?: string;
  /** Carried unchanged; an admitted result is never upgraded past it. */
  claimCeiling: string;
}

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
  /** Null only when the job set no cycle-time target on qualified evidence. */
  cycleTimeMet: boolean | null;
  passed: true;
  evaluatedAtIso: string;
  evidenceScope: EvidenceScope;
  scoring: EvidenceScoring;
  qualification?: SiteTaskQualification;
  episodeAccounting?: EpisodeAccounting;
  uncertainty?: SuccessRateUncertainty;
  passRule?: "observed_success_rate.v1";
  boundary: string;
  /**
   * The task kind the simulation scored (the Pipeline's team-evaluation
   * contract `task_kind`), or null when it could not be tied to this run.
   * Absent on evidence written before it was recorded.
   */
  scoredTaskKind?: string | null;
}

export type EvidenceRefusal =
  | "evaluation_run_missing"
  | "evaluation_run_other_job"
  | "evaluation_run_private"
  | "evaluation_result_missing"
  | "evaluation_not_simulator_scored"
  | "evaluation_result_changed"
  | "evaluation_too_few_episodes"
  | "evaluation_below_pass_mark"
  | "evaluation_cycle_time_missed"
  | "evaluation_cycle_time_missing"
  | "evaluation_development_only"
  | "evaluation_scene_not_qualified"
  | "evaluation_episode_accounting_invalid"
  | "evaluation_criteria_changed";

export const EVIDENCE_REFUSAL_MESSAGES: Record<EvidenceRefusal, string> = {
  evaluation_run_missing: "No evaluation run with that id exists. Recommend a team from one of this job's completed evaluations.",
  evaluation_run_other_job: "That evaluation ran against a different job. A recommendation must cite an evaluation of this job.",
  evaluation_run_private: "That evaluation is a team's private run; its result was not agreed to be shown to the site.",
  evaluation_result_missing: "That evaluation has no recorded result yet. Recommend only after it completes with episodes.",
  evaluation_not_simulator_scored: "That evaluation's successes were not scored by the simulator against this job's success contract, so they cannot back a recommendation.",
  evaluation_result_changed: "The evaluation result changed since it was listed. Reload this job's evaluations and review it again.",
  evaluation_too_few_episodes: `That evaluation ran fewer than ${MINIMUM_EVIDENCE_EPISODES} episodes, which is too few to recommend on.`,
  evaluation_below_pass_mark: "That evaluation did not meet this job's pass mark. Recommend only a team whose evaluation passed.",
  evaluation_cycle_time_missed: "That evaluation's measured cycle time is slower than this job's target.",
  evaluation_cycle_time_missing: "This job has a cycle-time target, but the evaluation did not measure a valid cycle time. Measure it in an evaluation against the frozen target before recommending.",
  evaluation_development_only: "This is development-only evidence. It can demonstrate engine operation but cannot back a qualified recommendation for the site.",
  evaluation_scene_not_qualified: "This evaluation has no valid registration and fidelity qualification bound to its exact capture and scene revision. Complete scene qualification before recommending.",
  evaluation_episode_accounting_invalid: "The evaluation must report every prescribed hidden episode exactly once, with successes, failures and voids matching its scored denominator. Retain a complete result before recommending.",
  evaluation_criteria_changed: "The site changed this job's success-rate or cycle-time target after this evaluation was requested. Its result cannot be judged against a target set afterwards; evaluate again against the current target.",
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

export function sceneQualificationFor(run: RunWithResult): SiteTaskQualification | null {
  return frozenSiteTaskQualification(run, run.result);
}

function developmentOnly(run: RunWithResult): boolean {
  return run.result?.evidenceScope === "development_only"
    || run.executionAdmission?.envelope.evidence_scope === "development_only";
}

function uncertaintyFor(succeeded: number, scored: number): SuccessRateUncertainty {
  return { method: "wilson_two_sided_95", lower: wilsonLowerBound(succeeded, scored), upper: wilsonUpperBound(succeeded, scored),
    boundary: SUCCESS_RATE_UNCERTAINTY_BOUNDARY };
}

/** The site job request that funded a run, when its admission recorded one. */
export function fundingRequestIdFor(run: RunWithResult | null | undefined): string | null {
  const funding = (run?.executionAdmission?.envelope as { funding?: { workspace_request_id?: unknown } } | undefined)?.funding;
  const id = funding?.workspace_request_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function snapshotNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Whether the job's own targets moved after the run was requested. The
 * evaluation request froze the targets it was run against
 * (`workspace_evaluation.targetSnapshot`); a result is judged only against
 * those, never against a threshold lowered afterwards. Runs with no funding
 * request on record have no snapshot to compare and are judged as they stand.
 */
export function criteriaChangedSinceRequest(
  record: Record<string, any> | null | undefined,
  fundingRecord: Record<string, any> | null | undefined,
): boolean {
  const snapshot = fundingRecord?.workspace_evaluation?.targetSnapshot;
  if (!snapshot || typeof snapshot !== "object") return false;
  const terms = record?.workspace_task?.terms ?? {};
  return snapshotNumber(snapshot.successRate) !== snapshotNumber(terms.successRate)
    || snapshotNumber(snapshot.cycleTimeSeconds) !== snapshotNumber(terms.cycleTimeSeconds);
}

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
  /** Null when the simulator scored the result in an admitted runtime. */
  scoringRefusal: ScoringRefusal | null;
  episodeAccounting: EpisodeAccounting | null;
  uncertainty: SuccessRateUncertainty | null;
  /** Empty when the run can back a recommendation (team eligibility aside). */
  refusals: EvidenceRefusal[];
}

/**
 * Why a run's result can never back a recommendation, in the team's words, or
 * null when it can (its numbers against the pass mark aside). The same rule
 * `readEvaluation` applies: a team evaluation the simulator scored under an
 * admitted statement, with at least `MINIMUM_EVIDENCE_EPISODES` counted.
 */
export function notCountedReason(run: {
  teamEvaluationPurpose?: string;
  result?: Parameters<typeof scoringRefusal>[0];
  executionAdmission?: { envelope: Record<string, unknown> };
  executionCaptureId?: string;
  quotedEpisodes?: number;
}): string | null {
  if (run.teamEvaluationPurpose !== "scored")
    return "It is not a team evaluation. Only a team evaluation of the job, 200 hidden episodes scored by Blueprint's simulator, can back a recommendation.";
  if (scoringRefusal(run.result)) return "Blueprint's simulator did not score it against the job's success contract.";
  const counted = run.result?.observed?.episodesRun ?? 0;
  if (counted < MINIMUM_EVIDENCE_EPISODES)
    return `Only ${counted} of its episodes were counted; a recommendation needs at least ${MINIMUM_EVIDENCE_EPISODES}.`;
  const candidate = run as RunWithResult;
  if (developmentOnly(candidate)) return EVIDENCE_REFUSAL_MESSAGES.evaluation_development_only;
  if (!sceneQualificationFor(candidate)) return EVIDENCE_REFUSAL_MESSAGES.evaluation_scene_not_qualified;
  if (!episodeAccountingFor(candidate)) return EVIDENCE_REFUSAL_MESSAGES.evaluation_episode_accounting_invalid;
  return null;
}

export function readEvaluation(
  run: RunWithResult,
  requestId: string,
  passMark: PassMark,
  options: { criteriaChanged?: boolean } = {},
): EvaluationReading {
  const result = run.result ?? null;
  const observed = result?.observed ?? null;
  const refusals: EvidenceRefusal[] = [];
  if (options.criteriaChanged) refusals.push("evaluation_criteria_changed");
  if (run.sceneId !== requestId) refusals.push("evaluation_run_other_job");
  if (!isSiteEvaluation(run)) refusals.push("evaluation_run_private");
  const hasResult = run.state === "completed" && Boolean(observed) && (observed!.episodesRun ?? 0) > 0;
  let passed: boolean | null = null;
  let cycleTimeMet: boolean | null = null;
  const unscored = hasResult ? scoringRefusal(result) : null;
  if (!hasResult) refusals.push("evaluation_result_missing");
  else {
    // Fail closed before reading the numbers: an unscored count never passes.
    if (unscored) refusals.push("evaluation_not_simulator_scored");
    const episodesRun = observed!.episodesRun;
    const rate = observed!.episodesSucceeded / episodesRun;
    const meetsRate = rate >= passMark.successRate;
    const median = observed!.medianCycleSeconds;
    cycleTimeMet = passMark.cycleTimeSeconds !== null && typeof median === "number" && Number.isFinite(median) && median > 0
      ? median <= passMark.cycleTimeSeconds
      : null;
    if (episodesRun < passMark.minimumEpisodes) refusals.push("evaluation_too_few_episodes");
    if (!meetsRate) refusals.push("evaluation_below_pass_mark");
    if (cycleTimeMet === false) refusals.push("evaluation_cycle_time_missed");
    if (passMark.cycleTimeSeconds !== null && cycleTimeMet === null) refusals.push("evaluation_cycle_time_missing");
    if (developmentOnly(run)) refusals.push("evaluation_development_only");
    else if (!sceneQualificationFor(run)) refusals.push("evaluation_scene_not_qualified");
    if (!episodeAccountingFor(run)) refusals.push("evaluation_episode_accounting_invalid");
    passed = refusals.length === 0;
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
    successRate: observed && observed.episodesRun > 0 ? observed.episodesSucceeded / observed.episodesRun : null,
    medianCycleSeconds: observed?.medianCycleSeconds ?? null,
    confidenceBand: observed ? successRateBand(observed.episodesSucceeded, observed.episodesRun) : null,
    evidenceScope: result ? (developmentOnly(run) ? "development_only" : sceneQualificationFor(run) ? "simulation" : null) : null,
    cycleTimeMet,
    passed,
    scoringRefusal: unscored,
    episodeAccounting: episodeAccountingFor(run),
    uncertainty: observed && observed.episodesRun > 0 ? uncertaintyFor(observed.episodesSucceeded, observed.episodesRun) : null,
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
  /** The job's targets moved after the run was requested (`criteriaChangedSinceRequest`). */
  criteriaChanged?: boolean;
  /** The scored task kind (`scoredTaskKindFor`), frozen with the evidence. */
  scoredTaskKind?: string | null;
}): { ok: true; evidence: PilotRecommendationEvidence } | { ok: false; refusal: EvidenceRefusal } {
  const { run, requestId, passMark } = params;
  if (!run) return { ok: false, refusal: "evaluation_run_missing" };
  const reading = readEvaluation(run, requestId, passMark, { criteriaChanged: params.criteriaChanged });
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
      successRate: result.observed.episodesSucceeded / result.observed.episodesRun,
      medianCycleSeconds: result.observed.medianCycleSeconds ?? null,
      confidenceBand: reading.confidenceBand,
      confidencePolicyVersion: CONFIDENCE_POLICY_VERSION,
      passMark,
      cycleTimeMet: reading.cycleTimeMet,
      passed: true,
      evaluatedAtIso: result.reportedAtIso,
      evidenceScope: reading.evidenceScope!,
      qualification: sceneQualificationFor(run)!,
      episodeAccounting: reading.episodeAccounting!,
      uncertainty: reading.uncertainty!,
      passRule: "observed_success_rate.v1",
      // Admitted above, so every field is present (`scoringRefusal`).
      scoring: {
        runtime: result.scoring!.runtime,
        successSource: result.scoring!.successSource,
        successContractDigest: result.scoring!.successContractDigest!,
        robotFreeProbeReceiptDigest: result.scoring!.robotFreeProbeReceiptDigest!,
        sceneRevisionDigest: result.scoring!.sceneRevisionDigest!,
        claimCeiling: result.scoring!.claimCeiling,
      },
      boundary: SIMULATION_EVIDENCE_BOUNDARY,
      scoredTaskKind: params.scoredTaskKind ?? null,
    },
  };
}

/**
 * The task kind this run was scored on: the job's published team-evaluation
 * contract, when that offer is for the capture the run executed. Null when the
 * two cannot be tied, so the card says "not recorded" instead of guessing.
 */
export function scoredTaskKindFor(record: Record<string, any> | null | undefined, run: RunWithResult | null | undefined): string | null {
  const offer = record?.agent_execution_offer;
  const kind = offer?.team_evaluation?.contract?.task_kind;
  if (typeof kind !== "string" || !kind.trim()) return null;
  return typeof offer.capture_id === "string" && run?.executionCaptureId === offer.capture_id ? kind.trim() : null;
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

/** Historical snapshots stay on file, but cannot inherit today's eligibility.
 * Qualified snapshots include the immutable scene receipts and full denominator.
 */
export function isQualifiedRecommendationEvidence(evidence: PilotRecommendationEvidence | null | undefined): evidence is PilotRecommendationEvidence {
  if (!evidence || evidence.schemaVersion !== "pilot_recommendation_evidence.v1"
    || evidence.evidenceScope !== "simulation" || evidence.passRule !== "observed_success_rate.v1") return false;
  const qualification = evidence.qualification;
  const digest = /^sha256:[a-f0-9]{64}$/;
  if (!qualification || evidence.scoring?.claimCeiling !== SITE_TASK_SIMULATION_CLAIM_CEILING
    || qualification.evidenceScope !== "simulation" || !qualification.captureId?.trim()
    || qualification.sceneRevisionDigest !== evidence.scoring?.sceneRevisionDigest
    || [qualification.sceneRevisionDigest, qualification.registrationReceiptDigest, qualification.fidelityReviewReceiptDigest]
      .some(value => typeof value !== "string" || !digest.test(value))) return false;
  const counts = evidence.episodeAccounting;
  if (!counts || Object.values(counts).some(value => !Number.isInteger(value) || value < 0)
    || counts.planned !== 200 || counts.reported !== counts.planned || counts.scored < MINIMUM_EVIDENCE_EPISODES
    || counts.scored + counts.void !== counts.reported || counts.succeeded + counts.failed !== counts.scored
    || counts.scored !== evidence.episodesRun || counts.succeeded !== evidence.episodesSucceeded) return false;
  return counts.succeeded / counts.scored >= evidence.passMark.successRate
    && (evidence.passMark.cycleTimeSeconds === null || (typeof evidence.medianCycleSeconds === "number"
      && Number.isFinite(evidence.medianCycleSeconds) && evidence.medianCycleSeconds > 0
      && evidence.medianCycleSeconds <= evidence.passMark.cycleTimeSeconds && evidence.cycleTimeMet === true));
}

/** What the site is shown of the evidence. No checkpoint, no run internals. */
export function projectEvidenceForSite(
  evidence: PilotRecommendationEvidence | null | undefined,
  options: { resultUrl: string | null },
) {
  if (!isQualifiedRecommendationEvidence(evidence)) return null;
  return {
    episodesRun: evidence.episodesRun,
    episodesSucceeded: evidence.episodesSucceeded,
    successRate: evidence.episodesSucceeded / evidence.episodesRun,
    passMarkSuccessRate: evidence.passMark.successRate,
    passMarkSource: evidence.passMark.source,
    cycleTimeTargetSeconds: evidence.passMark.cycleTimeSeconds,
    medianCycleSeconds: evidence.medianCycleSeconds,
    cycleTimeMet: evidence.cycleTimeMet,
    confidenceBand: evidence.confidenceBand,
    evaluatedAtIso: evidence.evaluatedAtIso,
    evidenceScope: evidence.evidenceScope,
    boundary: evidence.boundary,
    episodeAccounting: evidence.episodeAccounting!,
    uncertainty: uncertaintyFor(evidence.episodesSucceeded, evidence.episodesRun),
    passRule: evidence.passRule!,
    resultUrl: options.resultUrl,
  };
}

export type SiteRecommendationEvidence = NonNullable<ReturnType<typeof projectEvidenceForSite>>;
