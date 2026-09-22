import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Captures from "@/pages/app/Captures";
import type { CaptureTaskReview, CaptureUploadSession } from "@/lib/captureUploads";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
  review: vi.fn(),
  qa: vi.fn(),
  decide: vi.fn(),
  lifecycle: vi.fn(),
  reconstructionPlan: vi.fn(),
  reconstructionAuthorization: vi.fn(),
  reconstructionExecution: vi.fn(),
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
    apiRequest: vi.fn(async (_user, path) => path.endsWith("/sources") ? { sources: [] } : { intakes: [] }),
    listCaptureUploads: state.list,
    getCaptureUpload: state.get,
    createCaptureUpload: state.create,
    uploadCaptureFile: state.upload,
    getCaptureTaskReview: state.review,
    getCaptureQa: state.qa,
    submitTaskDecisionCommand: state.decide,
    applyCompletedCaptureLifecycle: state.lifecycle,
    planCaptureReconstruction: state.reconstructionPlan,
    authorizeCaptureReconstruction: state.reconstructionAuthorization,
    executeCaptureReconstruction: state.reconstructionExecution,
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
  reconstruction: { state: "not_planned" },
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
    state.qa.mockReset();
    state.decide.mockReset();
    state.lifecycle.mockReset();
    state.lifecycle.mockResolvedValue({
      schema_version: "completed_capture_lifecycle_inspection.v1",
      session_id: "capture-upload-1",
      intake_id: "intake-1",
      state: "revoked",
      lifecycle_complete: true,
    });
    state.reconstructionPlan.mockReset();
    state.reconstructionPlan.mockResolvedValue({ status: "authorization_required" });
    state.reconstructionAuthorization.mockReset();
    state.reconstructionExecution.mockReset();
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

  it("starts with the capture list; the upload form, optional details, and tips are one click away", async () => {
    render(<Captures />);

    expect(screen.getByRole("heading", { level: 1, name: "Captures" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks", exact: true })).toHaveAttribute("href", "/app/tasks");
    expect(await screen.findByText("warehouse-tour.mp4")).toBeInTheDocument();
    expect(screen.getByText("Upload not finished")).toBeInTheDocument();
    expect(screen.queryByLabelText("Capture file")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload a capture" }));
    expect(screen.getByLabelText("Capture file")).toHaveAttribute(
      "accept",
      ".mp4,.mov,video/mp4,video/quicktime",
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getAllByText(/Uploading isn't acceptance/)).toHaveLength(1);
    const optional = screen.getByText("Optional details", { selector: "summary" }).closest("details")!;
    expect(optional.open).toBe(false);
    expect(within(optional).getByLabelText("Camera manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Capture tips", { selector: "summary" }).closest("details")!.open).toBe(false);

    // The expert evaluation request is closed until someone asks for it.
    const evaluation = screen.getByText("Request an evaluation on a completed scene", { selector: "summary" }).closest("details")!;
    expect(evaluation.open).toBe(false);
    expect(screen.queryByText(/thesis_not_supported|What upload completion means|advisory hints/i)).not.toBeInTheDocument();
  });

  it("shows the reduced authority of ordinary video and resumes with the exact file", async () => {
    render(<Captures />);
    fireEvent.click(await screen.findByRole("button", { name: "Upload a capture" }));
    fireEvent.change(screen.getByLabelText("Capture type"), {
      target: { value: "monocular_video" },
    });
    expect(screen.getByText(/It has no built-in scale or depth/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume upload" }));
    expect(screen.getByRole("heading", { name: "Resume your upload" })).toBeInTheDocument();
    expect(screen.getByText(/Choose warehouse-tour\.mp4 \(.+ bytes\) again to resume/)).toBeInTheDocument();
    const submit = screen.getAllByRole("button", { name: "Resume upload" }).find((button) => button.getAttribute("type") === "submit");
    expect(submit).toBeDisabled();
  });

  it("shows an upload problem inside the form, without a reload hint", async () => {
    render(<Captures />);
    fireEvent.click(await screen.findByRole("button", { name: "Upload a capture" }));
    fireEvent.change(screen.getByLabelText("Scene ID"), { target: { value: "packing-line-a" } });
    fireEvent.change(screen.getByLabelText("Capture file"), {
      target: { files: [new File(["x"], "tiny.mp4", { type: "video/mp4" })] },
    });
    const upload = screen.getByRole("button", { name: "Upload" });
    expect(upload).toBeEnabled();
    // Submit the form directly; the DOM double doesn't run native file-input validation.
    fireEvent.submit(upload.closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Videos must be larger than 5 MB and no larger than 50 GB.");
    expect(alert.closest("form")).not.toBeNull();
    expect(alert).not.toHaveTextContent(/Reload the page/);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("opens one capture on its own and records a task approval as pending", async () => {
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
    state.review
      .mockResolvedValueOnce(taskReview)
      .mockResolvedValueOnce({
        ...taskReview,
        status: "decision_pending_pipeline_validation",
        latest_decision_command: { action: "approve" } as unknown as CaptureTaskReview["latest_decision_command"],
      });
    render(<Captures />);

    expect(await screen.findByText("Review the proposed tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("heading", { name: "Proposed tasks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "warehouse-tour.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← All captures" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your captures" })).not.toBeInTheDocument();

    // The real-world boundary is stated once for the whole capture, in plain words.
    expect(screen.getAllByText(/None of it shows a robot can do the task in the real world/)).toHaveLength(1);
    expect(screen.queryByText(/physical_task_success|thesis_not_supported|WebApp records/)).not.toBeInTheDocument();
    const seen = screen.getByText("What Blueprint saw in the capture", { selector: "summary" }).closest("details")!;
    expect(seen.open).toBe(false);
    expect(within(seen).getByText("A blue tote is visible on the table.")).toBeInTheDocument();

    const approve = screen.getByRole("button", { name: "Approve this task" });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Why"), {
      target: { value: "This is our exact task." },
    });
    fireEvent.click(approve);
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
    expect(await screen.findByText(/Your decision \(approve\) is recorded and being checked/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← All captures" }));
    expect(screen.getByRole("heading", { name: "Your captures" })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete capture" }));
    await waitFor(() => expect(state.lifecycle).toHaveBeenCalledWith(
      state.currentUser,
      "capture-upload-1",
      "operator_deletion_request",
      "web-delete-capture-upload-1",
    ));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Permanently delete"));
    expect(await screen.findByRole("heading", { level: 1, name: "Captures" })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows the capture check and plans the 3D scene without selecting a provider", async () => {
    state.list.mockResolvedValue({
      sessions: [{
        ...pendingSession,
        status: "capture_accepted",
        upload_status: "uploaded_verification_pending",
        pipeline_handoff: { status: "forwarded", performed: true },
        capture_qa: {
          state: "capture_accepted",
          status: "accepted",
          qa_report_digest: `sha256:${"a".repeat(64)}`,
          recapture_plan: [],
          missing_evidence: [],
          next_cheapest_experiment: null,
          proof_boundary: {
            qa_is_task_success: false,
            qa_is_physical_success: false,
            deployment_or_safety_approved: false,
            comparative_policy_ranking_verdict: "thesis_not_supported",
          },
        },
        reconstruction: { state: "not_planned" },
      }],
    });
    state.qa.mockResolvedValue({
      schema_version: "capture_qa_inspection.v1",
      session_id: "capture-upload-1",
      intake_id: "intake-1",
      status: "accepted",
      state: "capture_accepted",
      publication: {
        qa_report_digest: `sha256:${"a".repeat(64)}`,
        report: { checks: [], recapture_plan: [], missing_evidence: [], next_cheapest_experiment: null, claim_ceiling: {} },
      },
    });
    render(<Captures />);

    expect(await screen.findByText("Capture accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("heading", { name: "Capture check" })).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Plan the 3D scene" }));
    await waitFor(() => expect(state.reconstructionPlan).toHaveBeenCalledWith(
      state.currentUser,
      "capture-upload-1",
      ["perception_visibility", "reachability"],
      "web-reconstruction-plan-capture-upload-1",
    ));
  });
});
