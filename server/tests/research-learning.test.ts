import { describe, expect, it } from "vitest";
import { CLASSIFICATION_POLICY, digest, makeEvent, validateEvent, type EventInput, type LearningEvent } from "../research-learning/contract";
import { buildSnapshot, resolveHistory, verifySnapshot } from "../research-learning/snapshot";
import { planResearchLearning } from "../research-learning/planner";
import { ResearchLearningStore } from "../research-learning/store";
import { dryRunMigration, migrationFixture } from "../research-learning/migration";
import { normalizeExistingSources, readExistingSources, type ExistingProspectSources } from "../research-learning/existing-sources";
import { researchLearningContext, sheetsLearningView, notionLearningSummary } from "../research-learning/harness";
import { learningNow, learningEvent, learningScope, learningCorrection, learningScenario, learningMemoryFirestore } from "./fixtures/research-learning";
import { publishedResearchFixture } from "./fixtures/published-research";
import { previewResearchCommunications } from "../agents/communications-producer";
import { communicationsBriefSchema, communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";

const focus = { city: "Sacramento", industry: "Laundromats" };
function snapshot(events: LearningEvent[], ids = ["prospect-1"]) {
  const { grant, request } = learningScope(ids);
  return buildSnapshot(events, grant, request, learningNow);
}
function remake(event: LearningEvent, changes: Record<string, any>) {
  const { eventId: _id, version: _version, ...input } = event;
  return makeEvent({ ...input, ...changes } as EventInput);
}

describe("research learning evidence and privacy contract", () => {
  it("hashes maps deterministically and refuses modified evidence", () => {
    expect(digest({ b: 2, a: 1 })).toBe(digest({ a: 1, b: 2 }));
    const event = learningEvent("research_observed");
    expect(() => validateEvent({ ...event, occurredAt: "2026-09-02T00:00:00Z" })).toThrow("hash_mismatch");
  });
  it.each(["body", "subject", "contactEmail", "accessToken", "unrelatedMailbox"])("rejects raw %s in shared events", field => {
    expect(() => validateEvent({ ...learningEvent("reply_observed"), [field]: "PRIVATE_SENTINEL" })).toThrow();
  });
  it("requires evidence kinds, ownership and acceptance references", () => {
    const send = learningEvent("outreach_observed");
    expect(() => remake(send, { writer: "research_adapter" })).toThrow("field_owner");
    expect(() => remake(send, { evidence: [{ ...send.evidence[0], basis: "public_research" }] })).toThrow("basis_missing");
    expect(() => remake(send, { data: { ...send.data, messageId: null } })).toThrow("receipt_missing");
  });
  it("keeps paid classification disabled and curiosity distinct from readiness", () => {
    expect(CLASSIFICATION_POLICY).toEqual({ model: "gpt-6-luna", enabled: false });
    const reply = learningEvent("reply_observed");
    expect(() => remake(reply, { data: { ...reply.data, classification: { label: "curiosity", interest: "pilot_discussion", confidence: 1, method: "human", uncertain: false, objections: [] } } })).toThrow("classification_inconsistent");
    expect(() => remake(reply, { data: { ...reply.data, classification: { label: "interested", interest: "pilot_ready", confidence: 1, method: "model", uncertain: false, objections: [] } } })).toThrow();
  });
  it("bounds relevant prospects, sections, expiry and cutoff", () => {
    const { grant, request } = learningScope();
    expect(() => buildSnapshot([], grant, { ...request, prospectIds: ["unrelated"] }, learningNow)).toThrow("scope_denied");
    expect(() => buildSnapshot([], { ...grant, sections: ["research"] }, request, learningNow)).toThrow("scope_denied");
    expect(() => buildSnapshot([], { ...grant, expiresAt: learningNow }, request, learningNow)).toThrow("scope_denied");
    expect(() => buildSnapshot([], grant, { ...request, asOf: "2027-01-01T00:00:00Z" }, learningNow)).toThrow("scope_denied");
  });
  it("omits unauthorized sections and unrelated data before serialization", () => {
    const { grant, request } = learningScope();
    const research = learningEvent("research_observed"), reply = learningEvent("reply_observed");
    const view = buildSnapshot([research, reply, { entities: { prospectId: "unrelated" }, body: "PRIVATE_SENTINEL" }],
      { ...grant, sections: ["research"] }, { ...request, sections: ["research"] }, learningNow);
    expect(view.rows[0].history.map(e => e.kind)).toEqual(["research_observed"]);
    expect(JSON.stringify(view)).not.toContain("PRIVATE_SENTINEL");
    expect(JSON.stringify(view)).not.toContain("reply-prospect");
  });
  it("uses append-only correction chains independently of ingestion order", () => {
    const original = learningEvent("reply_observed");
    const correction = learningCorrection(original, { data: { ...original.data, classification: { label: "rejection", interest: "unknown", confidence: 1, method: "human", uncertain: false, objections: ["timing"] } } });
    const again = learningCorrection(correction, { data: { ...original.data } });
    expect(resolveHistory([again, original, correction]).active.map(e => e.eventId)).toEqual([again.eventId]);
    expect(resolveHistory([again, original, correction]).history).toHaveLength(3);
    expect(() => resolveHistory([correction])).toThrow("target_invalid");
    expect(() => resolveHistory([original, correction, learningCorrection(original)])).toThrow("correction_conflict");
    expect(() => learningCorrection(original, { data: { ...original.data, classification: { label: "unknown", interest: "unknown", confidence: 0, method: "legacy_unknown", uncertain: true, objections: [] } } })).toThrow("requires_human");
  });
  it("prevents corrections from changing exact prospect/message joins", () => {
    const original = learningEvent("reply_observed");
    expect(() => resolveHistory([original, learningCorrection(original, { entities: { ...original.entities, taskId: "different" } })])).toThrow("target_invalid");
    expect(() => resolveHistory([original, learningCorrection(original, { data: { ...original.data, threadId: "other-thread" } })])).toThrow("join_changed");
  });
  it.each(["payloadDigest", "approvalLedgerId", "messageDigest", "outreachVersion", "intent", "campaignId", "timingWindow"])("preserves immutable outreach %s across human corrections", field => {
    const original = learningEvent("outreach_observed");
    const value = field.endsWith("Digest") ? digest("changed") : field === "intent" ? "reply" : "changed";
    expect(() => resolveHistory([original, learningCorrection(original, { data: { ...original.data, [field]: value } })])).toThrow("source_owned_fields_changed");
  });
  it("does not backdate future ingestion or human review", () => {
    const event = learningEvent("reply_observed"), { grant, request } = learningScope();
    expect(buildSnapshot([event], grant, { ...request, asOf: "2026-09-15T00:00:00.000Z" }, learningNow).rows[0].history).toEqual([]);
    expect(() => remake(event, { occurredAt: "2026-12-01T00:00:00Z" })).toThrow("future_evidence");
  });
  it("checks snapshot hashes, principals and deterministic ordering", () => {
    const scenario = learningScenario(), view = buildSnapshot(scenario.events, scenario.grant, scenario.request, learningNow);
    expect(buildSnapshot([...scenario.events].reverse(), scenario.grant, scenario.request, learningNow)).toEqual(view);
    expect(verifySnapshot(view, scenario.grant, learningNow)).toEqual(view);
    expect(() => verifySnapshot({ ...view, rows: [] }, scenario.grant, learningNow)).toThrow("readback_mismatch");
    expect(() => verifySnapshot(view, { ...scenario.grant, principalId: "another-agent" }, learningNow)).toThrow("readback_mismatch");
  });
});

describe("observed learning counts and comparison cohorts", () => {
  it("reports mature denominators, pending, nonresponse, curiosity and rejection independently", () => {
    const s = learningScenario(), view = buildSnapshot(s.events, s.grant, s.request, learningNow);
    const plan = planResearchLearning(view, focus);
    expect(plan.cohorts[0].counts).toMatchObject({ researchedProspects: 4, attemptedTouches: 3, acceptedTouches: 3,
      verifiedDeliveredTouches: 0, matureAcceptedProspects: 2, matureReplyRate: { numerator: 1, denominator: 2 },
      matureNonresponseProspects: 1, pendingProspects: 1, explicitRejections: 0, curiosityReplies: 1 });
    expect(plan.cohorts[1].counts).toMatchObject({ researchedProspects: 2, bouncedTouches: 1, matureAcceptedProspects: 1 });
    expect(plan.cohorts[2].counts).toMatchObject({ unknownAcknowledgementTouches: 1, explicitRejections: 1 });
    expect(plan.causalProof).toBe(false); expect(plan.stopAfterProspectCount).toBeNull(); expect(plan.allocation.newExploration).toBeGreaterThan(0);
  });
  it("does not let an unrelated delivery suppress another job's unknown delivery", () => {
    const send = learningEvent("outreach_observed"), other = learningEvent("delivery_observed", "prospect-1", { data: { ...learningEvent("delivery_observed").data, jobId: "other-job" } });
    expect(snapshot([send, other]).rows[0].unknowns).toContain("delivery_unknown");
  });
  it("bounds delivery rates when true delivery follows unknown send acknowledgement", () => {
    const original = learningEvent("outreach_observed");
    const attempt = remake(original, { data: { ...original.data, status: "unknown", messageId: null, threadId: null }, evidence: [{ ...original.evidence[0], basis: "send_attempt" }] });
    const view = snapshot([learningEvent("research_observed"), attempt, learningEvent("delivery_observed")]);
    expect(planResearchLearning(view, focus).cohorts[0].counts).toMatchObject({ verifiedDeliveredTouches: 1, verifiedDeliveryRate: { numerator: 0, denominator: 0 } });
  });
  it("counts distinct jobs once and preserves original mature window after later bounce", () => {
    const first = learningEvent("outreach_observed");
    const later = remake(first, { occurredAt: "2026-09-20T10:00:00.000Z", data: { ...first.data, jobId: "follow-up", messageId: "later-message", threadId: "later-thread" } });
    const bounce = learningEvent("delivery_observed", "prospect-1", { occurredAt: "2026-09-21T10:00:00.000Z", data: { ...learningEvent("delivery_observed").data, jobId: "follow-up", messageId: "later-message", threadId: "later-thread", status: "bounced" } });
    const view = snapshot([learningEvent("research_observed"), first, first, later, bounce]);
    expect(planResearchLearning(view, focus).cohorts[0].counts).toMatchObject({ acceptedTouches: 2, matureAcceptedProspects: 1, matureNonresponseProspects: 1 });
  });
  it("counts a correlated reply on a later accepted thread within the original observation window", () => {
    const first = learningEvent("outreach_observed"), reply = learningEvent("reply_observed");
    const later = remake(first, { occurredAt: "2026-09-20T10:00:00.000Z", data: { ...first.data,
      jobId: "follow-up", approvalLedgerId: "communications_follow-up", messageId: "later-message", threadId: "later-thread" } });
    const answer = remake(reply, { occurredAt: "2026-09-21T10:00:00.000Z", data: { ...reply.data,
      jobId: "reply-job", messageId: "later-answer", threadId: "later-thread" } });
    const plan = planResearchLearning(snapshot([learningEvent("research_observed"), first, later, answer]), focus);
    expect(plan.cohorts[0].counts).toMatchObject({ acceptedTouches: 2, matureAcceptedProspects: 1,
      repliedProspects: 1, matureNonresponseProspects: 0, matureReplyRate: { numerator: 1, denominator: 1 } });
  });
  it.each(["before_acceptance", "unrelated_thread", "automatic", "other_contract"])("keeps accepted-rate eligibility separate for %s reply evidence", change => {
    const first = learningEvent("outreach_observed"), originalReply = learningEvent("reply_observed");
    let later = remake(first, { occurredAt: "2026-09-20T10:00:00.000Z", data: { ...first.data,
      jobId: "follow-up", approvalLedgerId: "communications_follow-up", messageId: "later-message", threadId: "later-thread" } });
    let reply = remake(originalReply, { occurredAt: "2026-09-21T10:00:00.000Z", data: { ...originalReply.data,
      jobId: "reply-job", messageId: "later-answer", threadId: "later-thread" } });
    if (change === "before_acceptance") reply = remake(reply, { occurredAt: "2026-09-19T10:00:00.000Z" });
    if (change === "unrelated_thread") reply = remake(reply, { data: { ...reply.data, threadId: "unrelated" } });
    if (change === "other_contract") reply = remake(reply, { data: { ...reply.data, outreachVersion: "other.v1" } });
    if (change === "automatic" && reply.kind === "reply_observed") reply = remake(reply, { data: { ...reply.data,
      classification: { ...reply.data.classification, label: "automatic", interest: "unknown" } } });
    const plan = planResearchLearning(snapshot([learningEvent("research_observed"), first, later, reply]), focus);
    expect(plan.cohorts[0].counts).toMatchObject({ matureAcceptedProspects: 1, repliedProspects: change === "automatic" ? 0 : 1,
      replyAcceptanceUnknownProspects: change === "automatic" ? 0 : 1, matureNonresponseProspects: change === "automatic" ? 1 : 0,
      matureReplyRate: { numerator: 0, denominator: 1 } });
  });
  it.each([[true, false], [false, false], [true, true], [false, true]])("keeps unknown-ACK replies visible with prior accepted=%s and null Gmail refs=%s", (priorAccepted, nullRefs) => {
    const first = learningEvent("outreach_observed"), originalReply = learningEvent("reply_observed");
    const unknown = remake(first, { occurredAt: "2026-09-20T10:00:00.000Z", data: { ...first.data, status: "unknown",
      jobId: "follow-up", approvalLedgerId: "communications_follow-up", messageId: nullRefs ? null : "later-message", threadId: nullRefs ? null : "later-thread" },
      evidence: [{ ...first.evidence[0], basis: "send_attempt" }] });
    const reply = remake(originalReply, { occurredAt: "2026-09-21T10:00:00.000Z", data: { ...originalReply.data,
      jobId: "reply-job", messageId: "later-answer", threadId: "later-thread" } });
    const view = snapshot([learningEvent("research_observed"), ...(priorAccepted ? [first] : []), unknown, reply]);
    const plan = planResearchLearning(view, focus);
    expect(plan.cohorts[0].counts).toMatchObject({ repliedProspects: 1, replyAcceptanceUnknownProspects: 1,
      matureAcceptedProspects: priorAccepted ? 1 : 0, matureReplyAcceptanceUnknownProspects: priorAccepted ? 1 : 0,
      matureNonresponseProspects: 0, matureReplyRate: { numerator: 0, denominator: priorAccepted ? 1 : 0 } });
    const { grant } = learningScope(), exportView = sheetsLearningView(view, grant, learningNow);
    expect(exportView.rows[0][exportView.columns.indexOf("reply_acceptance_unknown")]).toBe(true);
  });
  it.each([true, false])("preserves legacy correlated reply observations when their touch is missing, prior accepted=%s", priorAccepted => {
    const originalReply = learningEvent("reply_observed");
    const reply = remake(originalReply, { occurredAt: "2026-09-21T10:00:00.000Z", data: { ...originalReply.data,
      jobId: "legacy-reply-job", threadId: "legacy-thread" } });
    const view = snapshot([learningEvent("research_observed"), ...(priorAccepted ? [learningEvent("outreach_observed")] : []), reply]);
    const counts = planResearchLearning(view, focus).cohorts[0].counts;
    expect(counts).toMatchObject({ repliedProspects: 1, replyAcceptanceUnknownProspects: 1,
      acceptedTouches: priorAccepted ? 1 : 0, matureReplyAcceptanceUnknownProspects: priorAccepted ? 1 : 0,
      matureNonresponseProspects: 0, matureReplyRate: { numerator: 0, denominator: priorAccepted ? 1 : 0 } });
  });
  it("freezes cohort metadata and contact availability at the first touch", () => {
    const research = learningEvent("research_observed"), contact = learningEvent("contact_observed");
    const changed = remake(research, { occurredAt: "2026-09-15T10:00:00.000Z", data: { ...research.data, city: "Oakland", industry: "Retail" } });
    const changedContact = remake(contact, { occurredAt: "2026-09-15T10:00:00.000Z", data: { availability: "missing" } });
    const plan = planResearchLearning(snapshot([research, contact, learningEvent("outreach_observed"), changed, changedContact]), focus);
    expect(plan.cohorts[0].counts.researchedProspects).toBe(1);
    expect(plan.cohorts[0].strata[0].controls.contact).toBe("verified_business_route");
  });
  it("keeps observed milestones after a later pilot outcome", () => {
    const later = learningEvent("outcome_observed", "prospect-1", { occurredAt: "2026-09-20T10:00:00.000Z", data: { outcome: "pilot_started", ownerConfirmed: true, outcomeRecordId: "later-outcome" } });
    const plan = planResearchLearning(snapshot([learningEvent("research_observed"), learningEvent("outcome_observed"), later]), focus);
    expect(plan.cohorts[0].counts.laterOutcomes).toMatchObject({ call_held: 1, pilot_started: 1 });
  });
  it("requires all authorized sections before planning and separates copy digests", () => {
    expect(() => planResearchLearning({ ...snapshot([]), scope: { ...snapshot([]).scope, sections: ["research"] } }, focus)).toThrow("sections_missing");
    const one = learningEvent("outreach_observed", "one"), two = learningEvent("outreach_observed", "two");
    const different = remake(two, { data: { ...two.data, messageDigest: digest("different-copy") } });
    const plan = planResearchLearning(snapshot([learningEvent("research_observed", "one"), learningEvent("research_observed", "two"), one, different], ["one", "two"]), focus);
    expect(plan.cohorts[0].strata).toHaveLength(2);
  });
});

function existingSourceFixture(): ExistingProspectSources {
  const f = publishedResearchFixture();
  const preview = previewResearchCommunications(f.snapshot, "prospect-1", f.prospect, f.input, Date.parse("2026-09-30T23:00:00Z"));
  const brief = communicationsBriefSchema.parse({ ...preview.proposal, qualityReview: { state: "approved", reviewedBy: "offline-fixture", reviewedAt: "2026-09-30T23:00:00.000Z", sourceRecordUrl: preview.sourceRecordUrl } });
  const briefDigest = communicationsDigest(brief);
  const job = { jobId: "job-1", prospectId: brief.prospectId, briefId: brief.briefId, briefDigest, intent: "outreach", inboundMessageId: null };
  const envelope = { version: "blueprint.communications.v1", job, brief, thread: null, output: f.output, approvalState: "pending_approval" };
  const payload = { communications: envelope, to: brief.contact.email, subject: f.output.subject, body: f.output.body, transportBody: f.output.body };
  return { prospectId: brief.prospectId, prospect: { ...f.prospect, siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, researchPublicationId: preview.source.sheetsProspectId },
    jobs: [{ id: job.jobId, record: { ...job, state: "running", checkpoint: {} }, brief,
      handoff: { version: "blueprint.communications-handoff.v1", ...brief.qualityReview, briefDigest, sheetsReceipt: preview.source.sheetsReceipt, notionReceipt: preview.source.notionReceipt },
      researchSource: { briefDigest, source: preview.source }, ledger: { action_payload: payload },
      receipt: { jobId: job.jobId, state: "sent", payloadDigest: communicationsDigest(payload), approvalLedgerId: `communications_${job.jobId}`,
        attemptedAt: "2026-09-30T23:10:00.000Z", sentAt: "2026-09-30T23:11:00.000Z", receipt: { messageId: "out-1", threadId: "thread-1" } } }],
    communicationsEvents: [{ id: "unrelated", record: { type: "other", body: "PRIVATE_SENTINEL" } }] };
}

function existingReplySourceFixture(): ExistingProspectSources {
  const input = existingSourceFixture(), bundle = input.jobs[0], originalJob = structuredClone(bundle.record) as any;
  const brief: any = { ...(bundle.brief as any), priorConversation: { gmailThreadId: "thread-1", gmailMessageIds: ["out-1"] } };
  const briefDigest = communicationsDigest(brief);
  bundle.brief = brief;
  bundle.record = { ...originalJob, jobId: "reply-job", briefDigest, intent: "reply", inboundMessageId: "in-1" };
  bundle.id = "reply-job";
  bundle.handoff = { ...(bundle.handoff as any), briefDigest };
  bundle.researchSource = { ...bundle.researchSource, briefDigest };
  bundle.receipt = undefined; bundle.ledger = undefined;
  input.communicationsEvents = [{ id: "sent_job-1", record: { type: "sent", job: originalJob,
    receipt: { messageId: "out-1", threadId: "thread-1", rfcMessageId: "<out-1@tryblueprint.io>" } } },
  { id: "reply_in-1", record: { type: "reply_received", jobId: "reply-job", untrusted: true, message: {
    gmailMessageId: "in-1", gmailThreadId: "thread-1", from: brief.contact.email, to: ["nijel@tryblueprint.io"],
    receivedAt: "2026-10-01T10:00:00Z", inReplyTo: "<out-1@tryblueprint.io>", references: [], body: "PRIVATE_REPLY_SENTINEL" } } }];
  return input;
}

describe("read-only existing-source joins and staged migration", () => {
  it("groups identical canonical copy despite distinct recipient transport footers", () => {
    const first = existingSourceFixture(), second = structuredClone(first), later = second.jobs[0];
    const identity = later.record as any;
    later.id = "job-2"; later.record = { ...identity, jobId: later.id };
    later.ledger.action_payload.communications.job = { ...later.ledger.action_payload.communications.job, jobId: later.id };
    // Match the real worker shape: canonical output stays unchanged while
    // recipient/job-specific unsubscribe content changes the transport body.
    for (const [input, recipient] of [[first, "one"], [second, "two"]] as const) {
      const bundle = input.jobs[0];
      bundle.ledger.action_payload.transportBody += `\nUnsubscribe: https://example.test/unsubscribe/${recipient}/${bundle.id}`;
      bundle.receipt = { ...bundle.receipt, jobId: bundle.id, approvalLedgerId: `communications_${bundle.id}`,
        payloadDigest: communicationsDigest(bundle.ledger.action_payload) };
    }
    const outreach = (input: ExistingProspectSources) => {
      const result = normalizeExistingSources([input], learningNow);
      expect(result.quarantine).toEqual([]);
      const event = result.events.find(e => e.kind === "outreach_observed")!;
      if (event.kind !== "outreach_observed") throw new Error("outreach_missing");
      return event;
    };
    const one = outreach(first), two = outreach(second);
    expect(one.data.payloadDigest).not.toBe(two.data.payloadDigest);
    expect(one.evidence[0].sourceHash).not.toBe(two.evidence[0].sourceHash);
    expect(one.data.messageDigest).toBe(two.data.messageDigest);
    const changed = structuredClone(second), bundle = changed.jobs[0], payload = bundle.ledger.action_payload;
    payload.communications.output.body += "\nA different learning question.";
    payload.body = payload.communications.output.body;
    payload.transportBody = payload.body + "\nUnsubscribe: https://example.test/unsubscribe/two/job-2";
    bundle.receipt.payloadDigest = communicationsDigest(payload);
    expect(outreach(changed).data.messageDigest).not.toBe(one.data.messageDigest);
  });
  it("maps actual source shapes, preserving IDs and source dates without exposing private content", () => {
    const input = existingSourceFixture(), normalized = normalizeExistingSources([input], learningNow);
    expect(normalized.quarantine).toEqual([]); expect(normalized.events).toHaveLength(3);
    expect(normalized.events[0].entities).toMatchObject({ prospectId: "prospect-1", crmId: "BP-000042", siteId: "site-1", taskId: "task-1", caseId: "case-1" });
    const research = normalized.events.find(e => e.kind === "research_observed")!;
    if (research.kind === "research_observed") expect(research.data.factChecks[0].sourceCheckedAt).toBe("2026-09-30T20:00:00.000Z");
    const serialized = JSON.stringify(normalized.events);
    expect(serialized).not.toContain("PRIVATE_SENTINEL"); expect(serialized).not.toContain(input.prospect.contactEmail);
    expect(serialized).not.toContain(input.jobs[0].ledger.action_payload.transportBody);
    expect(normalized.events.some(e => e.kind === "delivery_observed")).toBe(false);
  });
  it.each(["crm", "site", "case", "recipient", "ledger_job", "source_digest", "receipt_job", "copy_subject", "copy_body"])("quarantines invalid %s joins without partial events", change => {
    const input = existingSourceFixture(), job = input.jobs[0];
    if (change === "crm") input.prospect.researchPublicationId = "different";
    if (change === "site") input.prospect.siteId = "different";
    if (change === "case") input.prospect.caseId = "different";
    if (change === "recipient") job.ledger.action_payload.to = "different@facility.example";
    if (change === "ledger_job") job.ledger.action_payload.communications.job.prospectId = "different";
    if (change === "source_digest") job.researchSource.source.candidate.city = "Changed";
    if (change === "receipt_job") job.receipt.jobId = "different";
    if (change === "copy_subject") job.ledger.action_payload.subject = "Different copy";
    if (change === "copy_body") job.ledger.action_payload.body = "Different copy";
    if (["recipient", "ledger_job", "copy_subject", "copy_body"].includes(change)) job.receipt.payloadDigest = communicationsDigest(job.ledger.action_payload);
    const result = normalizeExistingSources([input], learningNow);
    expect(result.events).toEqual([]); expect(result.quarantine).toHaveLength(1);
  });
  it("preserves historical sends and blocks cutover when current contact changes", () => {
    const input = existingSourceFixture(); input.prospect.contactEmail = "corrected@facility.example";
    const result = normalizeExistingSources([input], learningNow);
    expect(result.events).toHaveLength(3); expect(result.quarantine[0].reason).toBe("historical_contact_change_requires_reconciliation");
  });
  it("requires actual RFC/Gmail correlation and leaves legacy reply meaning unknown", () => {
    const input = existingReplySourceFixture();
    const result = normalizeExistingSources([input], learningNow);
    expect(result.quarantine).toEqual([]);
    expect(result.events.find(e => e.kind === "reply_observed")?.data).toMatchObject({ classification: { label: "unknown", uncertain: true, method: "legacy_unknown" } });
    expect(JSON.stringify(result.events)).not.toContain("PRIVATE_REPLY_SENTINEL");
    input.communicationsEvents[1].record.message.inReplyTo = "<unrelated@tryblueprint.io>";
    expect(normalizeExistingSources([input], learningNow).quarantine).toHaveLength(1);
  });
  it("retains the worker-recorded earlier correlated opt-out alongside a reply job's trigger", () => {
    const input = existingReplySourceFixture(), earlier = structuredClone(input.communicationsEvents[1]);
    earlier.id = "reply_in-0"; earlier.record.message.gmailMessageId = "in-0";
    earlier.record.message.receivedAt = "2026-10-01T09:00:00Z";
    earlier.record.message.body = "PRIVATE_EARLIER_OPT_OUT: stop emailing me";
    input.communicationsEvents.push(earlier);
    const result = normalizeExistingSources([input], learningNow);
    expect(result.quarantine).toEqual([]); expect(result.events).toHaveLength(4);
    expect(result.events.filter(e => e.kind === "reply_observed").map(e => e.data.messageId).sort()).toEqual(["in-0", "in-1"]);
    expect(JSON.stringify(result.events)).not.toContain("PRIVATE_EARLIER_OPT_OUT");
    expect((input.jobs[0].record as any).inboundMessageId).toBe("in-1");
  });
  it.each(["event_id", "thread", "sender", "recipient", "rfc", "job_intent", "missing_trigger"])("still quarantines historical reply identity mismatch: %s", change => {
    const input = existingReplySourceFixture(), earlier = structuredClone(input.communicationsEvents[1]);
    earlier.id = "reply_in-0"; earlier.record.message.gmailMessageId = "in-0";
    earlier.record.message.receivedAt = "2026-10-01T09:00:00Z";
    if (change === "event_id") earlier.id = "reply_wrong";
    if (change === "thread") earlier.record.message.gmailThreadId = "unrelated-thread";
    if (change === "sender") earlier.record.message.from = "unrelated@facility.example";
    if (change === "recipient") earlier.record.message.to = ["unrelated@facility.example"];
    if (change === "rfc") earlier.record.message.inReplyTo = "<unrelated@tryblueprint.io>";
    if (change === "job_intent") (input.jobs[0].record as any).intent = "outreach";
    if (change === "missing_trigger") (input.jobs[0].record as any).inboundMessageId = null;
    input.communicationsEvents.push(earlier);
    const result = normalizeExistingSources([input], learningNow);
    expect(result.events).toEqual([]); expect(result.quarantine).toHaveLength(1);
  });
  it("authorizes before any existing-source read and never reads OAuth/mailboxes", async () => {
    const memory = learningMemoryFirestore(), { grant, request } = learningScope();
    await expect(readExistingSources(memory.db, grant, { ...request, prospectIds: ["unrelated"] }, learningNow)).rejects.toThrow("scope_denied");
    expect(memory.reads).toEqual([]);
    const input = existingSourceFixture(), bundle = input.jobs[0], identity = bundle.record as any;
    memory.records.set("outboundProspects/prospect-1", input.prospect);
    const root = "blueprintCommunications/default";
    for (const [path, value] of [[`jobs/${bundle.id}`, bundle.record], [`briefs/${identity.briefId}`, bundle.brief], [`handoffs/${identity.briefDigest}`, bundle.handoff],
      [`researchSources/${identity.briefDigest}`, bundle.researchSource], [`sendReceipts/${communicationsDeliveryKey(identity)}`, bundle.receipt]] as [string, unknown][]) memory.records.set(`${root}/${path}`, value);
    memory.records.set(`action_ledger/communications_${identity.jobId}`, bundle.ledger);
    const result = await readExistingSources(memory.db, grant, request, learningNow);
    expect(result.events).toHaveLength(3); expect(memory.writes).toEqual([]);
    expect(memory.reads.some(path => /oauth|mailbox/i.test(path))).toBe(false);
    expect(JSON.stringify(result)).not.toContain(input.prospect.contactEmail);
    const limited = await readExistingSources(memory.db, { ...grant, sections: ["research"] }, { ...request, sections: ["research"] }, learningNow);
    expect(limited.events.every(event => event.kind === "research_observed")).toBe(true);
    memory.records.set(`${root}/sendReceipts/${communicationsDeliveryKey(identity)}`, { ...bundle.receipt, jobId: "unknown-orphan-job" });
    const orphan = await readExistingSources(memory.db, grant, request, learningNow);
    expect(orphan.quarantine.some(item => item.reason === "orphan_or_legacy_receipt_requires_reconciliation")).toBe(true);
    expect(orphan.events.some(event => event.kind === "outreach_observed")).toBe(false);
  });
  it("dry-runs append/replay and blocks unreconciled manifests and quarantines", () => {
    const s = learningScenario(), input = migrationFixture(s.events, s.grant, s.request, learningNow);
    const report = dryRunMigration(input);
    expect(report.readyForStagedAppend).toBe(true); expect(report.readyForCutover).toBe(false);
    expect(dryRunMigration({ ...input, existingEvents: s.events }).counts.appendEvents).toBe(0);
    expect(dryRunMigration({ ...input, expectedEvidenceRefs: [...input.expectedEvidenceRefs, "missing"] }).errors).toContain("evidence_manifest_not_reconciled");
    expect(dryRunMigration({ ...input, quarantine: [{ recordRef: "legacy", reason: "join_missing" }] }).readyForStagedAppend).toBe(false);
    expect(dryRunMigration({ ...input, expectedProspectIds: [] }).readyForStagedAppend).toBe(false);
  });
});

describe("append-only Firestore and agent/export handoffs", () => {
  it("appends idempotently, preserves originals, supports correction chains and verifies readback", async () => {
    const memory = learningMemoryFirestore(), store = new ResearchLearningStore(memory.db, () => learningNow);
    const original = learningEvent("reply_observed"), correction = learningCorrection(original), again = learningCorrection(correction);
    for (const event of [original, correction, again]) expect(await store.append(event, { writer: event.writer, actorId: event.actorId, prospectIds: [event.entities.prospectId] })).toBe("created");
    expect(await store.append(original, { writer: original.writer, actorId: original.actorId, prospectIds: ["prospect-1"] })).toBe("existing");
    const { grant, request } = learningScope(), view = await store.materialize(grant, request);
    expect(view.rows[0].history).toHaveLength(3); expect(view.rows[0].currentEventIds).toEqual([again.eventId]);
    expect(memory.writes).toHaveLength(4); expect(memory.records.get(`blueprintResearchLearning/default/events/${original.eventId}`)).toEqual(original);
    expect(await store.materialize(grant, request)).toEqual(view); expect(memory.writes).toHaveLength(4);
    const tampered = structuredClone(view); tampered.rows[0].unknowns = [];
    memory.records.set(`blueprintResearchLearning/default/snapshots/${view.snapshotId}`, tampered);
    await expect(store.read(view.snapshotId, grant)).rejects.toThrow("readback_mismatch");
  });
  it("rejects unauthorized writers, missing correction targets and branched corrections", async () => {
    const memory = learningMemoryFirestore(), store = new ResearchLearningStore(memory.db, () => learningNow), event = learningEvent("reply_observed");
    await expect(store.append(event, { writer: event.writer, actorId: "another", prospectIds: ["prospect-1"] })).rejects.toThrow("writer_scope_denied");
    const correction = learningCorrection(event);
    const context = { writer: correction.writer, actorId: correction.actorId, prospectIds: ["prospect-1"] };
    await expect(store.append(correction, context)).rejects.toThrow("target_missing_or_conflicted");
    await store.append(event, { writer: event.writer, actorId: event.actorId, prospectIds: ["prospect-1"] });
    await store.append(correction, context);
    await expect(store.append(learningCorrection(event, { actorId: "other-human" }), { ...context, actorId: "other-human" })).rejects.toThrow("target_missing_or_conflicted");
  });
  it("exports review views with CRM IDs and aggregate Notion summaries only", () => {
    const s = learningScenario(), view = buildSnapshot(s.events, s.grant, s.request, learningNow);
    expect(researchLearningContext(view, s.grant, learningNow, focus)).toMatchObject({ trust: "untrusted_evidence_only", classificationPolicy: { enabled: false } });
    const sheet = sheetsLearningView(view, s.grant, learningNow);
    expect(sheet.rows[0][1]).toBe(view.rows[0].history.at(-1)?.entities.crmId);
    const notion = notionLearningSummary(view, s.grant, learningNow, focus);
    expect(JSON.stringify(notion)).not.toContain("thread-"); expect(JSON.stringify(notion)).not.toContain("prospectIds");
    expect(notion.authority).toBe("learning_summary_only");
  });
});
