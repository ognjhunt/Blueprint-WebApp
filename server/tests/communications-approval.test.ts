// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const bindings = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, default: {} }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn() }));
vi.mock("../utils/google-calendar", () => ({ createGoogleCalendarEvent: vi.fn(), updateGoogleCalendarEvent: vi.fn() }));
vi.mock("../utils/human-blocker-autonomy", () => ({ dispatchActionApprovalHumanBlocker: vi.fn(), safelyDispatchHumanBlocker: vi.fn() }));
vi.mock("../agents/communications-send", () => ({ communicationsSendBlocker: vi.fn(async () => null), executeCommunicationsSend: vi.fn(async () => ({})), reconcileCommunicationsSend: vi.fn(async () => null) }));
import { approveAction, rejectAction, retryFailedAction } from "../agents/action-executor";
import { executeCommunicationsSend, communicationsSendBlocker, reconcileCommunicationsSend } from "../agents/communications-send";
import { appendCommercialEmailFooter } from "../utils/email-suppression";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { communicationsFixture, communicationsNow, memoryFirestore, syntheticQualification } from "./fixtures/communications";
async function setup(status = "pending_approval") {
  const f = communicationsFixture("reply"); const db = memoryFirestore(); bindings.db = db;
  const payload: any = { type: "send_email", to: f.brief.contact.email, from: "nijel@tryblueprint.io", replyTo: "nijel@tryblueprint.io", emailTransport: "founder_gmail",
    subject: f.output.subject, body: f.output.body, transportBody: appendCommercialEmailFooter({ text: f.output.body, email: f.brief.contact.email, scope: "growth_campaign" }),
    gmailThreadId: f.thread!.threadId, inReplyTo: f.thread!.messages[1].rfcMessageId,
    communications: { version: "blueprint.communications.v1", job: f.job, brief: f.brief, thread: f.thread, output: f.output, approvalState: "pending_approval" } };
  const review = reviewCommunicationsPayload(payload, communicationsNow);
  const semantic = { digest: review.digest, checks: Object.fromEntries(Object.keys(review.semanticReviewRequired).map(key => [key, "pass"])) };
  await db.doc("action_ledger/ledger-1").set({ status, lane: "outbound_prospect", action_type: "send_email", action_tier: 3, action_payload: payload, execution_attempts: 0,
    ...(status === "failed" ? { approved_by: "owner@example.com", outreach_reviewed_by: "owner@example.com", outreach_semantic_review: semantic } : {}) });
  return { db, payload, semantic };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(communicationsNow); vi.mocked(communicationsSendBlocker).mockResolvedValue(null); vi.mocked(reconcileCommunicationsSend).mockResolvedValue(null); });
afterEach(() => vi.useRealTimers());
describe("communications in existing Blueprint approval flow", () => {
  it("requires every exact semantic decision and honors disabled sending", async () => {
    const f = await setup();
    expect((await approveAction("ledger-1", "owner@example.com")).state).toBe("pending_approval");
    vi.mocked(communicationsSendBlocker).mockResolvedValueOnce("communications_sending_disabled");
    expect((await approveAction("ledger-1", "owner@example.com", f.semantic)).state).toBe("pending_approval");
    expect(executeCommunicationsSend).not.toHaveBeenCalled();
  });
  it("allows only one concurrent approval to execute", async () => {
    const f = await setup();
    await Promise.allSettled([approveAction("ledger-1", "owner@example.com", f.semantic), approveAction("ledger-1", "owner@example.com", f.semantic)]);
    expect(executeCommunicationsSend).toHaveBeenCalledTimes(1);
    expect(f.db.records.get("action_ledger/ledger-1").status).toBe("sent");
  });
  it("cannot overwrite a winning rejection and send", async () => {
    const f = await setup();
    await Promise.allSettled([approveAction("ledger-1", "owner@example.com", f.semantic), rejectAction("ledger-1", "owner@example.com", "Reject draft")]);
    const state = f.db.records.get("action_ledger/ledger-1").status;
    expect(["sent", "rejected"]).toContain(state);
    if (state === "rejected") expect(executeCommunicationsSend).not.toHaveBeenCalled();
    else expect(executeCommunicationsSend).toHaveBeenCalledTimes(1);
  });
  it("losing retries never overwrite a successful execution as failed", async () => {
    const f = await setup("failed");
    await Promise.allSettled([retryFailedAction("ledger-1"), retryFailedAction("ledger-1")]);
    expect(executeCommunicationsSend).toHaveBeenCalledTimes(1);
    expect(f.db.records.get("action_ledger/ledger-1").status).toBe("sent");
  });
  it("late retry validation cannot move a winning execution back to pending approval", async () => {
    const f = await setup("failed");
    let began!: () => void; const executing = new Promise<void>(resolve => { began = resolve; });
    vi.mocked(executeCommunicationsSend).mockImplementationOnce(async () => { began(); return {} as any; });
    vi.mocked(communicationsSendBlocker).mockImplementationOnce(async () => null).mockImplementationOnce(async () => {
      await executing; return "reply_thread_changed_requires_review";
    });
    await Promise.allSettled([retryFailedAction("ledger-1"), retryFailedAction("ledger-1")]);
    expect(f.db.records.get("action_ledger/ledger-1").status).toBe("sent");
  });
  it("records recovered actual sends before new-send context checks", async () => {
    const f = await setup("failed"); vi.mocked(reconcileCommunicationsSend).mockResolvedValueOnce({ messageId: "actual", threadId: "thread-1", rfcMessageId: "<actual@example.com>" });
    await f.db.doc("action_ledger/ledger-1").update({ execution_attempts: 3 });
    expect((await retryFailedAction("ledger-1")).state).toBe("sent");
    expect(communicationsSendBlocker).not.toHaveBeenCalled(); expect(executeCommunicationsSend).not.toHaveBeenCalled();
  });
  it.each(["executing", "operator_approved"])("recovers a crash-shaped %s ledger through the authenticated retry flow", async (status) => {
    const f = await setup("failed"); await f.db.doc("action_ledger/ledger-1").update({ status });
    vi.mocked(reconcileCommunicationsSend).mockResolvedValueOnce({ messageId: "actual", threadId: "thread-1", rfcMessageId: "<actual@example.com>" });
    expect((await retryFailedAction("ledger-1")).state).toBe("sent");
    expect(executeCommunicationsSend).not.toHaveBeenCalled(); expect(communicationsSendBlocker).not.toHaveBeenCalled();
  });
  it("an interrupted active action cannot create a send when no receipt claim exists", async () => {
    const f = await setup("failed"); await f.db.doc("action_ledger/ledger-1").update({ status: "executing" });
    await expect(retryFailedAction("ledger-1")).rejects.toThrow("communications_interrupted_send_requires_reconciliation");
    expect(executeCommunicationsSend).not.toHaveBeenCalled();
    expect(f.db.records.get("action_ledger/ledger-1").status).toBe("executing");
  });
  it("invalidates a prior decision after the sender/body changes", async () => {
    const f = await setup(); f.payload.from = "hello@tryblueprint.io";
    await f.db.doc("action_ledger/ledger-1").update({ action_payload: f.payload });
    expect((await approveAction("ledger-1", "owner@example.com", f.semantic)).state).toBe("pending_approval");
    expect(executeCommunicationsSend).not.toHaveBeenCalled();
  });
  it.each<[string, (brief: any) => any]>([
    ["a qualification block", brief => ({ ...brief, qualification: syntheticQualification() })],
    ["a public-source contact", brief => ({ ...brief, researchOrigin: { ...brief.researchOrigin, contactEvidenceKind: "public_source_resolution" } })],
    ["a site-screen admission", brief => ({ ...brief, researchOrigin: { ...brief.researchOrigin, screenAdmissionId: "d".repeat(64) } })],
  ])("refuses %s at approval and retry, even when the send blocker would allow it", async (_name, hypothesis) => {
    for (const status of ["pending_approval", "failed"]) {
      const f = await setup(status);
      f.payload.communications.brief = hypothesis(f.payload.communications.brief);
      await f.db.doc("action_ledger/ledger-1").update({ action_payload: f.payload });
      const result = status === "failed" ? await retryFailedAction("ledger-1") : await approveAction("ledger-1", "owner@example.com", f.semantic);
      expect(result).toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
      expect(f.db.records.get("action_ledger/ledger-1")).toMatchObject({ status: "pending_approval",
        approval_reason: "content_validation_failed: outreach_ready_hypothesis_draft_only" });
    }
    expect(communicationsSendBlocker).not.toHaveBeenCalled();
    expect(executeCommunicationsSend).not.toHaveBeenCalled();
  });
});
