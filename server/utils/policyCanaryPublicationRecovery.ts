type Publication = Record<string, any>;

const SAME_IDENTITY_FIELDS = [
  "capture_session_id",
  "intake_id",
  "run_id",
  "request_digest",
  "configuration_digest",
] as const;

function blockers(publication: Publication) {
  const rows = publication.policy_canary_result?.blockers;
  return Array.isArray(rows) ? rows.map(String) : [];
}

function episodes(publication: Publication) {
  const rows = publication.result_delivery?.episodes;
  return Array.isArray(rows) ? rows : [];
}

export function policyCanaryRecoveredPublicationAllowed(
  prior: Publication,
  next: Publication,
) {
  if (SAME_IDENTITY_FIELDS.some((field) => prior[field] !== next[field])) return false;
  if (
    prior.schema_version !== "task_evaluation_run_publication.v4"
    || next.schema_version !== "task_evaluation_run_publication.v4"
    || prior.run_kind !== "internal_policy_canary"
    || next.run_kind !== "internal_policy_canary"
    || prior.claim_ceiling !== "diagnostic_policy_execution"
    || next.claim_ceiling !== "diagnostic_policy_execution"
    || prior.result_status !== "blocked"
    || next.result_status !== "completed_unqualified"
  ) return false;
  const priorBlockers = blockers(prior);
  const priorEpisodes = episodes(prior);
  const nextEpisodes = episodes(next);
  const priorCounts = prior.policy_canary_result?.counts || {};
  const nextCounts = next.policy_canary_result?.counts || {};
  const transportFailure = priorBlockers.some((blocker) => (
    blocker.includes("output_upload_failed")
    || blocker.includes("provider_output_upload_nontransient_failure")
  ));
  const missingRuntimeResult = priorBlockers.includes(
    "native_task_arena_policy_canary_session_runtime_result_missing",
  );
  const syntheticPrior = (
    priorEpisodes.length === 20
    && priorEpisodes.every((episode) => (
      episode?.score?.status === "not_scored"
      && episode?.score?.policy_outcome_interpretable === false
      && episode?.failure?.code === "before_first_observation"
      && Object.keys(episode?.evidence?.videos || {}).length === 0
    ))
    && priorCounts.completed_learned_policy_rollout_count === 0
    && priorCounts.learned_policy_rollout_count === 20
  );
  const completeRecovery = (
    nextEpisodes.length === 20
    && nextEpisodes.every((episode) => (
      episode?.episode_kind === "learned_candidate"
      && episode?.score?.status === "scored"
      && episode?.score?.policy_outcome_interpretable === true
      && episode?.evidence?.complete === true
      && Boolean(episode?.evidence?.lossless_policy_inputs)
      && Boolean(episode?.evidence?.frame_manifest)
      && Object.keys(episode?.evidence?.videos || {}).length >= 2
      && episode?.action_delivery?.actions_reached_robot === true
      && episode?.action_delivery?.arm_moved === true
    ))
    && nextCounts.completed_learned_policy_rollout_count === 20
    && nextCounts.learned_policy_rollout_count === 20
    && next.proof_boundary?.scene_promotion_authorized === false
    && next.proof_boundary?.official_policy_ranking_authorized === false
    && next.proof_boundary?.winner_selection_authorized === false
  );
  return transportFailure && missingRuntimeResult && syntheticPrior && completeRecovery;
}
