import { createHash } from "node:crypto";

import type { User as FirebaseUser } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  uploadCaptureFile,
  type CaptureUploadSession,
} from "@/lib/captureUploads";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "csrf-test",
  }),
}));

vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (
    _currentUser: FirebaseUser,
    headers: Record<string, string> = {},
  ) => ({ ...headers, Authorization: "Bearer firebase-test" }),
}));

const session: CaptureUploadSession = {
  schema_version: "capture_upload_session.v1",
  session_id: "capture-upload-1",
  intake_id: "intake-1",
  status: "upload_pending",
  capture_authority_profile: "monocular_video",
  source_type: "monocular_video",
  scene_id: "scene-1",
  original_filename: "capture.mp4",
  size_bytes: 4,
  media_type: "video/mp4",
  part_size_bytes: 4,
  expected_part_count: 1,
  uploaded_parts: [],
  storage_uri: null,
  upload_validation: { status: "pending" },
  malware_content_validation: { status: "pending" },
  content_addressing: { status: "pending_server_sha256_verification" },
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
  updated_at_iso: "2026-07-29T20:00:00.000Z",
  error: null,
};

describe("capture upload client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async (_algorithm: string, value: ArrayBuffer) => {
          const bytes = createHash("sha1").update(Buffer.from(value)).digest();
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes part authorization and retries a transient network failure", async () => {
    let authorizationCount = 0;
    let directUploadCount = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/parts/1/authorize")) {
        authorizationCount += 1;
        return new Response(JSON.stringify({
          session_id: session.session_id,
          part_number: 1,
          upload_url: "https://upload.example/part",
          authorization_token: `part-token-${authorizationCount}`,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "https://upload.example/part") {
        directUploadCount += 1;
        if (directUploadCount === 1) throw new TypeError("temporary network failure");
        return new Response("", { status: 200 });
      }
      if (url.endsWith("/complete")) {
        return new Response(JSON.stringify({
          ...session,
          status: "uploaded_verification_pending",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const completed = await uploadCaptureFile({
      currentUser: { uid: "buyer-1" } as FirebaseUser,
      session,
      file: new File([new Uint8Array([1, 2, 3, 4])], "capture.mp4", { type: "video/mp4" }),
    });

    expect(completed.status).toBe("uploaded_verification_pending");
    expect(authorizationCount).toBe(2);
    expect(directUploadCount).toBe(2);
    const directCalls = fetchMock.mock.calls.filter(([input]) => String(input) === "https://upload.example/part");
    expect(directCalls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "part-token-2" }),
    });
  });
});
