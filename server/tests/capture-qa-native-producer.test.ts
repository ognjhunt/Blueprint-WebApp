// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseVerifiedCaptureQaPublication } from "../utils/captureQaContract";
import { forwardCaptureUploadToPipeline } from "../utils/captureUploadForwarding";
import { canonicalArtifactDigest, stableJson } from "../utils/taskCandidateContract";

// Retained Pipeline45135 Library QA report. No source video, credentials or
// provider grant. Keep its scientific digest and producer numeric bytes intact.
const native = JSON.parse(readFileSync(
  new URL("./fixtures/native-monocular-capture-qa.json", import.meta.url), "utf8",
));
const sha = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

afterEach(() => vi.unstubAllGlobals());

describe("Pipeline-owned Capture QA producer bytes", () => {
  it("accepts the retained native report without reserializing its measurements", () => {
    expect(native.qa_report_digest).toBe("sha256:c3a4e214faa1f9a4fe89dc7ace27858ef6baa676045337e6d8592ca053a5fab6");
    expect(canonicalArtifactDigest(native.report, "qa_report_digest")).not.toBe(native.qa_report_digest);
    expect(sha(native.qa_report_canonical_json)).toBe(native.qa_report_digest);
    expect(parseVerifiedCaptureQaPublication(native)).toEqual({ ok: true, publication: native });
  });

  it("keeps the native report fail-closed when its original numeric bytes are absent", () => {
    const value = structuredClone(native);
    delete value.qa_report_canonical_json;
    expect(parseVerifiedCaptureQaPublication(value)).toEqual({
      ok: false, blockers: ["capture_qa_report_digest_mismatch"],
    });
  });

  it.each(["report", "bytes", "digest", "null-canonical"])("rejects altered %s", (kind) => {
    const value = structuredClone(native);
    if (kind === "report") value.report.checks[0].measurement = "fabricated";
    if (kind === "bytes") value.qa_report_canonical_json += " ";
    if (kind === "digest") value.report.qa_report_digest = `sha256:${"1".repeat(64)}`;
    if (kind === "null-canonical") value.qa_report_canonical_json = null;
    expect(parseVerifiedCaptureQaPublication(value).ok).toBe(false);
  });

  it("does not fall back to a matching legacy digest when supplied producer bytes are invalid", () => {
    const value = structuredClone(native);
    value.report.qa_report_digest = canonicalArtifactDigest(value.report, "qa_report_digest");
    value.qa_report_digest = value.report.qa_report_digest;
    expect(parseVerifiedCaptureQaPublication(value)).toEqual({
      ok: false, blockers: ["capture_qa_report_digest_mismatch"],
    });
  });

  it("still rejects a claim upgrade even when its producer bytes and digest agree", () => {
    const value = structuredClone(native);
    value.report.claim_ceiling.physical_task_success = true;
    const body = { ...value.report };
    delete body.qa_report_digest;
    value.qa_report_canonical_json = JSON.stringify(body);
    value.report.qa_report_digest = value.qa_report_digest = sha(value.qa_report_canonical_json);
    expect(parseVerifiedCaptureQaPublication(value)).toEqual({
      ok: false, blockers: ["capture_qa_claim_ceiling_upgrade_forbidden"],
    });
  });

  it("verifies forwarding and every binding with the real native QA report", async () => {
    // Transfer receipt is synthetic; the original native QA report is unchanged.
    const request = { intake_id: native.intake_id, capture_authority_profile: "monocular_video",
      original_file: { size_bytes: 12 } };
    const binding = { capture_session_id: native.capture_session_id, customer_id: "fixture-owner",
      organization_id: "fixture-org", request };
    const receipt = {
      schema_version: "capture_upload_intake_receipt.v1",
      capture_session_id: native.capture_session_id, intake_id: native.intake_id,
      request_digest: sha(stableJson(binding)), envelope_digest: native.envelope_digest,
      capture_digest: `sha256:${"3".repeat(64)}`, size_bytes: 12,
      admission_status: "accepted", state: "capture_accepted", claim_ceiling: native.report.claim_ceiling,
      artifact_reference: { uri: "intakes/fixture", envelope_digest: native.envelope_digest },
      malware_content_validation: { status: "passed", scanner: "fixture-scanner" },
      capture_qa_report: native.report, already_exists: true,
      proof_boundary: { server_sha256_verified: true, raw_input_content_addressed: true,
        capture_qa_completed: true, task_success_established: false,
        physical_task_success_established: false, deployment_or_safety_approved: false,
        comparative_policy_ranking_verdict: "thesis_not_supported" },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      schema_version: "capture_upload_processing_result.v1", receipt, capture_qa_publication: native,
    }), { status: 200 })));
    const result = await forwardCaptureUploadToPipeline({
      captureSessionId: native.capture_session_id, customerId: "fixture-owner", organizationId: "fixture-org",
      request, endpointUrl: "https://pipeline.invalid/fixture", token: "fixture-only",
      transfer: { provider: "backblaze", url: "https://storage.invalid/fixture",
        authorizationToken: "fixture-only", expiresAtIso: "2099-01-01T00:00:00Z" },
    });
    expect(result.status).toBe("forwarded");
    expect(result.receipt?.capture_qa_report.qa_report_digest).toBe(native.qa_report_digest);
    expect(result.captureQaPublication).toEqual(native);
  });
});
