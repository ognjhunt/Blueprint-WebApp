import { z } from "zod";

import { canonicalArtifactDigest, stableJson } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1);

export const captureQaReportSchema = z.object({
  schema_version: z.literal("capture_qa_report.v1"),
  intake_id: nonEmpty,
  envelope_digest: digest,
  capture_authority_profile: nonEmpty,
  status: z.enum(["accepted", "analysis_required", "recapture_required", "rejected"]),
  state: z.enum([
    "capture_accepted",
    "validating",
    "rejected_or_recapture_required",
    "failed",
  ]),
  checks: z.array(z.object({
    check_id: nonEmpty,
    status: z.enum(["pass", "fail", "not_measured", "not_applicable"]),
    evidence_source: nonEmpty,
    measurement: z.unknown(),
    threshold: z.unknown(),
    claim_impact: z.array(z.string()),
    recapture_code: z.string().nullable(),
    recapture_instruction: z.string().nullable(),
  }).strict()),
  recapture_plan: z.array(z.object({
    code: nonEmpty,
    instruction: nonEmpty,
    reason: nonEmpty,
  }).passthrough()),
  missing_evidence: z.array(z.string()),
  required_analysis: z.array(z.string()),
  next_cheapest_experiment: z.record(z.string(), z.unknown()).nullable(),
  quality_observations_digest: z.string().nullable(),
  quality_analysis_errors: z.array(z.string()),
  claim_ceiling: z.record(z.string(), z.unknown()),
  prohibited_claims: z.array(z.string()),
  comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  qa_report_digest: digest,
}).strict();

export const captureQaPublicationSchema = z.object({
  schema_version: z.literal("capture_qa_publication.v1"),
  capture_session_id: nonEmpty,
  intake_id: nonEmpty,
  capture_authority_profile: nonEmpty,
  envelope_digest: digest,
  qa_report_digest: digest,
  status: z.enum(["accepted", "analysis_required", "recapture_required", "rejected"]),
  state: z.enum([
    "capture_accepted",
    "validating",
    "rejected_or_recapture_required",
    "failed",
  ]),
  report: captureQaReportSchema,
  proof_boundary: z.object({
    qa_is_task_success: z.literal(false),
    qa_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
}).strict();

function sensitivePaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => sensitivePaths(child, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const sensitive = /(^|_)(secret|token|password|private_key|api_key|credential)($|_)/i.test(key)
      && child !== null && child !== "" && child !== false;
    return [...(sensitive ? [path] : []), ...sensitivePaths(child, path)];
  });
}

export function parseVerifiedCaptureQaPublication(value: unknown) {
  const parsed = captureQaPublicationSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, blockers: ["capture_qa_publication_schema_invalid"] };
  const publication = parsed.data;
  const report = publication.report;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(report, "qa_report_digest") !== report.qa_report_digest) {
    blockers.push("capture_qa_report_digest_mismatch");
  }
  const expectedState = {
    accepted: "capture_accepted",
    analysis_required: "validating",
    recapture_required: "rejected_or_recapture_required",
    rejected: "failed",
  }[report.status];
  if (
    publication.intake_id !== report.intake_id ||
    publication.capture_authority_profile !== report.capture_authority_profile ||
    publication.envelope_digest !== report.envelope_digest ||
    publication.qa_report_digest !== report.qa_report_digest ||
    publication.status !== report.status ||
    publication.state !== report.state ||
    report.state !== expectedState
  ) blockers.push("capture_qa_publication_binding_mismatch");
  if (report.status === "accepted" && report.recapture_plan.length) {
    blockers.push("accepted_capture_has_recapture_plan");
  }
  if (report.status === "recapture_required" && !report.recapture_plan.length) {
    blockers.push("recapture_required_without_instructions");
  }
  if (
    report.claim_ceiling.physical_task_success !== false ||
    report.claim_ceiling.deployment_readiness !== false ||
    report.claim_ceiling.safety_certification !== false
  ) blockers.push("capture_qa_claim_ceiling_upgrade_forbidden");
  if (sensitivePaths(publication).length) blockers.push("capture_qa_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, publication };
}

export function exactCaptureQaFingerprint(value: unknown) {
  return stableJson(value);
}
