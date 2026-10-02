import { describe, expect, it } from "vitest";
import { digest } from "../research-learning/contract";
import { BusinessHistoryStore, businessHistoryProjection, makeBusinessHistory, validateBusinessHistory, type BusinessHistoryInput } from "../research-learning/business-history";
import { initialHypothesisEvents, offShiftPreparationHypothesis } from "../research-learning/initial-hypotheses";
import { learningMemoryFirestore } from "./fixtures/research-learning";

const now = "2026-10-01T23:00:00.000Z";
const subjectKey = "blueprint:research-learning";
const scope = { principalId: "company-history-host", subjectKeys: [subjectKey], expiresAt: "2026-10-02T00:00:00.000Z" };
function decision(change: Record<string, any> = {}) {
  return makeBusinessHistory({ recordId: "BP-DEC-learning", subjectKey, contentClass: "blueprint_business_only", occurredAt: "2026-10-01T22:00:00.000Z", recordedAt: now,
    capturedBy: scope.principalId, supersedesEventId: null, sources: [{ system: "chat", threadId: "synthetic-business-thread", messageId: "synthetic-message-1",
      originalTimestamp: "2026-10-01T22:00:00.000Z", originalAuthorId: "company-owner", originalAuthorRole: "user", sourceHash: digest("synthetic original message"), businessExcerpt: "Use the existing database for company learning." }],
    kind: "decision", classification: "explicit_decision", statement: "Use existing Blueprint Firestore as the knowledge source of truth.", rationale: null,
    ...change } as BusinessHistoryInput);
}
const context = (event: ReturnType<typeof decision>) => ({ principalId: scope.principalId, subjectKeys: scope.subjectKeys, approvedEventId: event.eventId, verifiedSources: event.sources });

describe("sourced append-only company business history", () => {
  it("preserves original message identity/time, explicit decisions and inference separately", () => {
    const explicit = decision(), inference = decision({ recordId: "BP-DEC-inference", classification: "inference" });
    const view = businessHistoryProjection([explicit, inference, { subjectKey: "private:personal", text: "PRIVATE_SECRET" }], scope, now, now);
    expect(view.current).toHaveLength(2); expect(view.current[0].sources[0]).toMatchObject({ threadId: "synthetic-business-thread", messageId: "synthetic-message-1", originalTimestamp: "2026-10-01T22:00:00.000Z" });
    expect(new Set(view.current.map(event => event.kind === "decision" && event.classification))).toEqual(new Set(["explicit_decision", "inference"]));
    expect(JSON.stringify(view)).not.toContain("PRIVATE_SECRET");
  });
  it("retains legacy event IDs and labels excerpt hashes and unknown author identity without inventing metadata", () => {
    const original = decision(), { eventId, version: _version, ...input } = original;
    expect(makeBusinessHistory(input).eventId).toBe(eventId);
    const excerpt = "Robots could prepare work for humans on the next shift.", timestamp = "2026-10-02T01:01:57.000Z";
    const source = { system: "chat" as const, threadId: "synthetic-business-thread", messageId: "synthetic-offshift-message",
      originalTimestamp: timestamp, originalAuthorId: null, originalAuthorRole: "user" as const,
      sourceHashBasis: "provided_business_excerpt" as const, sourceHash: digest(excerpt), businessExcerpt: excerpt };
    const captured = offShiftPreparationHypothesis({ subjectKey, capturedBy: scope.principalId, occurredAt: timestamp,
      recordedAt: "2026-10-02T01:20:00.000Z", sources: [source] });
    expect(captured).toMatchObject({ recordId: "BP-HYP-off-shift-preparation-human-handoff", status: "provisional", evidence: [], causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true });
    expect(captured.sources[0]).toMatchObject({ originalAuthorId: null, sourceHashBasis: "provided_business_excerpt" });
    expect(captured.kind === "hypothesis" && captured.nextQuestion).toBe("What has to be ready when your next shift arrives, and what sometimes isn’t?");
    expect(() => offShiftPreparationHypothesis({ subjectKey, capturedBy: scope.principalId, occurredAt: timestamp,
      recordedAt: "2026-10-02T01:20:00.000Z", sources: [{ ...source, businessExcerpt: "Changed without a matching hash." }] })).toThrow("excerpt_hash_invalid");
  });
  it.each(["missing_message", "personal_class", "email", "secret", "assistant_explicit", "future_source"])("rejects %s before persistence", invalid => {
    const original = decision(), { version: _version, eventId: _id, ...input } = original; const candidate: any = structuredClone(input);
    if (invalid === "missing_message") candidate.sources = [{ system: "firestore", recordRef: "source/1", sourceHash: digest("source"), checkedAt: now }];
    if (invalid === "personal_class") candidate.contentClass = "personal";
    if (invalid === "email") candidate.statement = "Contact private@example.org";
    if (invalid === "secret") candidate.sources[0].businessExcerpt = "access_token=PRIVATE_SECRET";
    if (invalid === "assistant_explicit") candidate.sources[0].originalAuthorRole = "assistant";
    if (invalid === "future_source") candidate.sources[0].originalTimestamp = "2026-10-02T00:00:00.000Z";
    expect(() => makeBusinessHistory(candidate)).toThrow();
  });
  it("supersedes by append while keeping the full original history and rejects branches/cross-subject moves", () => {
    const first = decision(), next = decision({ supersedesEventId: first.eventId, statement: "Retain portable JSON exports alongside canonical Firestore records." });
    const view = businessHistoryProjection([first, next], scope, now, now);
    expect(view.history).toHaveLength(2); expect(view.current.map(event => event.eventId)).toEqual([next.eventId]);
    expect(() => businessHistoryProjection([first, next, decision({ supersedesEventId: first.eventId, statement: "Competing update." })], scope, now, now)).toThrow("conflicted");
    expect(() => businessHistoryProjection([first, decision({ statement: "Competing root." })], scope, now, now)).toThrow("competing_roots");
    expect(() => businessHistoryProjection([first, decision({ supersedesEventId: first.eventId, classification: "inference" })], scope, now, now)).toThrow("supersession_invalid");
  });
  it("registers all four conversation hypotheses only with original source metadata and keeps unexpected discovery", () => {
    const original = decision();
    const events = initialHypothesisEvents({ subjectKey, capturedBy: scope.principalId, occurredAt: original.occurredAt, recordedAt: now, sources: original.sources });
    expect(events).toHaveLength(4); expect(new Set(events.map(event => event.recordId)).size).toBe(4);
    for (const event of events) expect(event).toMatchObject({ kind: "hypothesis", status: "provisional", evidence: [], causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true });
    expect(() => initialHypothesisEvents({ subjectKey, capturedBy: scope.principalId, occurredAt: original.occurredAt, recordedAt: now, sources: [] })).toThrow();
  });
  it("supports provisional hypotheses with counterevidence and no prospect hard filter", () => {
    const base = decision(), { classification: _classification, statement: _statement, rationale: _rationale, kind: _kind, eventId: _id, version: _version, ...fields } = base as any;
    const hypothesis = makeBusinessHistory({ ...fields, recordId: "BP-HYP-readiness", kind: "hypothesis", statement: "Some sites may seek readiness information before purchase.", status: "provisional",
      uncertainty: "Unconfirmed; no response sample yet.", evidence: [], confounders: ["contactability", "response_bias", "delayed_replies"],
      whatWouldChangeBelief: ["Comparable sites explicitly report another motive."], nextQuestion: "What information would change your assessment?", nextTest: "Compare explicit answers while preserving unexpected opportunities.",
      causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true });
    expect(hypothesis.kind).toBe("hypothesis"); expect(() => validateBusinessHistory({ ...hypothesis, hardFilterProspects: true })).toThrow();
  });
  it("creates idempotently through existing Firestore and keeps source-owned records untouched", async () => {
    const memory = learningMemoryFirestore(), store = new BusinessHistoryStore(memory.db, () => now), event = decision();
    expect(await store.append(event, context(event))).toBe("created"); expect(await store.append(event, context(event))).toBe("existing");
    const snapshot = await store.read(scope, now); expect(snapshot.current[0].eventId).toBe(event.eventId);
    expect(memory.writes).toEqual([`blueprintResearchLearning/default/businessHistoryEvents/${event.eventId}`]);
    await expect(store.append(decision({ statement: "Unverified new statement." }), context(event))).rejects.toThrow("writer_scope_or_source_denied");
  });
  it("binds trusted capture to the exact verified source metadata and subject before database access", async () => {
    const memory = learningMemoryFirestore(), store = new BusinessHistoryStore(memory.db, () => now), event = decision();
    await expect(store.append(event, { ...context(event), verifiedSources: [] })).rejects.toThrow("source_denied");
    await expect(store.append(event, { ...context(event), subjectKeys: ["unrelated"] })).rejects.toThrow("scope_or_source_denied"); expect(memory.reads).toEqual([]);
    await expect(store.read({ ...scope, expiresAt: now }, now)).rejects.toThrow("expired"); expect(memory.reads).toEqual([]);
  });
  it("rejects valid events under wrong Firestore document keys before projecting or appending", async () => {
    const f = learningMemoryFirestore(), event = decision(), store = new BusinessHistoryStore(f.db, () => now);
    f.records.set("blueprintResearchLearning/default/businessHistoryEvents/wrong-key", event);
    await expect(store.read(scope, now)).rejects.toThrow("document_identity_changed");
    const next = decision({ supersedesEventId: event.eventId, statement: "A sourced later decision." });
    await expect(store.append(next, context(next))).rejects.toThrow("document_identity_changed"); expect(f.writes).toEqual([]);
  });

});
