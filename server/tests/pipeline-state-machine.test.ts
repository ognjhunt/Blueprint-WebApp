// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mock firebase-admin for the state machine
vi.mock("firebase-admin", () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: () => "SERVER_TIMESTAMP",
    },
  },
}));

import {
  computePipelineStateTransition,
  checkHostedReviewReadiness,
  inferQualificationStateFromArtifacts,
  inferOpportunityState,
  stampProofPathMilestones,
  computeOpsEnvelopeFromPipeline,
  enrichEvaluationReadinessFromArtifacts,
  growthEventsForStamps,
} from "../utils/pipelineStateMachine";
import type { PipelineArtifacts, ProofPathMilestones } from "../types/inbound-request";

// ── Helpers ──

function makeArtifacts(keys: (keyof PipelineArtifacts)[]): PipelineArtifacts {
  const result: Partial<PipelineArtifacts> = {};
  for (const key of keys) {
    (result as Record<string, string | null>)[key] = `gs://test/${key}.json`;
  }
  return result as PipelineArtifacts;
}

function emptyProofPath(): ProofPathMilestones {
  return {
    exact_site_requested_at: null,
    qualified_inbound_at: null,
    proof_pack_delivered_at: null,
    proof_pack_reviewed_at: null,
    hosted_review_ready_at: null,
    hosted_review_started_at: null,
    hosted_review_follow_up_at: null,
    artifact_handoff_delivered_at: null,
    artifact_handoff_accepted_at: null,
    human_commercial_handoff_at: null,
  };
}

// ── inferQualificationStateFromArtifacts tests ──

describe("inferQualificationStateFromArtifacts", () => {
  it("returns submitted when no artifacts exist", () => {
    expect(inferQualificationStateFromArtifacts({})).toBe("submitted");
  });

  it("returns qualified_ready when world model, quality, and rights are present", () => {
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "capture_quality_summary_uri",
      "rights_and_compliance_summary_uri",
    ]);
    expect(inferQualificationStateFromArtifacts({ artifacts: arts })).toBe("qualified_ready");
  });

  it("PIPE-02: withholds qualified_ready when rights_review_status is not cleared", () => {
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "capture_quality_summary_uri",
      "rights_and_compliance_summary_uri",
    ]);
    // Same artifacts present, but the pipeline reports a non-cleared verdict.
    expect(
      inferQualificationStateFromArtifacts({
        artifacts: arts,
        evaluationReadiness: { rights_review_status: "needs_review" },
      }),
    ).not.toBe("qualified_ready");
    expect(
      inferQualificationStateFromArtifacts({
        artifacts: arts,
        evaluationReadiness: { rights_review_status: "blocked" },
      }),
    ).not.toBe("qualified_ready");
  });

  it("PIPE-02: still qualified_ready when rights_review_status is cleared", () => {
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "capture_quality_summary_uri",
      "rights_and_compliance_summary_uri",
    ]);
    expect(
      inferQualificationStateFromArtifacts({
        artifacts: arts,
        evaluationReadiness: { rights_review_status: "cleared" },
      }),
    ).toBe("qualified_ready");
  });

  it("returns in_review when handoff is available", () => {
    const arts = makeArtifacts(["opportunity_handoff_uri"]);
    expect(inferQualificationStateFromArtifacts({ artifacts: arts })).toBe("in_review");
  });

  it("returns qa_passed when launch_gate_summary is available", () => {
    const arts = makeArtifacts(["launch_gate_summary_uri"]);
    expect(inferQualificationStateFromArtifacts({ artifacts: arts })).toBe("qa_passed");
  });

  it("returns qualified_risky when only quality report exists", () => {
    const arts = makeArtifacts([
      "qualification_quality_report_uri",
      "capture_quality_summary_uri",
    ]);
    expect(inferQualificationStateFromArtifacts({ artifacts: arts })).toBe("qualified_risky");
  });

  it("falls back to current state when no relevant artifacts", () => {
    expect(inferQualificationStateFromArtifacts({ current: "capture_requested" })).toBe("capture_requested");
  });
});

// ── inferOpportunityState tests ──

describe("inferOpportunityState", () => {
  it("returns not_applicable for submitted state", () => {
    expect(inferOpportunityState({ qualificationState: "submitted" })).toBe("not_applicable");
  });

  it("returns handoff_ready for qualified_ready", () => {
    expect(inferOpportunityState({ qualificationState: "qualified_ready" })).toBe("handoff_ready");
  });

  it("returns not_applicable for needs_refresh", () => {
    expect(inferOpportunityState({ qualificationState: "needs_refresh" })).toBe("not_applicable");
  });

  it("returns escalated_to_validation when health and diff artifacts exist", () => {
    const arts = makeArtifacts(["site_world_health_uri", "recapture_diff_uri"]);
    expect(
      inferOpportunityState({
        qualificationState: "qualified_ready",
        artifacts: arts,
      })
    ).toBe("escalated_to_validation");
  });

  it("returns escalated_to_geometry when compatibility_matrix exists", () => {
    const arts = makeArtifacts(["compatibility_matrix_uri"]);
    expect(
      inferOpportunityState({
        qualificationState: "qualified_risky",
        artifacts: arts,
      })
    ).toBe("escalated_to_geometry");
  });
});

// ── stampProofPathMilestones tests ──

describe("stampProofPathMilestones", () => {
  it("does not stamp anything when no artifacts exist", () => {
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
    });
    expect(result.stampedThisSync).toHaveLength(0);
  });

  it("stamps proof_pack_delivered when 2+ world model outputs are available", () => {
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "preview_manifest_uri",
    ]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).toContain("proof_pack_delivered_at");
  });

  it("does not stamp hosted_review_ready when preview_manifest exists without runtime evidence", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).not.toContain("hosted_review_ready_at");
  });

  it("stamps hosted_review_ready when preview_manifest and runtime access exist", () => {
    const arts = makeArtifacts(["preview_manifest_uri", "worldlabs_launch_url"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).toContain("hosted_review_ready_at");
  });

  it("does not stamp hosted_review_ready when preview_manifest lacks runtime access, even with a generated preview asset", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
      derivedAssets: {
        preview_simulation: {
          status: "generated",
          generated_at: "2026-04-11T00:00:00.000Z",
        },
      } as any,
    });
    expect(result.stampedThisSync).not.toContain("hosted_review_ready_at");
  });

  it("stamps artifact_handoff_delivered when handoff URI is available", () => {
    const arts = makeArtifacts(["opportunity_handoff_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).toContain("artifact_handoff_delivered_at");
  });

  it("does not re-stamp already stamped milestones", () => {
    const existing: ProofPathMilestones = {
      ...emptyProofPath(),
      proof_pack_delivered_at: "2026-04-01T00:00:00.000Z" as never,
    };
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "preview_manifest_uri",
    ]);
    const result = stampProofPathMilestones({
      currentProofPath: existing,
      artifacts: arts,
    });
    expect(result.stampedThisSync).not.toContain("proof_pack_delivered_at");
  });

  it("stamps hosted_review_follow_up_at when hosted_review_started and evaluation artifacts exist", () => {
    const arts = makeArtifacts([
      "preview_manifest_uri",
      "worldlabs_launch_url",
      "launch_gate_summary_uri",
    ]);
    const started: ProofPathMilestones = {
      ...emptyProofPath(),
      hosted_review_started_at: "2026-04-01T00:00:00.000Z" as never,
    };
    const result = stampProofPathMilestones({
      currentProofPath: started,
      artifacts: arts,
    });
    expect(result.stampedThisSync).toContain("hosted_review_follow_up_at");
  });

  it("does not stamp hosted_review_follow_up_at without hosted_review_started", () => {
    const arts = makeArtifacts(["launch_gate_summary_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).not.toContain("hosted_review_follow_up_at");
  });

  it("stamps human_commercial_handoff_at when opportunity_handoff_uri exists", () => {
    const arts = makeArtifacts(["opportunity_handoff_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).toContain("human_commercial_handoff_at");
  });

  it("stamps human_commercial_handoff_at when qualified_ready with launchable export", () => {
    const arts = makeArtifacts(["launchable_export_bundle_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
      qualificationState: "qualified_ready",
    });
    expect(result.stampedThisSync).toContain("human_commercial_handoff_at");
  });

  it("does not stamp human_commercial_handoff_at without handoff or export", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = stampProofPathMilestones({
      currentProofPath: emptyProofPath(),
      artifacts: arts,
    });
    expect(result.stampedThisSync).not.toContain("human_commercial_handoff_at");
  });
});

// ── growthEventsForStamps tests ──

describe("growthEventsForStamps", () => {
  it("maps proof_pack_delivered_at to proof_pack_delivered event", () => {
    expect(growthEventsForStamps(["proof_pack_delivered_at"])).toEqual(["proof_pack_delivered"]);
  });

  it("maps hosted_review_ready_at to hosted_review_ready event", () => {
    expect(growthEventsForStamps(["hosted_review_ready_at"])).toEqual(["hosted_review_ready"]);
  });

  it("maps hosted_review_started_at to hosted_review_started event", () => {
    expect(growthEventsForStamps(["hosted_review_started_at"])).toEqual(["hosted_review_started"]);
  });

  it("maps hosted_review_follow_up_at to hosted_review_follow_up_sent event", () => {
    expect(growthEventsForStamps(["hosted_review_follow_up_at"])).toEqual(["hosted_review_follow_up_sent"]);
  });

  it("maps human_commercial_handoff_at to human_commercial_handoff_started event", () => {
    expect(growthEventsForStamps(["human_commercial_handoff_at"])).toEqual(["human_commercial_handoff_started"]);
  });

  it("skips milestones with no event mapping", () => {
    expect(growthEventsForStamps(["qualified_inbound_at", "artifact_handoff_delivered_at"])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(growthEventsForStamps([])).toEqual([]);
  });
});

// ── computeOpsEnvelopeFromPipeline tests ──

describe("computeOpsEnvelopeFromPipeline", () => {
  it("defaults to awaiting pipeline artifacts when none exist", () => {
    const result = computeOpsEnvelopeFromPipeline({});
    expect(result.opsAutomation.next_action).toBe("await_pipeline_artifacts");
  });

  it("sets next_action to human_commercial_handoff when handoff URI exists", () => {
    const arts = makeArtifacts(["opportunity_handoff_uri"]);
    const result = computeOpsEnvelopeFromPipeline({ artifacts: arts });
    expect(result.opsAutomation.next_action).toBe("human_commercial_handoff");
  });

  it("marks hosted review queue when preview + launch_url exist", () => {
    const arts = makeArtifacts(["preview_manifest_uri", "worldlabs_launch_url"]);
    const result = computeOpsEnvelopeFromPipeline({ artifacts: arts });
    expect(result.opsAutomation.queue).toBe("exact_site_hosted_review_queue");
    expect(result.opsAutomation.requires_human_review).toBe(false);
  });

  it("sets rights_status to verified when rights report exists", () => {
    const arts = makeArtifacts(["rights_and_compliance_summary_uri"]);
    const result = computeOpsEnvelopeFromPipeline({ artifacts: arts });
    expect(result.rightsStatus).toBe("verified");
  });

  it("flags recapture when evaluation_readiness says so", () => {
    const result = computeOpsEnvelopeFromPipeline({
      evaluationReadiness: { recapture_required: true },
    });
    expect(result.recaptureRequired).toBe(true);
  });

  it("adds pipeline_synced tag when any artifacts present", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = computeOpsEnvelopeFromPipeline({ artifacts: arts });
    expect(result.opsAutomation.filter_tags).toContain("pipeline_synced");
  });
});

// ── enrichEvaluationReadinessFromArtifacts tests ──

describe("enrichEvaluationReadinessFromArtifacts", () => {
  it("sets native_world_model_status when worldlabs manifest exists", () => {
    const arts = makeArtifacts(["worldlabs_world_manifest_uri"]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.native_world_model_status).toBe("primary_ready");
    expect(enriched?.native_world_model_primary).toBe(true);
  });

  it("sets runtime_launchable when runtime_demo_manifest exists", () => {
    const arts = makeArtifacts(["runtime_demo_manifest_uri"]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.runtime_launchable).toBe(true);
  });

  it("blocks public ready state when the robot eval package is partial", () => {
    const arts = makeArtifacts([
      "robot_eval_dataset_manifest_uri",
      "robot_eval_site_card_uri",
    ]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);

    expect(enriched?.robot_eval_dataset_summary?.dataset_state).toBe(
      "publication_blocked_missing_robot_eval_package",
    );
    expect(enriched?.robot_eval_dataset_summary?.ready_to_evaluate_publishable).toBe(false);
    expect(enriched?.robot_eval_dataset_summary?.missing_required_artifacts).toEqual(
      expect.arrayContaining([
        "robot_eval_task_cards_uri",
        "robot_eval_scenario_cards_uri",
        "robot_eval_cards_uri",
        "robot_eval_task_thresholds_uri",
        "robot_eval_publication_readiness_uri",
      ]),
    );
  });

  it("keeps complete robot eval dataset artifacts advisory-only but publishable", () => {
    const arts = makeArtifacts([
      "robot_eval_dataset_manifest_uri",
      "robot_eval_site_card_uri",
      "robot_eval_task_cards_uri",
      "robot_eval_scenario_cards_uri",
      "robot_eval_cards_uri",
      "robot_eval_annotation_backlog_uri",
      "robot_eval_proof_boundaries_uri",
      "robot_rights_packet_uri",
      "robot_rights_ledger_uri",
      "robot_task_ontology_v1_uri",
      "robot_task_library_uri",
      "robot_scenario_family_library_uri",
      "robot_scoring_methodology_uri",
      "robot_eval_task_thresholds_uri",
      "robot_eval_publication_readiness_uri",
      "robot_eval_scene_asset_inspection_uri",
      "robot_eval_scene_frame_estimate_uri",
      "robot_eval_cpu_preflight_scorecard_uri",
      "robot_eval_episode_spec_manifest_uri",
      "robot_eval_cpu_simulator_preflight_manifest_uri",
      "recorded_trace_eval_report_uri",
      "policy_eval_report_uri",
      "robot_team_test_submission_modalities_uri",
      "prediction_outcome_ledger_uri",
      "prediction_vs_actual_summary_uri",
    ]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.robot_eval_dataset_summary?.dataset_state).toBe(
      "ready_to_evaluate_package_present"
    );
    expect(enriched?.robot_eval_dataset_summary?.ready_to_evaluate_publishable).toBe(true);
    expect(enriched?.robot_eval_dataset_summary?.publication_label).toBe(
      "Ready to evaluate",
    );
    expect(enriched?.robot_eval_dataset_summary?.missing_required_artifacts).toEqual([]);
    expect(enriched?.robot_eval_dataset_summary?.manifest_uri).toBe(
      "gs://test/robot_eval_dataset_manifest_uri.json"
    );
    expect(enriched?.robot_eval_dataset_summary?.site_card_count).toBe(1);
    expect(enriched?.robot_eval_dataset_summary?.card_artifact_uris).toEqual(
      expect.objectContaining({
        site_card_uri: "gs://test/robot_eval_site_card_uri.json",
        task_cards_uri: "gs://test/robot_eval_task_cards_uri.json",
        scenario_cards_uri: "gs://test/robot_eval_scenario_cards_uri.json",
        eval_cards_uri: "gs://test/robot_eval_cards_uri.json",
        proof_boundaries_uri: "gs://test/robot_eval_proof_boundaries_uri.json",
        rights_packet_uri: "gs://test/robot_rights_packet_uri.json",
        rights_ledger_uri: "gs://test/robot_rights_ledger_uri.json",
        task_ontology_v1_uri: "gs://test/robot_task_ontology_v1_uri.json",
        scenario_family_library_uri:
          "gs://test/robot_scenario_family_library_uri.json",
        scoring_methodology_uri: "gs://test/robot_scoring_methodology_uri.json",
        task_thresholds_uri: "gs://test/robot_eval_task_thresholds_uri.json",
        publication_readiness_uri:
          "gs://test/robot_eval_publication_readiness_uri.json",
        scene_asset_inspection_uri:
          "gs://test/robot_eval_scene_asset_inspection_uri.json",
        scene_frame_estimate_uri:
          "gs://test/robot_eval_scene_frame_estimate_uri.json",
        cpu_preflight_scorecard_uri:
          "gs://test/robot_eval_cpu_preflight_scorecard_uri.json",
        episode_spec_manifest_uri:
          "gs://test/robot_eval_episode_spec_manifest_uri.json",
        cpu_simulator_preflight_manifest_uri:
          "gs://test/robot_eval_cpu_simulator_preflight_manifest_uri.json",
        recorded_trace_eval_report_uri:
          "gs://test/recorded_trace_eval_report_uri.json",
        policy_eval_report_uri: "gs://test/policy_eval_report_uri.json",
        robot_team_test_submission_modalities_uri:
          "gs://test/robot_team_test_submission_modalities_uri.json",
        prediction_vs_actual_summary_uri:
          "gs://test/prediction_vs_actual_summary_uri.json",
      }),
    );
    expect(enriched?.runtime_launchable).toBeUndefined();
    expect(enriched?.runtime_registration_status).toBeUndefined();
    expect(enriched?.native_world_model_status).toBeUndefined();
    expect(enriched?.robot_eval_preflight_summary).toEqual(
      expect.objectContaining({
        status: "advisory_cpu_preflight_artifacts_present",
        scene_asset_preflight_status: "manifest_present",
        episode_spec_status: "manifest_present_review_required",
        cpu_simulator_preflight_status: "manifest_present_optional_smoke",
        cpu_preflight_scorecard_uri:
          "gs://test/robot_eval_cpu_preflight_scorecard_uri.json",
        episode_spec_manifest_uri:
          "gs://test/robot_eval_episode_spec_manifest_uri.json",
        cpu_simulator_preflight_manifest_uri:
          "gs://test/robot_eval_cpu_simulator_preflight_manifest_uri.json",
        ready_for_owner_gpu_preflight: false,
        local_cpu_preflight_smoke_ran: false,
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
        non_ranking_operational_claim_validated: false,
        public_claim_upgrade_allowed: false,
      }),
    );
  });

  it("preserves synced robot eval preflight blockers while keeping proof claims false", () => {
    const arts = makeArtifacts([
      "robot_eval_cpu_preflight_scorecard_uri",
      "robot_eval_episode_spec_manifest_uri",
      "robot_eval_cpu_simulator_preflight_manifest_uri",
    ]);
    const enriched = enrichEvaluationReadinessFromArtifacts(
      {
        robot_eval_preflight_summary: {
          scene_asset_preflight_status: "blocked",
          episode_spec_status: "compiled_review_required",
          cpu_simulator_preflight_status: "blocked_missing_optional_dependency",
          episode_count: 1,
          collider_backend_labels: ["isaac_usd_collision_unverified"],
          collider_backend_blockers: ["portable_collider_glb_missing"],
          install_instructions: [
            "python -m pip install mujoco",
            "python -m pip install pybullet",
          ],
          simulator_execution_proven: true,
          rank_fidelity_result_proven: true,
          non_ranking_operational_claim_validated: true,
          public_claim_upgrade_allowed: true,
        },
      },
      arts,
      undefined,
    );

    expect(enriched?.robot_eval_preflight_summary).toEqual(
      expect.objectContaining({
        scene_asset_preflight_status: "blocked",
        episode_spec_status: "compiled_review_required",
        cpu_simulator_preflight_status: "blocked_missing_optional_dependency",
        episode_count: 1,
        collider_backend_blockers: ["portable_collider_glb_missing"],
        install_instructions: [
          "python -m pip install mujoco",
          "python -m pip install pybullet",
        ],
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
        non_ranking_operational_claim_validated: false,
        public_claim_upgrade_allowed: false,
      }),
    );
  });

  it("syncs robot eval job status artifacts without upgrading proof claims", () => {
    const arts = makeArtifacts([
      "robot_eval_job_request_uri",
      "robot_eval_scheduler_decision_uri",
      "robot_eval_worker_launch_plan_uri",
      "robot_eval_worker_manifest_uri",
      "robot_eval_gpu_provider_launch_request_uri",
      "robot_eval_gpu_provider_launcher_result_uri",
      "robot_eval_runpod_provider_adapter_result_uri",
      "robot_eval_gpu_cost_control_ledger_uri",
      "robot_eval_startup_architecture_audit_uri",
      "robot_eval_worker_runtime_manifest_uri",
      "robot_eval_worker_runtime_preflight_uri",
      "robot_eval_job_run_manifest_uri",
      "robot_eval_job_proof_boundary_uri",
      "robot_eval_job_blocked_manifest_uri",
    ]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);

    expect(enriched?.robot_eval_job_summary).toEqual(
      expect.objectContaining({
        status: "advisory_job_artifacts_present",
        job_request_uri: "gs://test/robot_eval_job_request_uri.json",
        scheduler_decision_uri: "gs://test/robot_eval_scheduler_decision_uri.json",
        worker_launch_plan_uri: "gs://test/robot_eval_worker_launch_plan_uri.json",
        worker_manifest_uri: "gs://test/robot_eval_worker_manifest_uri.json",
        gpu_provider_launch_request_uri:
          "gs://test/robot_eval_gpu_provider_launch_request_uri.json",
        gpu_provider_launcher_result_uri:
          "gs://test/robot_eval_gpu_provider_launcher_result_uri.json",
        runpod_provider_adapter_result_uri:
          "gs://test/robot_eval_runpod_provider_adapter_result_uri.json",
        gpu_cost_control_ledger_uri:
          "gs://test/robot_eval_gpu_cost_control_ledger_uri.json",
        startup_architecture_audit_uri:
          "gs://test/robot_eval_startup_architecture_audit_uri.json",
        worker_runtime_manifest_uri:
          "gs://test/robot_eval_worker_runtime_manifest_uri.json",
        worker_runtime_preflight_uri:
          "gs://test/robot_eval_worker_runtime_preflight_uri.json",
        job_run_manifest_uri: "gs://test/robot_eval_job_run_manifest_uri.json",
        proof_boundary_uri: "gs://test/robot_eval_job_proof_boundary_uri.json",
        blocked_manifest_uri: "gs://test/robot_eval_job_blocked_manifest_uri.json",
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
        public_claim_upgrade_allowed: false,
      }),
    );
  });

  it("sets benchmark_coverage_status to ready when benchmark_suite exists", () => {
    const arts = makeArtifacts(["benchmark_suite_manifest_uri"]);
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.benchmark_coverage_status).toBe("ready");
  });

  it("sets preview_status to processing when sim is generating", () => {
    const derivedAssets = {
      preview_simulation: {
        status: "generating",
        manifest_uri: "gs://test/sim.json",
      },
      synced_at: "2026-04-05T00:00:00.000Z",
    };
    const enriched = enrichEvaluationReadinessFromArtifacts(undefined, undefined, derivedAssets);
    expect(enriched?.preview_status).toBe("processing");
  });

  it("returns current when no artifacts or derived assets provided", () => {
    const current = { qualification_state: "submitted" as const };
    expect(enrichEvaluationReadinessFromArtifacts(current, undefined, undefined)).toBe(current);
  });
});

// ── checkHostedReviewReadiness tests ──

describe("checkHostedReviewReadiness", () => {
  it("returns not ready when no artifacts exist", () => {
    const result = checkHostedReviewReadiness({});
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("returns ready when preview_manifest and launch_url exist", () => {
    const arts = makeArtifacts(["preview_manifest_uri", "worldlabs_launch_url"]);
    const result = checkHostedReviewReadiness({ artifacts: arts });
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("is not ready when only preview_manifest exists", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = checkHostedReviewReadiness({ artifacts: arts });
    expect(result.ready).toBe(false);
  });

  it("PIPE-02: not ready when rights_review_status is not cleared, even with previews", () => {
    const arts = makeArtifacts(["preview_manifest_uri", "worldlabs_launch_url"]);
    const result = checkHostedReviewReadiness({ artifacts: arts, rightsReviewStatus: "needs_review" });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("rights_review:needs_review");
  });

  it("PIPE-02: ready when previews exist and rights are cleared", () => {
    const arts = makeArtifacts(["preview_manifest_uri", "worldlabs_launch_url"]);
    const result = checkHostedReviewReadiness({ artifacts: arts, rightsReviewStatus: "cleared" });
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});

// ── computePipelineStateTransition integration tests ──

describe("computePipelineStateTransition", () => {
  it("produces a coherent transition for a fully-artifacted site", () => {
    const arts = makeArtifacts([
      "worldlabs_world_manifest_uri",
      "preview_manifest_uri",
      "worldlabs_launch_url",
      "runtime_demo_manifest_uri",
      "capture_quality_summary_uri",
      "rights_and_compliance_summary_uri",
      "launch_gate_summary_uri",
    ]);

    const transition = computePipelineStateTransition({
      artifacts: arts,
      authoritativeStateUpdate: false,
      currentProofPath: emptyProofPath(),
    });

    expect(transition.artifactCount.total).toBe(7);
    expect(transition.artifactCount.core).toBeGreaterThan(0);
    expect(transition.recommendedAction).toBeTruthy();
    expect(transition.qualificationState).toBeDefined();
    expect(transition.proofPathUpdate.proofPath).toBeDefined();
    expect(transition.opsUpdate.opsAutomation).toBeDefined();
  });

  it("respects authoritative_state_update when set", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: true,
      explicitQualificationState: "qa_passed",
      explicitOpportunityState: "handoff_ready",
      currentProofPath: emptyProofPath(),
    });

    expect(transition.qualificationState).toBe("qa_passed");
    expect(transition.opportunityState).toBe("handoff_ready");
  });

  it("infers state from artifacts when authoritative_state_update is false", () => {
    const arts = makeArtifacts(["opportunity_handoff_uri"]);
    const transition = computePipelineStateTransition({
      artifacts: arts,
      authoritativeStateUpdate: false,
      currentQualificationState: "submitted",
      currentProofPath: emptyProofPath(),
    });

    expect(transition.qualificationState).toBe("in_review");
    expect(transition.recommendedAction).toBe("commercial_handoff");
  });

  it("handles minimal pipeline with no artifacts gracefully", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: false,
      currentQualificationState: "submitted",
      currentProofPath: emptyProofPath(),
    });

    expect(transition.artifactCount.total).toBe(0);
    expect(transition.recommendedAction).toBe("await_initial_sync");
  });

  it("stamps proof_path milestones when conditions are met", () => {
    const arts = makeArtifacts([
      "preview_manifest_uri",
      "worldlabs_launch_url",
      "worldlabs_world_manifest_uri",
    ]);
    const transition = computePipelineStateTransition({
      artifacts: arts,
      authoritativeStateUpdate: false,
      currentProofPath: emptyProofPath(),
    });

    expect(transition.proofPathUpdate.stampedThisSync.length).toBeGreaterThan(0);
  });

  it("sets capture_policy_tier based on QA artifacts", () => {
    const arts = makeArtifacts([
      "capture_quality_summary_uri",
      "qualification_quality_report_uri",
    ]);
    const transition = computePipelineStateTransition({
      artifacts: arts,
      authoritativeStateUpdate: false,
      currentProofPath: emptyProofPath(),
    });

    expect(transition.opsUpdate.captureStatus).toBe("approved");
    expect(transition.opsUpdate.capturePolicyTier).toBe("approved_capture");
  });

  it("detects stall when qualification is needs_more_evidence", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: true,
      explicitQualificationState: "needs_more_evidence",
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(true);
    expect(transition.stallReason).toBe("needs_more_evidence");
  });

  it("detects stall when qualification is needs_refresh", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: true,
      explicitQualificationState: "needs_refresh",
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(true);
    expect(transition.stallReason).toBe("needs_refresh");
  });

  it("detects stall when qualification is not_ready_yet", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: true,
      explicitQualificationState: "not_ready_yet",
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(true);
    expect(transition.stallReason).toBe("not_ready_yet");
  });

  it("detects stall when recapture is required", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: false,
      evaluationReadiness: { recapture_required: true },
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(true);
    expect(transition.stallReason).toBe("recapture_required");
  });

  it("does not flag stall for qualified_ready", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: true,
      explicitQualificationState: "qualified_ready",
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(false);
    expect(transition.stallReason).toBeNull();
  });

  it("does not flag stall for submitted with no artifacts", () => {
    const transition = computePipelineStateTransition({
      authoritativeStateUpdate: false,
      currentQualificationState: "submitted",
      currentProofPath: emptyProofPath(),
    });
    expect(transition.proofMotionStalled).toBe(false);
  });
});
