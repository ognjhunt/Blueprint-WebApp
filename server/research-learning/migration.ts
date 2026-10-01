import { z } from "zod";
import { digest, eventSchema, grantSchema, id, instant, requestSchema, validateEvent, type LearningEvent } from "./contract";
import { buildSnapshot, resolveHistory } from "./snapshot";
import { planResearchLearning } from "./planner";

export const migrationInputSchema = z.object({
  version: z.literal("blueprint.research-learning-dry-run-input.v1"),
  now: instant, grant: grantSchema, request: requestSchema,
  events: z.array(eventSchema).max(10000), existingEvents: z.array(eventSchema).max(10000),
  expectedProspectIds: z.array(id).max(100),
  expectedEvidenceRefs: z.array(z.string().max(500)).max(10000),
  quarantine: z.array(z.object({ recordRef: z.string().max(500), reason: z.string().max(120) }).strict()).max(10000),
  focus: z.object({ city: z.string().max(120), industry: z.string().max(120) }).strict(),
}).strict();

/** Pure preflight. No apply mode exists. A green fixture report is not live
 * reconciliation proof; the source manifest must come from the actual scope. */
export function dryRunMigration(value: unknown) {
  const input = migrationInputSchema.parse(value);
  const events = input.events.map(validateEvent), existing = input.existingEvents.map(validateEvent);
  const errors: string[] = [];
  if (digest([...input.expectedProspectIds].sort()) !== digest([...input.request.prospectIds].sort())) errors.push("prospect_manifest_scope_mismatch");
  if (events.some(e => !input.request.prospectIds.includes(e.entities.prospectId))
    || existing.some(e => !input.request.prospectIds.includes(e.entities.prospectId))) errors.push("event_outside_migration_scope");
  const observedRefs = [...new Set(events.flatMap(event => event.evidence.map(e => e.recordRef)))].sort();
  const expectedRefs = [...new Set(input.expectedEvidenceRefs)].sort();
  const missingRefs = expectedRefs.filter(ref => !observedRefs.includes(ref));
  const unexpectedRefs = observedRefs.filter(ref => !expectedRefs.includes(ref));
  if (missingRefs.length || unexpectedRefs.length) errors.push("evidence_manifest_not_reconciled");
  if (input.quarantine.length) errors.push("quarantined_sources_require_owner_review");
  const existingIds = new Set(existing.map(e => e.eventId));
  const deduped = resolveHistory([...existing, ...events]).history;
  const snapshot = buildSnapshot(deduped, input.grant, input.request, input.now);
  if (snapshot.rows.some(row => row.history.length === 0)) errors.push("prospects_without_normalized_history");
  if (events.some(e => e.entities.siteId === null || e.entities.taskId === null || e.entities.crmId === null)) errors.push("exact_crm_site_task_reconciliation_missing");
  if (deduped.some(e => e.recordedAt > snapshot.asOf || e.occurredAt > snapshot.asOf)) errors.push("events_outside_cutoff");
  const append = [...new Map(events.map(e => [e.eventId, e])).values()].filter(e => !existingIds.has(e.eventId));
  const plan = planResearchLearning(snapshot, input.focus);
  return { version: "blueprint.research-learning-dry-run.v1", mode: "offline_dry_run", sourceInputHash: digest(input),
    readyForStagedAppend: errors.length === 0, readyForCutover: false,
    errors, quarantine: input.quarantine, sourceReconciliation: { expectedRefs, observedRefs, missingRefs, unexpectedRefs },
    counts: { inputEvents: events.length, duplicateInputEvents: events.length - new Set(events.map(e => e.eventId)).size,
      existingEvents: existing.length, appendEvents: append.length, preservedEvents: existingIds.size, prospects: snapshot.rows.length },
    appendEventIds: append.map(e => e.eventId), snapshot, plan,
    blockedActions: ["destructive_migration", "source_field_rewrites", "live_cutover", "new_credentials", "oauth_grants", "paid_classification", "prospect_sends"] };
}

export function migrationFixture(events: LearningEvent[], grant: z.infer<typeof grantSchema>, request: z.infer<typeof requestSchema>, now: string) {
  return { version: "blueprint.research-learning-dry-run-input.v1", now, grant, request, events, existingEvents: [],
    expectedProspectIds: request.prospectIds, expectedEvidenceRefs: [...new Set(events.flatMap(e => e.evidence.map(ref => ref.recordRef)))],
    quarantine: [], focus: { city: "Sacramento", industry: "Laundromats" } };
}
