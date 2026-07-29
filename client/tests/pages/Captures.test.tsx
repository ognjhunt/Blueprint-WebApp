import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Captures from "@/pages/app/Captures";
import type { CaptureUploadSession } from "@/lib/captureUploads";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
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
  };
});

const pendingSession: CaptureUploadSession = {
  schema_version: "capture_upload_session.v1",
  session_id: "capture-upload-1",
  intake_id: "intake-1",
  status: "uploading",
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
});
