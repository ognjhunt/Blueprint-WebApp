import { crossRuntimeDigest } from "../../utils/crossRuntimeCanonical";
export function ownerClosure(requestId = "req1", captureId = `walkthrough-${requestId}`) {
  const value = { schema_version: "website_run_closure.v1", request_id: requestId, capture_id: captureId,
    decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: `sha256:${"a".repeat(64)}`,
    closed_at_iso: "2026-10-28T04:48:00.000Z", new_execution_authorized: false, explicit_resume_required: true,
    physical_validation: false };
  return { ...value, closure_digest: crossRuntimeDigest(value) };
}
