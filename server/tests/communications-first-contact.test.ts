// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const bindings = vi.hoisted(() => ({ db: null as any, snapshot: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, default: {} }));
vi.mock("../utils/email-suppression", async original => ({ ...await original<any>(), isEmailSuppressed: vi.fn(async () => false) }));
vi.mock("../agents/communications-research", async original => ({ ...await original<any>(), readExistingResearchSnapshot: vi.fn(async () => bindings.snapshot) }));
vi.mock("../agents/communications-oauth-store", () => ({ requireFounderSendCapability: vi.fn(async () => undefined) }));
vi.mock("../agents/communications-gmail", () => ({ verifyFounderMailbox: vi.fn(async () => ({})), readFounderThread: vi.fn(),
  hasFounderPriorContact: vi.fn(async () => false),
  findFounderSentMessage: vi.fn(async () => null), sendFounderMessage: vi.fn(async params => ({ messageId: "mock-sent", threadId: "mock-thread", rfcMessageId: params.messageId })) }));
import { communicationsNow, communicationsFixture, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { admitBoundCommunicationsReplies } from "../agents/communications-reply-intake";
import { processCommunicationsJob, startCommunicationsQueueLoop } from "../agents/communications-worker";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";
import { compileAutomaticFirstContact, firstContactAuthority, firstContactLearningQuestion, verifyFirstContactAuthority,
  firstContactDailyLimit, firstContactRecipientKey, firstContactCalendarDay, firstContactGeography } from "../agents/communications-first-contact";
import { executeAutomaticFirstContact, executeCommunicationsSend } from "../agents/communications-send";
import { sendFounderMessage, findFounderSentMessage, verifyFounderMailbox, hasFounderPriorContact, readFounderThread } from "../agents/communications-gmail";
import { requireFounderSendCapability } from "../agents/communications-oauth-store";
import { isEmailSuppressed } from "../utils/email-suppression";
import { appendFirstContactFooter } from "../agents/communications-first-contact-footer";

// Intentionally non-deliverable fixture; no real mailing address.
const SYNTHETIC_POSTAL_LINE = "Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000";

async function setup(beforeProcess?: (context: any) => Promise<void>, country: "US" | "CA" = "US") {
  const fixture = publishedResearchFixture({ publicContact: true, mutateCandidate: candidate => {
    candidate.location = country === "US" ? "Synthetic location, United States" : "Toronto, Canada";
    candidate.evidence[2].quote = country === "US" ? "Synthetic packing site is located in the United States" : "Synthetic packing site is located in Canada";
  } });
  const db = memoryFirestore(); bindings.db = db; bindings.snapshot = fixture.snapshot;
  const deps = { db, readResearch: async () => fixture.snapshot, isSuppressed: async () => false, now: () => Date.now() };
  const admitted: any = await admitPublishedResearch(fixture.snapshot, fixture.candidate.candidate_key, deps);
  expect(admitted.state).toBe("admitted");
  const store = new CommunicationsStore(db, deps.now, "mock-worker");
  const brief = await store.brief(admitted.briefId);
  const output = structuredClone(fixture.output);
  output.usedFactIds = [brief.facts[0].id];
  output.body = output.body.replace(output.outreachContract!.question, brief.contact.learningQuestion);
  output.outreachContract!.question = brief.contact.learningQuestion;
  const api = { run: vi.fn(async () => ({ output, checkpoint: { createClaimedAt: null, sessionId: "mock-session", turnId: "mock-turn" }, usage: { mock: true } })), cancel: vi.fn(), reconcileSaved: vi.fn() };
  const workerDeps = { store, api, readResearch: deps.readResearch, now: deps.now, isSuppressed: deps.isSuppressed,
    verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn() };
  if (beforeProcess) await beforeProcess({ db, admitted, brief, output, workerDeps });
  const outcome = await processCommunicationsJob(admitted.jobId, workerDeps);
  const ledgerId = `communications_${admitted.jobId}`, ledger = db.records.get(`action_ledger/${ledgerId}`);
  return { ...fixture, db, store, brief, admitted, ledgerId, ledger, payload: ledger.action_payload, workerDeps, outcome, output,
    receiptPath: `${COMMUNICATIONS_ROOT}/sendReceipts/${communicationsDeliveryKey(ledger.action_payload.communications.job)}` };
}

async function setupAutomaticReply(subject?: string) {
  const f = await setup();
  expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" });
  const receipt = f.db.records.get(f.receiptPath);
  const thread = communicationsFixture("reply").thread!;
  thread.threadId = receipt.receipt.threadId;
  Object.assign(thread.messages[0], { gmailThreadId: thread.threadId, gmailMessageId: receipt.receipt.messageId,
    rfcMessageId: receipt.receipt.rfcMessageId, subject: f.payload.subject, body: f.payload.transportBody,
    to: [f.brief.contact.email] });
  Object.assign(thread.messages[1], { gmailThreadId: thread.threadId, from: f.brief.contact.email,
    to: ["nijel@tryblueprint.io"], inReplyTo: receipt.receipt.rfcMessageId, references: [receipt.receipt.rfcMessageId] });
  if (subject) thread.messages[1].subject = subject;
  f.workerDeps.readThread.mockResolvedValue(thread);
  vi.mocked(readFounderThread).mockResolvedValue(thread);
  const admitted = await admitBoundCommunicationsReplies(communicationsDeliveryKey(f.payload.communications.job), {
    ...f.workerDeps, db: f.db,
  });
  expect(admitted.state).toBe("queued");
  const jobId = (admitted as { jobId: string }).jobId;
  f.workerDeps.api.run.mockImplementation(async () => ({ output: { ...communicationsFixture("reply").output,
    subject: thread.messages[1].subject, body: "Thanks for your reply. I will keep this discussion to public information.",
    usedFactIds: [], outreachContract: null },
    checkpoint: { createClaimedAt: null, sessionId: "mock-reply-session", turnId: "mock-reply-turn" }, usage: { mock: true } }));
  return { ...f, thread, jobId, replyLedgerId: `communications_${jobId}` };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(communicationsNow); vi.clearAllMocks();
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", SYNTHETIC_POSTAL_LINE);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT", "5");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
  vi.mocked(requireFounderSendCapability).mockResolvedValue(undefined); vi.mocked(isEmailSuppressed).mockResolvedValue(false);
  vi.mocked(findFounderSentMessage).mockResolvedValue(null);
  vi.mocked(hasFounderPriorContact).mockResolvedValue(false);
  vi.mocked(sendFounderMessage).mockImplementation(async p => ({ messageId: "mock-sent", threadId: "mock-thread", rfcMessageId: p.messageId }));
  vi.mocked(verifyFounderMailbox).mockResolvedValue({} as any);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("bounded first-contact authority (all providers mocked)", () => {
  it("treats a correlated Pricing subject as retained recipient provenance, without inventing a price or commitment", async () => {
    const f = await setupAutomaticReply("Re: Pricing");
    expect(await processCommunicationsJob(f.jobId, f.workerDeps)).toMatchObject({ state: "auto_approved" });
    const ledger = f.db.records.get(`action_ledger/${f.replyLedgerId}`);
    expect(ledger.action_payload.subject).toBe("Re: Pricing");
    expect(ledger.action_payload.body).toBe("Thanks for your reply. I will keep this discussion to public information.");
    expect(ledger.action_payload.body).not.toMatch(/pricing|price|contract|guarantee|\$/i);
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toEqual({ state: "sent" });
  });
  it("retains prospective geographic-policy refusal as blocked evidence, without creating another human approval stop", async () => {
    const f = await setup(undefined, "CA");
    expect(f.outcome).toMatchObject({ state: "blocked", reason: "routine_recipient_geography_not_authorized", sent: false });
    expect(f.ledger).toMatchObject({ status: "failed", approval_reason: "routine_recipient_geography_not_authorized",
      approved_by: null, draft_output: { requires_human_review: false } });
    expect(f.ledger.first_contact_authority).toBeUndefined();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`)).toMatchObject({ state: "blocked", output: f.output });
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("keeps a previously charged saved session in its original human lane", async () => {
    const f = await setup(async ({ db, admitted }) => {
      await db.doc(`${COMMUNICATIONS_ROOT}/jobs/${admitted.jobId}`).update({ checkpoint: {
        createClaimedAt: new Date(communicationsNow).toISOString(), sessionId: "old-paid-session", turnId: "old-turn" } });
    });
    expect(f.outcome.state).toBe("pending_approval");
    expect(f.ledger).not.toHaveProperty("first_contact_authority");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`)).not.toHaveProperty("automationPolicyVersion");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("does not promote an existing pending approval when automation is later activated", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
    const f = await setup(), original = structuredClone(f.ledger);
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    expect(await processCommunicationsJob(f.admitted.jobId, f.workerDeps)).toEqual({ state: "no_op" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "failed" });
    expect(f.db.records.get(`action_ledger/${f.ledgerId}`)).toEqual(original);
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("answers an actually sent correlated reply once with the agent's plain acknowledgment and retained authority", async () => {
    const f = await setupAutomaticReply();
    vi.mocked(hasFounderPriorContact).mockClear();
    expect(await processCommunicationsJob(f.jobId, f.workerDeps)).toMatchObject({ state: "auto_approved", sent: false });
    const ledger = f.db.records.get(`action_ledger/${f.replyLedgerId}`);
    expect(ledger).toMatchObject({ approved_by: null, status: "auto_approved", first_contact_authority: {
      kind: "standing_agent_communications_policy", intent: "reply", inboundMessageId: f.thread.messages[1].gmailMessageId } });
    expect(ledger.action_payload.body).toBe("Thanks for your reply. I will keep this discussion to public information.");
    expect(ledger.action_payload.communications.output.usedFactIds).toEqual([]);
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toEqual({ state: "sent" });
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toEqual({ state: "sent" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(2);
    expect(sendFounderMessage).toHaveBeenLastCalledWith(expect.objectContaining({ threadId: f.thread.threadId,
      inReplyTo: f.thread.messages[1].rfcMessageId }));
    const job = f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.jobId}`);
    expect(await f.store.finishAutomatic(job, { state: "sent" })).toMatchObject({ state: "sent" });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).attempts).toBe(2);
    expect(hasFounderPriorContact).not.toHaveBeenCalled(); // Prior contact is required for a reply.
  });
  it("retains an unknown automatic reply acknowledgment across restart without repeating the write", async () => {
    const f = await setupAutomaticReply();
    await processCommunicationsJob(f.jobId, f.workerDeps);
    vi.mocked(sendFounderMessage).mockRejectedValueOnce(new Error("lost ACK"));
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toMatchObject({ reason: "gmail_send_requires_reconciliation_no_resend" });
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toMatchObject({ reason: "gmail_send_requires_reconciliation_no_resend" });
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
    vi.mocked(findFounderSentMessage).mockResolvedValueOnce({ id: "recovered-reply", threadId: f.thread.threadId });
    expect(await executeAutomaticFirstContact(f.replyLedgerId)).toEqual({ state: "sent" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(2);
  });
  it.each(["opt_out", "changed_parent"])("denies automatic reply %s after drafting before any new send", async kind => {
    const f = await setupAutomaticReply();
    await processCommunicationsJob(f.jobId, f.workerDeps);
    if (kind === "opt_out") f.thread.messages[1].body = "Please stop emailing us.";
    else f.db.records.get(f.receiptPath).receipt.messageId = "changed-parent-message";
    expect((await executeAutomaticFirstContact(f.replyLedgerId)).state).not.toBe("sent");
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
  });
  it("continues verifying the original v1 compiler snapshot without upgrading its authority", async () => {
    const f = await setup();
    const payload = structuredClone(f.payload), compiled = compileAutomaticFirstContact(f.brief, communicationsNow)!;
    Object.assign(payload, { body: compiled.body, subject: compiled.subject,
      transportBody: appendFirstContactFooter(compiled.body, f.brief.contact.email), outreachContract: compiled.outreachContract });
    payload.communications.output = compiled;
    const authority = firstContactAuthority(payload, communicationsNow, undefined, true)!;
    expect(authority).toMatchObject({ version: "blueprint.first-contact-authority.v1", kind: "standing_first_contact_policy" });
    expect(verifyFirstContactAuthority(authority, payload, communicationsNow)).toEqual(authority);
    const changed = structuredClone(payload);
    changed.body += " A new sentence.";
    changed.communications.output.body = changed.body;
    changed.transportBody = appendFirstContactFooter(changed.body, f.brief.contact.email);
    expect(() => verifyFirstContactAuthority(authority, changed, communicationsNow, true)).toThrow();
  });
  it("records immutable authority with unknown interest and no invented human approval", async () => {
    const f = await setup(); expect(f.outcome).toMatchObject({ state: "auto_approved", sent: false });
    expect(f.ledger).toMatchObject({ status: "auto_approved", action_tier: 1, approved_by: null, auto_approve_reason: "standing_agent_communications_policy" });
    expect(f.payload.communications.output).toEqual(f.output);
    expect(f.payload.body).toBe(f.output.body);
    expect(f.payload.subject).toBe(f.output.subject);
    expect(f.payload.communications.output.reason).not.toContain("Compiled");
    expect(f.payload.body).toContain("I'm building Blueprint.");
    expect(f.payload.body).toContain("Is exploring robotics for Packing relevant to your site?");
    expect(f.ledger.first_contact_authority.stage.interest).toBe("unknown");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactAuthorities/${f.ledger.first_contact_authority_digest}`)).toEqual(f.ledger.first_contact_authority);
    expect(sendFounderMessage).not.toHaveBeenCalled();
    expect(f.payload.transportBody).toContain(SYNTHETIC_POSTAL_LINE);
    expect(f.payload.transportBody).toContain("scope=all");
  });
  it("always adds the approved outreach postal/opt-out footer even if content mentions privacy and unsubscribe", () => {
    const body = "Public wording includes unsubscribe and /privacy";
    const text = appendFirstContactFooter(body, "ops@business.example");
    expect(text).toContain(SYNTHETIC_POSTAL_LINE); expect(text).toContain("scope=all");
  });
  it("holds automatic authority when the owner-configured outreach address is missing", async () => {
    const f = await setup(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "");
    expect(firstContactAuthority(f.payload, communicationsNow)).toBeNull();
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow(); expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("keeps original human review when the automatic flag is off", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false"); const f = await setup();
    expect(f.ledger).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null });
    expect(f.ledger).not.toHaveProperty("first_contact_authority");
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "failed" });
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("sends once through the policy, with receipt, recipient fence and local-calendar attempt count", async () => {
    const f = await setup();
    expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(f.receiptPath)).toMatchObject({ state: "sent", firstContactAuthorityDigest: f.ledger.first_contact_authority_digest });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/recipientFirstTouches/${firstContactRecipientKey(f.brief.contact.email)}`)).toMatchObject({ prospectId: f.brief.prospectId });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).attempts).toBe(1);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).timezone).toBe("America/Chicago");
  });
  it("fences concurrent execution, even when multiple worker instances see the same job", async () => {
    const f = await setup(); await Promise.allSettled([executeAutomaticFirstContact(f.ledgerId), executeAutomaticFirstContact(f.ledgerId)]);
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).attempts).toBe(1);
  });
  it("resumes an interrupted executing ledger when no receipt was ever reserved", async () => {
    const f = await setup(); await f.db.doc(`action_ledger/${f.ledgerId}`).update({ status: "executing" });
    expect(f.db.records.has(f.receiptPath)).toBe(false);
    expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
  });
  it("never reclaims an interrupted durable reservation into a new Gmail POST", async () => {
    const f = await setup(), job = f.payload.communications.job;
    await f.db.doc(f.receiptPath).set({ state: "attempting", jobId: job.jobId, payloadDigest: communicationsDigest(f.payload),
      firstContactAuthorityDigest: f.ledger.first_contact_authority_digest, rfcMessageId: "<mock-reserved@business.example>" });
    await f.db.doc(`action_ledger/${f.ledgerId}`).update({ status: "executing" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "auto_approved", reason: "gmail_send_requires_reconciliation_no_resend" });
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it.each(["send_flag", "automatic_flag", "missing_limit", "send_scope", "suppression", "authority", "authority_record", "recipient", "source"])("blocks %s before Gmail POST", async kind => {
    const f = await setup();
    if (kind === "send_flag") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    if (kind === "automatic_flag") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
    if (kind === "missing_limit") vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT", "");
    if (kind === "send_scope") vi.mocked(requireFounderSendCapability).mockRejectedValue(new Error("founder_send_scope_unverified"));
    if (kind === "suppression") vi.mocked(isEmailSuppressed).mockResolvedValue(true);
    if (kind === "authority") f.db.records.get(`action_ledger/${f.ledgerId}`).first_contact_authority.contact.email = "wrong@facility.example";
    if (kind === "authority_record") f.db.records.delete(`${COMMUNICATIONS_ROOT}/firstContactAuthorities/${f.ledger.first_contact_authority_digest}`);
    if (kind === "recipient") f.db.records.get(`outboundProspects/${f.brief.prospectId}`).contactEmail = "wrong@facility.example";
    if (kind === "source") f.db.records.get(`${COMMUNICATIONS_ROOT}/researchSources/${f.admitted.briefDigest}`).source.candidate.organization = "Changed";
    expect((await executeAutomaticFirstContact(f.ledgerId)).state).not.toBe("sent");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("rechecks suppression and immutable authority inside the final transaction", async () => {
    const f = await setup(); vi.mocked(verifyFounderMailbox).mockImplementationOnce(async () => {
      await f.db.doc(`email_suppressions/${f.brief.contact.email}`).set({ global_suppressed: true }); return {} as any;
    });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("recipient_suppressed"); expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("enforces the atomic attempt cap and does not consume a recipient claim when full", async () => {
    const f = await setup(); await f.db.doc(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).set({ attempts: 5 });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "auto_approved", reason: "first_contact_daily_cap_reached" });
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("blocks a different CRM row using an already-contacted business address", async () => {
    const f = await setup(); await f.db.doc("outboundProspects/duplicate").set({ contactEmail: f.brief.contact.email, stage: "contacted" });
    expect((await executeAutomaticFirstContact(f.ledgerId)).state).toBe("failed"); expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("refuses a forged US label without its exact published geography excerpt", async () => {
    const f = await setup(); f.db.records.get(`${COMMUNICATIONS_ROOT}/researchSources/${f.admitted.briefDigest}`).source.candidate.evidence[2].quote = "Synthetic packing site, Canada";
    expect((await executeAutomaticFirstContact(f.ledgerId)).state).not.toBe("sent"); expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it.each(["Our headquarters are in the United States; the target facility is elsewhere",
    "Synthetic packing site is in the United States; other facilities are overseas",
    "The company is based in the United States"])("refuses headquarters-only or mixed geographic evidence: %s", async quote => {
    const f = await setup(), provenance = structuredClone(f.db.records.get(`${COMMUNICATIONS_ROOT}/researchSources/${f.admitted.briefDigest}`));
    provenance.source.candidate.evidence[2].quote = quote;
    const brief = { ...f.brief, researchOrigin: { ...f.brief.researchOrigin, sourceDigest: communicationsDigest(provenance.source) } };
    expect(firstContactGeography(provenance, brief, communicationsNow)).toBeNull();
  });
  it("does not classify a non-US candidate as US from a US-company footprint excerpt", async () => {
    const f = await setup(), provenance = structuredClone(f.db.records.get(`${COMMUNICATIONS_ROOT}/researchSources/${f.admitted.briefDigest}`));
    provenance.source.candidate.location = "Toronto, Canada";
    const brief = { ...f.brief, researchOrigin: { ...f.brief.researchOrigin, sourceDigest: communicationsDigest(provenance.source) } };
    expect(firstContactGeography(provenance, brief, communicationsNow)).toBeNull();
  });
  it("blocks prior founder contact that is absent from the normalized CRM query", async () => {
    const f = await setup(); vi.mocked(hasFounderPriorContact).mockResolvedValue(true);
    await f.db.doc("outboundProspects/legacy-uppercase").set({ contactEmail: f.brief.contact.email.toUpperCase(), stage: "contacted" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "auto_approved", reason: "recipient_previously_contacted" });
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("recovers unknown acknowledgement without a second POST, even with new sends off", async () => {
    const f = await setup(); vi.mocked(sendFounderMessage).mockRejectedValueOnce(new Error("mock lost ACK"));
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "auto_approved", reason: "gmail_send_requires_reconciliation_no_resend" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toMatchObject({ state: "auto_approved", reason: "gmail_send_requires_reconciliation_no_resend" });
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "");
    vi.mocked(findFounderSentMessage).mockResolvedValueOnce({ id: "mock-recovered", threadId: "mock-thread" });
    expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" }); expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).attempts).toBe(1);
  });
  it.each(["body", "question", "attachment", "reply", "prior_thread", "stale", "future", "private", "pricing", "unsupported_stage"])("refuses automatic %s", async kind => {
    const f = await setup(), p = structuredClone(f.payload), b = p.communications.brief;
    if (kind === "body") { p.body += " We guarantee a match."; p.communications.output.body = p.body; }
    if (kind === "question") b.contact.learningQuestion = "Can we schedule a meeting?";
    if (kind === "attachment") p.attachments = ["private.pdf"];
    if (kind === "reply") p.communications.job.intent = "reply";
    if (kind === "prior_thread") b.priorConversation = { gmailThreadId: "prior", gmailMessageIds: ["prior-message"] };
    if (kind === "stale") b.contact.sourceCheckedAt = "2026-09-01T00:00:00Z";
    if (kind === "future") b.contact.sourceCheckedAt = "2026-10-02T00:00:00Z";
    if (kind === "private" || kind === "pricing") { b.outreachContext.observations[0].claim = kind === "private" ? "The patient has a medical condition" : "The contract price is $100"; b.facts[0].claim = b.outreachContext.observations[0].claim; }
    if (kind === "unsupported_stage") b.stage = { interest: "deployed", evidenceIds: [] };
    expect(firstContactAuthority(p, communicationsNow)).toBeNull();
  });
  it.each(["unknown", "expressed", "pilot", "deployed"] as const)("adapts the task-specific question to verified %s state", async state => {
    const f = await setup(), brief = structuredClone(f.brief);
    brief.stage = { interest: state, evidenceIds: state === "unknown" ? [] : ["stage-fact"] };
    const stageClaims = { unknown: "The operator describes Packing", expressed: "The operator expressed interest in robotics for Packing",
      pilot: "The operator is running a robotics pilot for Packing", deployed: "The operator has robots in production for Packing" };
    brief.facts.push({ ...brief.facts[0], id: "stage-fact", claim: stageClaims[state], assertionScope: "current_operational" });
    brief.contact.learningQuestion = firstContactLearningQuestion(brief.boundedJob, state);
    const compiled = compileAutomaticFirstContact(brief, communicationsNow);
    expect(compiled?.body).toContain(brief.contact.learningQuestion); expect(compiled?.body).toContain("Packing");
    expect(compiled?.body.match(/\?/g)).toHaveLength(1); expect(compiled?.body).not.toMatch(/pricing|guarantee|schedule|we met/i);
  });
  it.each(["expressed", "pilot", "deployed"] as const)("does not infer %s from generic robotics work or a negated state", async state => {
    const f = await setup(), brief = structuredClone(f.brief);
    brief.stage = { interest: state, evidenceIds: ["stage-fact"] };
    brief.contact.learningQuestion = firstContactLearningQuestion(brief.boundedJob, state);
    brief.facts.push({ ...brief.facts[0], id: "stage-fact", claim: "The operator describes current robotics work on Packing", assertionScope: "current_operational" });
    expect(compileAutomaticFirstContact(brief, communicationsNow)).toBeNull();
    brief.facts.at(-1)!.claim = "The operator has not deployed robots for Packing";
    expect(compileAutomaticFirstContact(brief, communicationsNow)).toBeNull();
    brief.facts.at(-1)!.claim = "The operator has deployed robots for Packing in a pilot";
    if (state === "deployed") expect(compileAutomaticFirstContact(brief, communicationsNow)).toBeNull();
  });
  it.each(["", "0", "-1", "26", "1.5", "Infinity", "05"])("fails closed for invalid daily limit %s", value => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT", value); expect(firstContactDailyLimit()).toBe(0);
  });
  it("does not grant another daily allowance when UTC rolls over during the user's evening", () => {
    expect(firstContactCalendarDay(Date.parse("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
    expect(firstContactCalendarDay(Date.parse("2026-10-01T05:00:00Z"))).toBe("2026-10-01");
  });
  it("preserves a past audit for receipt recovery while refusing fresh sends after evidence ages", async () => {
    const f = await setup(), authority = f.ledger.first_contact_authority;
    const later = communicationsNow + 8 * 86400000;
    expect(() => verifyFirstContactAuthority(authority, f.payload, later)).toThrow();
    expect(verifyFirstContactAuthority(authority, f.payload, later, true)).toEqual(authority);
    expect(communicationsDigest(authority)).toBe(f.ledger.first_contact_authority_digest);
  });
  it("does not process model work or automatic sends while the existing paid-inference gate is closed", async () => {
    const f = await setup(), sendAutomatic = vi.fn();
    const stop = startCommunicationsQueueLoop({ ...f.workerDeps, sendAutomatic }, { processJobs: false });
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(sendAutomatic).not.toHaveBeenCalled(); expect(f.workerDeps.api.run).toHaveBeenCalledTimes(1);
  });
  it("persists automatic send recovery after restart and inference-lease expiry without another draft", async () => {
    const f = await setup(); vi.setSystemTime(communicationsNow + 180001);
    const restarted = new CommunicationsStore(f.db, () => Date.now(), "restarted-worker");
    const stop = startCommunicationsQueueLoop({ ...f.workerDeps, store: restarted, sendAutomatic: executeAutomaticFirstContact });
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`).state).toBe("sent");
    expect(await restarted.automaticJobs()).toEqual([]);
    expect(sendFounderMessage).toHaveBeenCalledTimes(1); expect(f.workerDeps.api.run).toHaveBeenCalledTimes(1);
  });
  it("projects a verified sent receipt after restart without downgrading or sending twice", async () => {
    const f = await setup(); expect(await executeAutomaticFirstContact(f.ledgerId)).toEqual({ state: "sent" });
    const restarted = new CommunicationsStore(f.db, () => communicationsNow + 240000, "restarted-worker");
    const job = (await restarted.automaticJobs())[0];
    expect(await restarted.finishAutomatic(job, { state: "failed", reason: "stale_worker_result" })).toEqual({ state: "sent", reason: "sent" });
    expect(await restarted.automaticJobs()).toEqual([]); expect(sendFounderMessage).toHaveBeenCalledTimes(1);
  });
  it("retains an expired automatic job during a verified daily-cap hold", async () => {
    const f = await setup(); await f.db.doc(`${COMMUNICATIONS_ROOT}/firstContactDailyUsage/2026-09-30`).set({ attempts: 5 });
    const restarted = new CommunicationsStore(f.db, () => communicationsNow + 240000, "restarted-worker"), job = (await restarted.automaticJobs())[0];
    const outcome = await executeAutomaticFirstContact(f.ledgerId);
    expect(await restarted.finishAutomatic(job, outcome)).toMatchObject({ state: "auto_approved", reason: "first_contact_daily_cap_reached" });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${job.jobId}`).reason).toBe("first_contact_daily_cap_reached");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("refuses unverified send success and a changed automatic ledger binding", async () => {
    const f = await setup(), restarted = new CommunicationsStore(f.db, () => communicationsNow + 240000, "restarted-worker");
    const job = (await restarted.automaticJobs())[0];
    await expect(restarted.finishAutomatic(job, { state: "sent" })).rejects.toThrow("communications_automatic_result_unverified");
    await f.db.doc(`action_ledger/${f.ledgerId}`).update({ source_doc_id: "different-prospect" });
    await expect(restarted.finishAutomatic(job, { state: "auto_approved" })).rejects.toThrow("communications_automatic_result_context_changed");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${job.jobId}`).state).toBe("auto_approved");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("rotates past five retained recipient holds to recover a later eligible job", async () => {
    const f = await setup(), jobRow = f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`);
    for (let i = 0; i < 5; i++) {
      const jobId = `000-hold-${i}`, ledgerId = `communications_${jobId}`, row = { ...structuredClone(jobRow), jobId, ledgerId };
      const ledger = structuredClone(f.ledger); ledger.action_payload.communications.job.jobId = jobId;
      await f.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${jobId}`).set(row);
      await f.db.doc(`action_ledger/${ledgerId}`).set(ledger);
    }
    const sendAutomatic = vi.fn(async (ledgerId: string) => ledgerId.includes("000-hold-")
      ? { state: "auto_approved" as const, reason: "recipient_suppressed" } : executeAutomaticFirstContact(ledgerId));
    const stop = startCommunicationsQueueLoop({ ...f.workerDeps, sendAutomatic });
    await vi.advanceTimersByTimeAsync(120000); await stop();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`).state).toBe("sent");
    expect(sendAutomatic).toHaveBeenCalledWith(f.ledgerId); expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    const first = await f.store.automaticJobs();
    expect(first).toHaveLength(5);
    expect((await f.store.automaticJobs(5, first.at(-1)!.jobId)).map(job => job.jobId)).toEqual(first.map(job => job.jobId));
  });
});
