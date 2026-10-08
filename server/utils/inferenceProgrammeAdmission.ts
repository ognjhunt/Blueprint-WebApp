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
  return value;
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
    expires_at_ms: row.expires_at_ms, cap_micro_usd: row.cap_micro_usd, producer_source_digest: row.producer_source_digest ?? null,
    slots: row.slots.map(slot => ({ id: slot.id, provider: slot.provider, model: slot.model, reserved_micro_usd: slot.reserved_micro_usd }))
      .sort((left, right) => left.id.localeCompare(right.id)) });
}
