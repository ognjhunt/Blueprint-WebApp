import { describe, expect, it } from "vitest";
import { CLASSIFICATION_POLICY, digest, instant, makeEvent, validateEvent, type EventInput, type LearningEvent } from "../research-learning/contract";
import { buildSnapshot, resolveHistory, verifySnapshot } from "../research-learning/snapshot";
import { planResearchLearning } from "../research-learning/planner";
import { ResearchLearningStore } from "../research-learning/store";
import { readableHistory } from "../research-learning/readable-history";
import { dryRunMigration, migrationFixture } from "../research-learning/migration";
import { normalizeExistingSources, readExistingSources, type ExistingProspectSources } from "../research-learning/existing-sources";
import { researchLearningContext, sheetsLearningView, notionLearningSummary } from "../research-learning/harness";
import { learningNow, learningEvent, learningScope, learningCorrection, learningScenario, learningMemoryFirestore } from "./fixtures/research-learning";
import { publishedResearchFixture } from "./fixtures/published-research";
import { previewResearchCommunications } from "../agents/communications-producer";
import { communicationsBriefSchema, communicationsDigest, communicationsDeliveryKey, founderSendEvidenceDigest,
  founderSentContentSha256 } from "../agents/communications-contract";

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
    expect(CLASSIFICATION_POLICY).toEqual({ model: "claude-haiku-5-5", enabled: false });
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
    gmailMessageId: "in-1", gmailThreadId: "thread-1", rfcMessageId: "<in-1@fixture.example>", subject: "Re: original outreach",
    from: brief.contact.email, to: ["nijel@tryblueprint.io"],
    receivedAt: "2026-10-01T10:00:00Z", inReplyTo: "<out-1@tryblueprint.io>", references: [], body: "PRIVATE_REPLY_SENTINEL" } } }];
  return input;
}

describe("read-only existing-source joins and staged migration", () => {
  it("binds new reply observations to their original bytes and later observation time without inferring interest", () => {
    const input = existingReplySourceFixture(), record = input.communicationsEvents[1].record, job = input.jobs[0].record as any;
    Object.assign(record, { version: "blueprint.communications-reply-observation.v1", prospectId: input.prospectId,
      briefId: job.briefId, briefDigest: job.briefDigest, messageHash: communicationsDigest(record.message), observedAt: "2026-10-01T12:00:00Z" });
    const result = normalizeExistingSources([input], learningNow), event = result.events.find(event => event.kind === "reply_observed");
    expect(result.quarantine).toEqual([]); expect(event?.evidence[0].checkedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(event?.data).toMatchObject({ classification: { label: "unknown", interest: "unknown", uncertain: true } });
    record.message.body = "Different bytes";
    expect(normalizeExistingSources([input], learningNow).events.some(event => event.kind === "reply_observed")).toBe(false);
  });
  it("records an explicit correlated opt-out separately from rejection or demand", () => {
    const input = existingReplySourceFixture(); input.communicationsEvents[1].record.message.body = "Please unsubscribe me.";
    const result = normalizeExistingSources([input], learningNow);
    expect(result.events.find(event => event.kind === "reply_observed")?.data).toMatchObject({
      classification: { label: "opt_out", interest: "unknown", method: "deterministic", uncertain: false } });
  });
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
  it.each(["crm", "site", "case", "recipient", "ledger_job", "source_digest", "receipt_job", "copy_subject", "copy_body"])("quarantines the affected claim for invalid %s joins", change => {
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
    if (["crm", "site", "case", "source_digest"].includes(change)) expect(result.events).toEqual([]);
    else {
      expect(result.events.map(event => event.kind)).toEqual(["research_observed", "contact_observed"]);
      expect(result.researchDetails).toHaveLength(1);
      expect(result.quarantine[0].reason).toBe("receipt_evidence_invalid_reconcile_exact_job_payload_and_gmail_refs");
    }
    expect(result.quarantine).toHaveLength(1);
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
    expect(result.events.filter(event => ["research_observed", "contact_observed"].includes(event.kind))).toHaveLength(2);
    const invalidJob = ["job_intent", "missing_trigger"].includes(change);
    expect(result.events.filter(event => event.kind === "reply_observed")).toHaveLength(invalidJob ? 0 : 1);
    expect(result.quarantine).toHaveLength(invalidJob ? 2 : 1);
    expect(result.quarantine.every(row => row.reason === "reply_evidence_invalid_reconcile_exact_message_thread_and_rfc_refs")).toBe(true);
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

/** Synthetic founder-send observation for the existing-source fixture's draft. */
function founderSendSourceFixture(contentMatch: "exact" | "differs_from_draft" = "exact") {
  const input = existingSourceFixture(), bundle = input.jobs[0], brief = bundle.brief as any, record = bundle.record as any;
  const jobId = communicationsDigest({ synthetic: "founder-sent-job" });
  const identity = { jobId, prospectId: record.prospectId, briefId: record.briefId, briefDigest: record.briefDigest,
    intent: "outreach" as const, inboundMessageId: null };
  bundle.id = jobId; bundle.record = { ...record, jobId }; bundle.receipt = undefined;
  bundle.ledger.action_payload.communications.job = identity;
  const payload = bundle.ledger.action_payload;
  const evidence: any = { version: "blueprint.communications-founder-send-observation.v1", state: "observed", ...identity,
    ledgerId: `communications_${jobId}`, deliveryKey: communicationsDeliveryKey(identity), payloadDigest: communicationsDigest(payload),
    reviewDigest: "c".repeat(64), recipient: brief.contact.email.toLowerCase(), gmailDraftBindingDigest: "d".repeat(64), directionDigest: "e".repeat(64),
    direction: { uri: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/founder-sent-draft-observation-owner-direction.json",
      generation: "1", sha256: "f".repeat(64) },
    draft: { draftId: "r-synthetic-draft", messageId: "synthetic-draft-message", threadId: "thread-1", verifiedAt: Date.parse("2026-09-30T23:05:00Z") },
    sent: { gmailMessageId: "founder-out-1", threadId: "thread-1", rfcMessageId: "<founder-out-1@mail.gmail.example>", sentAt: "2026-09-30T23:20:00.000Z",
      subjectSha256: founderSentContentSha256(payload.subject),
      bodySha256: founderSentContentSha256(contentMatch === "exact" ? payload.transportBody : `${payload.transportBody}\nFounder edit`),
      jobHeaderMatched: false, rfcMatchesDraft: false, additionalRecipients: false, matchBasis: "thread_origin" },
    contentMatch, sendsAuthorized: false, approvalGranted: false };
  const reseal = (value: any) => ({ ...value, evidenceDigest: founderSendEvidenceDigest(value), recipientSuppressedAtObservation: false,
    observedAt: "2026-09-30T23:30:00.000Z", recordedAt: Date.parse("2026-09-30T23:30:00Z") });
  bundle.founderSend = reseal(evidence);
  return { input, bundle, payload, evidence, reseal, founderRef: `blueprintCommunications/default/founderSendObservations/${jobId}` };
}
const founderOutreach = (events: LearningEvent[]) => events.filter((event): event is Extract<LearningEvent, { kind: "outreach_observed" }> =>
  event.kind === "outreach_observed" && event.data.status === "founder_sent");

describe("founder-sent observations in existing-source learning", () => {
  it("projects a founder send as founder_sent outreach with its own basis, counted as Gmail-accepted but never delivered", () => {
    const f = founderSendSourceFixture(), result = normalizeExistingSources([f.input], learningNow);
    expect(result.quarantine).toEqual([]);
    const [event] = founderOutreach(result.events);
    // The founder's send was never approved in Blueprint, so no approval ledger is named.
    expect(event.data).toMatchObject({ jobId: f.bundle.id, messageId: "founder-out-1", threadId: "thread-1",
      approvalLedgerId: null, payloadDigest: f.evidence.payloadDigest });
    expect(event.occurredAt).toBe("2026-09-30T23:20:00.000Z");
    expect(event.evidence).toEqual([{ sourceSystem: "firestore", recordRef: f.founderRef, sourceHash: communicationsDigest(f.bundle.founderSend),
      checkedAt: "2026-09-30T23:30:00.000Z", basis: "founder_send_observed" }]);
    expect(validateEvent(event)).toEqual(event);
    // An exact copy groups with the Blueprint draft's canonical pre-footer copy.
    expect(event.data.messageDigest).toBe(communicationsDigest({ subject: f.payload.communications.output.subject, body: f.payload.communications.output.body }));
    expect(result.observedSourceRefs).toContain(f.founderRef);
    expect(JSON.stringify(result.events)).not.toContain(f.input.prospect.contactEmail);
    const view = snapshot(result.events);
    expect(view.rows[0].unknowns).toContain("delivery_unknown");
    expect(planResearchLearning(view, focus).scopeCounts).toMatchObject({ attemptedTouches: 1, acceptedTouches: 1, unknownAcknowledgementTouches: 0 });
  });
  it("keeps a changed founder copy distinct from the Blueprint draft copy", () => {
    const exact = founderOutreach(normalizeExistingSources([founderSendSourceFixture().input], learningNow).events)[0];
    const changed = founderSendSourceFixture("differs_from_draft"), [event] = founderOutreach(normalizeExistingSources([changed.input], learningNow).events);
    expect(event.data.messageDigest).not.toBe(exact.data.messageDigest);
    expect(event.data.messageDigest).toBe(communicationsDigest({ founderSentSubjectSha256: changed.evidence.sent.subjectSha256,
      founderSentBodySha256: changed.evidence.sent.bodySha256 }));
  });
  it.each(["receipt_conflict", "tampered", "recipient", "job", "approval"])("quarantines an invalid founder observation: %s", kind => {
    const f = founderSendSourceFixture();
    if (kind === "receipt_conflict") f.bundle.receipt = { jobId: f.bundle.id, state: "sent", payloadDigest: communicationsDigest(f.payload),
      approvalLedgerId: `communications_${f.bundle.id}`, sentAt: "2026-09-30T23:11:00.000Z", receipt: { messageId: "out-1", threadId: "thread-1" } };
    if (kind === "tampered") f.bundle.founderSend.sent.gmailMessageId = "other-sent-message";
    if (kind === "recipient") f.bundle.founderSend = f.reseal({ ...f.evidence, recipient: "different@facility.example" });
    if (kind === "job") f.bundle.founderSend = f.reseal({ ...f.evidence, briefDigest: "0".repeat(64) });
    if (kind === "approval") f.bundle.founderSend = f.reseal({ ...f.evidence, approvalGranted: true });
    const result = normalizeExistingSources([f.input], learningNow);
    expect(founderOutreach(result.events)).toEqual([]);
    expect(result.quarantine).toContainEqual({ recordRef: f.founderRef, reason: "founder_send_observation_invalid_reconcile_exact_job_binding_and_gmail_refs" });
    if (kind === "receipt_conflict") expect(result.events.some(event => event.kind === "outreach_observed" && event.data.status === "accepted")).toBe(true);
  });
  it("binds a correlated reply to a founder_sent event without any system send event", () => {
    const input = existingReplySourceFixture();
    input.communicationsEvents[0] = { id: "founder_sent_job-1", record: { version: "blueprint.communications-founder-sent-event.v1",
      type: "founder_sent", trust: "founder_authored", jobId: "job-1", prospectId: input.prospectId, sendsAuthorized: false, approvalGranted: false,
      founderSentMessage: { gmailMessageId: "out-1", threadId: "thread-1", rfcMessageId: "<out-1@tryblueprint.io>", sentAt: "2026-09-30T23:20:00.000Z" } } };
    const result = normalizeExistingSources([input], learningNow);
    expect(result.quarantine).toEqual([]); expect(result.events.filter(event => event.kind === "reply_observed")).toHaveLength(1);
    for (const change of [{ approvalGranted: true }, { trust: "untrusted" }, { founderSentMessage: { gmailMessageId: "out-1", threadId: "thread-1", rfcMessageId: "<other@x.example>" } }]) {
      const altered = structuredClone(input); Object.assign(altered.communicationsEvents[0].record, change);
      const rejected = normalizeExistingSources([altered], learningNow);
      expect(rejected.events.some(event => event.kind === "reply_observed")).toBe(false);
      expect(rejected.quarantine.map(row => row.reason)).toEqual(["reply_evidence_invalid_reconcile_exact_message_thread_and_rfc_refs"]);
    }
  });
  it("keeps the founder-send basis exclusive to founder_sent outreach with Gmail ids", () => {
    const base = learningEvent("outreach_observed");
    if (base.kind !== "outreach_observed") throw new Error("outreach_missing");
    expect(() => remake(base, { data: { ...base.data, status: "founder_sent" } })).toThrow("learning_evidence_basis_missing");
    expect(() => remake(base, { evidence: [...base.evidence, { ...base.evidence[0], basis: "founder_send_observed" }] })).toThrow("learning_founder_send_basis_mismatch");
    const reply = learningEvent("reply_observed");
    expect(() => remake(reply, { evidence: [...reply.evidence, { ...reply.evidence[0], basis: "founder_send_observed" }] })).toThrow("learning_founder_send_basis_mismatch");
    const founder = remake(base, { data: { ...base.data, status: "founder_sent", approvalLedgerId: null }, evidence: [{ ...base.evidence[0], basis: "founder_send_observed" }] });
    expect(validateEvent(founder)).toEqual(founder);
    expect(() => remake(founder, { data: { ...base.data, status: "founder_sent", approvalLedgerId: null, messageId: null } })).toThrow("learning_acceptance_receipt_missing");
    // Only a founder send lacks an approval ledger; a founder send never names one.
    expect(() => remake(founder, { data: { ...founder.data, approvalLedgerId: "communications_job-1" } })).toThrow("learning_founder_send_approval_mismatch");
    expect(() => remake(base, { data: { ...base.data, approvalLedgerId: null } })).toThrow("learning_founder_send_approval_mismatch");
  });
  it("reads a founder observation through the existing read-only binding only for the outreach section", async () => {
    const memory = learningMemoryFirestore(), { grant, request } = learningScope(), f = founderSendSourceFixture(), identity = f.bundle.record as any;
    const root = "blueprintCommunications/default";
    memory.records.set("outboundProspects/prospect-1", f.input.prospect);
    for (const [path, value] of [[`jobs/${f.bundle.id}`, f.bundle.record], [`briefs/${identity.briefId}`, f.bundle.brief],
      [`handoffs/${identity.briefDigest}`, f.bundle.handoff], [`researchSources/${identity.briefDigest}`, f.bundle.researchSource],
      [`founderSendObservations/${f.bundle.id}`, f.bundle.founderSend]] as [string, unknown][]) memory.records.set(`${root}/${path}`, value);
    memory.records.set(`action_ledger/communications_${f.bundle.id}`, f.bundle.ledger);
    const result = await readExistingSources(memory.db, grant, request, learningNow);
    expect(result.quarantine).toEqual([]); expect(founderOutreach(result.events)).toHaveLength(1);
    expect(memory.writes).toEqual([]); expect(memory.reads.some(path => /oauth|mailbox|gmailDraft/i.test(path))).toBe(false);
    const reads = memory.reads.length;
    await readExistingSources(memory.db, { ...grant, sections: ["research"] }, { ...request, sections: ["research"] }, learningNow);
    expect(memory.reads.slice(reads).some(path => path.includes("founderSendObservations"))).toBe(false);
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
  it("normalizes equivalent timestamp formats without changing source evidence or event identity", () => {
    const original = learningEvent("research_observed"), formatted = structuredClone(original);
    formatted.occurredAt = "2026-09-01T05:00:00-05:00";
    formatted.recordedAt = "2026-10-01T17:00:00+00:00";
    formatted.evidence[0].checkedAt = "2026-09-01T10:00:00.000000Z";
    const before = JSON.stringify(formatted);
    expect(validateEvent(formatted)).toEqual(original);
    expect(JSON.stringify(formatted)).toBe(before);
    expect(() => validateEvent({ ...formatted, occurredAt: "2026-09-01T10:00:01Z" })).toThrow("hash_mismatch");
  });
  it("reads identical stored and live history for equivalent offset cutoffs", () => {
    const { request } = learningScope(), contact = learningEvent("contact_observed"), research = learningEvent("research_observed");
    const documents = [{ id: contact.eventId, data: () => contact }];
    const before = JSON.stringify([request, contact, research]);
    const canonical = readableHistory(documents, [research], request);
    expect(canonical.events).toHaveLength(2);
    expect(readableHistory(documents, [research], { ...request, asOf: "2026-10-01T12:00:00-05:00" })).toEqual(canonical);
    expect(JSON.stringify([request, contact, research])).toBe(before);
  });
  it.each([
    { city: "São José & Saint-Louis-du-Ha! Ha!", industry: "Laundries / cafés", quarantine: [] },
    { city: "private@example.org", industry: "Laundries", quarantine: ["cohort_city_invalid_reconcile_public_label"] },
  ])("retains verified facts through public cohort-label repair: $city", metadata => {
    const input = existingSourceFixture(), bundle = input.jobs[0], brief: any = bundle.brief;
    Object.assign(bundle.researchSource.source.candidate, { city: metadata.city, industry: metadata.industry });
    brief.researchOrigin.sourceDigest = communicationsDigest(bundle.researchSource.source);
    const briefDigest = communicationsDigest(brief), job: any = bundle.record;
    job.briefDigest = briefDigest; job.costState = "pending"; job.resultCount = 11; job.providerMetadata = { harmless: true };
    (bundle.handoff as any).briefDigest = briefDigest; bundle.researchSource.briefDigest = briefDigest;
    bundle.ledger.action_payload.communications.brief = brief;
    bundle.ledger.action_payload.communications.job.briefDigest = briefDigest;
    bundle.receipt.payloadDigest = communicationsDigest(bundle.ledger.action_payload);
    const before = JSON.stringify(input), normalized = normalizeExistingSources([input], learningNow);
    expect(normalized.quarantine.map(row => row.reason)).toEqual(metadata.quarantine);
    const research = normalized.events.find(event => event.kind === "research_observed")!;
    expect(research.data).toMatchObject({ city: metadata.quarantine.length ? "unknown" : metadata.city, industry: metadata.industry });
    expect(research.evidence[0].sourceHash).toBe(communicationsDigest(bundle.researchSource));
    expect(normalized.events).toHaveLength(3); expect(normalized.researchDetails).toHaveLength(1);
    expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(normalized)).not.toContain("private@example.org");
  });
  it("keeps a valid reply beside malformed optional communications metadata", () => {
    const input = existingReplySourceFixture(); input.communicationsEvents.push({ id: "bad", record: null });
    const before = JSON.stringify(input), result = normalizeExistingSources([input], learningNow);
    expect(result.events.filter(event => event.kind === "reply_observed")).toHaveLength(1);
    expect(result.researchDetails).toHaveLength(1);
    expect(result.quarantine).toEqual([{ recordRef: "outboundProspects/prospect-1/communicationsEvents/bad", reason: "communications_event_invalid_reconcile_original_record_identity" }]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("reads past 100 jobs and repairs an optional receipt network failure without losing verified research", async () => {
    const f = learningMemoryFirestore(), input = existingSourceFixture(), bundle = input.jobs[0], root = "blueprintCommunications/default";
    const identity = { ...bundle.ledger.action_payload.communications.job, jobId: "zz-valid-job" };
    bundle.ledger.action_payload.communications.job = identity;
    bundle.receipt.jobId = identity.jobId; bundle.receipt.approvalLedgerId = `communications_${identity.jobId}`;
    bundle.receipt.payloadDigest = communicationsDigest(bundle.ledger.action_payload);
    f.records.set("outboundProspects/prospect-1", input.prospect);
    for (let index = 0; index < 105; index++) f.records.set(`${root}/jobs/bad-${String(index).padStart(3, "0")}`, { prospectId: input.prospectId, body: "PRIVATE_SENTINEL" });
    f.records.set(`${root}/jobs/${identity.jobId}`, { ...identity, costState: "pending", resultCount: 11 });
    f.records.set(`${root}/briefs/${identity.briefId}`, bundle.brief);
    f.records.set(`${root}/handoffs/${identity.briefDigest}`, bundle.handoff);
    f.records.set(`${root}/researchSources/${identity.briefDigest}`, bundle.researchSource);
    const receiptRef = `${root}/sendReceipts/${communicationsDeliveryKey(identity)}`;
    f.records.set(receiptRef, bundle.receipt); f.records.set(`action_ledger/communications_${identity.jobId}`, bundle.ledger);
    let unavailable = true; const originalDoc = f.db.doc;
    f.db.doc = (path: string) => { const ref = originalDoc(path);
      return path === receiptRef ? { ...ref, get: async () => { if (unavailable) throw Error("PRIVATE_NETWORK_ERROR"); return ref.get(); } } : ref; };
    const originalCollection = f.db.collection;
    f.db.collection = (path: string) => {
      const collection = originalCollection(path); if (path !== "outboundProspects") return collection;
      return { ...collection, doc: (prospectId: string) => {
        const ref = collection.doc(prospectId), child = ref.collection;
        return { ...ref, collection: (name: string) => { if (name === "communicationsEvents" && unavailable) throw Error("PRIVATE_REPLY_NETWORK_ERROR"); return child(name); } };
      } };
    };
    const { grant, request } = learningScope();
    const partial = await readExistingSources(f.db, grant, request, learningNow);
    expect(partial.events.map(event => event.kind)).toEqual(["research_observed", "contact_observed"]);
    expect(partial.researchDetails).toHaveLength(1);
    expect(partial.quarantine).toContainEqual({ recordRef: "outboundProspects/prospect-1/communicationsEvents", reason: "communications_events_read_unavailable_retry_authorized_prospect" });
    expect(partial.quarantine).toContainEqual({ recordRef: receiptRef, reason: "receipt_read_unavailable_retry_exact_receipt_and_ledger" });
    unavailable = false; const repaired = await readExistingSources(f.db, grant, request, learningNow);
    expect(repaired.events.find(event => event.kind === "outreach_observed")?.data).toMatchObject({ status: "accepted", jobId: identity.jobId });
    expect(repaired.events.find(event => event.kind === "research_observed")?.eventId).toBe(partial.events[0].eventId);
    expect(JSON.stringify([partial, repaired])).not.toContain("PRIVATE_"); expect(f.writes).toEqual([]);
  });
  it("filters unauthorized reply records before validating a research-only snapshot", () => {
    const { grant, request } = learningScope(), research = learningEvent("research_observed");
    const read = buildSnapshot([research, { kind: "reply_observed", entities: research.entities, body: "PRIVATE_UNAUTHORIZED_REPLY" }],
      { ...grant, sections: ["research"] }, { ...request, sections: ["research"] }, learningNow);
    expect(read.rows[0].history).toEqual([research]); expect(JSON.stringify(read)).not.toContain("PRIVATE_UNAUTHORIZED_REPLY");
  });

  it("returns an actionable validation issue for an impossible ISO offset", () => {
    const invalid = instant.safeParse("2026-10-02T12:00:00+99:99");
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues.some(issue => issue.message === "learning_timestamp_invalid_repair_iso_offset_or_calendar_date")).toBe(true);
  });

});
