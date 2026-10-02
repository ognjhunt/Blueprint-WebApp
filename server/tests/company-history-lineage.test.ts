import { describe, expect, it } from "vitest";
import { makeBusinessHistory } from "../research-learning/business-history";
import { loadCompanyHistory, type CompanyHistoryAccess } from "../research-learning/company-history";
import { digest, LEARNING_ROOT } from "../research-learning/contract";
import { makeSiteLearning } from "../research-learning/site-learning";
import { learningMemoryFirestore } from "./fixtures/research-learning";

const now = "2026-10-02T16:00:00.000Z";
const access: CompanyHistoryAccess = { principalId: "company-lineage-reader", companyWide: true,
  expiresAt: "2026-10-02T17:00:00.000Z" };
const businessBase = { subjectKey: "blueprint:research-learning", contentClass: "blueprint_business_only" as const,
  occurredAt: "2026-10-01T12:00:00.000Z", recordedAt: "2026-10-01T13:00:00.000Z",
  capturedBy: "company-owner", supersedesEventId: null,
  sources: [{ system: "chat" as const, threadId: "fixture-business-thread", messageId: "fixture-business-message",
    originalTimestamp: "2026-10-01T12:00:00.000Z", originalAuthorId: "company-owner", originalAuthorRole: "user" as const,
    sourceHash: digest("fixture business message"), businessExcerpt: "Retain company evidence and independent hypotheses." }] };
const decisionInput = { ...businessBase, recordId: "BP-DEC-original", kind: "decision" as const,
  classification: "explicit_decision" as const, statement: "Original company decision.", rationale: null };
const hypothesisInput = { ...businessBase, recordId: "BP-HYP-independent", kind: "hypothesis" as const,
  statement: "Some sites may prepare work for the next shift.", status: "provisional" as const,
  uncertainty: "No authorized response evidence yet.", evidence: [], confounders: ["response_bias"],
  whatWouldChangeBelief: ["Comparable owners report another motive."], nextQuestion: "What must be ready for the next shift?",
  nextTest: "Compare owner answers and unexpected opportunities.", causalProof: false as const,
  hardFilterProspects: false as const, unexpectedExplorationRequired: true as const };
const siteInput = { crmId: "BP-000001", canonicalProspectId: null, siteId: null, taskId: null,
  occurredAt: "2026-10-01T12:00:00.000Z", recordedAt: "2026-10-01T13:00:00.000Z", capturedBy: "site-owner",
  ownerConfirmed: true as const, correctsEventId: null, statedMotive: null, boundedQuestion: "Original site question.",
  decisionChangingEvidence: null, statedDecisionOwnerId: "site-owner", evidenceOwnerId: null,
  briefChoice: "later" as const, brief: null, usefulness: "unknown" as const, feedback: null,
  attestation: { recordRef: "fixture/site-attestation", sourceHash: digest("fixture owner attestation"),
    attestedBy: "site-owner", attestedAt: "2026-10-01T13:00:00.000Z" } };

describe("company history preserves independent evidence during correction repair", () => {
  it("does not revive an old business decision after a malformed correction, while an independent hypothesis remains readable", async () => {
    const memory = learningMemoryFirestore(), root = makeBusinessHistory(decisionInput);
    const correction = makeBusinessHistory({ ...decisionInput, supersedesEventId: root.eventId, statement: "Corrected company decision." });
    const healthy = makeBusinessHistory(hypothesisInput);
    memory.records.set(`${LEARNING_ROOT}/businessHistoryEvents/${root.eventId}`, root);
    memory.records.set(`${LEARNING_ROOT}/businessHistoryEvents/${correction.eventId}`, { ...correction, statement: "PRIVATE_MALFORMED_CORRECTION" });
    memory.records.set(`${LEARNING_ROOT}/businessHistoryEvents/${healthy.eventId}`, healthy);
    const before = JSON.stringify([...memory.records]);
    const loaded = await loadCompanyHistory(memory.db, access, () => now);
    expect(loaded.records.filter(row => row.kind === "decision")).toEqual([]);
    expect(loaded.records.filter(row => row.kind === "hypothesis")).toEqual([expect.objectContaining({
      source_ref: `${LEARNING_ROOT}/businessHistoryEvents/${healthy.eventId}`, current: true, content: healthy,
    })]);
    expect(loaded.diagnostics).toContainEqual(expect.objectContaining({ record_ref: `${LEARNING_ROOT}/businessHistoryEvents/${correction.eventId}` }));
    expect(JSON.stringify(loaded)).not.toContain("PRIVATE_MALFORMED_CORRECTION");
    expect(JSON.stringify([...memory.records])).toBe(before); expect(memory.writes).toEqual([]);
  });

  it("quarantines a hash-valid cross-record business supersession and its ancestors without hiding another subject", async () => {
    const memory = learningMemoryFirestore(), root = makeBusinessHistory(decisionInput);
    const ancestor = makeBusinessHistory({ ...decisionInput, supersedesEventId: root.eventId, statement: "Intermediate decision." });
    const broken = makeBusinessHistory({ ...decisionInput, recordId: "BP-DEC-wrong-join", supersedesEventId: ancestor.eventId, statement: "A hash-valid mismatched revision." });
    const healthy = makeBusinessHistory({ ...hypothesisInput, subjectKey: "blueprint:independent-research" });
    for (const event of [root, ancestor, broken, healthy]) memory.records.set(`${LEARNING_ROOT}/businessHistoryEvents/${event.eventId}`, event);
    const before = JSON.stringify([...memory.records]);
    const loaded = await loadCompanyHistory(memory.db, access, () => now);
    expect(loaded.records.filter(row => row.kind === "decision")).toEqual([]);
    expect(loaded.records.filter(row => row.kind === "hypothesis")).toEqual([expect.objectContaining({
      source_ref: `${LEARNING_ROOT}/businessHistoryEvents/${healthy.eventId}`, current: true, content: healthy,
    })]);
    for (const event of [root, ancestor, broken]) expect(loaded.diagnostics).toContainEqual(expect.objectContaining({
      record_ref: `${LEARNING_ROOT}/businessHistoryEvents/${event.eventId}`,
    }));
    expect(JSON.stringify([...memory.records])).toBe(before); expect(memory.writes).toEqual([]);
  });

  it("connects malformed raw site correction pointers before validation and retains independent events in the same and another CRM", async () => {
    const memory = learningMemoryFirestore(), root = makeSiteLearning(siteInput);
    const correction = makeSiteLearning({ ...siteInput, correctsEventId: root.eventId, boundedQuestion: "Corrected site question." });
    const sameCrm = makeSiteLearning({ ...siteInput, boundedQuestion: "Independent question for the same site." });
    const otherCrm = makeSiteLearning({ ...siteInput, crmId: "BP-000002", boundedQuestion: "Independent question for another site." });
    for (const event of [root, sameCrm, otherCrm]) memory.records.set(`${LEARNING_ROOT}/siteLearningEvents/${event.eventId}`, event);
    memory.records.set(`${LEARNING_ROOT}/siteLearningEvents/${correction.eventId}`, { ...correction, boundedQuestion: "PRIVATE_MALFORMED_SITE_CORRECTION" });
    const before = JSON.stringify([...memory.records]);
    const loaded = await loadCompanyHistory(memory.db, access, () => now);
    const sites = loaded.records.filter(row => row.kind === "site_learning");
    expect(new Set(sites.map(row => row.source_ref))).toEqual(new Set([sameCrm, otherCrm].map(event => `${LEARNING_ROOT}/siteLearningEvents/${event.eventId}`)));
    expect(sites.every(row => row.current)).toBe(true);
    expect(loaded.diagnostics).toContainEqual({ record_ref: `${LEARNING_ROOT}/siteLearningEvents/${correction.eventId}`, code: "company_history_site_record_invalid" });
    expect(loaded.diagnostics).toContainEqual({ code: "company_history_site_correction_lineage_invalid" });
    expect(JSON.stringify(loaded)).not.toContain("PRIVATE_MALFORMED_SITE_CORRECTION");
    expect(JSON.stringify([...memory.records])).toBe(before); expect(memory.writes).toEqual([]);
  });
});
