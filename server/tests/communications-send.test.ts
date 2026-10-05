// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const bindings = vi.hoisted(() => ({ db: null as any, snapshot: null as any, thread: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, default: {} }));
vi.mock("../utils/email-suppression", async (importOriginal) => ({ ...await importOriginal<any>(), isEmailSuppressed: vi.fn(async () => false) }));
vi.mock("../agents/communications-research", async (importOriginal) => ({ ...await importOriginal<any>(), readExistingResearchSnapshot: vi.fn(async () => bindings.snapshot) }));
vi.mock("../agents/communications-gmail", () => ({ verifyFounderMailbox: vi.fn(async () => ({})), readFounderThread: vi.fn(async () => bindings.thread),
  hasFounderPriorContact: vi.fn(async () => false),
  findFounderSentMessage: vi.fn(async () => null), sendFounderMessage: vi.fn(async (params) => ({ messageId: "sent-message-1", threadId: params.threadId ?? "new-thread", rfcMessageId: params.messageId })) }));
vi.mock("../agents/communications-oauth-store", () => ({ requireFounderSendCapability: vi.fn(async () => undefined) }));
import { communicationsFixture, communicationsNow, memoryFirestore, syntheticQualification } from "./fixtures/communications";
import { appendCommercialEmailFooter, isEmailSuppressed } from "../utils/email-suppression";
import { verifyFounderMailbox, readFounderThread, sendFounderMessage, findFounderSentMessage } from "../agents/communications-gmail";
import { communicationsSendBlocker, executeCommunicationsSend, reconcileCommunicationsSend } from "../agents/communications-send";
import { communicationsDigest, communicationsDeliveryKey } from "../agents/communications-contract";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { COMMUNICATIONS_ROOT } from "../agents/communications-store";

async function setup(intent: "outreach" | "reply" = "outreach") {
  const f = communicationsFixture(intent); const db = memoryFirestore(); bindings.db = db; bindings.snapshot = f.snapshot; bindings.thread = f.thread;
  const payload: any = { type: "send_email", to: f.brief.contact.email, from: "nijel@tryblueprint.io", replyTo: "nijel@tryblueprint.io",
    subject: f.output.subject, body: f.output.body, transportBody: appendCommercialEmailFooter({ text: f.output.body, email: f.brief.contact.email, scope: "growth_campaign" }),
    commercialEmail: true, emailTransport: "founder_gmail", outreachContext: f.brief.outreachContext, outreachContract: f.output.outreachContract,
    ...(f.thread ? { gmailThreadId: f.thread.threadId, inReplyTo: f.thread.messages[1].rfcMessageId } : {}),
    communications: { version: "blueprint.communications.v1", job: f.job, brief: f.brief, thread: f.thread, output: f.output, approvalState: "pending_approval" } };
  const ledgerId = `communications_${f.job.jobId}`;
  await db.doc(`outboundProspects/${f.job.prospectId}`).set({ contactEmail: f.brief.contact.email, siteId: f.brief.siteId, taskId: f.brief.taskId,
    stage: intent === "outreach" ? "drafted" : "contacted", communications: { jobId: f.job.jobId, ledgerId } });
  await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${f.brief.briefId}`).set(f.brief);
  await db.doc(`${COMMUNICATIONS_ROOT}/handoffs/${f.handoff.briefDigest}`).set(f.handoff);
  await db.doc(`action_ledger/${ledgerId}`).set({ action_payload: payload, status: "executing", approved_by: "owner@blueprint.example", outreach_reviewed_by: "owner@blueprint.example",
    outreach_semantic_review: { digest: reviewCommunicationsPayload(payload, communicationsNow).digest } });
  return { ...f, db, payload, ledgerId, receiptPath: `${COMMUNICATIONS_ROOT}/sendReceipts/${communicationsDeliveryKey(f.job)}` };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(communicationsNow); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
  vi.mocked(isEmailSuppressed).mockResolvedValue(false); vi.mocked(findFounderSentMessage).mockResolvedValue(null); vi.mocked(verifyFounderMailbox).mockResolvedValue({} as any);
  vi.mocked(sendFounderMessage).mockImplementation(async (params) => ({ messageId: "sent-message-1", threadId: params.threadId ?? "new-thread", rfcMessageId: params.messageId })); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("approved founder send and acknowledgement recovery (all mocked)", () => {
  it.each<[string, (brief: any) => any]>([
    ["a qualification block", brief => ({ ...brief, qualification: syntheticQualification() })],
    ["a public-source contact", brief => ({ ...brief, researchOrigin: { ...brief.researchOrigin, contactEvidenceKind: "public_source_resolution" } })],
    ["a site-screen admission", brief => ({ ...brief, researchOrigin: { ...brief.researchOrigin, screenAdmissionId: "d".repeat(64) } })],
  ])("refuses an outreach-ready hypothesis with %s even with every send flag on and exact approval", async (_name, hypothesis) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT", "5");
    const f = await setup();
    // A consistent hypothesis job: stored brief, handoff, job, prospect binding and exact approval all match.
    const brief = hypothesis(f.brief), briefDigest = communicationsDigest(brief);
    const { jobId: _previous, ...input } = { ...f.job, briefDigest };
    const job = { ...input, jobId: communicationsDigest(input) }, ledgerId = `communications_${job.jobId}`;
    f.payload.communications = { ...f.payload.communications, brief, job };
    await f.db.doc(`${COMMUNICATIONS_ROOT}/briefs/${brief.briefId}`).set(brief);
    await f.db.doc(`${COMMUNICATIONS_ROOT}/handoffs/${briefDigest}`).set({ ...f.handoff, briefDigest });
    await f.db.doc(`outboundProspects/${job.prospectId}`).update({ communications: { jobId: job.jobId, ledgerId } });
    await f.db.doc(`action_ledger/${ledgerId}`).set({ action_payload: f.payload, status: "executing", approved_by: "owner@blueprint.example",
      outreach_reviewed_by: "owner@blueprint.example", outreach_semantic_review: { digest: reviewCommunicationsPayload(f.payload, communicationsNow).digest } });
    expect(await communicationsSendBlocker(f.payload, ledgerId)).toBe("outreach_ready_hypothesis_draft_only");
    // The refusal does not depend on any flag: it comes before the send-flag check.
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    expect(await communicationsSendBlocker(f.payload, ledgerId)).toBe("outreach_ready_hypothesis_draft_only");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(verifyFounderMailbox).not.toHaveBeenCalled();
    expect(f.db.records.has(f.receiptPath)).toBe(false);
    expect([...f.db.records.keys()].some(path => path.includes("/recipientFirstTouches/"))).toBe(false);
  });
  it.each<[string, Record<string, unknown>]>([
    ["an outreach-ready tier", { researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" }],
    ["a site-screen admission", { screenAdmissionId: "d".repeat(64) }],
    ["an unrecognised research admission", { researchPublicationId: "BP-000044", entityAdmission: "research_unrecognised" }],
    ["an unrecognised tier", { researchPublicationId: "BP-000045", qualificationTier: "verified_later" }],
  ])("refuses a prospect record with %s before any send flag, the same way with flags on or off", async (_name, marker) => {
    const f = await setup();
    await f.db.doc(`outboundProspects/${f.job.prospectId}`).update(marker);
    for (const enabled of ["false", "true"]) {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", enabled);
      expect(await communicationsSendBlocker(f.payload, f.ledgerId), enabled).toBe("outreach_ready_hypothesis_draft_only");
      await expect(executeCommunicationsSend(f.payload), enabled).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    }
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(verifyFounderMailbox).not.toHaveBeenCalled();
    expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("checks the job's own prospect record by its ID, even when the record no longer carries the recipient address", async () => {
    const f = await setup();
    await f.db.doc(`outboundProspects/${f.job.prospectId}`).update({ contactEmail: "renamed@facility.example", screenAdmissionId: "d".repeat(64) });
    for (const enabled of ["false", "true"]) {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", enabled);
      expect(await communicationsSendBlocker(f.payload, f.ledgerId), enabled).toBe("outreach_ready_hypothesis_draft_only");
      await expect(executeCommunicationsSend(f.payload), enabled).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    }
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("refuses a hypothesis brief in executeCommunicationsSend itself while sending is off", async () => {
    const f = await setup(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    f.payload.communications = { ...f.payload.communications, brief: { ...f.brief, qualification: syntheticQualification() } };
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("refuses an address that another prospect record holds as a hypothesis, before any flag", async () => {
    const f = await setup();
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBeNull();
    // The same address on a separate record that research marked as a hypothesis.
    await f.db.doc("outboundProspects/other-record").set({ contactEmail: f.brief.contact.email,
      researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" });
    for (const enabled of ["false", "true"]) {
      vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", enabled);
      expect(await communicationsSendBlocker(f.payload, f.ledgerId), enabled).toBe("outreach_ready_hypothesis_draft_only");
      await expect(executeCommunicationsSend(f.payload), enabled).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    }
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("fails closed when the prospect records for the address cannot be read", async () => {
    const f = await setup(), collection = f.db.collection.bind(f.db);
    vi.spyOn(f.db, "collection").mockImplementation((name: string) => name !== "outboundProspects" ? collection(name)
      : { ...collection(name), where: () => { throw new Error("firestore unavailable"); } });
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("recipient_research_origin_unavailable");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("recipient_research_origin_unavailable");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("re-reads the address inside the claim, so a hypothesis record written after the checks still refuses", async () => {
    const f = await setup(), run = f.db.runTransaction.bind(f.db);
    // The first transaction is the claim: research writes the record just before it.
    vi.spyOn(f.db, "runTransaction").mockImplementationOnce(async (fn: any) => {
      await f.db.doc("outboundProspects/other-record").set({ contactEmail: f.brief.contact.email,
        screenAdmissionId: "d".repeat(64) });
      return run(fn);
    });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
    expect([...f.db.records.keys()].some(path => path.includes("/recipientFirstTouches/"))).toBe(false);
  });
  it("refuses a send when the canonical prospect record is an outreach-ready hypothesis, including inside the final claim", async () => {
    const f = await setup(), prospect = `outboundProspects/${f.job.prospectId}`;
    await f.db.doc(prospect).update({ researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" });
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("outreach_ready_hypothesis_draft_only");
    await f.db.doc(prospect).update({ qualificationTier: "verified" });
    // The marker lands after the blocker read but before the receipt claim.
    vi.mocked(verifyFounderMailbox).mockImplementationOnce(async () => {
      await f.db.doc(prospect).update({ qualificationTier: "outreach_ready" }); return {} as any;
    });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
  });
  it("keeps sending disabled by default, with no Gmail calls", async () => {
    const f = await setup(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("communications_sending_disabled");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("communications_sending_disabled");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(verifyFounderMailbox).not.toHaveBeenCalled();
  });
  it("sends once under exact human approval and records the actual receipt", async () => {
    const f = await setup();
    expect(await executeCommunicationsSend(f.payload)).toMatchObject({ messageId: "sent-message-1" });
    expect(await executeCommunicationsSend(f.payload)).toMatchObject({ messageId: "sent-message-1" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(f.receiptPath)).toMatchObject({ state: "sent", jobId: f.job.jobId });
    expect(f.db.records.get(`outboundProspects/${f.job.prospectId}`).stage).toBe("contacted");
  });
  it("claims concurrent sends once; a race never repeats Gmail POST", async () => {
    const f = await setup();
    await Promise.allSettled([executeCommunicationsSend(f.payload), executeCommunicationsSend(f.payload)]);
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
  });
  it("refuses a send without the exact recorded human review", async () => {
    const f = await setup(); await f.db.doc(`action_ledger/${f.ledgerId}`).update({ approved_by: null });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("communications_exact_human_approval_required");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("recovers a lost reply acknowledgement even after its own sent message changes the thread and sending is disabled", async () => {
    const f = await setup("reply"); vi.mocked(sendFounderMessage).mockRejectedValueOnce(new Error("lost ACK"));
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("gmail_send_requires_reconciliation_no_resend");
    bindings.thread = { ...f.thread, messages: [...f.thread!.messages, { ...f.thread!.messages[0], gmailMessageId: "real-new-own-sent" }] };
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    vi.mocked(findFounderSentMessage).mockResolvedValueOnce({ id: "real-new-own-sent", threadId: "thread-1" });
    expect(await reconcileCommunicationsSend(f.payload)).toMatchObject({ messageId: "real-new-own-sent", threadId: "thread-1" });
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(f.receiptPath).state).toBe("sent");
  });
  it("leaves an ambiguous send unresolved without repeating it when search finds nothing", async () => {
    const f = await setup(); vi.mocked(sendFounderMessage).mockRejectedValueOnce(new Error("lost ACK"));
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("no_resend");
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("no_resend");
    expect(sendFounderMessage).toHaveBeenCalledTimes(1); expect(f.db.records.get(f.receiptPath).state).toBe("unknown");
  });
  it("does not reopen a closed prospect when recovering an actual older send", async () => {
    const f = await setup(); vi.mocked(sendFounderMessage).mockRejectedValueOnce(new Error("lost ACK"));
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("no_resend");
    await f.db.doc(`outboundProspects/${f.job.prospectId}`).update({ stage: "closed" });
    vi.mocked(findFounderSentMessage).mockResolvedValueOnce({ id: "actual-sent", threadId: "actual-thread" });
    await reconcileCommunicationsSend(f.payload);
    expect(f.db.records.get(`outboundProspects/${f.job.prospectId}`).stage).toBe("closed");
  });
  it("rechecks canonical identity inside the final send transaction", async () => {
    const f = await setup();
    vi.mocked(verifyFounderMailbox).mockImplementationOnce(async () => {
      await f.db.doc(`outboundProspects/${f.job.prospectId}`).update({ contactEmail: "changed@example.com" }); return {} as any;
    });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("canonical_context_changed");
    expect(sendFounderMessage).not.toHaveBeenCalled();
  });
  it("refuses a send once the founder sent the same job from Gmail, including inside the final claim", async () => {
    const f = await setup(), observation = `${COMMUNICATIONS_ROOT}/founderSendObservations/${f.job.jobId}`;
    // The observation lands after the blocker read but before the receipt claim.
    vi.mocked(verifyFounderMailbox).mockImplementationOnce(async () => {
      await f.db.doc(observation).set({ state: "observed", jobId: f.job.jobId }); return {} as any;
    });
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow("founder_send_already_observed");
    expect(await communicationsSendBlocker(f.payload, f.ledgerId)).toBe("founder_send_already_observed");
    expect(sendFounderMessage).not.toHaveBeenCalled(); expect(f.db.records.has(f.receiptPath)).toBe(false);
    expect([...f.db.records.keys()].some(path => path.includes("/recipientFirstTouches/"))).toBe(false);
  });
  it("cannot answer the same incoming message twice by revising its brief/job", async () => {
    const f = await setup("reply"); await executeCommunicationsSend(f.payload);
    const revised = structuredClone(f.payload); revised.communications.job.jobId = "new-job"; revised.communications.brief.revision = 2;
    await expect(executeCommunicationsSend(revised)).rejects.toThrow("send_already_reserved_for_recipient_or_reply");
    expect(sendFounderMessage).toHaveBeenCalledTimes(1);
  });
  it.each(["recipient", "sender", "body", "footer", "suppression", "canonical", "thread", "optout", "mailbox"])("blocks changed %s before sending", async (kind) => {
    const f = await setup("reply");
    if (kind === "recipient") f.payload.to = "changed@example.com";
    if (kind === "sender") f.payload.from = "hello@tryblueprint.io";
    if (kind === "body") f.payload.body = "Changed body";
    if (kind === "footer") f.payload.transportBody += " Changed";
    if (kind === "suppression") vi.mocked(isEmailSuppressed).mockResolvedValueOnce(true);
    if (kind === "canonical") await f.db.doc(`outboundProspects/${f.job.prospectId}`).update({ siteId: "changed-site" });
    if (kind === "thread" || kind === "optout") bindings.thread = { ...f.thread, messages: [...f.thread!.messages, { ...f.thread!.messages[1], gmailMessageId: "message-in-new", receivedAt: "2026-09-30T22:40:00Z", body: kind === "optout" ? "Stop emailing us" : "New reply" }] };
    if (kind === "mailbox") vi.mocked(verifyFounderMailbox).mockRejectedValueOnce(new Error("founder_gmail_wrong_mailbox"));
    await expect(executeCommunicationsSend(f.payload)).rejects.toThrow(); expect(sendFounderMessage).not.toHaveBeenCalled();
  });
});
