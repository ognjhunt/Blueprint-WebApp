import { z } from "zod";
import { digest, hash, id, instant } from "./contract";
import { authorizeSources, safeText, type SourceGrant, type SourceRequest } from "./prior-research";

/** Human-owned learning observations are CRM-scoped, separate from v1 physical outcomes. */
export const siteLearningSchema = z.object({ version: z.literal("blueprint.site-learning-event.v1"), eventId: hash,
  crmId: id, canonicalProspectId: id.nullable(), siteId: id.nullable(), taskId: id.nullable(),
  occurredAt: instant, recordedAt: instant, capturedBy: id, ownerConfirmed: z.literal(true), correctsEventId: hash.nullable(),
  statedMotive: safeText(600).nullable(), boundedQuestion: safeText(600).nullable(),
  decisionChangingEvidence: safeText(600).nullable(), statedDecisionOwnerId: id.nullable(), evidenceOwnerId: id.nullable(),
  briefChoice: z.enum(["unknown", "brief", "later", "no"]),
  brief: z.object({ recordRef: safeText(500), briefId: id, version: id, revision: z.number().int().positive(), contentHash: hash }).strict().nullable(),
  usefulness: z.enum(["unknown", "pending", "helped", "did_not_help"]),
  feedback: z.object({ feedbackId: id, attributedToId: id, summary: safeText(600), observedAt: instant, requestedAt: instant.nullable() }).strict().nullable(),
  attestation: z.object({ recordRef: safeText(500), sourceHash: hash, attestedBy: id, attestedAt: instant }).strict(),
}).strict();
export type SiteLearningEvent = z.infer<typeof siteLearningSchema>;
export type SiteLearningInput = Omit<SiteLearningEvent, "eventId" | "version">;
function eventHash(event: SiteLearningEvent) { const { eventId: _id, recordedAt: _at, ...content } = event; return digest(content); }
export function validateSiteLearning(value: unknown) {
  const event = siteLearningSchema.parse(value);
  if (eventHash(event) !== event.eventId) throw new Error("site_learning_hash_mismatch");
  if (event.capturedBy !== event.attestation.attestedBy || event.occurredAt > event.recordedAt || event.attestation.attestedAt > event.recordedAt
    || event.attestation.attestedAt < event.occurredAt) throw new Error("site_learning_attestation_invalid");
  if (event.feedback && (event.feedback.observedAt > event.occurredAt || (event.feedback.requestedAt && event.feedback.requestedAt > event.feedback.observedAt))) throw new Error("site_learning_feedback_request_future");
  if (["helped", "did_not_help"].includes(event.usefulness) && (!event.brief || !event.feedback)) throw new Error("site_learning_attributed_feedback_missing");
  if (event.usefulness === "pending" && (!event.brief || !event.feedback?.requestedAt)) throw new Error("site_learning_feedback_request_missing");
  return event;
}
export function makeSiteLearning(input: SiteLearningInput) {
  const event = siteLearningSchema.parse({ ...input, version: "blueprint.site-learning-event.v1", eventId: "0".repeat(64) });
  event.eventId = eventHash(event);
  return validateSiteLearning(event);
}
export function validateSiteCorrection(original: SiteLearningEvent, correction: SiteLearningEvent) {
  if (correction.correctsEventId !== original.eventId || original.crmId !== correction.crmId || original.occurredAt !== correction.occurredAt
    || original.recordedAt > correction.recordedAt || digest([original.canonicalProspectId, original.siteId, original.taskId, original.brief])
      !== digest([correction.canonicalProspectId, correction.siteId, correction.taskId, correction.brief])) throw new Error("site_learning_correction_join_changed");
}
export function siteLearningHistory(values: unknown[], grant: SourceGrant, request: SourceRequest, now: string) {
  const { request: selected } = authorizeSources(grant, request, now);
  if (!selected.sections.includes("site_learning")) return { history: [] as SiteLearningEvent[], current: [] as SiteLearningEvent[] };
  const history = values.filter((value: any) => selected.crmIds.includes(value?.crmId)).map(validateSiteLearning)
    .filter(event => event.recordedAt <= selected.asOf && event.occurredAt <= selected.asOf && event.attestation.attestedAt <= selected.asOf);
  const byId = new Map<string, SiteLearningEvent>(), superseded = new Set<string>();
  for (const event of history) {
    const previous = byId.get(event.eventId);
    if (!previous || previous.recordedAt > event.recordedAt) byId.set(event.eventId, event);
  }
  for (const event of byId.values()) {
    if (!event.correctsEventId) continue;
    const original = byId.get(event.correctsEventId);
    if (!original || superseded.has(original.eventId)) throw new Error("site_learning_correction_missing_or_conflicted");
    validateSiteCorrection(original, event); superseded.add(original.eventId);
    const visited = new Set([event.eventId]); let ancestor: SiteLearningEvent | undefined = original;
    while (ancestor) {
      if (visited.has(ancestor.eventId)) throw new Error("site_learning_correction_cycle");
      visited.add(ancestor.eventId); ancestor = ancestor.correctsEventId ? byId.get(ancestor.correctsEventId) : undefined;
    }
  }
  const ordered = [...byId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.recordedAt.localeCompare(b.recordedAt) || a.eventId.localeCompare(b.eventId));
  return { history: ordered, current: ordered.filter(event => !superseded.has(event.eventId)) };
}
