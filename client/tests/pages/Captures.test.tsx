import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Captures from "@/pages/app/Captures";
import type { CaptureTaskReview, CaptureUploadSession } from "@/lib/captureUploads";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
  review: vi.fn(),
  decide: vi.fn(),
  lifecycle: vi.fn(),
  currentUser: {
    uid: "buyer-1",
    email: "buyer@example.com",
    displayName: "Buyer One",
    getIdToken: vi.fn(async () => "token-1"),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: state.currentUser,
    userData: { buyerType: "site_operator" },
    loading: false,
  }),
}));

vi.mock("@/lib/captureUploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/captureUploads")>();
  return {
    ...actual,
    listCaptureUploads: state.list,
    getCaptureUpload: state.get,
    createCaptureUpload: state.create,
    uploadCaptureFile: state.upload,
    getCaptureTaskReview: state.review,
    submitTaskDecisionCommand: state.decide,
    applyCompletedCaptureLifecycle: state.lifecycle,
  };
});

const pendingSession: CaptureUploadSession = {
  schema_version: "capture_upload_session.v1",
  session_id: "capture-upload-1",
  intake_id: "intake-1",
  status: "uploading",
  upload_status: "uploading",
  capture_authority_profile: "camera_360_equirectangular",
  source_type: "camera_360_equirectangular",
  scene_id: "warehouse-cell-a",
  original_filename: "warehouse-tour.mp4",
  size_bytes: 130 * 1024 * 1024,
  media_type: "video/mp4",
  part_size_bytes: 64 * 1024 * 1024,
  expected_part_count: 3,
  uploaded_parts: [
    { partNumber: 1, contentLength: 64 * 1024 * 1024, contentSha1: "a".repeat(40) },
  ],
  storage_uri: null,
  upload_validation: { status: "pending" },
  malware_content_validation: { status: "pending" },
  content_addressing: { status: "pending_server_sha256_verification" },
  pipeline_handoff: { status: "not_started", performed: false },
  completed_capture_lifecycle: { state: "active", lifecycle_complete: false },
  task_review: {
    status: "analysis_not_available",
    candidate_count: 0,
    latest_action: null,
  },
  claim_boundary: {
    capture_accepted: false,
    metric_scale_inherent: false,
    collision_geometry_established: false,
    physical_task_success_established: false,
    comparative_policy_ranking_verdict: "thesis_not_supported",
  },
  created_at_iso: "2026-07-29T20:00:00.000Z",
  updated_at_iso: "2026-07-29T20:01:00.000Z",
  error: null,
};

const taskReview: CaptureTaskReview = {
  schema_version: "capture_task_review.v1",
  session_id: "capture-upload-1",
  intake_id: "intake-1",
  status: "task_approval_required",
  discovery: {
    schema_version: "task_candidate_discovery.v1",
    discovery_id: "discovery-1",
    discovery_digest: `sha256:${"d".repeat(64)}`,
    source_capture: {
      intake_id: "intake-1",
      capture_digest: `sha256:${"a".repeat(64)}`,
      capture_authority_profile: "camera_360_equirectangular",
    },
    scene_analysis: {
      observed_site_facts: [{
        description: "A blue tote is visible on the table.",
      }],
      inferred_objects_and_affordances: [{
        description: "The tote may be graspable from its rim.",
      }],
      unsupported_or_occluded_regions: [{
        description: "The rear grasp surface is occluded.",
      }],
      hazards: [],
      privacy_sensitive_areas: [],
    },
    task_candidates: [{
      task_candidate_id: "task-candidate-1",
      candidate_digest: `sha256:${"c".repeat(64)}`,
      description: "Move the blue tote into the marked box.",
      observed_objects: [{ object_id: "tote-1", label: "blue tote" }],
      target_regions: [{ region_id: "box-1", label: "marked box" }],
      required_robot_capabilities: ["rigid-object grasp"],
      likely_task_family: "rigid_object_pick_place",
      proposed_measurable_success_condition: {
        metric: "object_center_distance",
        operator: "<=",
        threshold: 0.05,
        units: "m",
      },
      required_site_reset: "Return the tote to the table marker.",
      supporting_frames: ["frame-10"],
      supporting_3d_regions: ["region-table", "box-1"],
      confidence: 0.94,
      coverage: { task_object: 0.8 },
      assumptions: ["The tote is movable."],
      missing_evidence: ["Rear grasp surface is occluded."],
      prohibited_claims: ["physical_task_success"],
      estimated_evaluation_cost_usd: 2.5,
      expected_customer_value: null,
      approval_status: "approval_required",
    }],
    approval_state: "task_approval_required",
    claim_boundaries: {
      candidate_is_customer_intent: false,
      candidate_is_task_success_evidence: false,
      generated_or_inferred_content_upgrades_capture_authority: false,
    },
  },
  latest_decision_command: null,
  claim_boundary: {
    webapp_command_is_pipeline_approval: false,
    decision_evidence_request_compiled: false,
    task_success_established: false,
  },
};

describe("app/Captures", () => {
  beforeEach(() => {
    state.list.mockReset();
    state.list.mockResolvedValue({ sessions: [pendingSession] });
    state.get.mockReset();
    state.get.mockResolvedValue(pendingSession);
    state.create.mockReset();
    state.upload.mockReset();
    state.review.mockReset();
    state.review.mockResolvedValue(taskReview);
    state.decide.mockReset();
    state.lifecycle.mockReset();
    state.lifecycle.mockResolvedValue({
      schema_version: "completed_capture_lifecycle_inspection.v1",
      session_id: "capture-upload-1",
      intake_id: "intake-1",
      state: "revoked",
      lifecycle_complete: true,
    });
    state.decide.mockResolvedValue({
      schema_version: "task_candidate_decision_command_receipt.v1",
      command_request_id: "task-command-1",
      capture_session_id: "capture-upload-1",
      discovery_digest: taskReview.discovery!.discovery_digest,
      task_candidate_id: "task-candidate-1",
      candidate_digest: `sha256:${"c".repeat(64)}`,
      action: "approve",
      rationale: "This is our exact task.",
      edited_task: null,
      pipeline_approval_status: "pending_pipeline_validation",
      pipeline_task_decision: null,
      approved_task_definition: null,
      decision_evidence_request: null,
      pipeline_result_proof_boundary: null,
      created_at_iso: "2026-07-29T20:02:00.000Z",
    });
  });

  it("renders one coherent capture entry, honest proof boundaries, and owner history", async () => {
    render(<Captures />);

    expect(screen.getByRole("heading", { level: 1, name: "New Capture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Captures" })).toHaveAttribute("href", "/app/captures");
    expect(screen.getByText("What upload completion means")).toBeInTheDocument();
    expect(screen.getByText(/Upload completion is not capture acceptance/i)).toBeInTheDocument();
    expect(screen.getByText(/advisory hints, not reconstruction or task-success claims/i)).toBeInTheDocument();
    expect(await screen.findByText("warehouse-tour.mp4")).toBeInTheDocument();
    expect(screen.getByText("Upload in progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Capture file")).toHaveAttribute(
      "accept",
      ".mp4,.mov,video/mp4,video/quicktime",
    );
    expect(screen.getByRole("button", { name: "Start secure upload" })).toBeDisabled();
  });

  it("shows the reduced authority of ordinary video and an exact resumable file requirement", async () => {
    render(<Captures />);
    expect(await screen.findByText("warehouse-tour.mp4")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Capture type"), {
      target: { value: "monocular_video" },
    });
    expect(screen.getByText(/no inherent scale, poses, depth, collision truth, or physical outcome/i)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" &&
      Boolean(element.textContent?.includes("Reselect exactly warehouse-tour.mp4")) &&
      Boolean(element.textContent?.includes("Stored parts are checked against the reselected file")),
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume upload" })).toBeDisabled();
  });

  it("renders Pipeline-authored candidates and records approval as pending Pipeline validation", async () => {
    state.list.mockResolvedValue({
      sessions: [{
        ...pendingSession,
        status: "uploaded_verification_pending",
        task_review: {
          status: "task_approval_required",
          candidate_count: 1,
          latest_action: null,
        },
      }],
    });
    render(<Captures />);

    fireEvent.click(await screen.findByRole("button", { name: "Review tasks" }));
    expect(await screen.findByRole("heading", { name: "Review proposed tasks" })).toBeInTheDocument();
    expect(screen.getByText("Direct observations")).toBeInTheDocument();
    expect(screen.getByText("A blue tote is visible on the table.")).toBeInTheDocument();
    expect(screen.getByText("Inferred objects and affordances")).toBeInTheDocument();
    expect(screen.getByText(/WebApp records your exact command and digest binding/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve candidate" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Why this task is correct/i), {
      target: { value: "This is our exact task." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve candidate" }));
    await waitFor(() => expect(state.decide).toHaveBeenCalledWith(
      state.currentUser,
      "capture-upload-1",
      expect.objectContaining({
        discovery_digest: taskReview.discovery!.discovery_digest,
        task_candidate_id: "task-candidate-1",
        candidate_digest: `sha256:${"c".repeat(64)}`,
        action: "approve",
        rationale: "This is our exact task.",
        edited_task: null,
        idempotency_key: expect.stringMatching(/^web-task-decision-/),
      }),
    ));
  });

  it("requires explicit confirmation before requesting completed-capture deletion", async () => {
    state.list.mockResolvedValue({
      sessions: [{
        ...pendingSession,
        status: "capture_accepted",
        upload_status: "uploaded_verification_pending",
        pipeline_handoff: { status: "forwarded", performed: true },
        completed_capture_lifecycle: { state: "active", lifecycle_complete: false },
      }],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Captures />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete capture" }));
    await waitFor(() => expect(state.lifecycle).toHaveBeenCalledWith(
      state.currentUser,
      "capture-upload-1",
      "operator_deletion_request",
      "web-delete-capture-upload-1",
    ));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Permanently delete"));
    confirm.mockRestore();
  });
});
