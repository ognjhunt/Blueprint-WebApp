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
  enrichDeploymentReadinessFromArtifacts,
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

  it("flags recapture when deployment_readiness says so", () => {
    const result = computeOpsEnvelopeFromPipeline({
      deploymentReadiness: { recapture_required: true },
    });
    expect(result.recaptureRequired).toBe(true);
  });

  it("adds pipeline_synced tag when any artifacts present", () => {
    const arts = makeArtifacts(["preview_manifest_uri"]);
    const result = computeOpsEnvelopeFromPipeline({ artifacts: arts });
    expect(result.opsAutomation.filter_tags).toContain("pipeline_synced");
  });
});

// ── enrichDeploymentReadinessFromArtifacts tests ──

describe("enrichDeploymentReadinessFromArtifacts", () => {
  it("sets native_world_model_status when worldlabs manifest exists", () => {
    const arts = makeArtifacts(["worldlabs_world_manifest_uri"]);
    const enriched = enrichDeploymentReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.native_world_model_status).toBe("primary_ready");
    expect(enriched?.native_world_model_primary).toBe(true);
  });

  it("sets runtime_launchable when runtime_demo_manifest exists", () => {
    const arts = makeArtifacts(["runtime_demo_manifest_uri"]);
    const enriched = enrichDeploymentReadinessFromArtifacts(undefined, arts, undefined);
    expect(enriched?.runtime_launchable).toBe(true);
  });

  it("sets benchmark_coverage_status to ready when benchmark_suite exists", () => {
    const arts = makeArtifacts(["benchmark_suite_manifest_uri"]);
    const enriched = enrichDeploymentReadinessFromArtifacts(undefined, arts, undefined);
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
    const enriched = enrichDeploymentReadinessFromArtifacts(undefined, undefined, derivedAssets);
    expect(enriched?.preview_status).toBe("processing");
  });

  it("returns current when no artifacts or derived assets provided", () => {
    const current = { qualification_state: "submitted" as const };
    expect(enrichDeploymentReadinessFromArtifacts(current, undefined, undefined)).toBe(current);
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
});
