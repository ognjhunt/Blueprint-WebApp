import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Captures from "@/pages/app/Captures";
import type { CaptureUploadSession } from "@/lib/captureUploads";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
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


describe("app/Captures", () => {
  beforeEach(() => {
    state.list.mockReset();
    state.list.mockResolvedValue({ sessions: [pendingSession] });
    state.get.mockReset();
    state.get.mockResolvedValue(pendingSession);
    state.create.mockReset();
    state.upload.mockReset();
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
  });

  it("starts with the capture list; the upload form, optional details, and tips are one click away", async () => {
    render(<Captures />);

    expect(screen.getByRole("heading", { level: 1, name: "Captures" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your jobs", exact: true })).toHaveAttribute("href", "/app");
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
      target: { files: [new File([], "empty.mp4", { type: "video/mp4" })] },
    });
    const upload = screen.getByRole("button", { name: "Upload" });
    expect(upload).toBeEnabled();
    // Submit the form directly; the DOM double doesn't run native file-input validation.
    fireEvent.submit(upload.closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The file is empty or larger than 50 GB.");
    expect(alert.closest("form")).not.toBeNull();
    expect(alert).not.toHaveTextContent(/Reload the page/);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("admits a short video to the existing rights checks before any upload", async () => {
    render(<Captures />);
    fireEvent.click(await screen.findByRole("button", { name: "Upload a capture" }));
    fireEvent.change(screen.getByLabelText("Scene ID"), { target: { value: "packing-line-a" } });
    fireEvent.change(screen.getByLabelText("Capture file"), {
      target: { files: [new File(["x"], "short.mp4", { type: "video/mp4" })] },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Upload" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirm the rights and consent statements before uploading.");
    expect(state.create).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
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
    render(<Captures />);

    expect(await screen.findByText("Capture accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Plan the 3D scene" }));
    await waitFor(() => expect(state.reconstructionPlan).toHaveBeenCalledWith(
      state.currentUser,
      "capture-upload-1",
      ["perception_visibility", "reachability"],
      "web-reconstruction-plan-capture-upload-1",
    ));
  });
});

it("opens an existing job's native capture form with its visible site scene ID", async () => {
  state.create.mockClear();
  state.list.mockResolvedValue({ sessions: [] });
  const previous = window.location.href;
  window.history.replaceState({}, "", "/app/captures?jobId=job-1");
  try {
    render(<Captures />);
    expect(await screen.findByLabelText("Scene ID")).toHaveValue("site-job-1");
    expect(state.create).not.toHaveBeenCalled();
  } finally { window.history.replaceState({}, "", previous); }
});
