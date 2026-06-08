import type { SiteLibrarySite } from "@/data/siteLibrary";
import type {
  RobotTeamTestSubmission,
  RobotTeamTestSubmissionModalityId,
} from "@/lib/robotTeamTestSubmission";

type PolicyPackagePayload = Record<string, unknown>;

function kebab(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && String(value).trim() !== "";
    }),
  );
}

function splitList(value: string | undefined) {
  return String(value || "")
    .split(/\n|,|->/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fieldsFor(
  submission: RobotTeamTestSubmission,
  modality: RobotTeamTestSubmissionModalityId,
) {
  return submission.modalities[modality]?.fields || {};
}

export function buildPolicyPackageFromRobotTeamSubmission(
  submission?: RobotTeamTestSubmission | null,
) {
  if (!submission) {
    return {};
  }

  const policyPackage: Record<RobotTeamTestSubmissionModalityId, PolicyPackagePayload> = {
    policy_api_endpoint: {},
    docker_container: {},
    recorded_action_trace: {},
    high_level_skill_trace: {},
    teleop_demo: {},
    sim_controller_plugin: {},
  };

  if (submission.selectedModalities.includes("policy_api_endpoint")) {
    const fields = fieldsFor(submission, "policy_api_endpoint");
    policyPackage.policy_api_endpoint = compactRecord({
      endpoint_url: fields.endpointUrl,
      auth_handling: fields.authHandling,
      observation_schema_ref: fields.observationSchemaRef,
      action_schema_ref: fields.actionSchemaRef,
      runtime_constraints: fields.runtimeConstraints,
      callback_log_uri: fields.callbackLogUri,
      owner_contact: fields.ownerContact,
    });
  }

  if (submission.selectedModalities.includes("docker_container")) {
    const fields = fieldsFor(submission, "docker_container");
    policyPackage.docker_container = compactRecord({
      image_ref: fields.imageRef,
      digest: fields.digestChecksum,
      entrypoint: fields.entrypoint,
      environment_contract: fields.environmentContract,
      hardware_needs: fields.hardwareNeeds,
      io_schema_ref: fields.ioSchemaRef,
      runtime_notes: fields.runtimeNotes,
    });
  }

  if (submission.selectedModalities.includes("recorded_action_trace")) {
    const fields = fieldsFor(submission, "recorded_action_trace");
    policyPackage.recorded_action_trace = compactRecord({
      trace_manifest_uri: fields.traceManifestUri,
      format: fields.format,
      task_scenario_mapping: fields.taskScenarioMapping,
      timestamp_alignment: fields.timestampAlignment,
      observation_action_alignment: fields.observationActionAlignment,
      success_failure_labels: fields.successFailureLabels,
      checksum: fields.checksum,
    });
  }

  if (submission.selectedModalities.includes("high_level_skill_trace")) {
    const fields = fieldsFor(submission, "high_level_skill_trace");
    policyPackage.high_level_skill_trace = compactRecord({
      skill_taxonomy_version: fields.skillTaxonomyVersion,
      ordered_skill_sequence: splitList(fields.orderedSkillSequence),
      preconditions_postconditions: fields.preconditionsPostconditions,
      failure_labels: fields.failureLabels,
      source_type: fields.sourceType,
      confidence_coverage_note: fields.confidenceCoverageNote,
    });
  }

  if (submission.selectedModalities.includes("teleop_demo")) {
    const fields = fieldsFor(submission, "teleop_demo");
    policyPackage.teleop_demo = compactRecord({
      demo_artifact_uri: fields.demoArtifactUri,
      operator_device: fields.operatorDevice,
      control_mapping: fields.controlMapping,
      time_sync: fields.timeSync,
      task_scenario_mapping: fields.taskScenarioMapping,
      rights_privacy_attestation: fields.rightsPrivacyAttestation,
      labels: fields.labels,
    });
  }

  if (submission.selectedModalities.includes("sim_controller_plugin")) {
    const fields = fieldsFor(submission, "sim_controller_plugin");
    policyPackage.sim_controller_plugin = compactRecord({
      simulator_framework: fields.simulatorFramework,
      plugin_uri: fields.pluginUri,
      supported_control_modes: splitList(fields.supportedControlModes),
      observation_action_spaces: fields.observationActionSpaces,
      replay_export_path: fields.replayExportPath,
      compatibility_notes: fields.compatibilityNotes,
    });
  }

  return Object.fromEntries(
    Object.entries(policyPackage).filter(([, payload]) => Object.keys(payload).length > 0),
  );
}

export function robotTeamSubmissionReadyForJobRequest(
  submission?: RobotTeamTestSubmission | null,
) {
  return Boolean(
    submission &&
      submission.selectedModalities.length > 0 &&
      submission.selectedModalities.every(
        (modality) => submission.modalities[modality]?.reviewStatus === "ready_for_review",
      ),
  );
}

export function buildRobotEvalJobRequestFromSite(
  site: SiteLibrarySite,
  source: { route: string; surface: "sites" | "site-detail" },
  options: { robotTeamTestSubmission?: RobotTeamTestSubmission | null } = {},
) {
  const publication = site.robotEvalPublication;
  const selection = site.defaultRobotEvalSelection;
  if (!publication || !selection || !publication.readyToEvaluatePublishable) {
    throw new Error("Robot-eval publication package is not ready for this site.");
  }
  const jobId = `robot-eval-${site.slug}-${kebab(selection.taskId)}-${kebab(selection.policyId)}`;
  const buyerRequestId = `buyer-request-${site.slug}-${kebab(selection.taskId)}-${kebab(selection.policyId)}`;
  const lineage = site.captureLineage || {
    siteSubmissionId: `site-submission-${site.slug}`,
    captureJobId: `capture-job-${site.slug}`,
    captureId: `capture-${site.slug}`,
    pipelinePrefix: `/synced-artifacts/sites/${site.slug}/pipeline`,
  };

  return {
    schema_version: "robot_eval_job_request.v1",
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    customer: {
      id: "public-site-robot-team",
      name: "Robot team site-library request",
      contact_email: null,
    },
    site_package: {
      site_slug: site.slug,
      site_id: `site-${site.slug}`,
      site_submission_id: lineage.siteSubmissionId,
      capture_job_id: lineage.captureJobId,
      capture_id: lineage.captureId,
      buyer_request_id: buyerRequestId,
      pipeline_prefix: lineage.pipelinePrefix,
      site_name: site.name,
      site_type: site.siteType,
      site_region: site.region,
      access_state: site.access,
      capture_root: `/synced-artifacts/sites/${site.slug}`,
      package_uri: publication.artifactUris.manifestUri,
      publication_ready_to_evaluate: publication.readyToEvaluatePublishable,
      publication_readiness_uri: publication.artifactUris.publicationReadinessUri,
      task_thresholds_uri: publication.artifactUris.taskThresholdsUri,
      scene_asset_inventory_uri: publication.artifactUris.sceneAssetInventoryUri,
      scene_asset_dependency_audit_uri:
        publication.artifactUris.sceneAssetDependencyAuditUri,
      scene_asset_preflight_uri: publication.artifactUris.sceneAssetPreflightUri,
      scene_asset_inspection_uri: publication.artifactUris.sceneAssetInspectionUri,
      scene_frame_estimate_uri: publication.artifactUris.sceneFrameEstimateUri,
      collider_proxy_plan_uri: publication.artifactUris.colliderProxyPlanUri,
      cpu_scene_proxy_manifest_uri: publication.artifactUris.cpuSceneProxyManifestUri,
      cpu_preflight_scorecard_uri: publication.artifactUris.cpuPreflightScorecardUri,
      task_anchor_proposal_manifest_uri:
        publication.artifactUris.taskAnchorProposalManifestUri,
      episode_spec_manifest_uri: publication.artifactUris.episodeSpecManifestUri,
      episode_specs_uri: publication.artifactUris.episodeSpecsUri,
      spawn_pose_validation_manifest_uri:
        publication.artifactUris.spawnPoseValidationManifestUri,
      cpu_preflight_manifest_uri: publication.artifactUris.cpuPreflightManifestUri,
      pre_gpu_readiness_summary_uri: publication.artifactUris.preGpuReadinessSummaryUri,
      cpu_simulator_preflight_manifest_uri:
        publication.artifactUris.cpuSimulatorPreflightManifestUri,
      gpu_handoff_packet_uri: publication.artifactUris.gpuHandoffPacketUri,
      gpu_owner_system_proof_schema_uri:
        publication.artifactUris.gpuOwnerSystemProofSchemaUri,
      gpu_run_checklist_uri: publication.artifactUris.gpuRunChecklistUri,
      owner_gpu_simulator_execution_blocked_manifest_uri:
        publication.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri,
      artifact_uris: publication.artifactUris,
      missing_proof_labels: publication.missingProofLabels,
    },
    requested_tasks: [
      {
        task_id: selection.taskId,
        scenario_ids: [selection.scenarioId],
        task_thresholds_uri: publication.artifactUris.taskThresholdsUri,
      },
    ],
    robot_profile: {
      robot_profile_id: selection.robotProfileId,
      embodiment: "mobile_manipulator",
      sensors: ["rgb", "depth"],
    },
    policy_package: buildPolicyPackageFromRobotTeamSubmission(
      options.robotTeamTestSubmission,
    ),
    operation: "evaluate_only",
    simulator_preference: "fixture",
    cosmos_training_preference: { mode: "export_only" },
    budget: { budget_usd: 0, timeout_seconds: 120 },
    entitlement: {
      access_state: site.access,
      approved: site.access === "Open sample",
      entitlement_id: site.access === "Open sample" ? `open-sample-${site.slug}` : null,
    },
    rights_privacy_scope: {
      status: site.access === "Private / NDA" ? "review_required" : "cleared_for_robot_eval",
      external_use_allowed: site.access !== "Private / NDA",
      privacy_scope: "derived_deidentified_environment",
    },
    owner_system: {
      name: "Blueprint-WebApp",
      request_id: jobId,
      buyer_request_id: buyerRequestId,
      site_submission_id: lineage.siteSubmissionId,
      capture_job_id: lineage.captureJobId,
      capture_id: lineage.captureId,
    },
    source: {
      system: "Blueprint-WebApp",
      ...source,
      robot_team_test_submission: options.robotTeamTestSubmission
        ? {
            schema_version: options.robotTeamTestSubmission.schemaVersion,
            submission_id: options.robotTeamTestSubmission.submissionId || null,
            selected_modalities: options.robotTeamTestSubmission.selectedModalities,
            missing_evidence_statuses:
              options.robotTeamTestSubmission.missingEvidenceStatuses,
          }
        : null,
      selection_state: {
        buyer_request_id: buyerRequestId,
        site_slug: site.slug,
        site_submission_id: lineage.siteSubmissionId,
        capture_job_id: lineage.captureJobId,
        capture_id: lineage.captureId,
        task_id: selection.taskId,
        scenario_id: selection.scenarioId,
        policy_id: selection.policyId,
      },
    },
    pipeline_trigger: {
      status: "queued_for_pipeline",
      command: "blueprint-run-robot-eval-job",
      default_provisioner: "fixture_local",
      default_simulator: "fixture",
      cpu_pre_gpu_preflight: {
        scene_asset_inventory_uri: publication.artifactUris.sceneAssetInventoryUri,
        scene_asset_dependency_audit_uri:
          publication.artifactUris.sceneAssetDependencyAuditUri,
        scene_asset_preflight_uri: publication.artifactUris.sceneAssetPreflightUri,
        scene_asset_inspection_uri: publication.artifactUris.sceneAssetInspectionUri,
        collider_proxy_plan_uri: publication.artifactUris.colliderProxyPlanUri,
        cpu_scene_proxy_manifest_uri: publication.artifactUris.cpuSceneProxyManifestUri,
        cpu_preflight_scorecard_uri: publication.artifactUris.cpuPreflightScorecardUri,
        task_anchor_proposal_manifest_uri:
          publication.artifactUris.taskAnchorProposalManifestUri,
        episode_spec_manifest_uri: publication.artifactUris.episodeSpecManifestUri,
        episode_specs_uri: publication.artifactUris.episodeSpecsUri,
        spawn_pose_validation_manifest_uri:
          publication.artifactUris.spawnPoseValidationManifestUri,
        cpu_preflight_manifest_uri: publication.artifactUris.cpuPreflightManifestUri,
        pre_gpu_readiness_summary_uri:
          publication.artifactUris.preGpuReadinessSummaryUri,
        cpu_simulator_preflight_manifest_uri:
          publication.artifactUris.cpuSimulatorPreflightManifestUri,
        gpu_handoff_packet_uri: publication.artifactUris.gpuHandoffPacketUri,
        gpu_owner_system_proof_schema_uri:
          publication.artifactUris.gpuOwnerSystemProofSchemaUri,
        gpu_run_checklist_uri: publication.artifactUris.gpuRunChecklistUri,
        owner_gpu_simulator_execution_blocked_manifest_uri:
          publication.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri,
        ready_for_owner_gpu_preflight:
          publication.preflightSummary.readyForOwnerGpuPreflight,
        owner_gpu_simulator_execution_proven: false,
        local_cpu_preflight_smoke_ran:
          publication.preflightSummary.localCpuSmokeRan,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      },
    },
    proof_boundary: {
      simulator_execution_proven: false,
      robot_readiness_proven: false,
      robot_policy_execution_proven: false,
      physics_contact_validated: false,
      safety_validated: false,
      public_claim_upgrade_allowed: false,
    },
  };
}
