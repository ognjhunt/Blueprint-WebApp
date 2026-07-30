// @vitest-environment node
import { createHash, createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardCaptureUploadToPipeline } from "../utils/captureUploadForwarding";
import { canonicalArtifactDigest, stableJson } from "../utils/taskCandidateContract";

const request = {
  schema_version: "capture_upload_session_request.v1",
  intake_id: "intake-1",
  idempotency_key: "org-1-upload-1",
  capture_authority_profile: "monocular_video",
  source_type: "monocular_video",
  scene_id: "scene-1",
  original_file: {
    original_filename: "capture.mp4",
    size_bytes: 12,
    media_type: "video/mp4",
  },
};

function sha(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function receipt(overrides: Record<string, unknown> = {}) {
  const requestDigest = sha({
    capture_session_id: "capture-session-1",
    customer_id: "buyer-1",
    organization_id: "org-1",
    request,
  });
  const report: Record<string, any> = {
    schema_version: "capture_qa_report.v1",
    intake_id: "intake-1",
    envelope_digest: `sha256:${"2".repeat(64)}`,
    capture_authority_profile: "monocular_video",
    status: "accepted",
    state: "capture_accepted",
    checks: [],
    recapture_plan: [],
    missing_evidence: ["metric_scale"],
    required_analysis: [],
    next_cheapest_experiment: null,
    quality_observations_digest: null,
    quality_analysis_errors: [],
    claim_ceiling: {
      physical_task_success: false,
      deployment_readiness: false,
      safety_certification: false,
    },
    prohibited_claims: ["physical_task_success"],
    comparative_policy_ranking_verdict: "thesis_not_supported",
  };
  report.qa_report_digest = canonicalArtifactDigest(report, "qa_report_digest");
  return {
    schema_version: "capture_upload_intake_receipt.v1",
    capture_session_id: "capture-session-1",
    intake_id: "intake-1",
    request_digest: requestDigest,
    envelope_digest: `sha256:${"2".repeat(64)}`,
    capture_digest: `sha256:${"3".repeat(64)}`,
    size_bytes: 12,
    admission_status: "accepted",
    state: "capture_accepted",
    claim_ceiling: { physical_task_success: false },
    artifact_reference: {
      uri: "intakes/intake-1/fixture",
      envelope_digest: `sha256:${"2".repeat(64)}`,
    },
    malware_content_validation: { status: "passed", scanner: "clamdscan" },
    capture_qa_report: report,
    already_exists: false,
    proof_boundary: {
      server_sha256_verified: true,
      raw_input_content_addressed: true,
      capture_qa_completed: true,
      task_success_established: false,
      physical_task_success_established: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
    ...overrides,
  };
}

function processingResult(receiptOverrides: Record<string, unknown> = {}) {
  const value = receipt(receiptOverrides) as Record<string, any>;
  return {
    schema_version: "capture_upload_processing_result.v1",
    receipt: value,
    capture_qa_publication: {
      schema_version: "capture_qa_publication.v1",
      capture_session_id: value.capture_session_id,
      intake_id: value.intake_id,
      capture_authority_profile: "monocular_video",
      envelope_digest: value.envelope_digest,
      qa_report_digest: value.capture_qa_report.qa_report_digest,
      status: "accepted",
      state: "capture_accepted",
      report: value.capture_qa_report,
      proof_boundary: {
        qa_is_task_success: false,
        qa_is_physical_success: false,
        deployment_or_safety_approved: false,
        comparative_policy_ranking_verdict: "thesis_not_supported",
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_REQUIRED;
});

describe("Capture upload Pipeline forwarding", () => {
  it("signs the ephemeral transfer, validates the exact receipt, and returns no grant", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = String(init.body);
      const headers = init.headers as Record<string, string>;
      const expected = createHmac("sha256", "forward-secret")
        .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${body}`)
        .digest("hex");
      expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
      expect(JSON.parse(body)).toMatchObject({
        schema_version: "capture_upload_transfer_submission.v1",
        capture_session_id: "capture-session-1",
        transfer: {
          provider: "backblaze",
          authorization: "ephemeral-download-grant",
        },
      });
      return new Response(JSON.stringify(processingResult()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await forwardCaptureUploadToPipeline({
      captureSessionId: "capture-session-1",
      customerId: "buyer-1",
      organizationId: "org-1",
      request,
      transfer: {
        provider: "backblaze",
        url: "https://download.example.test/file/capture.mp4",
        authorizationToken: "ephemeral-download-grant",
        expiresAtIso: "2026-07-30T12:00:00.000Z",
      },
      endpointUrl: "https://pipeline.example.test/capture-upload-intakes",
      token: "forward-secret",
    });

    expect(result.status).toBe("forwarded");
    expect(result.receipt?.capture_digest).toBe(`sha256:${"3".repeat(64)}`);
    expect(result.captureQaPublication?.status).toBe("accepted");
    expect(JSON.stringify(result)).not.toContain("ephemeral-download-grant");
    expect(JSON.stringify(result)).not.toContain("download.example.test");
  });

  it("fails closed on a receipt bound to another request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(processingResult({
      request_digest: `sha256:${"9".repeat(64)}`,
    })), { status: 200 })));
    const result = await forwardCaptureUploadToPipeline({
      captureSessionId: "capture-session-1",
      customerId: "buyer-1",
      organizationId: "org-1",
      request,
      transfer: {
        provider: "backblaze",
        url: "https://download.example.test/file/capture.mp4",
        authorizationToken: "ephemeral-download-grant",
        expiresAtIso: "2026-07-30T12:00:00.000Z",
      },
      endpointUrl: "https://pipeline.example.test/capture-upload-intakes",
      token: "forward-secret",
    });
    expect(result).toMatchObject({
      status: "failed",
      performed: false,
      blocker: "pipeline_capture_upload_receipt_binding_mismatch",
    });
  });

  it("does not perform a provider transfer when the Pipeline endpoint is absent", async () => {
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_REQUIRED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await forwardCaptureUploadToPipeline({
      captureSessionId: "capture-session-1",
      customerId: "buyer-1",
      organizationId: "org-1",
      request,
      transfer: {
        provider: "backblaze",
        url: "https://download.example.test/file/capture.mp4",
        authorizationToken: "ephemeral-download-grant",
        expiresAtIso: "2026-07-30T12:00:00.000Z",
      },
    });
    expect(result).toMatchObject({
      status: "not_configured",
      performed: false,
      required: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
