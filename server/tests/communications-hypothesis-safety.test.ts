// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
// The real send paths read this store; each test points it at its own in-memory one.
const store = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return store.db; }, authAdmin: null, default: {} }));
const senders = vi.hoisted(() => ({ gmail: vi.fn(), legacy: vi.fn(), verifyMailbox: vi.fn(), priorContact: vi.fn(async () => false) }));
vi.mock("../agents/communications-gmail", async importOriginal => ({ ...await importOriginal<typeof import("../agents/communications-gmail")>(),
  sendFounderMessage: senders.gmail, verifyFounderMailbox: senders.verifyMailbox, hasFounderPriorContact: senders.priorContact }));
vi.mock("../utils/email", async importOriginal => ({ ...await importOriginal<typeof import("../utils/email")>(), sendEmail: senders.legacy }));
vi.mock("../agents/communications-oauth-store", async importOriginal => ({ ...await importOriginal<typeof import("../agents/communications-oauth-store")>(),
  requireFounderSendCapability: vi.fn(async () => undefined), requireFounderDraftCapability: vi.fn(async () => undefined) }));
import { HYPOTHESIS_DRAFTS_FLAG, runCommunicationsIntake } from "../agents/communications-intake";
import { processCommunicationsJob } from "../agents/communications-worker";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { communicationsBriefSchema, communicationsDigest, OUTREACH_READY_SEND_REFUSAL } from "../agents/communications-contract";
import { communicationsSendBlocker, executeAutomaticFirstContact, executeCommunicationsSend } from "../agents/communications-send";
import { firstContactAuthority } from "../agents/communications-first-contact";
import { approveAction, retryFailedAction } from "../agents/action-executor";
import { guardProspectSend, researchProspectSendBlocker } from "../utils/outboundProspects";
import { mirrorCommunicationsGmailDraft, type GmailDraftPorts } from "../agents/communications-gmail-draft";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { hypothesisDraft, hypothesisSetup, prospects } from "./fixtures/hypothesis";

// Invented operators, *.example hosts and synthetic evidence only. Every sender is a spy that must stay unused.
afterEach(() => { vi.unstubAllEnvs(); store.db = null; for (const spy of Object.values(senders)) spy.mockClear(); });
const EVERY_SEND_FLAG = { BLUEPRINT_COMMUNICATIONS_SEND_ENABLED: "true", BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED: "true",
  BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT: "1", BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE: "true",
  BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE: "Blueprint Robotics, Inc. · 1 Synthetic Road, Testville, TX 75001" };

/** One published hypothesis, admitted and drafted by the real intake and worker, its draft awaiting review. */
async function draftedHypothesis() {
  vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
  const f = hypothesisSetup();
  await f.workItem(); await runCommunicationsIntake(f.deps);
  const intake = f.hypothesisIntake();
  const brief = communicationsBriefSchema.parse(f.records("briefs").find(item => item.briefId === intake.briefId));
  const output = hypothesisDraft(brief);
  const api = { run: vi.fn(async (params: any) => ({ output, checkpoint: params.checkpoint, usage: {} })), cancel: vi.fn(), reconcileSaved: vi.fn() };
  const result: any = await processCommunicationsJob(intake.jobId, { ...f.deps, store: new CommunicationsStore(f.db, f.deps.now, "safety-owner"),
    api, verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn() });
  expect(result.state).toBe("pending_approval");
  const ledgerId: string = result.ledgerId;
  const ledger = () => f.db.records.get(`action_ledger/${ledgerId}`);
  const prospect = prospects(f).find(item => item.id === brief.prospectId)!;
  store.db = f.db;
  return { f, intake, brief, ledgerId, ledger, prospect };
}

describe("an outreach-ready hypothesis draft can never be sent (synthetic, every send flag on)", () => {
  it("is refused by every send, approval and first-contact path", async () => {
    const h = await draftedHypothesis();
    for (const [name, value] of Object.entries(EVERY_SEND_FLAG)) vi.stubEnv(name, value);
    const payload = h.ledger().action_payload;
    expect(await communicationsSendBlocker(payload, h.ledgerId)).toBe(OUTREACH_READY_SEND_REFUSAL);
    await expect(executeCommunicationsSend(payload)).rejects.toThrow(OUTREACH_READY_SEND_REFUSAL);
    expect(firstContactAuthority(payload, h.f.deps.now())).toBeNull();
    expect(await executeAutomaticFirstContact(h.ledgerId)).toMatchObject({ state: "failed", reason: "first_contact_authority_missing_or_changed" });
    const review = reviewCommunicationsPayload(payload, h.f.deps.now());
    const checks = Object.fromEntries(Object.keys(review.semanticReviewRequired).map(key => [key, "pass"]));
    expect(await approveAction(h.ledgerId, "ops@tryblueprint.io", { digest: review.digest, checks }))
      .toMatchObject({ state: "pending_approval", error: OUTREACH_READY_SEND_REFUSAL });
    expect(h.ledger()).toMatchObject({ status: "pending_approval", approved_by: null, sent_at: null, send_authority: "none" });
    // A retry of a failed row is refused the same way.
    h.f.db.records.set(`action_ledger/${h.ledgerId}`, { ...h.ledger(), status: "failed", execution_attempts: 1 });
    expect(await retryFailedAction(h.ledgerId)).toMatchObject({ error: OUTREACH_READY_SEND_REFUSAL });
    // The legacy mailer route's guard, with sending treated as enabled.
    expect(researchProspectSendBlocker(h.prospect, true)?.blocker).toBe(OUTREACH_READY_SEND_REFUSAL);
    expect(await guardProspectSend(h.prospect as any, { sendingEnabled: () => true, isSuppressed: async () => false,
      readRecipientProspects: async () => [h.prospect] })).toMatchObject({ send: false, blocker: OUTREACH_READY_SEND_REFUSAL });
    expect(senders.gmail).not.toHaveBeenCalled(); expect(senders.legacy).not.toHaveBeenCalled();
    expect(h.f.records("sendReceipts")).toHaveLength(0);
  });

  it("refuses the row by its recorded send authority even if its payload and prospect lost every other hypothesis marker", async () => {
    const h = await draftedHypothesis();
    for (const [name, value] of Object.entries(EVERY_SEND_FLAG)) vi.stubEnv(name, value);
    const row = h.ledger(), stripped = structuredClone(row.action_payload);
    delete stripped.communications.brief.qualification;
    delete stripped.communications.brief.researchOrigin.contactEvidenceKind;
    // With the prospect record gone too, only the ledger's own send_authority still says draft only.
    h.f.db.records.delete(`outboundProspects/${h.brief.prospectId}`);
    h.f.db.records.set(`action_ledger/${h.ledgerId}`, { ...row, action_payload: stripped });
    expect(await approveAction(h.ledgerId, "ops@tryblueprint.io")).toMatchObject({ state: "pending_approval", error: OUTREACH_READY_SEND_REFUSAL });
    h.f.db.records.set(`action_ledger/${h.ledgerId}`, { ...row, action_payload: stripped, status: "failed", execution_attempts: 1 });
    expect(await retryFailedAction(h.ledgerId)).toMatchObject({ error: OUTREACH_READY_SEND_REFUSAL });
    expect(senders.gmail).not.toHaveBeenCalled(); expect(senders.legacy).not.toHaveBeenCalled();
  });

  it("copies the draft to Gmail Drafts only through the unchanged draft-copy path, and sends nothing", async () => {
    const h = await draftedHypothesis();
    h.f.advance(181000); // The drafting worker's lease has ended; the copy path waits for it.
    const job = h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    let copied: any = null;
    const ports: GmailDraftPorts = { enabled: () => true, allowsRevision: () => true, requireCapability: vi.fn(async () => {}),
      verifyMailbox: vi.fn(async () => {}), priorContact: vi.fn(async () => false),
      write: vi.fn(async content => { copied = structuredClone(content); return { draftId: "gmail-draft-synthetic" }; }),
      find: vi.fn(async content => copied && content.payloadDigest === copied.payloadDigest ? { draftId: "gmail-draft-synthetic",
        messageId: "gmail-message-synthetic", threadId: "gmail-thread-synthetic", authoredRfcMessageId: content.messageId,
        observedRfcMessageId: content.messageId } : null) };
    const result = await mirrorCommunicationsGmailDraft(h.f.db, h.ledgerId, "Synthetic Operator 1",
      { expectedReviewDigest: job.reviewDigest, expectedRevisionId: null, mode: "write" }, ports, h.f.deps.now());
    expect(result).toMatchObject({ state: "verified", sent: false });
    expect(ports.write).toHaveBeenCalledOnce();
    expect(copied).toMatchObject({ to: h.brief.contact.email, subject: h.ledger().action_payload.subject,
      body: h.ledger().action_payload.transportBody, payloadDigest: communicationsDigest(h.ledger().action_payload) });
    expect(h.f.db.records.get(`${COMMUNICATIONS_ROOT}/gmailDraftBindings/${h.intake.jobId}`)).toMatchObject({ state: "verified" });
    expect(h.ledger()).toMatchObject({ status: "pending_approval", approved_by: null, sent_at: null, send_authority: "none" });
    expect(senders.gmail).not.toHaveBeenCalled(); expect(senders.legacy).not.toHaveBeenCalled();
  });
});
