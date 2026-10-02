import { hash, instant, LEARNING_ROOT, validateEvent, type LearningEvent, type SnapshotRequest } from "./contract";
import { eventSection, resolveHistory, sectionsByKind } from "./snapshot";
import type { Quarantine } from "./existing-sources";

/** Read repair only: original documents stay untouched. A broken correction
 * suppresses its connected lineage so an obsolete root cannot become current. */
export function readableHistory(documents: { id: string; data(): unknown }[], live: LearningEvent[], request: SnapshotRequest) {
  request = { ...request, asOf: instant.parse(request.asOf) };
  const events: LearningEvent[] = [], quarantine: Quarantine[] = [], invalid = new Set<string>(), observedSourceRefs: string[] = [];
  const key = (prospectId: string, eventId: string) => JSON.stringify([prospectId, eventId]);
  const parent = new Map<string, string>();
  const root = (value: string): string => {
    const path: string[] = []; let current = value;
    while (parent.has(current) && parent.get(current) !== current) { path.push(current); current = parent.get(current)!; }
    parent.set(current, current); path.forEach(item => parent.set(item, current)); return current;
  };
  const union = (left: string, right: string) => { parent.set(root(left), root(right)); };
  const admit = (event: LearningEvent) => request.prospectIds.includes(event.entities.prospectId)
    && request.sections.includes(eventSection(event)) && event.recordedAt <= request.asOf && event.occurredAt <= request.asOf
    && event.evidence.every(evidence => evidence.checkedAt <= request.asOf);
  for (const event of live) if (admit(event)) events.push(event);
  for (const document of documents) {
    const raw: any = document.data(), prospectId = raw?.entities?.prospectId;
    if (!request.prospectIds.includes(prospectId)) continue;
    const section = typeof raw?.kind === "string" && Object.hasOwn(sectionsByKind, raw.kind)
      ? sectionsByKind[raw.kind as LearningEvent["kind"]] : undefined;
    if (section ? !request.sections.includes(section) : request.sections.length !== 5) continue;
    // An identified future revision does not change an earlier frozen view.
    const recorded = instant.safeParse(raw?.recordedAt);
    if (recorded.success && recorded.data > request.asOf) continue;
    try {
      const event = validateEvent(raw);
      if (event.eventId !== document.id) throw new Error("stored_document_identity_changed");
      if (admit(event)) { events.push(event); observedSourceRefs.push(`${LEARNING_ROOT}/events/${document.id}`); }
    } catch {
      quarantine.push({ recordRef: `${LEARNING_ROOT}/events/${document.id}`, reason: "stored_event_invalid_reconcile_original_hash_and_identity" });
      for (const value of [document.id, raw?.eventId, raw?.correctsEventId]) if (hash.safeParse(value).success) invalid.add(key(prospectId, value));
      if (hash.safeParse(raw?.eventId).success && hash.safeParse(raw?.correctsEventId).success)
        union(key(prospectId, raw.eventId), key(prospectId, raw.correctsEventId));
    }
  }
  for (const event of events) {
    const own = key(event.entities.prospectId, event.eventId); root(own);
    if (event.correctsEventId) union(own, key(event.entities.prospectId, event.correctsEventId));
  }
  const invalidRoots = new Set([...invalid].map(root)), groups = new Map<string, LearningEvent[]>();
  for (const event of events) {
    const own = root(key(event.entities.prospectId, event.eventId));
    groups.set(own, [...(groups.get(own) ?? []), event]);
  }
  const valid: LearningEvent[] = [];
  for (const [lineage, group] of groups) {
    try {
      if (invalidRoots.has(lineage)) throw new Error("stored_lineage_incomplete");
      resolveHistory(group); valid.push(...group);
    } catch {
      quarantine.push(...group.map(event => ({ recordRef: `${LEARNING_ROOT}/events/${event.eventId}`,
        reason: "stored_lineage_conflict_reconcile_correction_without_deleting_history" })));
    }
  }
  return { events: valid, quarantine, observedSourceRefs: [...new Set(observedSourceRefs)].sort() };
}
