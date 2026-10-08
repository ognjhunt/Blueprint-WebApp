import { humanDecisionDigest } from "./human-reply-admission";

const fields = ["buyerType", "taskDescription", "whatGoesWrong", "taskStatement", "details", "operatingConstraints",
  "siteTaskSpec", "siteTaskGates", "siteLocation", "siteLocationMetadata", "capture_region"];
export function inferenceProgrammeContextDigest(raw: Record<string, any>, brief: unknown) {
  return humanDecisionDigest({ request: Object.fromEntries(fields.map(key => [key, raw.request?.[key] ?? null])), brief: brief ?? null });
}
export function hasInferenceProgramme(raw: Record<string, any> | undefined) {
  return !!raw && Object.prototype.hasOwnProperty.call(raw, "inference_program_id");
}
export function inferenceProgrammeId(raw: Record<string, any>) {
  if (typeof raw.inference_program_id !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(raw.inference_program_id))
    throw new Error("inference_programme_authority_invalid");
  return raw.inference_program_id as string;
}

/** Historical programme identities remain portable provenance, never spending admission. */
export type AssessmentRecovery = {
  schema_version: "site_assessment_recovery.v1" | "site_assessment_recovery.v2"; retry_identity: string; job_id: string;
  request_id: string; capture_id: string; previous_run_id: string; previous_claim_id: string; new_run_id: string;
  source_key: string; source_digest: string; context_digest: string; advisory_context_digest: string;
  video_sha256: string; programme_id: string; authority_digest: string;
  slot_id: string; admission_token: string; provider: "openai" | "gemini"; model: string;
  reserved_micro_usd: number; reserved_call_micro_usd: number;
  capture_calls: number; capture_exposure_usd: number; created_at_ms: number; receipt_sha256: string;
};
