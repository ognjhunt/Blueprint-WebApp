import {
  authorize, digest, SNAPSHOT_VERSION, validateEvent,
  type LearningEvent, type LearningGrant, type Section, type SnapshotRequest,
} from "./contract";

export const sectionsByKind: Record<LearningEvent["kind"], Section> = {
  research_observed: "research", contact_observed: "contact", outreach_observed: "outreach",
  delivery_observed: "outreach", reply_observed: "replies", outcome_observed: "outcomes",
};
export function eventSection(event: LearningEvent): Section { return sectionsByKind[event.kind]; }
export type SnapshotRow = {
  prospectId: string;
  history: LearningEvent[];
  currentEventIds: string[];
  unknowns: string[];
};
export type LearningSnapshot = {
  version: typeof SNAPSHOT_VERSION; snapshotId: string; contentHash: string;
  asOf: string; maturityDays: number;
  scope: { principalId: string; prospectIds: string[]; sections: Section[] };
  rows: SnapshotRow[];
};
const ordered = (a: LearningEvent, b: LearningEvent) => a.occurredAt.localeCompare(b.occurredAt)
  || a.evidence.map(e => e.checkedAt).sort().at(-1)!.localeCompare(b.evidence.map(e => e.checkedAt).sort().at(-1)!)
  || a.eventId.localeCompare(b.eventId);

export function validateCorrection(original: LearningEvent, event: LearningEvent) {
  if (event.correctsEventId !== original.eventId || original.kind !== event.kind || digest(original.entities) !== digest(event.entities)
    || original.recordedAt > event.recordedAt) throw new Error("learning_correction_target_invalid");
  if ("jobId" in original.data && (original.data.jobId !== (event.data as { jobId?: string }).jobId
    || original.data.messageId !== (event.data as { messageId?: string | null }).messageId
    || original.data.threadId !== (event.data as { threadId?: string | null }).threadId)) throw new Error("learning_correction_join_changed");
  const immutable = (record: LearningEvent) => {
    if (record.kind === "research_observed") return { factIds: record.data.factIds, factChecks: record.data.factChecks };
    if (record.kind === "reply_observed") { const { classification: _classification, ...refs } = record.data; return refs; }
    if (record.kind === "outreach_observed" || record.kind === "delivery_observed") { const { status: _status, ...refs } = record.data; return refs; }
    if (record.kind === "outcome_observed") { const { outcome: _outcome, ...refs } = record.data; return refs; }
    return {};
  };
  if (original.occurredAt !== event.occurredAt || digest(immutable(original)) !== digest(immutable(event))
    || original.evidence.filter(e => e.basis !== "human_attestation").some(e => !event.evidence.some(next => digest(e) === digest(next)))) {
    throw new Error("learning_correction_source_owned_fields_changed");
  }
}

/** Correction edges, not ingestion order, determine human authority. Branching
 * corrections are unresolved conflicts; never silently pick a winner. */
export function resolveHistory(values: unknown[]): { history: LearningEvent[]; active: LearningEvent[] } {
  const byId = new Map<string, LearningEvent>();
  for (const value of values) {
    const event = validateEvent(value), existing = byId.get(event.eventId);
    if (existing && digest({ ...existing, recordedAt: null }) !== digest({ ...event, recordedAt: null })) throw new Error("learning_event_id_conflict");
    // First persisted observation is authoritative for recordedAt.
    if (!existing || event.recordedAt < existing.recordedAt) byId.set(event.eventId, event);
  }
  const superseded = new Set<string>();
  for (const event of byId.values()) {
    if (!event.correctsEventId) continue;
    const original = byId.get(event.correctsEventId);
    if (!original) throw new Error("learning_correction_target_invalid");
    validateCorrection(original, event);
    if (superseded.has(original.eventId)) throw new Error("learning_correction_conflict");
    superseded.add(original.eventId);
    let cursor: LearningEvent | undefined = event;
    const visited = new Set<string>();
    while (cursor) {
      if (visited.has(cursor.eventId)) throw new Error("learning_correction_cycle");
      visited.add(cursor.eventId);
      cursor = cursor.correctsEventId ? byId.get(cursor.correctsEventId) : undefined;
    }
  }
  return { history: [...byId.values()].sort(ordered), active: [...byId.values()].filter(e => !superseded.has(e.eventId)).sort(ordered) };
}

export function buildSnapshot(values: unknown[], grant: LearningGrant, input: SnapshotRequest, now: string): LearningSnapshot {
  const { request } = authorize(grant, input, now);
  // Discard unrelated records before parsing or serializing any of their fields.
  const scoped = values.filter((value: any) => {
    if (!request.prospectIds.includes(value?.entities?.prospectId)) return false;
    const section = typeof value?.kind === "string" && Object.hasOwn(sectionsByKind, value.kind)
      ? sectionsByKind[value.kind as LearningEvent["kind"]] : undefined;
    return section ? request.sections.includes(section) : request.sections.length === 5;
  });
  const allowed = scoped.map(validateEvent).filter(event => event.recordedAt <= request.asOf && event.occurredAt <= request.asOf
    && event.evidence.every(e => e.checkedAt <= request.asOf) && request.sections.includes(eventSection(event)));
  const rows = [...request.prospectIds].sort().map(prospectId => {
    const { history, active } = resolveHistory(allowed.filter(e => e.entities.prospectId === prospectId));
    const unknowns: string[] = [];
    if (!active.some(e => e.kind === "research_observed")) unknowns.push("research_missing_or_not_authorized");
    if (!active.some(e => e.kind === "contact_observed")) unknowns.push("contact_missing_or_not_authorized");
    if (active.some(e => e.entities.siteId === null || e.entities.taskId === null)) unknowns.push("exact_site_or_task_join_missing");
    if (active.some(e => e.kind === "outreach_observed" && (e.data.status === "accepted" || e.data.status === "founder_sent")
      && !active.some(d => d.kind === "delivery_observed" && d.data.jobId === e.data.jobId
        && d.data.messageId === e.data.messageId && d.data.threadId === e.data.threadId))) unknowns.push("delivery_unknown");
    if (active.some(e => e.kind === "reply_observed" && e.data.classification.uncertain)) unknowns.push("reply_classification_uncertain");
    return { prospectId, history, currentEventIds: active.map(e => e.eventId), unknowns };
  });
  const content = { version: SNAPSHOT_VERSION as typeof SNAPSHOT_VERSION, asOf: request.asOf, maturityDays: request.maturityDays,
    scope: { principalId: grant.principalId, prospectIds: [...request.prospectIds].sort(), sections: [...request.sections].sort() }, rows };
  const contentHash = digest(content);
  return { ...content, contentHash, snapshotId: contentHash };
}

/** Readback validates the complete projection, not only a caller-supplied hash. */
export function verifySnapshot(value: LearningSnapshot, grant: LearningGrant, now: string): LearningSnapshot {
  if (value.version !== SNAPSHOT_VERSION) throw new Error("learning_snapshot_version_unsupported");
  const expected = buildSnapshot(value.rows.flatMap(row => row.history), grant,
    { prospectIds: value.scope.prospectIds, sections: value.scope.sections, asOf: value.asOf, maturityDays: value.maturityDays }, now);
  if (digest(value) !== digest(expected) || value.scope.principalId !== grant.principalId) throw new Error("learning_snapshot_readback_mismatch");
  return expected;
}
