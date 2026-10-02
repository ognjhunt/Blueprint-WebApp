import { createHash } from "node:crypto";
import { z } from "zod";

export const LEARNING_ROOT = "blueprintResearchLearning/default";
export const EVENT_VERSION = "blueprint.research-learning-event.v1";
export const SNAPSHOT_VERSION = "blueprint.research-learning-snapshot.v1";
// No model execution or credentials in this slice. Activation needs a separate
// reviewed implementation, budget and policy version, not an environment toggle.
export const CLASSIFICATION_POLICY = { model: "gpt-6-luna", enabled: false } as const;
export const digest = (value: unknown): string => {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical((item as Record<string, unknown>)[key])]))
      : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
};
export const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:-]+$/);
export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const instant = z.string().datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), { message: "learning_timestamp_invalid_repair_iso_offset_or_calendar_date" })
  .transform(value => new Date(value).toISOString());
// Public cohort labels include accents, non-Latin scripts and punctuation.
// Exclude private addresses, controls and credential-like material.
export const cohortLabel = z.string().min(1).max(120).refine(value => !/[\p{Cc}\p{Cf}@]/u.test(value)
  && !/(?:bearer\s+\S+|(?:token|password|secret|api[_ -]?key)\s*[:=])/i.test(value));
const label = cohortLabel;
const uniqueIds = z.array(id).max(100).refine(items => new Set(items).size === items.length);
export const entitiesSchema = z.object({
  prospectId: id, crmId: id.nullable(), companyId: id.nullable(),
  siteId: id.nullable(), taskId: id.nullable(), caseId: id.nullable(), teamIds: uniqueIds, capabilityIds: uniqueIds,
}).strict();
export const sectionSchema = z.enum(["research", "contact", "outreach", "replies", "outcomes"]);
export type Section = z.infer<typeof sectionSchema>;
export const evidenceSchema = z.object({
  sourceSystem: z.enum(["firestore", "public_web", "gmail", "human"]),
  // A pointer, never subject/body/email/token or a mailbox-wide query.
  recordRef: z.string().min(1).max(500).regex(/^[A-Za-z0-9_.:/-]+$/),
  sourceHash: hash, checkedAt: instant,
  basis: z.enum(["public_research", "contact_proof", "send_attempt", "provider_acceptance", "delivery_notification", "correlated_reply", "human_attestation"]),
}).strict();
export const gmailRefsSchema = z.object({
  messageId: id, threadId: id, jobId: id, outreachVersion: id,
}).strict();
const classificationSchema = z.object({
  label: z.enum(["unknown", "ambiguous", "curiosity", "interested", "rejection", "opt_out", "automatic"]),
  interest: z.enum(["unknown", "informational_curiosity", "willing_to_talk", "evaluation_interest", "pilot_discussion"]),
  objections: z.array(z.enum(["budget", "timing", "authority", "technical_fit", "trust", "no_need", "other", "unknown"])).max(8),
  confidence: z.number().min(0).max(1),
  method: z.enum(["human", "deterministic", "legacy_unknown"]),
  uncertain: z.boolean(),
}).strict();
const base = {
  version: z.literal(EVENT_VERSION), eventId: hash, occurredAt: instant, recordedAt: instant,
  entities: entitiesSchema, evidence: z.array(evidenceSchema).min(1).max(20),
  writer: z.enum(["research_adapter", "communications_adapter", "outcome_adapter", "human_correction"]),
  actorId: id, correctsEventId: hash.nullable(),
};
export const eventSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("research_observed"), data: z.object({
    city: label, industry: label, factIds: uniqueIds,
    factChecks: z.array(z.object({ factId: id, sourceHash: hash, sourceCheckedAt: instant,
      grade: z.enum(["primary", "corroborated", "operator_stated", "vendor_reported", "inference"]),
    }).strict()).max(100),
  }).strict() }).strict(),
  z.object({ ...base, kind: z.literal("contact_observed"), data: z.object({
    availability: z.enum(["verified_business_route", "unverified", "missing"]),
  }).strict() }).strict(),
  z.object({ ...base, kind: z.literal("outreach_observed"), data: z.object({
    messageId: id.nullable(), threadId: id.nullable(), jobId: id, outreachVersion: id,
    intent: z.enum(["outreach", "reply"]), payloadDigest: hash, approvalLedgerId: id,
    messageDigest: hash, messageVariant: id.nullable(),
    status: z.enum(["attempted", "accepted", "unknown"]),
    campaignId: id.nullable(), timingWindow: label.nullable(),
  }).strict() }).strict(),
  z.object({ ...base, kind: z.literal("delivery_observed"), data: z.object({
    ...gmailRefsSchema.shape, status: z.enum(["verified_delivered", "bounced"]),
  }).strict() }).strict(),
  z.object({ ...base, kind: z.literal("reply_observed"), data: z.object({
    ...gmailRefsSchema.shape, classification: classificationSchema,
  }).strict() }).strict(),
  z.object({ ...base, kind: z.literal("outcome_observed"), data: z.object({
    outcome: z.enum(["call_held", "evaluation_participation_agreed", "pilot_agreed", "deployment_capacity_confirmed", "pilot_started", "pilot_completed", "lost"]),
    ownerConfirmed: z.literal(true), outcomeRecordId: id,
  }).strict() }).strict(),
]);
export type LearningEvent = z.infer<typeof eventSchema>;
export type EventInput = LearningEvent extends infer E ? E extends LearningEvent ? Omit<E, "eventId" | "version"> : never : never;

export function eventDigest(event: LearningEvent) {
  const { eventId: _id, recordedAt: _recorded, ...content } = event;
  return digest(content);
}
export function makeEvent(input: EventInput): LearningEvent {
  const event = eventSchema.parse({ ...input, version: EVENT_VERSION, eventId: "0".repeat(64) });
  event.eventId = eventDigest(event);
  return validateEvent(event);
}
export function validateEvent(value: unknown): LearningEvent {
  const event = eventSchema.parse(value);
  if (event.eventId !== eventDigest(event)) throw new Error("learning_event_hash_mismatch");
  const expectedWriter = event.kind === "research_observed" || event.kind === "contact_observed" ? "research_adapter"
    : event.kind === "outcome_observed" ? "outcome_adapter" : "communications_adapter";
  if (event.correctsEventId ? event.writer !== "human_correction" : event.writer !== expectedWriter) {
    throw new Error("learning_field_owner_mismatch");
  }
  if (Date.parse(event.occurredAt) > Date.parse(event.recordedAt)
    || event.evidence.some(e => Date.parse(e.checkedAt) > Date.parse(event.recordedAt))) throw new Error("learning_future_evidence");
  const requiredBasis = event.kind === "research_observed" ? "public_research"
    : event.kind === "contact_observed" ? "contact_proof"
    : event.kind === "outreach_observed" ? event.data.status === "accepted" ? "provider_acceptance" : "send_attempt"
    : event.kind === "delivery_observed" ? "delivery_notification"
    : event.kind === "reply_observed" ? "correlated_reply" : "human_attestation";
  if (!event.evidence.some(e => e.basis === requiredBasis)) throw new Error("learning_evidence_basis_missing");
  if (event.correctsEventId && !event.evidence.some(e => e.basis === "human_attestation")) throw new Error("learning_correction_attestation_missing");
  if (event.kind === "reply_observed") {
    const c = event.data.classification;
    if (event.correctsEventId && c.method !== "human") throw new Error("learning_correction_requires_human");
    if (c.method === "human" && !event.evidence.some(e => e.basis === "human_attestation")) throw new Error("learning_classification_attestation_missing");
    if ((c.label === "curiosity" && !["unknown", "informational_curiosity"].includes(c.interest))
      || (["unknown", "ambiguous", "automatic", "rejection", "opt_out"].includes(c.label) && c.interest !== "unknown")
      || (c.method === "legacy_unknown" && (c.label !== "unknown" || !c.uncertain))) throw new Error("learning_classification_inconsistent");
  }
  if (event.kind === "outreach_observed" && event.data.status === "accepted"
    && (!event.data.messageId || !event.data.threadId)) throw new Error("learning_acceptance_receipt_missing");
  if (event.kind === "research_observed" && (event.data.factChecks.length !== event.data.factIds.length || event.data.factChecks.some(f => !event.data.factIds.includes(f.factId)
    || Date.parse(f.sourceCheckedAt) > Date.parse(event.recordedAt))
    || new Set(event.data.factChecks.map(f => f.factId)).size !== event.data.factChecks.length)) throw new Error("learning_fact_provenance_invalid");
  return event;
}

/** Issued by the existing trusted server/control plane after authorization.
 * Never accept this object from model metadata, a prompt or a client body. */
export const grantSchema = z.object({
  principalId: id, prospectIds: uniqueIds.refine(ids => ids.length > 0),
  sections: z.array(sectionSchema).min(1).max(5).refine(items => new Set(items).size === items.length),
  expiresAt: instant,
}).strict();
export type LearningGrant = z.infer<typeof grantSchema>;
export const requestSchema = z.object({
  prospectIds: uniqueIds.refine(ids => ids.length > 0),
  sections: z.array(sectionSchema).min(1).max(5).refine(items => new Set(items).size === items.length),
  asOf: instant, maturityDays: z.number().int().min(1).max(90),
}).strict();
export type SnapshotRequest = z.infer<typeof requestSchema>;
export function authorize(grantInput: LearningGrant, requestInput: SnapshotRequest, now: string) {
  const grant = grantSchema.parse(grantInput), request = requestSchema.parse(requestInput);
  instant.parse(now);
  if (Date.parse(grant.expiresAt) <= Date.parse(now) || Date.parse(request.asOf) > Date.parse(now)
    || request.prospectIds.some(id => !grant.prospectIds.includes(id))
    || request.sections.some(section => !grant.sections.includes(section))) throw new Error("learning_snapshot_scope_denied");
  return { grant, request };
}
