import type {
  TaskEvaluationResultArtifact,
  TaskEvaluationResultEpisode,
  TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

export type EpisodeFilters = {
  family: string;
  seed: string;
  outcome: "all" | "success" | "failure";
  interpretability: "all" | "interpretable" | "uninterpretable";
};

export type AlignedCanaryCell = {
  key: string;
  cellId: string;
  familyId: string;
  seed: number | null;
  partition: string;
  episodesByCandidate: Record<string, TaskEvaluationResultEpisode | undefined>;
};

export const canaryFailureCohorts = [
  "collision",
  "no_motion",
  "action_delivery",
  "contact_loss",
  "task_miss",
  "timeout",
  "camera_sensor",
  "runtime_provider",
  "evidence_gap",
] as const;

export function wilson95(successes: number, attempts: number) {
  if (!Number.isInteger(successes) || !Number.isInteger(attempts) || attempts <= 0) return null;
  const boundedSuccesses = Math.min(Math.max(successes, 0), attempts);
  const z = 1.959963984540054;
  const phat = boundedSuccesses / attempts;
  const denominator = 1 + (z * z) / attempts;
  const center = (phat + (z * z) / (2 * attempts)) / denominator;
  const halfWidth = z * Math.sqrt(
    (phat * (1 - phat) + (z * z) / (4 * attempts)) / attempts,
  ) / denominator;
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
  };
}

function episodeMatches(episode: TaskEvaluationResultEpisode, filters: EpisodeFilters) {
  if (filters.family !== "all" && episode.variation?.family_id !== filters.family) return false;
  if (filters.seed !== "all" && String(episode.variation?.seed) !== filters.seed) return false;
  if (filters.outcome === "success" && episode.score.task_succeeded !== true) return false;
  if (filters.outcome === "failure" && episode.score.task_succeeded !== false && !episode.failure) return false;
  if (
    filters.interpretability === "interpretable"
    && episode.score.policy_outcome_interpretable === false
  ) return false;
  if (
    filters.interpretability === "uninterpretable"
    && episode.score.policy_outcome_interpretable !== false
  ) return false;
  return true;
}

export function buildAlignedCanaryCells(
  episodes: TaskEvaluationResultEpisode[],
  candidateIds: string[],
  filters: EpisodeFilters,
) {
  const rows = new Map<string, AlignedCanaryCell>();
  for (const episode of episodes) {
    if (episode.episode_kind !== "learned_candidate" || !episodeMatches(episode, filters)) continue;
    const cellId = episode.variation?.cell_id || "unbound-cell";
    const seed = typeof episode.variation?.seed === "number" ? episode.variation.seed : null;
    const key = `${cellId}\0${seed ?? "unknown"}`;
    const row = rows.get(key) || {
      key,
      cellId,
      familyId: episode.variation?.family_id || "unreported",
      seed,
      partition: episode.variation?.partition || "unreported",
      episodesByCandidate: {},
    };
    const candidateId = episode.policy_candidate_id || episode.subject_id;
    if (candidateIds.includes(candidateId)) row.episodesByCandidate[candidateId] = episode;
    rows.set(key, row);
  }
  return [...rows.values()].sort((left, right) => (
    (left.seed ?? Number.MAX_SAFE_INTEGER) - (right.seed ?? Number.MAX_SAFE_INTEGER)
    || left.cellId.localeCompare(right.cellId)
  ));
}

function failureCohort(episode: TaskEvaluationResultEpisode): typeof canaryFailureCohorts[number] | null {
  const material = [
    episode.failure?.code,
    episode.failure?.phase,
    episode.failure?.summary,
    episode.action_delivery?.harness_failure_code,
    episode.evidence?.typed_media_gap?.code,
  ].filter(Boolean).join(" ").toLowerCase();
  if (episode.score.collision === true || material.includes("collision")) return "collision";
  if (material.includes("no_motion") || material.includes("no motion") || (
    episode.action_delivery?.actions_reached_robot === true
    && episode.action_delivery.arm_moved === false
  )) return "no_motion";
  if (episode.action_delivery?.actions_reached_robot === false || material.includes("action_delivery")) return "action_delivery";
  if (material.includes("contact_loss") || material.includes("contact loss")) return "contact_loss";
  if (material.includes("task_miss") || material.includes("task miss")) return "task_miss";
  if (material.includes("timeout")) return "timeout";
  if (material.includes("camera") || material.includes("sensor")) return "camera_sensor";
  if (material.includes("runtime") || material.includes("provider")) return "runtime_provider";
  if (episode.evidence?.typed_media_gap || material.includes("evidence") || material.includes("media")) return "evidence_gap";
  return episode.failure ? "task_miss" : null;
}

export function buildFailureAnalysis(episodes: TaskEvaluationResultEpisode[]) {
  const cohorts = new Map<typeof canaryFailureCohorts[number], string[]>();
  for (const cohort of canaryFailureCohorts) cohorts.set(cohort, []);
  for (const episode of episodes) {
    const cohort = failureCohort(episode);
    if (cohort) cohorts.get(cohort)?.push(episode.episode_id);
  }
  return canaryFailureCohorts.map((cohort) => ({
    cohort,
    count: cohorts.get(cohort)?.length || 0,
    representativeEpisodeIds: (cohorts.get(cohort) || []).slice(0, 3),
  }));
}

function episodeArtifacts(episode: TaskEvaluationResultEpisode) {
  return [
    episode.artifacts?.receipt,
    episode.artifacts?.frame_manifest,
    ...Object.values(episode.artifacts?.videos || {}),
    episode.evidence?.lossless_policy_inputs,
    episode.evidence?.frame_manifest,
    ...Object.values(episode.evidence?.videos || {}),
    episode.evidence?.episode_json,
    episode.evidence?.indexed_mcap_rosbag,
    episode.action_delivery?.returned_action_sequence,
    episode.action_delivery?.delivery_readback,
    episode.traces?.state,
    episode.traces?.contact_force,
    episode.traces?.task_object_trajectory,
  ].filter((artifact): artifact is TaskEvaluationResultArtifact => Boolean(artifact));
}

export function buildCanaryArtifactInventory(result: TaskEvaluationResultSiteRecord) {
  const publication = result.publication;
  const delivery = publication.result_delivery;
  const canaryResult = publication.policy_canary_result || {};
  const reproducibility = canaryResult.reproducibility || {};
  const artifacts = [
    ...(delivery?.artifacts || []),
    ...(delivery?.episodes || []).flatMap(episodeArtifacts),
    reproducibility.evidence_manifest,
    reproducibility.billing_receipt,
    reproducibility.teardown_receipt,
    reproducibility.provider_zero_receipt,
    publication.notification_delivery?.receipt,
  ].filter((artifact): artifact is TaskEvaluationResultArtifact => Boolean(artifact));
  const unique = new Map<string, TaskEvaluationResultArtifact>();
  for (const artifact of artifacts) unique.set(artifact.artifact_id, artifact);
  return [...unique.values()].sort((left, right) => (
    left.role.localeCompare(right.role) || left.relative_path.localeCompare(right.relative_path)
  ));
}

export function availableCanaryFilters(episodes: TaskEvaluationResultEpisode[]) {
  return {
    families: [...new Set(episodes.map((episode) => episode.variation?.family_id).filter(Boolean) as string[])].sort(),
    seeds: [...new Set(episodes.map((episode) => episode.variation?.seed).filter((seed): seed is number => typeof seed === "number"))].sort((a, b) => a - b),
  };
}
