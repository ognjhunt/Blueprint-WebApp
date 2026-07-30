// @vitest-environment node
import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyCompletedCaptureLifecycleToPipeline,
  inspectCompletedCaptureLifecycleInPipeline,
  recordCaptureExternalRevocationEvidenceInPipeline,
} from "../utils/captureLifecycleForwarding";

const captureDigest = `sha256:${"1".repeat(64)}`;
const envelopeDigest = `sha256:${"2".repeat(64)}`;
const tombstoneDigest = `sha256:${"3".repeat(64)}`;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID;
});

describe("completed capture lifecycle forwarding", () => {
  it("derives the Pipeline base, signs the exact body, and validates the tombstone binding", async () => {
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL =
      "https://pipeline.example/api/live-pipeline/capture-upload-intakes";
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN = "lifecycle-secret";
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID = "blueprint-webapp";
    const fetch = vi.fn(async () => jsonResponse({
      schema_version: "capture_lifecycle_tombstone.v1",
      capture_digest: captureDigest,
      envelope_digest: envelopeDigest,
      action: "consent_revoked",
      tombstone_digest: tombstoneDigest,
      serve_allowed: false,
      future_processing_allowed: false,
      local_payload_deletion_complete: true,
      external_revocation_complete: false,
    }));
    vi.stubGlobal("fetch", fetch);

    const result = await applyCompletedCaptureLifecycleToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      captureDigest,
      envelopeDigest,
      action: "consent_revoked",
      idempotencyKey: "lifecycle-command-1",
    });

    expect(result.status).toBe("forwarded");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://pipeline.example/api/live-pipeline/capture-upload-intakes/capture-session-1/intake-1/lifecycle",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    expect(headers["x-blueprint-pipeline-signature"]).toBe(
      `sha256=${createHmac("sha256", "lifecycle-secret")
        .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${body}`)
        .digest("hex")}`,
    );
    expect(JSON.parse(body)).toMatchObject({
      schema_version: "capture_lifecycle_submission.v1",
      capture_digest: captureDigest,
      envelope_digest: envelopeDigest,
      action: "consent_revoked",
    });
  });

  it("fails closed on a mismatched tombstone and on missing configuration", async () => {
    process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL =
      "https://pipeline.example/api/live-pipeline";
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN = "lifecycle-secret";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      schema_version: "capture_lifecycle_tombstone.v1",
      capture_digest: `sha256:${"9".repeat(64)}`,
      envelope_digest: envelopeDigest,
      action: "operator_deletion_request",
      tombstone_digest: tombstoneDigest,
      serve_allowed: false,
      future_processing_allowed: false,
      local_payload_deletion_complete: true,
      external_revocation_complete: false,
    })));
    const mismatch = await applyCompletedCaptureLifecycleToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      captureDigest,
      envelopeDigest,
      action: "operator_deletion_request",
      idempotencyKey: "lifecycle-command-2",
    });
    expect(mismatch).toMatchObject({
      status: "failed",
      performed: false,
      blocker: "pipeline_capture_lifecycle_binding_mismatch",
    });

    delete process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL;
    delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
    const missing = await inspectCompletedCaptureLifecycleInPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
    });
    expect(missing).toMatchObject({
      status: "not_configured",
      performed: false,
      blocker: "capture_lifecycle_pipeline_base_url_missing",
    });
  });

  it("records only one of the exact external revocation actions", async () => {
    process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL =
      "https://pipeline.example/api/live-pipeline";
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN = "lifecycle-secret";
    const receiptDigest = `sha256:${"4".repeat(64)}`;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      schema_version: "capture_external_revocation_evidence.v1",
      tombstone_digest: tombstoneDigest,
      action: "disable_signed_download_access",
      target_system: "capture-object-store",
      receipt_digest: receiptDigest,
      external_revocation_evidence_digest: `sha256:${"5".repeat(64)}`,
    })));
    const result = await recordCaptureExternalRevocationEvidenceInPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      action: "disable_signed_download_access",
      targetSystem: "capture-object-store",
      receiptDigest,
      completedAt: "2026-07-30T12:00:00.000Z",
      verificationMethod: "storage_access_revocation_receipt",
      idempotencyKey: "external-evidence-1",
    });
    expect(result.status).toBe("forwarded");
    expect(result.value).toMatchObject({
      action: "disable_signed_download_access",
      receipt_digest: receiptDigest,
    });
  });
});
