export const ROBOT_TEAM_TEST_SUBMISSION_SCHEMA_VERSION =
  "blueprint.robot_team_test_submission.v1";

export type RobotTeamTestSubmissionModalityId =
  | "policy_api_endpoint"
  | "docker_container"
  | "recorded_action_trace"
  | "high_level_skill_trace"
  | "teleop_demo"
  | "sim_controller_plugin";

export type RobotTeamTestSubmissionReviewStatus =
  | "not_selected"
  | "missing_required_refs"
  | "ready_for_review";

export type RobotTeamTestSubmissionFieldDefinition = {
  key: string;
  label: string;
  helper: string;
  required: boolean;
  placeholder?: string;
};

export type RobotTeamTestSubmissionModalityDefinition = {
  id: RobotTeamTestSubmissionModalityId;
  label: string;
  shortLabel: string;
  summary: string;
  missingEvidenceStatus: string;
  requestedOutputs: string[];
  fields: RobotTeamTestSubmissionFieldDefinition[];
};

export type RobotTeamTestSubmissionModality = {
  modality: RobotTeamTestSubmissionModalityId;
  label: string;
  selected: boolean;
  fields: Record<string, string>;
  artifactReferenceUris: string[];
  missingFields: string[];
  missingEvidenceStatus: string | null;
  reviewStatus: RobotTeamTestSubmissionReviewStatus;
};

export type RobotTeamTestSubmission = {
  schemaVersion: typeof ROBOT_TEAM_TEST_SUBMISSION_SCHEMA_VERSION;
  submissionId?: string | null;
  siteWorldId?: string | null;
  taskId?: string | null;
  scenarioId?: string | null;
  robotProfileId?: string | null;
  selectedModalities: RobotTeamTestSubmissionModalityId[];
  modalities: Record<RobotTeamTestSubmissionModalityId, RobotTeamTestSubmissionModality>;
  missingEvidenceStatuses: string[];
  requestedOutputs: string[];
  pipelineDatasetSchemaRefs: string[];
  proofBoundary: {
    submittedArtifactsAre: "artifact_references_only";
    submittedArtifactsDoNotProve: string[];
    blockedClaimUpgrades: string[];
    operationalReadinessRequires: string[];
  };
};

export const ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS: RobotTeamTestSubmissionModalityDefinition[] = [
  {
    id: "policy_api_endpoint",
    label: "Policy API endpoint",
    shortLabel: "API endpoint",
    summary: "Let Blueprint send an observation to your service and receive the next action back. Keep source code and model weights private.",
    missingEvidenceStatus: "needs_policy_api_endpoint_ref",
    requestedOutputs: ["observation_frames", "action_trace", "success_failure", "export_bundle"],
    fields: [
      {
        key: "endpointUrl",
        label: "Endpoint URL",
        helper: "HTTPS endpoint or internal gateway URL.",
        required: true,
        placeholder: "https://policy.example.com/v1/action",
      },
      {
        key: "authHandling",
        label: "Auth handling / redacted secret ref",
        helper: "Name the auth method and where the secret reference lives.",
        required: true,
        placeholder: "Bearer token in team secret manager: robot-policy-prod",
      },
      {
        key: "observationSchemaRef",
        label: "Observation schema URI or JSON ref",
        helper: "Artifact reference for what the policy sees: cameras, robot state, task instruction, or other inputs.",
        required: true,
        placeholder: "gs://team-bucket/schemas/observation.v1.json",
      },
      {
        key: "actionSchemaRef",
        label: "Action schema URI or JSON ref",
        helper: "Artifact reference for what the policy sends back: base motion, arm motion, gripper command, skill, or stop signal.",
        required: true,
        placeholder: "gs://team-bucket/schemas/action.v1.json",
      },
      {
        key: "runtimeConstraints",
        label: "Rate-limit / runtime constraints",
        helper: "Timeout, rate limit, batch, and cold-start constraints.",
        required: true,
        placeholder: "200 ms p95, 10 rps, no external network from container.",
      },
      {
        key: "callbackLogUri",
        label: "Callback / log URI",
        helper: "Where Blueprint can send or retrieve run logs.",
        required: true,
        placeholder: "gs://team-bucket/blueprint/logs/",
      },
      {
        key: "ownerContact",
        label: "Owner contact",
        helper: "Technical owner for schema or runtime questions.",
        required: true,
        placeholder: "robot-eval-owner@example.com",
      },
    ],
  },
  {
    id: "docker_container",
    label: "Docker container",
    shortLabel: "Container",
    summary: "Package the policy as a runnable service when the simulator needs low-latency access on the same machine or private network.",
    missingEvidenceStatus: "needs_docker_container_ref",
    requestedOutputs: ["observation_frames", "action_trace", "rollout_video", "export_bundle"],
    fields: [
      {
        key: "imageRef",
        label: "Image / artifact URI",
        helper: "Registry ref or artifact pointer for the runnable policy service.",
        required: true,
        placeholder: "registry.example.com/team/policy:2026-06-03",
      },
      {
        key: "digestChecksum",
        label: "Digest / checksum",
        helper: "Immutable digest or checksum.",
        required: true,
        placeholder: "sha256:...",
      },
      {
        key: "entrypoint",
        label: "Entrypoint",
        helper: "Command Blueprint should call inside the container.",
        required: true,
        placeholder: "python -m policy_server --port 8080",
      },
      {
        key: "environmentContract",
        label: "Environment contract",
        helper: "Required env vars, files, mount points, and secret refs.",
        required: true,
        placeholder: "OBS_SCHEMA=/schemas/obs.json, ACTION_SCHEMA=/schemas/action.json",
      },
      {
        key: "hardwareNeeds",
        label: "Hardware / GPU needs",
        helper: "CPU, memory, GPU, accelerator, and driver expectations.",
        required: true,
        placeholder: "1x L4, CUDA 12.4, 16 GB RAM.",
      },
      {
        key: "ioSchemaRef",
        label: "Expected input / output schema",
        helper: "Artifact reference for full IO contract.",
        required: true,
        placeholder: "gs://team-bucket/schemas/container-io.v1.json",
      },
      {
        key: "runtimeNotes",
        label: "Runtime notes",
        helper: "Startup, shutdown, determinism, and unsupported modes.",
        required: true,
        placeholder: "Warm-up one request before measuring cycle time.",
      },
    ],
  },
  {
    id: "recorded_action_trace",
    label: "Recorded action traces",
    shortLabel: "Action traces",
    summary: "Share precomputed actions for a task when you cannot connect a live policy yet.",
    missingEvidenceStatus: "needs_recorded_action_trace_ref",
    requestedOutputs: ["observation_frames", "action_trace", "success_failure", "export_bundle"],
    fields: [
      {
        key: "traceManifestUri",
        label: "Trace manifest URI",
        helper: "Manifest containing trace files and run metadata.",
        required: true,
        placeholder: "gs://team-bucket/traces/manifest.json",
      },
      {
        key: "format",
        label: "Format",
        helper: "Trace format, codec, and serialization.",
        required: true,
        placeholder: "JSONL actions, one row per timestamp.",
      },
      {
        key: "taskScenarioMapping",
        label: "Task / scenario mapping",
        helper: "How traces map to Blueprint task_id and scenario_id.",
        required: true,
        placeholder: "trace task_key maps to task_id sw-chi-01-task-1.",
      },
      {
        key: "timestampAlignment",
        label: "Timestamp alignment",
        helper: "Clock source and alignment method.",
        required: true,
        placeholder: "Unix ms aligned to observation frame timestamps.",
      },
      {
        key: "observationActionAlignment",
        label: "Observation / action alignment",
        helper: "How observations and actions are paired.",
        required: true,
        placeholder: "action[t] consumes observation[t-1].",
      },
      {
        key: "successFailureLabels",
        label: "Success / failure labels",
        helper: "Label source and label vocabulary.",
        required: true,
        placeholder: "success, partial, failure with failure_mode_id.",
      },
      {
        key: "checksum",
        label: "Checksum",
        helper: "Manifest checksum or trace package digest.",
        required: true,
        placeholder: "sha256:...",
      },
    ],
  },
  {
    id: "high_level_skill_trace",
    label: "High-level skill traces",
    shortLabel: "Skill traces",
    summary: "Share steps like navigate, pick, place, or recover when the policy works above low-level joint control.",
    missingEvidenceStatus: "needs_high_level_skill_trace_ref",
    requestedOutputs: ["task_summary", "scenario", "success_failure", "export_bundle"],
    fields: [
      {
        key: "skillTaxonomyVersion",
        label: "Skill taxonomy / version",
        helper: "Taxonomy name and version used by the trace.",
        required: true,
        placeholder: "team.manipulation_skills.v3",
      },
      {
        key: "orderedSkillSequence",
        label: "Ordered skill sequence",
        helper: "Artifact URI or inline ordered skill summary.",
        required: true,
        placeholder: "approach_shelf -> locate_tote -> grasp_tote -> retreat",
      },
      {
        key: "preconditionsPostconditions",
        label: "Preconditions / postconditions",
        helper: "State assertions before and after each skill.",
        required: true,
        placeholder: "Pre: tote visible. Post: tote secured in gripper.",
      },
      {
        key: "failureLabels",
        label: "Failure labels",
        helper: "Failure taxonomy or label mapping.",
        required: true,
        placeholder: "failure_perception_occlusion, failure_intervention_required.",
      },
      {
        key: "sourceType",
        label: "Source type",
        helper: "Planner, human-labeled demo, robot log, or policy output.",
        required: true,
        placeholder: "planner_export",
      },
      {
        key: "confidenceCoverageNote",
        label: "Confidence / coverage note",
        helper: "Coverage gaps, confidence, and reviewed scope.",
        required: true,
        placeholder: "Covers nominal tote pick only; low coverage on occluded shelf.",
      },
    ],
  },
  {
    id: "teleop_demo",
    label: "Teleop demos",
    shortLabel: "Teleop",
    summary: "Share human-driven demonstrations so Blueprint can compare the site task, controls, labels, and failure points.",
    missingEvidenceStatus: "needs_teleop_demo_ref",
    requestedOutputs: ["observation_frames", "action_trace", "rollout_video", "export_bundle"],
    fields: [
      {
        key: "demoArtifactUri",
        label: "Demo media or trajectory URI",
        helper: "Artifact reference for media, trajectory, or manifest.",
        required: true,
        placeholder: "gs://team-bucket/teleop/demo-001/manifest.json",
      },
      {
        key: "operatorDevice",
        label: "Operator / device",
        helper: "Operator role and input device.",
        required: true,
        placeholder: "Certified operator, dual-stick controller.",
      },
      {
        key: "controlMapping",
        label: "Control mapping",
        helper: "Control dimensions and device mapping.",
        required: true,
        placeholder: "left stick base xy, right stick yaw, trigger gripper.",
      },
      {
        key: "timeSync",
        label: "Time sync",
        helper: "Clock sync with observation and action records.",
        required: true,
        placeholder: "NTP synced, trajectory timestamps in Unix ms.",
      },
      {
        key: "taskScenarioMapping",
        label: "Task / scenario mapping",
        helper: "How demos map to Blueprint task and scenario IDs.",
        required: true,
        placeholder: "demo_id D001 maps to scenario sw-chi-01-scenario-1.",
      },
      {
        key: "rightsPrivacyAttestation",
        label: "Rights / privacy attestation",
        helper: "Artifact reference or statement for demo use boundaries.",
        required: true,
        placeholder: "privacy reviewed; operator face excluded; attestation URI attached.",
      },
      {
        key: "labels",
        label: "Labels",
        helper: "Success, failure, intervention, and safety labels.",
        required: true,
        placeholder: "success=true, interventions=0, safety_events=0.",
      },
    ],
  },
  {
    id: "sim_controller_plugin",
    label: "Sim controller plugin",
    shortLabel: "Sim plugin",
    summary: "Share the adapter that lets a simulator speak your robot controller format without claiming the sim has already run.",
    missingEvidenceStatus: "needs_sim_controller_plugin_ref",
    requestedOutputs: ["observation_frames", "action_trace", "rollout_video", "export_bundle"],
    fields: [
      {
        key: "simulatorFramework",
        label: "Simulator / framework",
        helper: "Simulator family and integration surface.",
        required: true,
        placeholder: "Isaac Sim 4.x controller extension.",
      },
      {
        key: "pluginUri",
        label: "Plugin URI / ref",
        helper: "Artifact reference for plugin package or source snapshot.",
        required: true,
        placeholder: "gs://team-bucket/plugins/isaac-controller-v2.zip",
      },
      {
        key: "supportedControlModes",
        label: "Supported control modes",
        helper: "Position, velocity, torque, high-level skill, or custom mode.",
        required: true,
        placeholder: "base velocity, ee delta pose, binary gripper.",
      },
      {
        key: "observationActionSpaces",
        label: "Observation / action spaces",
        helper: "Observation and action schema references or summaries.",
        required: true,
        placeholder: "obs schema v1, action schema ee_delta_pose_gripper.",
      },
      {
        key: "replayExportPath",
        label: "Replay / export path",
        helper: "Where replay outputs and logs are written.",
        required: true,
        placeholder: "gs://team-bucket/sim/replays/",
      },
      {
        key: "compatibilityNotes",
        label: "Version / compatibility notes",
        helper: "Version pinning, unsupported modes, and adapter notes.",
        required: true,
        placeholder: "Isaac Sim 4.2, Python 3.10, no contact-rich manipulation yet.",
      },
    ],
  },
];

const fieldDefinitionsByModality = Object.fromEntries(
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
) as Record<RobotTeamTestSubmissionModalityId, RobotTeamTestSubmissionModalityDefinition>;

export const ROBOT_TEAM_TEST_SUBMISSION_MODALITY_IDS =
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => definition.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value: unknown, maxLength = 2000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeFields(
  definition: RobotTeamTestSubmissionModalityDefinition,
  rawFields: unknown,
) {
  const source = isRecord(rawFields) ? rawFields : {};
  const fields: Record<string, string> = {};
  const missingFields: string[] = [];
  const artifactReferenceUris: string[] = [];

  for (const field of definition.fields) {
    const normalized = normalizeString(source[field.key]);
    fields[field.key] = normalized;
    if (field.required && !normalized) {
      missingFields.push(field.key);
    }
    if (
      normalized &&
      /(uri|url|ref|manifest|schema|checksum|digest|path)/i.test(field.key)
    ) {
      artifactReferenceUris.push(normalized);
    }
  }

  return { fields, missingFields, artifactReferenceUris };
}

function normalizeRawModality(
  definition: RobotTeamTestSubmissionModalityDefinition,
  rawValue: unknown,
): RobotTeamTestSubmissionModality {
  const raw = isRecord(rawValue) ? rawValue : {};
  const { fields, missingFields, artifactReferenceUris } = normalizeFields(
    definition,
    raw.fields ?? raw,
  );
  const hasAnyFieldValue = Object.values(fields).some(Boolean);
  const selected = raw.selected === true || raw.enabled === true || hasAnyFieldValue;
  const reviewStatus: RobotTeamTestSubmissionReviewStatus = !selected
    ? "not_selected"
    : missingFields.length > 0
      ? "missing_required_refs"
      : "ready_for_review";

  return {
    modality: definition.id,
    label: definition.label,
    selected,
    fields,
    artifactReferenceUris,
    missingFields: selected ? missingFields : [],
    missingEvidenceStatus:
      selected && missingFields.length > 0 ? definition.missingEvidenceStatus : null,
    reviewStatus,
  };
}

function rawModalityValue(
  rawModalities: unknown,
  id: RobotTeamTestSubmissionModalityId,
) {
  if (Array.isArray(rawModalities)) {
    return rawModalities.find(
      (item) => isRecord(item) && (item.modality === id || item.id === id),
    );
  }
  if (isRecord(rawModalities)) {
    return rawModalities[id];
  }
  return undefined;
}

function uniqueStrings(values: Iterable<unknown>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeString(value, 240);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function normalizeRobotTeamTestSubmission(
  value: unknown,
): RobotTeamTestSubmission | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawModalities = value.modalities;
  const modalities = Object.fromEntries(
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
      definition.id,
      normalizeRawModality(definition, rawModalityValue(rawModalities, definition.id)),
    ]),
  ) as Record<RobotTeamTestSubmissionModalityId, RobotTeamTestSubmissionModality>;
  const selectedModalities = ROBOT_TEAM_TEST_SUBMISSION_MODALITY_IDS.filter(
    (id) => modalities[id].selected,
  );
  const selectedDefinitions = selectedModalities.map((id) => fieldDefinitionsByModality[id]);
  const missingEvidenceStatuses = uniqueStrings([
    ...selectedModalities
      .map((id) => modalities[id].missingEvidenceStatus)
      .filter(Boolean),
    ...(selectedModalities.length === 0 ? ["needs_robot_team_test_modality"] : []),
  ]);

  return {
    schemaVersion: ROBOT_TEAM_TEST_SUBMISSION_SCHEMA_VERSION,
    submissionId: normalizeString(value.submissionId, 160) || null,
    siteWorldId: normalizeString(value.siteWorldId, 160) || null,
    taskId: normalizeString(value.taskId, 160) || null,
    scenarioId: normalizeString(value.scenarioId, 160) || null,
    robotProfileId: normalizeString(value.robotProfileId, 160) || null,
    selectedModalities,
    modalities,
    missingEvidenceStatuses,
    requestedOutputs: uniqueStrings(selectedDefinitions.flatMap((definition) => definition.requestedOutputs)),
    pipelineDatasetSchemaRefs: [
      "real_site_robot_eval_dataset_manifest.v0.1",
      "robot_team_test_submission_modalities.v0.1",
      "prediction_outcome_ledger.v1",
    ],
    proofBoundary: {
      submittedArtifactsAre: "artifact_references_only",
      submittedArtifactsDoNotProve: [
        "deployment readiness",
        "safety validation",
        "real robot execution",
        "simulator run completion",
        "policy pass/fail outcome",
        "rights or privacy clearance",
      ],
      blockedClaimUpgrades: [
        "ready_to_deploy_claim",
        "safety_validated_claim",
        "simulator_completed_claim",
        "robot_trial_passed_claim",
        "policy_execution_passed_claim",
        "guaranteed_threshold_claim",
      ],
      operationalReadinessRequires: [
        "robot profile with geometry, sensors, controllers, and control level, or a clear site-feasibility-only scope",
        "request-scoped simulator traces or robot trial logs from the owning system",
        "action or teleoperation logs aligned to the exact task and scenario",
        "prediction-vs-actual outcome records",
        "rights and privacy clearance for the exact site and use",
        "buyer-approved evaluation methodology",
      ],
    },
  };
}

export function buildRobotTeamSubmissionInput(params: {
  submissionId?: string | null;
  siteWorldId?: string | null;
  taskId?: string | null;
  scenarioId?: string | null;
  robotProfileId?: string | null;
  modalities: Partial<
    Record<
      RobotTeamTestSubmissionModalityId,
      {
        selected?: boolean;
        fields?: Record<string, unknown>;
      }
    >
  >;
}) {
  return {
    submissionId: params.submissionId ?? null,
    siteWorldId: params.siteWorldId ?? null,
    taskId: params.taskId ?? null,
    scenarioId: params.scenarioId ?? null,
    robotProfileId: params.robotProfileId ?? null,
    modalities: Object.fromEntries(
      ROBOT_TEAM_TEST_SUBMISSION_MODALITY_IDS.map((id) => [
        id,
        {
          selected: params.modalities[id]?.selected === true,
          fields: params.modalities[id]?.fields || {},
        },
      ]),
    ),
  };
}
