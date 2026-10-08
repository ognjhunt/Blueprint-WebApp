import { humanDecisionDigest } from "./human-reply-admission";
import { SITE_ASSESSMENT_MODEL } from "../agents/provider-config";

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
type Slot = { id: string; provider: "openai" | "gemini"; model: string; reserved_micro_usd: number;
  state: "held" | "admitted" | "recorded" | "unknown"; admission_token?: string; run_id?: string;
  reserved_call_micro_usd?: number; usage_estimate_micro_usd?: number; [key: string]: unknown };
type Programme = { schema_version: "inference_program.v1"; status: "active"; authority_ref: string; ledger_sha256: string;
  request_id: string; capture_id: string; context_digest: string; video_sha256: string; expires_at_ms: number;
  cap_micro_usd: number; slots: Slot[]; producer_source_digest?: string; [key: string]: unknown };
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const amount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
/** Validate every retained reservation, including consumed and unknown calls. No release or new authority is inferred. */
export function validateInferenceProgramme(value: any, requireActive = true): Programme {
  if (!value || value.schema_version !== "inference_program.v1" || (requireActive && value.status !== "active")
    || typeof value.authority_ref !== "string" || !value.authority_ref.trim()
    || typeof value.ledger_sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.ledger_sha256)
    || !hash(value.context_digest) || !hash(value.video_sha256) || !amount(value.cap_micro_usd)
    || !Number.isSafeInteger(value.expires_at_ms) || !Array.isArray(value.slots) || !value.slots.length
    || (value.producer_source_digest !== undefined && !hash(value.producer_source_digest))) throw new Error("inference_programme_authority_invalid");
  const ids = new Set<string>(); let total = 0;
  for (const slot of value.slots) {
    if (!slot || typeof slot.id !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(slot.id) || ids.has(slot.id)
      || !amount(slot.reserved_micro_usd) || !["held", "admitted", "recorded", "unknown"].includes(slot.state)
      || !((slot.provider === "openai" && slot.model === SITE_ASSESSMENT_MODEL)
        || (slot.provider === "gemini" && slot.model === "gemini-3.8-flash"))) throw new Error("inference_programme_authority_invalid");
    ids.add(slot.id); total += slot.reserved_micro_usd;
    if (!Number.isSafeInteger(total) || total > value.cap_micro_usd) throw new Error("inference_programme_cap_invalid");
  }
  if (value.capture_history_reconciliation !== undefined) validateCaptureHistoryReconciliation(value.capture_history_reconciliation);
  return value;
}
type CaptureHistoryRow = { id: string; data: Record<string, any> };
/** Persisted scalar/ISO timestamp bytes are retained, rather than replacing them with a clock value. */
export function captureHistoryDigest(rows: CaptureHistoryRow[]) {
  const fields = ["requestId", "sceneId", "captureId", "state", "attempts", "started_at", "claim_token", "binding", "reason", "finding"];
  return humanDecisionDigest(rows.map(row => ({ review_id: row.id,
    ...Object.fromEntries(fields.map(field => [field, row.data[field] ?? null])) })).sort((left, right) => left.review_id.localeCompare(right.review_id)));
}
function validateCaptureHistoryReconciliation(value: any) {
  if (!value || value.schema_version !== "capture_history_reconciliation.v1" || value.status !== "accepted"
    || typeof value.receipt_sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.receipt_sha256)
    || typeof value.source_commit !== "string" || !/^[a-f0-9]{40}$/.test(value.source_commit)
    || typeof value.reviewed_by !== "string" || !value.reviewed_by.trim()
    || typeof value.authority_ref !== "string" || !value.authority_ref.trim()
    || typeof value.request_id !== "string" || !value.request_id || typeof value.capture_id !== "string" || !value.capture_id
    || !hash(value.history_digest) || !Array.isArray(value.reviews) || !value.reviews.length || value.reviews.length >= 100)
    throw new Error("inference_programme_history_receipt_invalid");
  let previous = "";
  for (const row of value.reviews) {
    if (!hash(row.review_id) || row.review_id <= previous || !Number.isSafeInteger(row.attempts) || row.attempts < 0
      || row.disposition !== "verified_zero_provider") throw new Error("inference_programme_history_receipt_invalid");
    previous = row.review_id;
  }
  return value;
}
/** Only accepted canonical operator evidence can distinguish proved pre-provider failure from unknown exposure. */
export function acceptsReconciledCaptureHistory(programme: any, requestId: string, captureId: string, rows: CaptureHistoryRow[]) {
  if (!programme?.capture_history_reconciliation) return false;
  const receipt = validateCaptureHistoryReconciliation(programme.capture_history_reconciliation);
  if (receipt.request_id !== requestId || receipt.capture_id !== captureId || rows.length !== receipt.reviews.length
    || rows.length >= 100 || captureHistoryDigest(rows) !== receipt.history_digest) return false;
  const sorted = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  return sorted.every((row, index) => row.id === receipt.reviews[index].review_id
    && row.data.attempts === receipt.reviews[index].attempts && row.data.requestId === requestId && row.data.captureId === captureId
    && ["failed", "waiting_prerequisite", "review_required"].includes(row.data.state)
    && typeof row.data.sceneId === "string" && !!row.data.sceneId
    && ((typeof row.data.started_at === "number" && Number.isSafeInteger(row.data.started_at) && row.data.started_at >= 0)
      || (typeof row.data.started_at === "string" && Number.isFinite(Date.parse(row.data.started_at))))
    && typeof row.data.claim_token === "string" && !!row.data.claim_token && row.data.binding?.capture_id === captureId
    && typeof row.data.binding?.source?.key === "string" && !!row.data.binding.source.key && hash(row.data.binding?.brief_digest));
}

export function admitInferenceProgramme(value: unknown, binding: { requestId: string; captureId: string; contextDigest: string;
  videoSha256: unknown; sourceDigest: string; provider: "openai" | "gemini"; model: string; reservedMicroUsd: number;
  token: string; runId: string; eligibleSlotIds?: string[]; admittedSlotIds?: string[] }) {
  const programme = validateInferenceProgramme(value);
  if (programme.expires_at_ms <= Date.now()) throw new Error("inference_programme_expired");
  if (programme.request_id !== binding.requestId || programme.capture_id !== binding.captureId
    || programme.context_digest !== binding.contextDigest || !hash(binding.videoSha256) || programme.video_sha256 !== binding.videoSha256
    || (programme.producer_source_digest !== undefined && programme.producer_source_digest !== binding.sourceDigest))
    throw new Error("inference_programme_binding_changed");
  const slot = programme.slots.find(row => row.state === "held"
    && (!binding.eligibleSlotIds || binding.eligibleSlotIds.includes(row.id)) && !binding.admittedSlotIds?.includes(row.id) && row.provider === binding.provider && row.model === binding.model
    && row.reserved_micro_usd >= binding.reservedMicroUsd);
  if (!slot) throw new Error("inference_programme_slot_unavailable");
  return { slotId: slot.id, slotReservation: slot.reserved_micro_usd, authorityDigest: inferenceProgrammeAuthorityDigest({ ...programme, producer_source_digest: binding.sourceDigest }), slots: programme.slots.map(row => row.id === slot.id ? { ...row, state: "admitted" as const,
    admission_token: binding.token, run_id: binding.runId, reserved_call_micro_usd: binding.reservedMicroUsd } : row),
    producer_source_digest: binding.sourceDigest };
}

/** Status may be revoked after dispatch; retained authority identity and amounts cannot be rewritten. */
export function inferenceProgrammeAuthorityDigest(value: unknown) {
  const row = validateInferenceProgramme(value, false);
  return humanDecisionDigest({ schema_version: row.schema_version, authority_ref: row.authority_ref, ledger_sha256: row.ledger_sha256,
    request_id: row.request_id, capture_id: row.capture_id, context_digest: row.context_digest, video_sha256: row.video_sha256,
    capture_history_reconciliation: row.capture_history_reconciliation ?? null,
    expires_at_ms: row.expires_at_ms, cap_micro_usd: row.cap_micro_usd, producer_source_digest: row.producer_source_digest ?? null,
    slots: row.slots.map(slot => ({ id: slot.id, provider: slot.provider, model: slot.model, reserved_micro_usd: slot.reserved_micro_usd }))
      .sort((left, right) => left.id.localeCompare(right.id)) });
}

export type AssessmentRecovery = {
  schema_version: "site_assessment_recovery.v1"; retry_identity: string; job_id: string;
  request_id: string; capture_id: string; previous_run_id: string; previous_claim_id: string; new_run_id: string;
  source_key: string; source_digest: string; context_digest: string; advisory_context_digest: string;
  video_sha256: string; programme_id: string; authority_digest: string;
  slot_id: string; admission_token: string; provider: "openai" | "gemini"; model: string;
  reserved_micro_usd: number; reserved_call_micro_usd: number;
  capture_calls: number; capture_exposure_usd: number; created_at_ms: number; receipt_sha256: string;
};
/** Canonical unknown receipts preserve full exposure; they are not provider usage receipts. */
export function validatedAssessmentRecoveries(state: any, programme: Programme): AssessmentRecovery[] {
  const rows = state?.assessment_recoveries ?? [];
  if (!Array.isArray(rows) || rows.length >= 100) throw new Error("advisory_retry_unavailable");
  const runs = new Set<string>(), tokens = new Set<string>();
  let prior: AssessmentRecovery | undefined;
  for (const row of rows) {
    const { receipt_sha256, ...content } = row ?? {};
    const slot = programme.slots.find(slot => slot.id === row?.slot_id);
    if (!row || row.schema_version !== "site_assessment_recovery.v1" || receipt_sha256 !== humanDecisionDigest(content)
      || !/^[A-Za-z0-9._-]{1,120}$/.test(row.retry_identity) || !/^advisory-[a-f0-9]{64}$/.test(row.job_id)
      || row.request_id !== programme.request_id || row.capture_id !== programme.capture_id
      || row.programme_id !== state.inference_program_id || row.authority_digest !== inferenceProgrammeAuthorityDigest(programme)
      || row.context_digest !== programme.context_digest || row.video_sha256 !== programme.video_sha256
      || row.source_digest !== programme.producer_source_digest || !hash(row.advisory_context_digest)
      || typeof row.source_key !== "string" || !row.source_key
      || !/^[A-Za-z0-9._-]{1,200}$/.test(row.previous_run_id) || !/^[A-Za-z0-9._-]{1,200}$/.test(row.new_run_id)
      || row.new_run_id !== `site-assessment-retry-${humanDecisionDigest({ jobId: row.job_id, previousRunId: row.previous_run_id, retryIdentity: row.retry_identity })}`
      || typeof row.previous_claim_id !== "string" || !row.previous_claim_id
      || (prior && (row.previous_run_id !== prior.new_run_id || row.capture_calls <= prior.capture_calls || row.job_id !== prior.job_id))
      || row.previous_run_id === row.new_run_id || runs.has(row.previous_run_id) || tokens.has(row.admission_token)
      || !Number.isSafeInteger(row.capture_calls) || row.capture_calls < 1 || row.capture_calls > state.calls
      || !Number.isFinite(row.capture_exposure_usd) || row.capture_exposure_usd <= 0 || row.capture_exposure_usd > state.exposure_usd
      || !Number.isSafeInteger(row.created_at_ms) || row.created_at_ms < 1
      || slot?.state !== "unknown" || slot.run_id !== row.previous_run_id || slot.admission_token !== row.admission_token
      || slot.provider !== row.provider || slot.model !== row.model || slot.reserved_micro_usd !== row.reserved_micro_usd
      || slot.reserved_call_micro_usd !== row.reserved_call_micro_usd
      || !state.inference_programme_admitted_slot_ids?.includes(row.slot_id)) throw new Error("advisory_retry_unavailable");
    runs.add(row.previous_run_id); tokens.add(row.admission_token); prior = row;
  }
  return rows;
}
