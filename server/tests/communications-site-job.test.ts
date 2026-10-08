import { describe, it, expect, vi } from "vitest";
import { memoryFirestore } from "./fixtures/communications";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { draftSiteJobCommunication, loadSiteJobCommunicationsContext, refreshSiteJobReplies, sendReviewedSiteJobCommunication, type SiteJobCommunicationsPorts } from "../agents/communications-site-job";
import { communicationsDigest, type CommunicationsOutput, type VerifiedThread } from "../agents/communications-contract";

vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (v: unknown) => v }));
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAdvisory: async () => ({ schemaVersion: "site_customer_advisory.v1", state: "unavailable", correlationId: null, sections: [], unknowns: [], nextAction: null }) }));
function fixture() {
  const db = memoryFirestore(new Map([
    ["inboundRequests/job-1", { contact: { email: "site@example.com" }, request: { taskStatement: "Unload dishes" }, siteTaskGates: { sameTask: "yes" },
      pilot_recommendation: { id: "rec-1", pilotCost: "Provider quote pending", reviewRequired: false } }],
    ["siteTaskBriefs/job-1", { summary: "Dish handling", proposed: [{ fieldId: "sameTask", basis: "observation", confidence: 0.8, atSeconds: 20 }], openQuestions: ["cycleTarget"], successCriteria: null }],
  ]));
  const output: CommunicationsOutput = { disposition: "draft", subject: "Your dish handling job", body: "What rate would make this useful for your operation? A target helps us decide which pilot test to recommend. You can reply here.",
    reason: "Different targets change the recommendation; video rate is not a required target.", usedFactIds: [], refreshFactIds: [], outreachContract: null, requiresHumanReview: true };
  const api = new CommunicationsAgentsAPI({ allowPaidInference: false });
  const run = vi.spyOn(api, "run").mockImplementation(async params => {
    const checkpoint = { ...params.checkpoint, createClaimedAt: "2026-10-08T17:00:00.000Z", sessionId: "simulated-existing-agent-session", turnId: "simulated-turn", requestDigest: "a".repeat(64) };
    await params.saveCheckpoint(checkpoint); return { output, checkpoint, usage: { simulated: true } };
  });
  const ports: SiteJobCommunicationsPorts = { api, now: () => Date.parse("2026-10-08T17:00:00Z"), sendsEnabled: () => true,
    suppressed: async () => false, suppress: vi.fn(async () => undefined), readThread: vi.fn(), send: vi.fn(async params => ({ messageId: "out-1", threadId: "thread-1", rfcMessageId: params.messageId })) };
  const request = async () => ({ purpose: "question" as const, instruction: "Ask the missing useful throughput target without inventing it", decisionReason: "Different target values change which pilot is suitable",
    expectedContextDigest: (await loadSiteJobCommunicationsContext(db, "job-1")).contextDigest, reviewedCustomerContext: true as const });
  return { db, output, ports, run, request };
}
describe("inbound job communications uses the existing agent and actual email evidence", () => {
  it("retains one agent output/checkpoint on the same job and reuses HTTP retries", async () => {
    const f = fixture(), request = await f.request();
    const first = await draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports);
    const again = await draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports);
    expect(f.run).toHaveBeenCalledTimes(1); expect(again).toMatchObject({ id: first.id, reused: true });
    const input = JSON.parse(f.run.mock.calls[0][0].input);
    expect(input.siteJob.context.answers.sameTask).toBe("yes");
    expect(input.siteJob.context.brief.proposed[0]).toMatchObject({ confidence: 0.8, atSeconds: 20 });
    expect(input).not.toHaveProperty("researchBrief"); expect(input.currentApproval.sendsAuthorized).toBe(false);
    expect(f.ports.send).not.toHaveBeenCalled();
    expect(f.db.records.get(`inboundRequests/job-1/communications/${first.id}`).checkpoint.sessionId).toBe("simulated-existing-agent-session");
  });
  it("omits revoked derived facts and stale decisions from an agent's context", async () => {
    const f = fixture(), job = f.db.records.get("inboundRequests/job-1");
    job.consent_revoked = true; job.customer_decision = { recommendation: "Stale derived decision" };
    const loaded = await loadSiteJobCommunicationsContext(f.db, "job-1");
    expect(loaded.context.brief).toBeNull(); expect(loaded.context.decision).toBeNull();
    expect(loaded.context.recommendation).toBeNull(); expect(loaded.context.answers).toEqual({});
  });
  it("retains an unknown paid create without letting HTTP retries create again", async () => {
    const f = fixture(), request = await f.request();
    f.run.mockImplementationOnce(async params => { await params.saveCheckpoint({ ...params.checkpoint, createClaimedAt: "2026-10-08T17:00:00.000Z" }); throw new Error("unknown_ack"); });
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports)).rejects.toThrow("unknown_ack");
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports)).rejects.toMatchObject({ code: "job_draft_in_progress_or_requires_saved_recovery" });
    expect(f.run).toHaveBeenCalledTimes(1);
  });
  it("requires current reviewed customer context and cannot address another customer", async () => {
    const f = fixture(), request = await f.request();
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...request, expectedContextDigest: "b".repeat(64) }, f.ports)).rejects.toMatchObject({ code: "job_context_review_required" });
    f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "other-thread", fetchedAt: "2026-10-08T17:00:00Z", messages: [{ from: "other@example.com", to: ["nijel@tryblueprint.io"], gmailThreadId: "other-thread" }] } as VerifiedThread);
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...request, threadId: "other-thread", inboundMessageId: "in-1" }, f.ports)).rejects.toMatchObject({ code: "job_thread_participants_not_bound" });
    f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "unrelated-thread", fetchedAt: "2026-10-08T17:00:00Z", messages: [{ from: "site@example.com", to: ["nijel@tryblueprint.io"], gmailThreadId: "unrelated-thread" }] } as VerifiedThread);
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...request, threadId: "unrelated-thread", inboundMessageId: "in-1" }, f.ports)).rejects.toMatchObject({ code: "job_thread_anchor_not_bound" });
    expect(f.run).not.toHaveBeenCalled();
  });
  it("needs the existing send gate and exact reviewed draft; repeated sends do not duplicate", async () => {
    const f = fixture(), drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
    const approval = { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: communicationsDigest(f.output), reviewedSend: true as const };
    await expect(sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, { ...f.ports, sendsEnabled: () => false })).rejects.toMatchObject({ code: "communications_send_disabled" });
    await expect(sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { ...approval, expectedOutputDigest: "b".repeat(64) }, f.ports)).rejects.toMatchObject({ code: "job_send_binding_changed" });
    const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, f.ports);
    expect(sent.sent).toBe(true);
    const again = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, f.ports);
    expect(again.reused).toBe(true); expect(f.ports.send).toHaveBeenCalledTimes(1);
    expect(f.ports.send).toHaveBeenCalledWith(expect.objectContaining({ to: "site@example.com", body: f.output.body }));
  });
  it("saves genuine natural email answers once with provenance and leaves interpretation to Blueprint", async () => {
    const f = fixture(), drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
    const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: communicationsDigest(f.output), reviewedSend: true }, f.ports);
    const anchor = { gmailMessageId: "out-1", gmailThreadId: "thread-1", rfcMessageId: sent.receipt.rfcMessageId, from: "nijel@tryblueprint.io", to: ["site@example.com"], subject: f.output.subject,
      body: f.output.body, receivedAt: "2026-10-08T17:01:00Z", inReplyTo: null, references: [] };
    f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "thread-1", fetchedAt: "2026-10-08T17:03:00Z", messages: [anchor,
      { ...anchor, gmailMessageId: "in-1", rfcMessageId: "<in-1@example.com>", from: "site@example.com", to: ["nijel@tryblueprint.io"], body: "About 30 trays an hour would help. We do not approve a visit yet.",
        receivedAt: "2026-10-08T17:02:00Z", inReplyTo: anchor.rfcMessageId, references: [anchor.rfcMessageId] }] });
    expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 1, nextOwner: "Blueprint" });
    expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 0 });
    const job = f.db.records.get("inboundRequests/job-1");
    expect(job.customerConversation).toHaveLength(1); expect(job.customerConversation[0]).toMatchObject({ source: "gmail:thread-1:in-1", receivedAt: "2026-10-08T17:02:00Z" });
    expect(job.siteTaskGates).toEqual({ sameTask: "yes" }); expect(job).not.toHaveProperty("pilot_booking");
    expect(job.customerAnswerNextOwner).toBe("Blueprint"); expect(job.pilot_recommendation.reviewRequired).toBe(false);
    expect((await loadSiteJobCommunicationsContext(f.db, "job-1")).context.customerStatements[0].text).toContain("30 trays");
    const originalThread = await f.ports.readThread("thread-1");
    f.ports.readThread = async () => ({ ...originalThread, messages: [...originalThread.messages, { ...originalThread.messages[1],
      gmailMessageId: "opt-out-1", rfcMessageId: "<opt-out-1@example.com>", body: "Do not email us again.", receivedAt: "2026-10-08T17:04:00Z" }] });
    expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 1 });
    expect(f.ports.suppress).toHaveBeenCalledWith("site@example.com");
    expect(job.pilot_recommendation.reviewRequired).toBe(false);
  });
  it("retries a known pre-provider failure on the same row and reads a retained session without another create", async () => {
    const f = fixture(), request = await f.request();
    f.run.mockRejectedValueOnce(new Error("communications_inference_disabled"));
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports)).rejects.toThrow("communications_inference_disabled");
    const drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports);
    expect(f.run).toHaveBeenCalledTimes(2);
    const ref = `inboundRequests/job-1/communications/${drafted.id}`, row = f.db.records.get(ref);
    f.db.records.set(ref, { ...row, state: "draft_requires_recovery", output: null });
    const read = vi.spyOn(f.ports.api, "reconcileSaved").mockResolvedValue({ output: f.output, checkpoint: row.checkpoint, usage: null });
    const restored = await draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports);
    expect(restored.output).toEqual(f.output); expect(read).toHaveBeenCalledTimes(1); expect(f.run).toHaveBeenCalledTimes(2);
  });
  it("checks suppression after the claim and refuses withdrawn capture authority before inference", async () => {
    const f = fixture(), request = await f.request();
    f.ports.suppressed = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports)).rejects.toMatchObject({ code: "job_customer_suppressed" });
    expect(f.run).not.toHaveBeenCalled();
    f.ports.suppressed = async () => false;
    const job = f.db.records.get("inboundRequests/job-1"); f.db.records.set("inboundRequests/job-1", { ...job, consent_revoked: true });
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports)).rejects.toMatchObject({ code: "job_capture_authority_withdrawn" });
    expect(f.run).not.toHaveBeenCalled();
  });
  it("refuses unrelated incoming mail even when Gmail groups it into a real job thread", async () => {
    const f = fixture(), anchor = { gmailMessageId: "real-out", gmailThreadId: "thread-bound", rfcMessageId: "<real-out@tryblueprint.io>",
      from: "nijel@tryblueprint.io", to: ["site@example.com"], subject: f.output.subject, body: f.output.body,
      receivedAt: "2026-10-08T17:01:00Z", inReplyTo: null, references: [] };
    f.db.records.set("inboundRequests/job-1/communications/prior", { recipient: "site@example.com", output: f.output,
      sendReceipt: { threadId: anchor.gmailThreadId, messageId: anchor.gmailMessageId, rfcMessageId: anchor.rfcMessageId } });
    f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: anchor.gmailThreadId, fetchedAt: "2026-10-08T17:04:00Z",
      messages: [anchor, { ...anchor, gmailMessageId: "unrelated-in", from: "site@example.com", to: ["hello@tryblueprint.io"],
        rfcMessageId: "<unrelated@example.com>", receivedAt: "2026-10-08T17:03:00Z", inReplyTo: "<another-job@example.com>", references: [] }] });
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...await f.request(), threadId: anchor.gmailThreadId, inboundMessageId: "unrelated-in" }, f.ports))
      .rejects.toMatchObject({ code: "job_inbound_message_not_bound" });
    expect(f.run).not.toHaveBeenCalled();
  });

});
