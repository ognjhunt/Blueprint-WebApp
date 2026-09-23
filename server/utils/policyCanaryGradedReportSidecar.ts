import { z } from "zod";

import type { PipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import { canonicalArtifactDigest } from "./taskCandidateContract";

/**
 * Graded run reports: how far each episode got, what went wrong on the way,
 * how smooth the motion was, and how long it took (RoboLab-style partial
 * credit). The Pipeline derives them from the same sealed episode evidence
 * the deterministic scorer read, and they bind to one published run by
 * digest. They never change a score, rank a candidate, or declare a winner.
 */

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const count = z.number().int().min(0).max(1_000_000);
const seconds = z.number().finite().min(0).max(86_400).nullable();
const unitInterval = z.number().finite().min(0).max(1);
const label = z.string().min(1).max(160);

const subtaskSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  label,
  condition_met: z.boolean(),
  achieved: z.boolean(),
  first_step_index: z.number().int().min(0).nullable(),
}).strict();

const wrongObjectSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("measured"), count }).strict(),
  z.object({ status: z.literal("not_measurable"), reason: z.string().min(1).max(128) }).strict(),
]);

export const policyEpisodeGradedReportSchema = z.object({
  schema_version: z.literal("policy_episode_graded_report.v1"),
  status: z.enum(["graded", "not_gradable"]),
  not_gradable_reason: z.string().min(1).max(128).nullable(),
  task_succeeded: z.boolean().nullable(),
  outcome: z.string().min(1).max(128).nullable(),
  manipulation_strategy: z.string().min(1).max(64),
  graded_score: unitInterval.nullable(),
  subtasks: z.array(subtaskSchema).min(1).max(16),
  safety_ok: z.boolean().nullable(),
  failure_events: z.object({
    drops: count,
    drop_steps: z.array(z.number().int().min(0)).max(1024),
    robot_body_hit_object: count,
    robot_hit_scene: count,
    object_hit_scene: count,
    containment_excursion_steps: count,
    workspace_excursion_steps: count,
    retries: count.nullable(),
    regrasps: count.nullable(),
    wrong_object_interactions: wrongObjectSchema,
  }).strict(),
  smoothness: z.object({
    end_effector_sparc: z.number().finite().max(0).nullable(),
    joint_sparc: z.number().finite().max(0).nullable(),
    end_effector_path_length_m: z.number().finite().min(0).nullable(),
  }).strict(),
  timing: z.object({
    control_frequency_hz: z.number().finite().positive().max(10_000),
    episode_duration_s: seconds,
    first_task_contact_s: seconds,
    first_object_motion_s: seconds,
    settled_at_s: seconds,
  }).strict(),
  parameters: z.object({
    movement_epsilon_m: z.number().finite().positive(),
    settle_position_tolerance_m: z.number().finite().positive(),
    sparc: z.object({
      pad_level: z.number().int().min(0).max(16),
      cutoff_hz: z.number().finite().positive(),
      amplitude_threshold: z.number().finite().positive(),
    }).strict(),
  }).strict(),
  inputs: z.object({
    score_report_digest: digest.nullable(),
    state_trace_digest: digest.nullable(),
  }).strict(),
  authority: z.object({
    grader: z.literal("deterministic_derivation_from_sealed_evidence"),
    task_success_authority: z.literal("deterministic_score_report"),
    learned_judge_consulted: z.literal(false),
    ranking_or_promotion_effect: z.literal("none"),
  }).strict(),
  report_digest: digest,
}).strict();

const candidateSummarySchema = z.object({
  schema_version: z.literal("policy_canary_graded_candidate_summary.v1"),
  candidate_id: identifier,
  episode_count: count,
  graded_episode_count: count,
  success_count: count,
  mean_graded_score: unitInterval.nullable(),
  subtask_completion_rate: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), unitInterval),
  episodes_with_drop: count,
  episodes_with_collision: count,
  total_drops: count,
  median_end_effector_sparc: z.number().finite().max(0).nullable(),
  median_episode_duration_s: seconds,
  median_settled_at_s: seconds,
  ranking_permitted: z.literal(false),
}).strict();

export const policyCanaryGradedReportSidecarSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_graded_report_sidecar.v1"),
  source_binding: z.object({
    record_id: identifier,
    source_run_id: identifier,
    source_projection_digest: digest,
    source_delivery_digest: digest,
    source_score_correction_sidecar_digest: digest.nullable(),
  }).strict(),
  candidates: z.array(candidateSummarySchema).min(1).max(8),
  episodes: z.array(z.object({
    episode_id: identifier,
    candidate_id: identifier,
    cell_id: identifier,
    seed: z.number().int().min(0).max(2_147_483_647),
    graded: policyEpisodeGradedReportSchema,
  }).strict()).min(1).max(400),
  audit: z.object({
    original_publication_preserved: z.literal(true),
    deterministic_scores_unchanged: z.literal(true),
    derived_only_from_sealed_episode_evidence: z.literal(true),
    ranking_or_promotion_effect: z.literal("none"),
    generated_at_iso: z.string().datetime({ offset: true }),
  }).strict(),
  sidecar_digest: digest,
}).strict();

export type PolicyCanaryGradedReportSidecar = z.infer<typeof policyCanaryGradedReportSidecarSchema>;

type EpisodeIdentity = { episode_id: string; candidate_id: string; cell_id: string; seed: number };

function episodeKey(value: EpisodeIdentity) {
  return `${value.episode_id}\0${value.candidate_id}\0${value.cell_id}\0${value.seed}`;
}

function scoreKey(value: { candidate_id: string; cell_id: string; seed: number }) {
  return `${value.candidate_id}\0${value.cell_id}\0${value.seed}`;
}

function digestsHold(sidecar: PolicyCanaryGradedReportSidecar) {
  return sidecar.sidecar_digest === canonicalArtifactDigest(sidecar, "sidecar_digest")
    && sidecar.episodes.every((row) => row.graded.report_digest
      === canonicalArtifactDigest(row.graded, "report_digest"));
}

/** Per-candidate totals must be the totals of the episodes they summarize. */
function summariesMatchEpisodes(sidecar: PolicyCanaryGradedReportSidecar) {
  const candidateIds = new Set(sidecar.episodes.map((row) => row.candidate_id));
  if (
    sidecar.candidates.length !== candidateIds.size
    || new Set(sidecar.candidates.map((row) => row.candidate_id)).size !== candidateIds.size
  ) return false;
  return sidecar.candidates.every((summary) => {
    const rows = sidecar.episodes.filter((row) => row.candidate_id === summary.candidate_id);
    const graded = rows.filter((row) => row.graded.status === "graded");
    return rows.length > 0
      && summary.episode_count === rows.length
      && summary.graded_episode_count === graded.length
      && summary.success_count === rows.filter((row) => row.graded.task_succeeded === true).length
      && summary.total_drops === rows.reduce((sum, row) => sum + row.graded.failure_events.drops, 0);
  });
}

/** A graded episode's score and its stages must agree with its own ladder. */
function episodesInternallyConsistent(sidecar: PolicyCanaryGradedReportSidecar) {
  return sidecar.episodes.every(({ graded }) => {
    let reached = true;
    for (const stage of graded.subtasks) {
      reached = reached && stage.condition_met;
      if (stage.achieved !== reached) return false;
    }
    if (graded.status === "not_gradable") return graded.graded_score === null;
    const achieved = graded.subtasks.filter((stage) => stage.achieved).length;
    return graded.graded_score !== null
      && Math.abs(graded.graded_score - achieved / graded.subtasks.length) < 1e-4;
  });
}

export function verifyPolicyCanaryGradedReportSidecar(params: {
  payload: unknown;
  publication: PipelinePolicyCanaryPublication;
  recordId: string;
  scoreCorrection: {
    sidecar_digest: string;
    correction: { score_updates: Array<{
      candidate_id: string; cell_id: string; seed: number;
      new_score: { task_succeeded: boolean };
    }> };
  } | null;
}) {
  const parsed = policyCanaryGradedReportSidecarSchema.safeParse(params.payload);
  if (!parsed.success) return { ok: false as const, code: "sidecar_schema_invalid" };
  const sidecar = parsed.data;
  const projection = params.publication.policy_canary_result;
  if (
    !digestsHold(sidecar)
    || sidecar.source_binding.record_id !== params.recordId
    || sidecar.source_binding.source_run_id !== params.publication.run_id
    || sidecar.source_binding.source_projection_digest !== projection.projection_digest
    || sidecar.source_binding.source_delivery_digest
      !== params.publication.result_delivery.delivery_digest
    || sidecar.source_binding.source_score_correction_sidecar_digest
      !== (params.scoreCorrection?.sidecar_digest ?? null)
  ) return { ok: false as const, code: "sidecar_source_binding_invalid" };

  const expected = new Set(projection.episodes.map(episodeKey));
  const supplied = new Set(sidecar.episodes.map(episodeKey));
  if (
    expected.size === 0
    || supplied.size !== sidecar.episodes.length
    || supplied.size !== expected.size
    || [...expected].some((key) => !supplied.has(key))
  ) return { ok: false as const, code: "sidecar_episode_inventory_invalid" };
  if (!summariesMatchEpisodes(sidecar) || !episodesInternallyConsistent(sidecar)) {
    return { ok: false as const, code: "sidecar_summary_inconsistent" };
  }

  // The deterministic score is the only authority on success, so a graded
  // report that disagrees with the published (or corrected) score is refused.
  const corrected = new Map((params.scoreCorrection?.correction.score_updates || [])
    .map((row) => [scoreKey(row), row.new_score.task_succeeded]));
  const delivered = new Map((params.publication.result_delivery.episodes || [])
    .map((row: Record<string, any>) => [String(row.episode_id), row.score?.task_succeeded ?? null]));
  const disagreement = sidecar.episodes.some((row) => {
    const official = corrected.has(scoreKey(row))
      ? corrected.get(scoreKey(row))
      : delivered.get(row.episode_id) ?? null;
    return row.graded.task_succeeded !== official;
  });
  if (disagreement) return { ok: false as const, code: "sidecar_contradicts_deterministic_score" };
  return { ok: true as const, sidecar };
}

export function verifiedPolicyCanaryGradedReportSidecar(value: unknown) {
  const parsed = policyCanaryGradedReportSidecarSchema.safeParse(value);
  if (!parsed.success || !digestsHold(parsed.data)) return null;
  return parsed.data;
}
