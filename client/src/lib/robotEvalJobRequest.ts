import type { SiteLibrarySite } from "@/data/siteLibrary";

const POLICY_DIGEST =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function kebab(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildRobotEvalJobRequestFromSite(
  site: SiteLibrarySite,
  source: { route: string; surface: "sites" | "site-detail" },
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
    policy_package: {
      policy_api_endpoint: {
        endpoint_url: "https://robot-team.example/policy-placeholder",
        observation_schema_ref: "schemas/observation-v1.json",
        action_schema_ref: "schemas/action-v1.json",
        runtime_constraints: "fixture_local_default_until_robot_team_uploads_owner_system_policy",
      },
      docker_container: {
        image_ref: "registry.example/robot-team/policy-placeholder:fixture",
        digest: POLICY_DIGEST,
        entrypoint: "/run-policy",
      },
      recorded_action_trace: {
        trace_manifest_uri: "gs://robot-team-placeholder/traces/trace-manifest.json",
        timestamp_alignment: "aligned_to_capture_timestamps",
        checksum: POLICY_DIGEST,
      },
      high_level_skill_trace: {
        skill_taxonomy_version: "skills-v1",
        ordered_skill_sequence: ["navigate", "observe", "act"],
      },
      teleop_demo: {
        demo_artifact_uri: "gs://robot-team-placeholder/teleop/demo.json",
        rights_privacy_attestation: "robot_team_owner_system_required_before_claim_upgrade",
      },
      sim_controller_plugin: {
        simulator_framework: "fixture",
        plugin_uri: "gs://robot-team-placeholder/plugins/fixture-controller.json",
        supported_control_modes: ["fixture_replay"],
      },
    },
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
