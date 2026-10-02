import { readQueryPages } from "./query-pages";
import { z } from "zod";
import { digest, hash, id, instant, LEARNING_ROOT } from "./contract";
import { safeText } from "./prior-research";

export const BUSINESS_HISTORY_ROOT = `${LEARNING_ROOT}/businessHistoryEvents`;
const ids = z.array(id).max(100).refine(values => new Set(values).size === values.length);
const pointer = z.string().min(1).max(500).regex(/^[A-Za-z0-9_.:/-]+$/);
const messageSource = z.object({ system: z.enum(["chat", "voice_transcript"]), threadId: id, messageId: id,
  originalTimestamp: instant, originalAuthorId: id.nullable(), originalAuthorRole: z.enum(["user", "assistant"]),
  sourceHash: hash, sourceHashBasis: z.enum(["original_message", "provided_business_excerpt"]).optional(),
  businessExcerpt: safeText(1200) }).strict();
const firestoreSource = z.object({ system: z.literal("firestore"), recordRef: pointer, sourceHash: hash, checkedAt: instant }).strict();
export const businessSourceSchema = z.union([messageSource, firestoreSource]);
const evidence = z.object({ recordRef: pointer, sourceHash: hash, checkedAt: instant, eventId: hash.nullable(), factId: id.nullable(),
  interpretation: safeText(600), relation: z.enum(["supporting", "counter", "ambiguous"]) }).strict();
const base = { version: z.literal("blueprint.business-history-event.v1"), eventId: hash,
  recordId: id.refine(value => /^BP-(?:DEC|HYP|RUN)-/.test(value)), subjectKey: id,
  contentClass: z.literal("blueprint_business_only"), occurredAt: instant, recordedAt: instant, capturedBy: id,
  supersedesEventId: hash.nullable(), sources: z.array(businessSourceSchema).min(1).max(5) };
export const businessHistoryEventSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("decision"), classification: z.enum(["explicit_decision", "inference"]),
    statement: safeText(1200), rationale: safeText(1200).nullable() }).strict(),
  z.object({ ...base, kind: z.literal("hypothesis"), statement: safeText(1200),
    status: z.enum(["provisional", "investigating", "supported_in_authorized_scope", "weakened", "withdrawn"]),
    uncertainty: safeText(600), evidence: z.array(evidence).max(20), confounders: z.array(safeText(200)).max(20),
    whatWouldChangeBelief: z.array(safeText(600)).min(1).max(10), nextQuestion: safeText(600), nextTest: safeText(600),
    causalProof: z.literal(false), hardFilterProspects: z.literal(false), unexpectedExplorationRequired: z.literal(true) }).strict(),
  z.object({ ...base, kind: z.literal("run_summary"), runId: id,
    state: z.enum(["completed", "failed", "cancelled", "sent", "no_reply", "opted_out", "awaiting_review", "reviewed", "superseded", "pending_approval", "awaiting_research", "blocked", "auto_approved"]),
    requestDigest: hash, nativeTimestamp: instant.nullable(), timeBasis: z.enum(["native_update", "remote_completion", "terminal_observation"]),
    contextHash: hash.nullable(), sourceSnapshotId: hash.nullable(),
    counts: z.record(id, z.number().int().nonnegative().nullable()).refine(value => Object.keys(value).length <= 30),
    unknowns: z.array(safeText(200)).max(100), prospectIds: ids,
    paidAnalysisCalls: z.literal(0) }).strict(),
]);
export type BusinessHistoryEvent = z.infer<typeof businessHistoryEventSchema>;
export type BusinessHistoryInput = BusinessHistoryEvent extends infer E ? E extends BusinessHistoryEvent ? Omit<E, "version" | "eventId"> : never : never;
const eventHash = (event: BusinessHistoryEvent) => { const { eventId: _id, recordedAt: _at, ...content } = event; return digest(content); };
export function validateBusinessHistory(value: unknown) {
  const event = businessHistoryEventSchema.parse(value);
  if (eventHash(event) !== event.eventId || event.occurredAt > event.recordedAt) throw new Error("business_history_hash_or_time_invalid");
  const prefix = event.kind === "decision" ? "BP-DEC-" : event.kind === "hypothesis" ? "BP-HYP-" : "BP-RUN-";
  if (!event.recordId.startsWith(prefix)) throw new Error("business_history_record_identity_invalid");
  const messages = event.sources.filter((source): source is z.infer<typeof messageSource> => source.system !== "firestore");
  // An unavailable author ID remains null. An excerpt hash never pretends to
  // authenticate unprovided whole-message bytes; legacy source hashes keep
  // their original shape and event IDs when the optional basis is absent.
  if (messages.some(source => source.sourceHashBasis === "provided_business_excerpt" && source.sourceHash !== digest(source.businessExcerpt))) throw new Error("business_history_excerpt_hash_invalid");
  if (event.sources.some(source => (source.system === "firestore" ? source.checkedAt : source.originalTimestamp) > event.recordedAt)) throw new Error("business_history_source_future");
  if (event.kind !== "run_summary" && (!messages.length || messages.some(source => source.originalTimestamp > event.occurredAt))) throw new Error("business_history_original_message_required");
  if (event.kind === "decision" && event.classification === "explicit_decision" && !messages.some(source => source.originalAuthorRole === "user")) throw new Error("business_history_explicit_user_source_required");
  if (event.kind === "run_summary" && (!event.sources.some(source => source.system === "firestore") || event.supersedesEventId)) throw new Error("business_history_native_run_receipt_required");
  if (event.kind === "hypothesis" && event.evidence.some(item => item.checkedAt > event.recordedAt)) throw new Error("business_history_evidence_future");
  return event;
}
export function makeBusinessHistory(input: BusinessHistoryInput) {
  const event = businessHistoryEventSchema.parse({ ...input, version: "blueprint.business-history-event.v1", eventId: "0".repeat(64) });
  event.eventId = eventHash(event); return validateBusinessHistory(event);
}
export function validateBusinessSupersession(original: BusinessHistoryEvent, next: BusinessHistoryEvent) {
  if (next.supersedesEventId !== original.eventId || next.recordId !== original.recordId || next.subjectKey !== original.subjectKey
    || next.kind !== original.kind || next.occurredAt < original.occurredAt || next.recordedAt < original.recordedAt
    || (original.kind === "decision" && original.classification === "explicit_decision" && next.kind === "decision" && next.classification === "inference")) throw new Error("business_history_supersession_invalid");
}
export const businessReadScopeSchema = z.object({ principalId: id, subjectKeys: z.array(id).min(1).max(10).refine(values => new Set(values).size === values.length), expiresAt: instant }).strict();
export type BusinessReadScope = z.infer<typeof businessReadScopeSchema>;
export function businessHistoryProjection(values: unknown[], scopeValue: BusinessReadScope, asOfValue: string, nowValue: string) {
  const scope = businessReadScopeSchema.parse(scopeValue), asOf = instant.parse(asOfValue), now = instant.parse(nowValue);
  if (scope.expiresAt <= now || asOf > now) throw new Error("business_history_scope_expired_or_future");
  // Filter authorization before validating or projecting unrelated records.
  const events = values.filter((value: any) => scope.subjectKeys.includes(value?.subjectKey)).map(validateBusinessHistory)
    .filter(event => event.recordedAt <= asOf && event.occurredAt <= asOf);
  const byId = new Map<string, BusinessHistoryEvent>();
  for (const event of events) if (!byId.has(event.eventId) || byId.get(event.eventId)!.recordedAt > event.recordedAt) byId.set(event.eventId, event);
  const superseded = new Set<string>(), roots = new Set<string>();
  for (const event of byId.values()) {
    if (!event.supersedesEventId) {
      if (roots.has(event.recordId)) throw new Error("business_history_competing_roots");
      roots.add(event.recordId); continue;
    }
    const original = byId.get(event.supersedesEventId);
    if (!original || superseded.has(original.eventId)) throw new Error("business_history_supersession_missing_or_conflicted");
    validateBusinessSupersession(original, event); superseded.add(original.eventId);
    const seen = new Set([event.eventId]); let ancestor: BusinessHistoryEvent | undefined = original;
    while (ancestor) { if (seen.has(ancestor.eventId)) throw new Error("business_history_cycle"); seen.add(ancestor.eventId); ancestor = ancestor.supersedesEventId ? byId.get(ancestor.supersedesEventId) : undefined; }
  }
  const history = [...byId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.recordedAt.localeCompare(b.recordedAt) || a.eventId.localeCompare(b.eventId));
  const current = history.filter(event => !superseded.has(event.eventId));
  const content = { version: "blueprint.business-history-snapshot.v1" as const, principalId: scope.principalId, subjectKeys: scope.subjectKeys,
    asOf, sourceRefs: history.map(event => ({ eventId: event.eventId, recordRef: `${BUSINESS_HISTORY_ROOT}/${event.eventId}`, sourceHash: event.eventId })), history, current };
  return { ...content, snapshotId: digest(content), historyHash: digest(history) };
}
export type BusinessHistorySnapshot = ReturnType<typeof businessHistoryProjection>;
export function validateStoredBusinessHistory(doc: { id: string; data(): unknown }) {
  const event = validateBusinessHistory(doc.data());
  if (event.eventId !== doc.id) throw new Error("business_history_document_identity_changed");
  return event;
}
export type BusinessWriterContext = { principalId: string; subjectKeys: string[]; approvedEventId: string;
  verifiedSources: BusinessHistoryEvent["sources"] };
/** Existing authorized host verifies original message identity, business-only
 * excerpt and classification before constructing this context. Never a model tool. */
export class BusinessHistoryStore {
  constructor(private db: FirebaseFirestore.Firestore, private clock = () => new Date().toISOString()) {}
  async append(value: unknown, context: BusinessWriterContext): Promise<"created" | "existing"> {
    const event = validateBusinessHistory(value), now = instant.parse(this.clock());
    const verifiedSources = context.verifiedSources.map(source => businessSourceSchema.parse(source));
    if (event.capturedBy !== context.principalId || !context.subjectKeys.includes(event.subjectKey) || context.approvedEventId !== event.eventId
      || event.recordedAt > now || event.sources.some(source => !verifiedSources.some(verified => digest(verified) === digest(source)))) throw new Error("business_history_writer_scope_or_source_denied");
    const collection = this.db.doc(LEARNING_ROOT).collection("businessHistoryEvents"), ref = collection.doc(event.eventId);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) { if (validateBusinessHistory(existing.data()).eventId !== event.eventId) throw new Error("business_history_existing_conflict"); return "existing"; }
      const rows = await readQueryPages(collection.where("recordId", "==", event.recordId), query => tx.get(query));
      const prior = rows.map(doc => validateStoredBusinessHistory(doc));
      if (prior.some(previous => previous.subjectKey !== event.subjectKey)) throw new Error("business_history_record_scope_changed");
      // Validate the complete lineage before an immutable create.
      businessHistoryProjection([...prior, event], { principalId: context.principalId, subjectKeys: [event.subjectKey], expiresAt: new Date(Date.parse(now)+60000).toISOString() }, now, now);
      tx.create(ref, event); return "created";
    });
  }
  async read(scope: BusinessReadScope, asOf: string) {
    const selected = businessReadScopeSchema.parse(scope), values: BusinessHistoryEvent[] = [];
    const quarantine: { recordRef: string; reason: string }[] = [], invalidLineages = new Set<string>();
    const lineageKey = (subjectKey: string, recordId: string) => JSON.stringify([subjectKey, recordId]);
    businessHistoryProjection([], selected, asOf, this.clock());
    for (const subjectKey of selected.subjectKeys) {
      const rows = await readQueryPages(this.db.doc(LEARNING_ROOT).collection("businessHistoryEvents").where("subjectKey", "==", subjectKey));
      for (const doc of rows) {
        const raw = doc.data(), recorded = instant.safeParse(raw?.recordedAt);
        if (recorded.success && recorded.data > instant.parse(asOf)) continue;
        try {
          const event = validateStoredBusinessHistory(doc);
          if (event.subjectKey !== subjectKey) throw new Error("business_history_stored_scope_changed");
          values.push(event);
        } catch {
          // A malformed correction can make an older root obsolete. Suppress
          // only that identified lineage until repaired, never present it as current.
          if (raw?.subjectKey === subjectKey && id.safeParse(raw.recordId).success) invalidLineages.add(lineageKey(subjectKey, raw.recordId));
          quarantine.push({ recordRef: `${BUSINESS_HISTORY_ROOT}/${doc.id}`, reason: "business_event_invalid_reconcile_original_hash_and_identity" });
        }
      }
    }
    const lineages = new Map<string, BusinessHistoryEvent[]>();
    for (const event of values) {
      const key = lineageKey(event.subjectKey, event.recordId);
      lineages.set(key, [...(lineages.get(key) ?? []), event]);
    }
    const valid: BusinessHistoryEvent[] = [];
    for (const [key, lineage] of lineages) {
      try {
        if (invalidLineages.has(key)) throw new Error("business_lineage_incomplete");
        businessHistoryProjection(lineage, selected, asOf, this.clock());
        valid.push(...lineage);
      } catch {
        quarantine.push(...lineage.map(event => ({ recordRef: `${BUSINESS_HISTORY_ROOT}/${event.eventId}`,
          reason: "business_lineage_conflict_reconcile_supersession_without_deleting_history" })));
      }
    }
    return { ...businessHistoryProjection(valid, selected, asOf, this.clock()), quarantine };
  }
}
