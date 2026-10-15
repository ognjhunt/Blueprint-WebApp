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
/** A team's practice run: the ten published cells, feedback for the team, never evidence. */
export const TEAM_EVALUATION_PRACTICE_RUNTIME = "team_evaluation_practice";
export const SIMULATOR_SCORED = "simulator_scored";

/** The only (runtime, source) pairs whose successes count. Everything else is refused. */
export const ADMITTED_SCORING: ReadonlyArray<{ runtime: string; successSource: string }> = Object.freeze([
  Object.freeze({ runtime: TEAM_EVALUATION_SCORED_RUNTIME, successSource: SIMULATOR_SCORED }),
]);

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const label = z.string().trim().min(1).max(100).regex(/^[a-z0-9_.-]+$/);

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
