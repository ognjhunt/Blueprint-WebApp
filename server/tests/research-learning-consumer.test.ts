import { describe, expect, it } from "vitest";
import { digest, LEARNING_ROOT, makeEvent, type EventInput } from "../research-learning/contract";
import { openResearchLearningSession, type ConsumerBinding, type ConsumerSelection } from "../research-learning/consumer";
import { verifySourceSnapshot } from "../research-learning/prior-research";
import { makeSiteLearning } from "../research-learning/site-learning";
import { learningMemoryFirestore, learningEvent, learningCorrection } from "./fixtures/research-learning";
import { publishedResearchFixture } from "./fixtures/published-research";
import { previewResearchCommunications } from "../agents/communications-producer";
import { communicationsBriefSchema, communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";
import { memoryFirestore } from "./fixtures/communications";
import { officialResearchInput } from "./fixtures/official-contact-research";
import { stageReviewedResearch } from "../agents/communications-reviewed-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { readExistingResearchSnapshot } from "../agents/communications-research";
import { resolvePublicContact } from "../agents/communications-contact-resolution";

const now = "2026-10-01T22:00:00.000Z";
const query = { taskTags: ["folding"], regionTags: ["Sacramento"], companyIds: [], capabilityIds: [], pageSize: 1, cursor: null };
function fixture(role: ConsumerBinding["role"] = "daily_research") {
  const memory = learningMemoryFirestore();
  const content = { version: "blueprint.research-learning-source-snapshot.v1", asOf: "2026-10-01T20:00:00.000Z",
    scope: { principalId: "source-reconciler", crmIds: ["BP-000001", "BP-000002"], capabilityIds: ["cap-1", "cap-2"], sections: ["crm", "capabilities", "site_learning"] },
    source: { crm: { recordRef: "blueprintDailyResearch/sites-first/files/crm.json", sourceHash: digest("crm"), capturedAt: "2026-10-01T12:00:00Z" },
      knowledge: { recordRef: "blueprintDailyResearch/sites-first/files/knowledge.json", sourceHash: digest("knowledge"), capturedAt: "2026-09-30T12:00:00Z" },
      knowledgeContentHash: digest("knowledge-content"), reconciliationHash: digest("verified-rows") },
    crmRows: [1, 2].map(number => ({ crmId: `BP-00000${number}`, organization: `Organization ${number}`, prospectType: "site", siteLabel: `Facility ${number}`,
      taskHypothesis: "Task unknown", geography: "Sacramento", sourceCheckedDate: "9/29/2026", verification: "Needs recheck", evidenceMaturity: "Unverified",
      inventoryStage: "Research", publicEvidenceUrls: ["https://example.org/task"], rowHash: digest(number), canonical: { prospectId: null, siteId: null, taskId: null, caseId: null } })),
    companies: [1, 2].map(number => ({ companyId: `company-${number}`, name: `Company ${number}`, roles: [], sourcePageIds: [] })),
    capabilities: [1, 2].map(number => ({ capabilityId: `cap-${number}`, companyId: `company-${number}`, recordType: "reviewed_capability", product: { name: "Product", version: null },
      taskTags: ["folding"], geographyTags: [], facts: [{ factId: `fact-${number}`, field: "task_claim", statement: `CAPABILITY_DETAIL_${number}`,
        status: number === 1 ? "reviewed" : "conflicted", evidenceLevel: "vendor_claim", confidence: "unknown", freshnessDays: 30,
        taskTags: [], geographyTags: [], sourcePageIds: [], sources: [{ url: "https://example.org/claim", sourceCheckedAt: "2026-09-29", revalidatedAt: null, publicationDate: null, classification: "vendor", publisher: null }],
        limits: ["Site fit unknown"], conflicts: number === 1 ? [] : ["Conflicting evidence"] }] })),
    sourcePages: [], researchRuns: [], unknowns: ["source_checks_are_not_refreshed"], parentSnapshotId: null };
  const source = verifySourceSnapshot({ ...content, snapshotId: digest(content), contentHash: digest(content) });
  memory.records.set(`${LEARNING_ROOT}/sourceSnapshots/${source.snapshotId}`, source);
  const binding: ConsumerBinding = { version: "blueprint.research-learning-consumer-binding.v1", principalId: `${role}-host`, role, sourceSnapshotId: source.snapshotId,
    crmIds: ["BP-000001"], prospectIds: ["prospect-1"], discoveryCapabilityIds: ["cap-1", "cap-2"], detailCapabilityIds: ["cap-1"], expiresAt: "2026-10-02T00:00:00.000Z" };
  const selection: ConsumerSelection = { crmIds: ["BP-000001"], prospectIds: [], capabilityIds: [], focus: { city: "Sacramento", industry: "Laundromats" } };
  memory.records.set("outboundProspects/unrelated", { researchPublicationId: "BP-000002", contactEmail: "PRIVATE_UNRELATED@example.org", notes: "PRIVATE_SENTINEL" });
  const open = (changes: Partial<ConsumerSelection> = {}) => openResearchLearningSession(memory.db, binding, { ...selection, ...changes }, () => now);
  return { ...memory, binding, selection, source, open };
}
function native(f: ReturnType<typeof fixture>, crmId = "BP-000001") {
  f.records.set("outboundProspects/prospect-1", { researchPublicationId: crmId, siteId: "site-1", taskId: "task-1", caseId: null, contactEmail: "PRIVATE_CONTACT@example.org" });
}
function stored(f: ReturnType<typeof fixture>, kind: Parameters<typeof learningEvent>[0], changes: Record<string, any> = {}) {
  const original = learningEvent(kind), { eventId: _id, version: _version, ...input } = original;
  const event = makeEvent({ ...input, entities: { ...original.entities, crmId: "BP-000001" }, ...changes } as EventInput);
  f.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event); return event;
}
function currentSent(f: ReturnType<typeof fixture>) {
  const published = publishedResearchFixture();
  const preview = previewResearchCommunications(published.snapshot, "prospect-1", published.prospect, published.input, Date.parse("2026-09-30T23:00:00Z"));
  const brief = communicationsBriefSchema.parse({ ...preview.proposal, qualityReview: { state: "approved", reviewedBy: "offline-fixture", reviewedAt: "2026-09-30T23:00:00.000Z", sourceRecordUrl: preview.sourceRecordUrl } });
  const briefDigest = communicationsDigest(brief), job = { jobId: "job-1", prospectId: brief.prospectId, briefId: brief.briefId, briefDigest, intent: "outreach", inboundMessageId: null };
  const envelope = { version: "blueprint.communications.v1", job, brief, thread: null, output: published.output, approvalState: "pending_approval" };
  const payload = { communications: envelope, to: brief.contact.email, subject: published.output.subject, body: published.output.body, transportBody: published.output.body };
  f.records.set("outboundProspects/prospect-1", { ...published.prospect, siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, researchPublicationId: preview.source.sheetsProspectId });
  const root = "blueprintCommunications/default";
  const records = { [`jobs/${job.jobId}`]: job, [`briefs/${brief.briefId}`]: brief,
    [`handoffs/${briefDigest}`]: { version: "blueprint.communications-handoff.v1", ...brief.qualityReview, briefDigest, sheetsReceipt: preview.source.sheetsReceipt, notionReceipt: preview.source.notionReceipt },
    [`researchSources/${briefDigest}`]: { briefDigest, source: preview.source }, [`sendReceipts/${communicationsDeliveryKey(job)}`]: { jobId: job.jobId, state: "sent",
      payloadDigest: communicationsDigest(payload), approvalLedgerId: "communications_job-1", attemptedAt: "2026-09-30T23:10:00.000Z", sentAt: "2026-09-30T23:11:00.000Z", receipt: { messageId: "out-1", threadId: "thread-1" } } };
  for (const [path, value] of Object.entries(records)) f.records.set(`${root}/${path}`, value);
  f.records.set("action_ledger/communications_job-1", { action_payload: payload });
  return { job, brief, receiptPath: `${root}/sendReceipts/${communicationsDeliveryKey(job)}` };
}

describe("runnable read-only research and communications consumer", () => {
  it.each(["daily_research", "communications"] as const)("opens a compact %s handoff without writers, mailbox reads or unscoped facts", async role => {
    const f = fixture(role), session = await f.open();
    expect(session.handoff.role).toBe(role); expect(session.handoff.priorResearch.crmRows).toHaveLength(1);
    expect(session.handoff.priorResearch.capabilityDetails.snapshot).toBeNull();
    expect(session.handoff.unknowns).toContain("native_contact_and_outcome_history_unknown");
    expect(session.handoff.priorContactAndOutcomes.planner).toBeNull();
    expect(session.handoff.discovery.completeDirectory).toBe(false);
    for (const marker of ["CAPABILITY_DETAIL_1", "CAPABILITY_DETAIL_2", "PRIVATE_", "example.org\"contact"]) expect(JSON.stringify(session.handoff)).not.toContain(marker);
    expect(f.reads).not.toContain("outboundProspects/unrelated"); expect(f.writes).toEqual([]);
    expect(f.reads.some(path => /oauth|gmail|mailbox|firstContact|recipientFirstTouches|run[s/]|lease/i.test(path))).toBe(false);
  });
  it.each(["crmIds", "prospectIds", "capabilityIds"] as const)("denies caller %s expansion before any Firestore read", async field => {
    const f = fixture(); await expect(f.open({ [field]: ["unrelated"] })).rejects.toThrow("scope_denied"); expect(f.reads).toEqual([]);
  });
  it("denies expired host scope before reading and after session construction", async () => {
    const f = fixture(); f.binding.expiresAt = now; await expect(f.open()).rejects.toThrow("expired"); expect(f.reads).toEqual([]);
    const other = fixture(); let at = now;
    const session = await openResearchLearningSession(other.db, other.binding, other.selection, () => at);
    at = other.binding.expiresAt;
    expect(() => session.search(query)).toThrow("expired"); expect(() => session.details(["cap-1"])).toThrow("expired");
    expect(() => session.history("prospect-1", { pageSize: 1, cursor: null })).toThrow("expired");
  });
  it("pages the authorized cached directory and fetches details only under the separate detail binding", async () => {
    const f = fixture(), session = await f.open(), first = session.search(query);
    const next = session.search({ ...query, cursor: first.nextCursor });
    expect([...first.rows, ...next.rows].map(row => row.entryId)).toEqual(["cap-1", "cap-2"]);
    expect(first.rows[0].regionMatch).toBe("unknown"); expect(next.rows[0].hasConflicts).toBe(true);
    const detail = session.details(["cap-1"]); expect(detail.snapshot!.capabilities[0].facts[0]).toMatchObject({ factId: "fact-1", confidence: "unknown" });
    expect(detail.snapshot!.capabilities[0].facts[0].sources[0].sourceCheckedAt).toBe("2026-09-29");
    expect(JSON.stringify(detail)).not.toContain("CAPABILITY_DETAIL_2"); expect(() => session.details(["cap-2"])).toThrow("detail_scope_denied");
    expect(session.search({ ...query, taskTags: ["unknown task"], regionTags: [] }).totalIndexed).toBe(2);
    expect(() => session.search({ ...query, capabilityIds: ["cap-1"], cursor: first.nextCursor })).toThrow("cursor_invalid"); expect(f.writes).toEqual([]);
  });
  it("resolves newly admitted exact CRM joins without changing cached joins or waiting for migration", async () => {
    const f = fixture(); native(f, "BP-NEW"); f.binding.crmIds = ["BP-NEW"];
    const session = await f.open({ crmIds: ["BP-NEW"] });
    expect(session.handoff.canonicalJoins[0]).toMatchObject({ crmId: "BP-NEW", prospectId: "prospect-1" });
    expect(session.handoff.priorResearch.crmRows).toEqual([]); expect(session.handoff.unknowns).toContain("crm_rows_missing_from_prior_snapshot");
    expect(f.records.get(`${LEARNING_ROOT}/sourceSnapshots/${f.source.snapshotId}`).crmRows[0].canonical.prospectId).toBeNull(); expect(f.writes).toEqual([]);
  });
  it("does not pick one competing native CRM join or read either contact history", async () => {
    const f = fixture(); native(f); f.records.set("outboundProspects/duplicate", { researchPublicationId: "BP-000001" });
    const session = await f.open(); expect(session.handoff.canonicalJoins).toEqual([]);
    expect(session.handoff.unknowns).toContain("crm_native_join_ambiguous");
    expect(f.reads).not.toContain("blueprintCommunications/default/jobs"); expect(session.handoff.provenance.quarantine).toHaveLength(1);
  });
  it("reads current accepted contact evidence before drafting while keeping delivery and interest unknown", async () => {
    const f = fixture(), data = currentSent(f); f.binding.crmIds = ["BP-000001"];
    const session = await f.open({ prospectIds: ["prospect-1"] });
    const summary = session.handoff.priorContactAndOutcomes.prospects[0];
    expect(summary).toMatchObject({ acceptedTouches: 1, verifiedDeliveredTouches: 0, interestSubtype: "unknown", outcome: "unknown", explicitRejection: false });
    expect(summary.unknowns).toContain("delivery_unknown");
    const history = session.history("prospect-1", { pageSize: 25, cursor: null });
    expect(history.events.some(event => event.kind === "outreach_observed" && event.data.threadId === "thread-1")).toBe(true);
    expect(history.events.flatMap(event => event.evidence).some(proof => proof.recordRef === data.receiptPath)).toBe(true);
    expect(JSON.stringify(session.handoff)).not.toContain(data.brief.contact.email); expect(f.writes).toEqual([]);
    const research = session.researchDetails("prospect-1", { pageSize: 1, cursor: null });
    expect(research.records[0].boundedQuestion).toBe(data.brief.contact.learningQuestion);
    expect(research.records[0].facts[0]).toMatchObject({ factId: data.brief.facts[0].id, sourceCheckedAt: data.brief.facts[0].sourceCheckedAt });
    expect(JSON.stringify(research)).not.toContain(data.brief.contact.email);
    expect(() => session.researchDetails("unrelated", { pageSize: 1, cursor: null })).toThrow("scope_denied");
    expect(() => session.researchDetails("prospect-1", { pageSize: 1, cursor: { contextHash: session.handoff.contextHash, prospectId: "unrelated", offset: 0 } })).toThrow("cursor_invalid");
  });
  it("reads the real reviewed-report admission contract without inventing a CRM row or provider session", async () => {
    const f = fixture("communications"), ownerDb = memoryFirestore(), input = officialResearchInput();
    const staged = await stageReviewedResearch(ownerDb, input, "authenticated-offline-owner", Date.parse(now));
    const result: any = await admitPublishedResearch(staged, input.candidate.candidate_key, { db: ownerDb, now: () => Date.parse(now),
      readResearch: (date, admissionId) => readExistingResearchSnapshot(ownerDb, date, admissionId), isSuppressed: async () => false });
    expect(result.state).toBe("admitted");
    for (const [path, value] of ownerDb.records) f.records.set(path, structuredClone(value));
    f.binding.prospectIds = [result.prospectId];
    const session = await f.open({ crmIds: [], prospectIds: [result.prospectId] });
    expect(session.handoff.provenance.quarantine).toEqual([]);
    expect(session.handoff.priorContactAndOutcomes.prospects[0]).toMatchObject({ hasResearch: true, acceptedTouches: 0, outcome: "unknown", interestSubtype: "unknown", contactAvailabilityAtTouch: "verified_business_route" });
    const events = session.history(result.prospectId, { pageSize: 25, cursor: null }).events;
    expect(events.every(event => event.entities.crmId === null)).toBe(true);
    const details = session.researchDetails(result.prospectId, { pageSize: 1, cursor: null });
    expect(details.records[0].facts.some(fact => fact.sourceUrl === input.candidate.evidence[0].url)).toBe(true);
    expect(details.records[0].privacyOmissions).toBe("private_or_nonpublic_fields_omitted");
    expect(JSON.stringify(details)).not.toContain(input.assessment.contact.email);
    expect(f.reads).toContain(`blueprintCommunications/default/reviewedResearch/${staged.row.admission_id}`);
    expect(f.writes).toEqual([]);
    const provenancePath = `blueprintCommunications/default/researchSources/${result.briefDigest}`;
    const changed = f.records.get(provenancePath); changed.source.recordReceipt = "firestore:wrong"; f.records.set(provenancePath, changed);
    const invalid = await f.open({ crmIds: [], prospectIds: [result.prospectId] });
    expect(invalid.handoff.provenance.quarantine.length).toBeGreaterThan(0);
    expect(invalid.researchDetails(result.prospectId, { pageSize: 1, cursor: null }).records).toEqual([]);
    changed.source.recordReceipt = (ownerDb.records.get(provenancePath) as any).source.recordReceipt;
    const proof = await resolvePublicContact(changed.source, result.prospectId, async url => ({ requestedUrl: url, finalUrl: url, redirects: [],
      checkedAt: now, status: 200, contentType: "text/html", bodyBase64: Buffer.from(`<p>${input.candidate.organization}. Business inquiries: ${input.assessment.contact.email}</p>`).toString("base64") }), () => Date.parse(now));
    const originalBrief = f.records.get(`blueprintCommunications/default/briefs/${result.briefId}`);
    const resolvedBrief = communicationsBriefSchema.parse({ ...originalBrief, briefId: `${originalBrief.briefId}-resolved`, revision: 2,
      qualityReview: { ...originalBrief.qualityReview, reviewedAt: now }, contact: { ...originalBrief.contact,
        sourceUrl: proof.contact.sourceUrl, sourceCheckedAt: proof.contact.sourceCheckedAt, scope: proof.contact.scope },
      researchOrigin: { ...originalBrief.researchOrigin, contactEvidenceKind: "public_operator_resolution", contactEvidenceDigest: communicationsDigest(proof) } });
    const resolvedDigest = communicationsDigest(resolvedBrief), root = "blueprintCommunications/default";
    const resolvedJob = { ...f.records.get(`${root}/jobs/${result.jobId}`), jobId: "resolved-job", briefId: resolvedBrief.briefId, briefDigest: resolvedDigest };
    f.records.set(`${root}/jobs/resolved-job`, resolvedJob); f.records.set(`${root}/briefs/${resolvedBrief.briefId}`, resolvedBrief);
    f.records.set(`${root}/handoffs/${resolvedDigest}`, { ...f.records.get(`${root}/handoffs/${result.briefDigest}`), ...resolvedBrief.qualityReview, briefDigest: resolvedDigest });
    f.records.set(`${root}/researchSources/${resolvedDigest}`, { ...changed, briefDigest: resolvedDigest });
    const proofPath = `${root}/contactProofs/${communicationsDigest(proof)}`; f.records.set(proofPath, proof);
    const resolved = await f.open({ crmIds: [], prospectIds: [result.prospectId] });
    expect(resolved.handoff.provenance.quarantine).toEqual([]); expect(f.reads).toContain(proofPath);
    expect(resolved.researchDetails(result.prospectId, { pageSize: 25, cursor: null }).records).toHaveLength(2);
    expect(JSON.stringify(resolved.handoff)).not.toContain(input.assessment.contact.email);
    for (const badProof of [undefined, { ...proof, contact: { ...proof.contact, email: "other@example.org" } }]) {
      f.records.set(proofPath, badProof);
      const rejected = await f.open({ crmIds: [], prospectIds: [result.prospectId] });
      expect(rejected.handoff.provenance.quarantine).toContainEqual(expect.objectContaining({ recordRef: `${root}/jobs/resolved-job` }));
      expect(rejected.researchDetails(result.prospectId, { pageSize: 25, cursor: null }).records).toHaveLength(1);
    }
  });
  it("keeps nonresponse, curiosity, human correction and later owner outcomes distinct with paged evidence IDs", async () => {
    const f = fixture(); native(f); stored(f, "research_observed"); stored(f, "contact_observed"); stored(f, "outreach_observed");
    const reply = stored(f, "reply_observed"), correction = learningCorrection(reply, { data: { ...reply.data, classification: { label: "interested", interest: "willing_to_talk", objections: ["timing"], method: "human", confidence: 1, uncertain: false } } });
    f.records.set(`${LEARNING_ROOT}/events/${correction.eventId}`, correction); stored(f, "outcome_observed");
    const session = await f.open(), summary = session.handoff.priorContactAndOutcomes.prospects[0];
    expect(summary).toMatchObject({ interestSubtype: "willing_to_talk", outcome: "call_held", explicitRejection: false, verifiedDeliveredTouches: 0, historyCount: 6, moreHistoryAvailable: true });
    const pages = []; let page = session.history("prospect-1", { pageSize: 1, cursor: null });
    for (;;) { pages.push(...page.events); if (!page.nextCursor) break; page = session.history("prospect-1", { pageSize: 1, cursor: page.nextCursor }); }
    expect(pages.map(event => event.eventId)).toContain(correction.eventId); expect(pages).toHaveLength(6);
    expect(session.handoff.priorContactAndOutcomes.planner!.causalProof).toBe(false);
    expect(session.handoff.classificationPolicy.enabled).toBe(false);
    expect(() => session.history("unrelated", { pageSize: 1, cursor: null })).toThrow("scope_denied");
    expect(() => session.history("prospect-1", { pageSize: 1, cursor: { contextHash: digest("other"), prospectId: "prospect-1", offset: 1 } })).toThrow("cursor_invalid");
  });
  it("binds history cursors to the exact prospect as well as the captured context", async () => {
    const f = fixture(); native(f); stored(f, "research_observed"); stored(f, "contact_observed");
    f.binding.prospectIds.push("prospect-2"); f.records.set("outboundProspects/prospect-2", { researchPublicationId: "BP-000002" });
    for (const kind of ["research_observed", "contact_observed"] as const) {
      const event = learningEvent(kind, "prospect-2"); f.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
    }
    const session = await f.open({ prospectIds: ["prospect-1", "prospect-2"] });
    const first = session.history("prospect-1", { pageSize: 1, cursor: null });
    expect(() => session.history("prospect-2", { pageSize: 1, cursor: first.nextCursor })).toThrow("cursor_invalid");
  });
  it("preserves missing contact history as unknown and flags malformed current jobs without raw record content", async () => {
    const f = fixture(); native(f); f.records.set("blueprintCommunications/default/jobs/invalid", { prospectId: "prospect-1", body: "PRIVATE_BODY_SENTINEL" });
    const session = await f.open(); expect(session.handoff.priorContactAndOutcomes.coverage).toBe("partial_authorized_scope");
    expect(session.handoff.unknowns).toContain("current_history_incomplete"); expect(JSON.stringify(session.handoff)).not.toContain("PRIVATE_BODY_SENTINEL");
    expect(session.handoff.priorContactAndOutcomes.prospects[0].unknowns).toContain("contact_missing_or_not_authorized");
  });
  it("does not expose malformed stored event document IDs or untrusted raw body fields", async () => {
    const f = fixture(); native(f); f.records.set(`${LEARNING_ROOT}/events/private@example.org`, { entities: { prospectId: "prospect-1" }, body: "PRIVATE_BODY_SENTINEL" });
    const session = await f.open(); const text = JSON.stringify(session.handoff); expect(text).not.toContain("private@example.org"); expect(text).not.toContain("PRIVATE_BODY_SENTINEL");
    expect(session.handoff.unknowns).toContain("stored_history_incomplete");
  });
  it("retains a captured session when source records change and prevents mutation of returned authority", async () => {
    const f = fixture(); native(f); stored(f, "research_observed"); const session = await f.open();
    session.handoff.scope.prospectIds.push("unrelated"); session.handoff.discovery.firstPage.rows[0].name = "Changed";
    expect(() => session.history("unrelated", { pageSize: 1, cursor: null })).toThrow("scope_denied");
    expect(session.search(query).rows[0].name).toBe("Company 1");
    stored(f, "outcome_observed"); expect(session.history("prospect-1", { pageSize: 25, cursor: null }).events).toHaveLength(1);
    const next = await f.open(); expect(next.history("prospect-1", { pageSize: 25, cursor: null }).events).toHaveLength(2);
  });
  it("supports an unknown-only cached scope without inferring capability incompatibility", async () => {
    const f = fixture(); native(f, "BP-NEW"); f.binding.crmIds = ["BP-NEW"]; f.binding.discoveryCapabilityIds = ["cap-new"]; f.binding.detailCapabilityIds = ["cap-new"];
    const session = await f.open({ crmIds: ["BP-NEW"], capabilityIds: ["cap-new"] });
    expect(session.handoff.discovery.firstPage.totalIndexed).toBe(0);
    expect(session.details(["cap-new"])).toMatchObject({ snapshot: null, missingCapabilityIds: ["cap-new"], absenceMeans: "unknown_not_incompatible" });
    expect(session.handoff.priorContactAndOutcomes.prospects).toHaveLength(1);
  });
  it("bounds initial human observations and retrieves remaining CRM-scoped evidence progressively", async () => {
    const f = fixture();
    for (let index = 0; index < 6; index++) {
      const event = makeSiteLearning({ crmId: "BP-000001", canonicalProspectId: null, siteId: null, taskId: null,
        occurredAt: now, recordedAt: now, capturedBy: "human-1", ownerConfirmed: true, correctsEventId: null,
        statedMotive: `Site question ${index}`, boundedQuestion: null, decisionChangingEvidence: null, statedDecisionOwnerId: "owner-1", evidenceOwnerId: null,
        briefChoice: "unknown", brief: null, usefulness: "unknown", feedback: null,
        attestation: { recordRef: `humanLearning/${index}`, sourceHash: digest(index), attestedBy: "human-1", attestedAt: now } });
      f.records.set(`${LEARNING_ROOT}/siteLearningEvents/${event.eventId}`, event);
    }
    const session = await f.open(); expect(session.handoff.siteLearning).toMatchObject({ currentCount: 6, historyCount: 6, moreHistoryAvailable: true });
    expect(session.handoff.siteLearning.recent).toHaveLength(5);
    const first = session.siteHistory("BP-000001", { pageSize: 3, cursor: null }), next = session.siteHistory("BP-000001", { pageSize: 3, cursor: first.nextCursor });
    expect([...first.events, ...next.events]).toHaveLength(6); expect(next.nextCursor).toBeNull();
    expect(() => session.siteHistory("BP-000002", { pageSize: 3, cursor: null })).toThrow("scope_denied");
    expect(() => session.siteHistory("BP-000001", { pageSize: 3, cursor: { contextHash: session.handoff.contextHash, crmId: "BP-000002", offset: 3 } })).toThrow("cursor_invalid");
    expect(f.writes).toEqual([]);
  });
});
