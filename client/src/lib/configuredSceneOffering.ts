export type ConfiguredSceneOfferingCard = {
  source_launch_id: string;
  status: "launch_ready" | "configured_controls_pending" | "evaluation_ready";
  offering_digest: string;
  configuration_run_id: string;
  team_namespace: string;
  scene_identity: { id: string; version: string };
  task: {
    identity: { id: string; version: string };
    kind: string;
    strategy: string;
    subject_identity: { id: string; version: string };
  };
  presentation: {
    thumbnail_url: string;
    selection: { camera_id: string; rationale: string };
    selected_from_exact_reviewed_frame_count: 8;
  };
  evaluation_preparation_binding: {
    configuration_source_commit: string;
    scene_mode: "reuse_configured_revision";
    construction_mode: "reuse_configured_scene";
    task_binding_mode: "reuse_configured_template";
    configured_scene_revision: { uri: string; digest: string; size_bytes: number };
    configured_scene_revision_digest: string;
    configured_scene_bundle: { uri: string; digest: string; size_bytes: number };
  };
  proof_boundary: {
    thumbnail_is_derived_appearance_evidence: true;
    thumbnail_is_capture_or_physical_evidence: false;
    configuration_is_policy_evaluation: false;
    configuration_is_deployment_or_safety_approval: false;
  };
  evaluation_admission?: {
    zero_action_required: true;
    scripted_positive_required: true;
    learned_policy_evaluation_admitted: boolean;
  };
};

export function bindConfiguredSceneOfferingToPreparation(
  draft: Record<string, any>,
  offering: ConfiguredSceneOfferingCard,
) {
  if (
    offering.status === "configured_controls_pending"
    || !/^sha256:[0-9a-f]{64}$/.test(offering.offering_digest)
    || !/^sha256:[0-9a-f]{64}$/.test(
      offering.evaluation_preparation_binding.configured_scene_revision_digest,
    )
    || offering.presentation.selected_from_exact_reviewed_frame_count !== 8
    || offering.proof_boundary.thumbnail_is_capture_or_physical_evidence !== false
  ) throw new Error("Configured scene offering is not launch-ready");
  const binding = offering.evaluation_preparation_binding;
  const priorTask = draft.task && typeof draft.task === "object" ? draft.task : {};
  const priorSubject = priorTask.subject && typeof priorTask.subject === "object"
    ? priorTask.subject
    : {};
  const task = {
    ...priorTask,
    identity: offering.task.identity,
    binding_mode: binding.task_binding_mode,
    kind: offering.task.kind,
    strategy: offering.task.strategy,
    configured_scene_revision_digest: binding.configured_scene_revision_digest,
    subject: {
      ...priorSubject,
      mode: "configured_scene_object",
      identity: offering.task.subject_identity,
      physics_authority: "configured_scene_revision",
    },
  };
  delete task.definition;
  delete task.success_criteria;
  delete task.execution;
  delete task.subject.representation_kind;
  delete task.subject.asset;
  delete task.subject.source_object;
  delete task.subject.physics_validation;
  delete task.subject.rights_admission;
  delete task.subject.provider_disclosure_allowed;
  return {
    ...draft,
    schema_version: "task_evaluation_launch_preparation_request.v1",
    run_mode: "episode_evaluation",
    team_namespace: offering.team_namespace,
    scene: {
      mode: binding.scene_mode,
      identity: offering.scene_identity,
      configured_revision: binding.configured_scene_revision,
    },
    construction: { mode: binding.construction_mode },
    task,
  };
}

export async function fetchAuthenticatedConfiguredSceneThumbnail(
  thumbnailUrl: string,
  headers: HeadersInit,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(thumbnailUrl, {
    headers,
    credentials: "include",
  });
  if (!response.ok) throw new Error("Configured scene thumbnail is unavailable");
  return response.blob();
}
