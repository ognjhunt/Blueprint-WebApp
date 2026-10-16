/**
 * Who scored a run's episodes, and whether that score can count as evidence.
 *
 * ## Why this exists
 *
 * A recommended pilot rests on one claim: a team's own policy met the job's
 * pass mark when the simulator scored it against the job's success contract.
 * The Pipeline's result route carried only two numbers, episodes run and
 * episodes succeeded, and nothing said where the second came from. The one
 * admissible team door at the time (`http_policy_api_observation_probe`) read
 * each attempt's success from the team's own HTTP response, and a legacy
 * terminal reader counted a simulator preview that never ran the team's policy.
 *
 * So the Pipeline now states its scoring on every signed result, and this
 * module admits a result as task evidence only through a positive allowlist:
 * a known runtime whose episodes the simulator scored against the job's frozen
 * success contract, on a scene whose robot-free success probe passed. A missing
 * statement, an unknown runtime, a team-reported source, or an incomplete
 * binding fails closed. Unknown values are still stored, so a person can see
 * exactly what the Pipeline said; they just never count.
 *
 * ## What it does not claim
 *
 * An admitted result is still a bounded simulation estimate. Its claim ceiling
 * travels with it unchanged (today `diagnostic_policy_execution`), and nothing
 * here certifies physical performance or safety.
 */
import { z } from "zod";

export const RUN_RESULT_SCORING_SCHEMA_VERSION = "blueprint.agent_run_result_scoring.v1";
/**
 * A team's scored evaluation of a job: 200 cells it has not seen, drawn from
 * the job's bounded variations. The only run a recommendation may rest on.
 */
export const TEAM_EVALUATION_SCORED_RUNTIME = "team_evaluation_scored";
export const SIMULATOR_SCORED = "simulator_scored";
/** A qualified simulation estimate; never a physical performance claim. */
export const SITE_TASK_SIMULATION_CLAIM_CEILING = "site_task_simulation";

/** The only (runtime, source) pairs whose successes count. Everything else is refused. */
export const ADMITTED_SCORING: ReadonlyArray<{ runtime: string; successSource: string }> = Object.freeze([
  Object.freeze({ runtime: TEAM_EVALUATION_SCORED_RUNTIME, successSource: SIMULATOR_SCORED }),
]);

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const label = z.string().trim().min(1).max(100).regex(/^[a-z0-9_.-]+$/);

/** Pipeline-owned, artifact-backed qualification of this exact captured scene.
 * Optional for diagnostic compatibility; absence never qualifies a recommendation.
 * This is simulation qualification only, not physical validation or owner approval.
 */
export const siteTaskQualificationSchema = z.object({
  evidence_scope: z.literal("simulation"),
  capture_id: z.string().trim().min(1).max(200),
  scene_revision_digest: digest,
  registration_receipt_digest: digest,
  fidelity_review_receipt_digest: digest,
}).strict();

export interface SiteTaskQualification {
  evidenceScope: "simulation";
  captureId: string;
  sceneRevisionDigest: string;
  registrationReceiptDigest: string;
  fidelityReviewReceiptDigest: string;
}

/** The Pipeline's wire statement. Unknown labels parse; they are refused later, not lost. */
export const runResultScoringSchema = z.object({
  schema_version: z.literal(RUN_RESULT_SCORING_SCHEMA_VERSION),
  runtime: label,
  success_source: label,
  scored_episode_count: z.number().int().min(0).max(100_000),
  success_contract_digest: digest.nullable(),
  scene_revision_digest: digest.nullable(),
  robot_free_probe_receipt_digest: digest.nullable(),
  team_candidate_admission_digest: digest.nullable(),
  session_result_digest: digest.nullable(),
  claim_ceiling: label,
  site_task_qualification: siteTaskQualificationSchema.optional(),
}).strict();

export type RunResultScoringWire = z.infer<typeof runResultScoringSchema>;

/** Stored on the run result exactly as stated, in this repo's casing. */
export interface RunResultScoring {
  schemaVersion: typeof RUN_RESULT_SCORING_SCHEMA_VERSION;
  runtime: string;
  successSource: string;
  scoredEpisodeCount: number;
  successContractDigest: string | null;
  sceneRevisionDigest: string | null;
  robotFreeProbeReceiptDigest: string | null;
  teamCandidateAdmissionDigest: string | null;
  sessionResultDigest: string | null;
  claimCeiling: string;
  siteTaskQualification?: SiteTaskQualification;
}

export function storedScoring(wire: RunResultScoringWire): RunResultScoring {
  return {
    schemaVersion: wire.schema_version,
    runtime: wire.runtime,
    successSource: wire.success_source,
    scoredEpisodeCount: wire.scored_episode_count,
    successContractDigest: wire.success_contract_digest,
    sceneRevisionDigest: wire.scene_revision_digest,
    robotFreeProbeReceiptDigest: wire.robot_free_probe_receipt_digest,
    teamCandidateAdmissionDigest: wire.team_candidate_admission_digest,
    sessionResultDigest: wire.session_result_digest,
    claimCeiling: wire.claim_ceiling,
    ...(wire.site_task_qualification ? { siteTaskQualification: {
      evidenceScope: wire.site_task_qualification.evidence_scope,
      captureId: wire.site_task_qualification.capture_id,
      sceneRevisionDigest: wire.site_task_qualification.scene_revision_digest,
      registrationReceiptDigest: wire.site_task_qualification.registration_receipt_digest,
      fidelityReviewReceiptDigest: wire.site_task_qualification.fidelity_review_receipt_digest,
    } } : {}),
  };
}

export type ScoringRefusal =
  | "scoring_missing"
  | "scoring_runtime_not_admitted"
  | "scoring_not_simulator_scored"
  | "scoring_binding_incomplete"
  | "scoring_episode_count_mismatch";

type ScoredResult = {
  scoring?: RunResultScoring | null;
  observed?: { episodesRun?: number | null } | null;
} | null | undefined;

/** Null when the result's successes may count as task evidence; the reason otherwise. */
export function scoringRefusal(result: ScoredResult): ScoringRefusal | null {
  const scoring = result?.scoring;
  if (!scoring || scoring.schemaVersion !== RUN_RESULT_SCORING_SCHEMA_VERSION) return "scoring_missing";
  if (!ADMITTED_SCORING.some(row => row.runtime === scoring.runtime)) return "scoring_runtime_not_admitted";
  if (!ADMITTED_SCORING.some(row => row.runtime === scoring.runtime && row.successSource === scoring.successSource)) {
    return "scoring_not_simulator_scored";
  }
  const bindings = [scoring.successContractDigest, scoring.sceneRevisionDigest,
    scoring.robotFreeProbeReceiptDigest, scoring.teamCandidateAdmissionDigest, scoring.sessionResultDigest];
  if (bindings.some(value => typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value))) {
    return "scoring_binding_incomplete";
  }
  const episodesRun = result?.observed?.episodesRun;
  if (typeof episodesRun !== "number" || scoring.scoredEpisodeCount !== episodesRun) {
    return "scoring_episode_count_mismatch";
  }
  return null;
}

export function isSimulatorScoredJobEvidence(result: ScoredResult): boolean {
  return scoringRefusal(result) === null;
}

/** A valid wire statement still must match the run's frozen capture binding. */
export function boundSiteTaskQualification(result: ScoredResult, captureId: string | null | undefined): SiteTaskQualification | null {
  const qualification = result?.scoring?.siteTaskQualification;
  const digestPattern = /^sha256:[a-f0-9]{64}$/;
  if (!qualification || result?.scoring?.claimCeiling !== SITE_TASK_SIMULATION_CLAIM_CEILING
    || qualification.evidenceScope !== "simulation" || !captureId
    || qualification.captureId !== captureId || qualification.sceneRevisionDigest !== result?.scoring?.sceneRevisionDigest
    || [qualification.sceneRevisionDigest, qualification.registrationReceiptDigest, qualification.fidelityReviewReceiptDigest]
      .some(value => typeof value !== "string" || !digestPattern.test(value))) return null;
  return qualification;
}
