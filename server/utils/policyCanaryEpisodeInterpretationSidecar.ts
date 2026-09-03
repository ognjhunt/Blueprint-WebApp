import { z } from "zod";

import {
  pipelineEpisodeInterpretationSchema,
  pipelineEpisodeInterpretationSummarySchema,
  type PipelinePolicyCanaryPublication,
} from "./policyCanaryWebappSyncContract";
import { canonicalArtifactDigest } from "./taskCandidateContract";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const policyCanaryEpisodeInterpretationSidecarSchema = z.object({
  schema_version: z.literal(
    "task_evaluation_policy_canary_episode_interpretation_sidecar.v1",
  ),
  source_binding: z.object({
    record_id: identifier,
    source_run_id: identifier,
    source_projection_digest: digest,
    source_delivery_digest: digest,
    source_score_correction_sidecar_digest: digest.nullable(),
  }).strict(),
  summary: pipelineEpisodeInterpretationSummarySchema,
  episodes: z.array(z.object({
    episode_id: identifier,
    candidate_id: z.enum(["pi05_droid", "groot_n17_droid"]),
    cell_id: identifier,
    seed: z.number().int().min(0).max(2_147_483_647),
    interpretation: pipelineEpisodeInterpretationSchema,
  }).strict()).length(20),
  audit: z.object({
    original_publication_preserved: z.literal(true),
    deterministic_scores_unchanged: z.literal(true),
    learned_interpretation_only: z.literal(true),
    ranking_or_promotion_effect: z.literal("none"),
    verified_at_iso: z.string().datetime({ offset: true }),
  }).strict(),
  sidecar_digest: digest,
}).strict();

export type PolicyCanaryEpisodeInterpretationSidecar = z.infer<
  typeof policyCanaryEpisodeInterpretationSidecarSchema
>;

function episodeKey(value: {
  episode_id: string;
  candidate_id: string;
  cell_id: string;
  seed: number;
}) {
  return `${value.episode_id}\0${value.candidate_id}\0${value.cell_id}\0${value.seed}`;
}

export function verifyPolicyCanaryEpisodeInterpretationSidecar(params: {
  payload: unknown;
  publication: PipelinePolicyCanaryPublication;
  recordId: string;
  scoreCorrectionSidecarDigest: string | null;
}) {
  const parsed = policyCanaryEpisodeInterpretationSidecarSchema.safeParse(params.payload);
  if (!parsed.success) return { ok: false as const, code: "sidecar_schema_invalid" };
  const sidecar = parsed.data;
  const projection = params.publication.policy_canary_result;
  if (
    sidecar.sidecar_digest !== canonicalArtifactDigest(sidecar, "sidecar_digest")
    || sidecar.source_binding.record_id !== params.recordId
    || sidecar.source_binding.source_run_id !== params.publication.run_id
    || sidecar.source_binding.source_projection_digest !== projection.projection_digest
    || sidecar.source_binding.source_delivery_digest
      !== params.publication.result_delivery.delivery_digest
    || sidecar.source_binding.source_score_correction_sidecar_digest
      !== params.scoreCorrectionSidecarDigest
  ) return { ok: false as const, code: "sidecar_source_binding_invalid" };
  if (
    projection.episode_interpretation !== undefined
    || projection.episodes.some((episode) => episode.interpretation !== undefined)
  ) return { ok: false as const, code: "publication_already_interpreted" };
  const expected = new Set(projection.episodes.map((episode) => episodeKey({
    episode_id: episode.episode_id,
    candidate_id: episode.candidate_id,
    cell_id: episode.cell_id,
    seed: episode.seed,
  })));
  const supplied = new Set(sidecar.episodes.map(episodeKey));
  if (
    expected.size !== 20
    || supplied.size !== 20
    || [...expected].some((key) => !supplied.has(key))
    || sidecar.summary.episode_count !== 20
    || sidecar.summary.receipt_count !== 20
    || sidecar.summary.completed_count + sidecar.summary.abstained_count !== 20
  ) return { ok: false as const, code: "sidecar_episode_inventory_invalid" };
  return { ok: true as const, sidecar };
}

export function verifiedPolicyCanaryEpisodeInterpretationSidecar(value: unknown) {
  const parsed = policyCanaryEpisodeInterpretationSidecarSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.sidecar_digest
    === canonicalArtifactDigest(parsed.data, "sidecar_digest")
    ? parsed.data
    : null;
}
