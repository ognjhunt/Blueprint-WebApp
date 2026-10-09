import { afterEach, describe, it, expect, vi } from "vitest";
import { memoryFirestore } from "./fixtures/communications";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { draftSiteJobCommunication, loadSiteJobCommunicationsContext, refreshSiteJobReplies, sendReviewedSiteJobCommunication, type SiteJobCommunicationsPorts } from "../agents/communications-site-job";
import { communicationsDigest, type CommunicationsOutput, type VerifiedThread } from "../agents/communications-contract";
import { withTextFooter } from "../utils/emailLayout";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { loadAssessmentCustomerStatements } from "../utils/siteCustomerStatements";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";

vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (v: unknown) => v }));
const advisory = vi.hoisted(() => ({ load: vi.fn(async () => ({ schemaVersion: "site_customer_advisory.v1", state: "unavailable", correlationId: null, sections: [], unknowns: [] as string[], nextAction: null as string | null })) }));
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAdvisory: advisory.load }));
afterEach(() => { advisory.load.mockClear(); vi.unstubAllEnvs(); });
function fixture() {
  const db = memoryFirestore(new Map([
    ["inboundRequests/job-1", { contact: { email: "site@example.com" }, request: { taskStatement: "Unload dishes" }, siteTaskGates: { sameTask: "yes" },
      pilot_recommendation: { id: "rec-1", pilotCost: "Provider quote pending", reviewRequired: false } }],
    ["siteTaskBriefs/job-1", { summary: "Dish handling", proposed: [{ fieldId: "sameTask", basis: "observation", confidence: 0.8, atSeconds: 20 }], openQuestions: ["cycleTarget"], successCriteria: null }],
  ]));
  const agentOutput: CommunicationsOutput = { disposition: "draft", subject: "Your dish handling job", body: "What rate would make this useful for your operation? A target helps us decide which pilot test to recommend.",
    reason: "Different targets change the recommendation; video rate is not a required target.", usedFactIds: [], refreshFactIds: [], outreachContract: null, requiresHumanReview: true };
  const output: CommunicationsOutput = { ...agentOutput, subject: "A question about your Blueprint job", body: withTextFooter("Hi,\n\nWe're following up on your Blueprint job. Your answer will help us plan the next step.\n\nWhat rate would make this useful for your operation? A target helps us decide which pilot test to recommend.\n\nReply directly to this email. A brief answer is fine; if you're unsure, let us know.\n\n— The Blueprint team") };
  const api = new CommunicationsAgentsAPI({ allowPaidInference: false });
  const run = vi.spyOn(api, "run").mockImplementation(async params => {
    const checkpoint = { ...params.checkpoint, createClaimedAt: "2026-10-08T17:00:00.000Z", sessionId: "simulated-existing-agent-session", turnId: "simulated-turn", requestDigest: "a".repeat(64) };
    await params.saveCheckpoint(checkpoint); return { output: agentOutput, checkpoint, usage: { simulated: true } };
  });
  const ports: SiteJobCommunicationsPorts = { api, now: () => Date.parse("2026-10-08T17:00:00Z"), sendsEnabled: () => true,
    suppressed: async () => false, suppress: vi.fn(async () => undefined), readThread: vi.fn(), send: vi.fn(async params => ({ messageId: "out-1", threadId: "thread-1", rfcMessageId: params.messageId })) };
  const request = async () => ({ purpose: "question" as const, instruction: "Ask the missing useful throughput target without inventing it", decisionReason: "Different target values change which pilot is suitable",
    expectedContextDigest: (await loadSiteJobCommunicationsContext(db, "job-1")).contextDigest, reviewedCustomerContext: true as const });
  return { db, output, agentOutput, ports, run, request };
}
describe("inbound job communications uses the existing agent and actual email evidence", () => {
  it("renders a fixed question email around changing agent content and reviews that exact email", async () => {
    const f = fixture(), first = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
    expect(first.output).toEqual(f.output);
    const saved = f.db.records.get(`inboundRequests/job-1/communications/${first.id}`);
    expect(saved.outputFormatting).toEqual({ version: "blueprint.customer-job-question-email.v1", agentOutputDigest: communicationsDigest(f.agentOutput) });
    expect(saved.binding.messageFormatVersion).toBe(saved.outputFormatting.version);
    expect(first.outputHtml).toContain('src="https://tryblueprint.io/brand/email-mark.png"');
    expect(first.outputHtml).toContain("#203d2e");
    expect(first.outputHtml).toContain("Blueprint Robotics, Inc.");
    expect(first.outputDigest).toBe(communicationsDigest({ output: first.output, html: first.outputHtml }));
    expect(JSON.parse(f.run.mock.calls[0][0].input).questionEmailFormat.bodyInstructions).toContain("Write only the dynamic question");
    f.agentOutput.body = "What finished state should the job achieve? This defines what the evaluation should measure.";
    const second = await draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...await f.request(), instruction: "Ask for the intended finished state" }, f.ports);
    expect(second.output.body).toContain(f.agentOutput.body);
    expect(second.output.body?.split("\n\n").slice(0, 2)).toEqual(first.output.body?.split("\n\n").slice(0, 2));
    expect(second.output.body?.split("\n\n").slice(-2)).toEqual(first.output.body?.split("\n\n").slice(-2));
    expect(f.ports.send).not.toHaveBeenCalled();
  });
  it("preserves the verified incoming subject when a formatted question replies to an existing thread", async () => {
    const f = fixture(), drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
    const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true }, f.ports);
    const anchor = { gmailMessageId: "out-1", gmailThreadId: "thread-1", rfcMessageId: sent.receipt.rfcMessageId, from: "nijel@tryblueprint.io", to: ["site@example.com"], subject: f.output.subject!, body: f.output.body!, receivedAt: "2026-10-08T17:01:00Z", inReplyTo: null, references: [] as string[] };
    f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "thread-1", fetchedAt: "2026-10-08T17:03:00Z", messages: [anchor,
      { ...anchor, gmailMessageId: "in-1", rfcMessageId: "<in-1@example.com>", from: "site@example.com", to: ["nijel@tryblueprint.io"], subject: "Re: Site's chosen job subject", body: "We need help unloading.", receivedAt: "2026-10-08T17:02:00Z", inReplyTo: anchor.rfcMessageId, references: [anchor.rfcMessageId] }] });
    const reply = await draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...await f.request(), threadId: "thread-1", inboundMessageId: "in-1" }, f.ports);
    expect(reply.output.subject).toBe("Re: Site's chosen job subject");
    expect(reply.output.body).toBe(f.output.body);
  });
  it("does not turn an empty question or a no-reply decision into a sendable template", async () => {
    const f = fixture();
    f.agentOutput.body = "";
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports)).rejects.toMatchObject({ code: "job_agent_output_not_source_bound" });
    f.agentOutput.disposition = "no_reply";
    const result = await draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...await f.request(), instruction: "Do not repeat an already answered question" }, f.ports);
    expect(result.state).toBe("needs_context");
    expect(result.output.body).toBe("");
    expect(f.ports.send).not.toHaveBeenCalled();
  });
  it("keeps plain-only coordination drafts on their existing digest and send contract", async () => {
    const f = fixture(), drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", { ...await f.request(), purpose: "coordination" }, f.ports);
    expect(drafted.output).toEqual(f.agentOutput);
    expect(drafted.outputHtml).toBeNull();
    expect(drafted.outputDigest).toBe(communicationsDigest(f.agentOutput));
    await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true }, f.ports);
    expect(vi.mocked(f.ports.send).mock.calls[0][0]).not.toHaveProperty("html");
  });
  it("passes current source-checked assessment questions to the existing agent without send authority", async () => {
    const f = fixture();
    const current = { schemaVersion: "site_customer_advisory.v1", state: "ready", correlationId: null, sections: [],
      unknowns: ["Question to resolve: What final state defines success? Decision consequence remains unverified."],
      nextAction: "Recommended next step (proposal): Define acceptance." };
    advisory.load.mockResolvedValue(current);
    try {
      await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
      const input = JSON.parse(f.run.mock.calls[0][0].input);
      expect(input.siteJob.context.assessment).toEqual(current);
      expect(input.currentApproval.sendsAuthorized).toBe(false);
      expect(f.ports.send).not.toHaveBeenCalled();
      f.db.records.get("inboundRequests/job-1").consent_revoked = true;
      expect((await loadSiteJobCommunicationsContext(f.db, "job-1")).context.assessment).toBeNull();
    } finally {
      advisory.load.mockResolvedValue({ schemaVersion: "site_customer_advisory.v1", state: "unavailable", correlationId: null, sections: [], unknowns: [], nextAction: null });
    }
  });
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
    const approval = { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true as const };
    await expect(sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, { ...f.ports, sendsEnabled: () => false })).rejects.toMatchObject({ code: "communications_send_disabled" });
    await expect(sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { ...approval, expectedOutputDigest: "b".repeat(64) }, f.ports)).rejects.toMatchObject({ code: "job_send_binding_changed" });
    const row = f.db.records.get(`inboundRequests/job-1/communications/${drafted.id}`), html = row.outputHtml;
    row.outputHtml = "<p>Unreviewed replacement</p>";
    await expect(sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, f.ports)).rejects.toMatchObject({ code: "job_send_binding_changed" });
    row.outputHtml = html;
    const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, f.ports);
    expect(sent.sent).toBe(true);
    const again = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", approval, f.ports);
    expect(again.reused).toBe(true); expect(f.ports.send).toHaveBeenCalledTimes(1);
    expect(f.ports.send).toHaveBeenCalledWith(expect.objectContaining({ to: "site@example.com", body: f.output.body, html: drafted.outputHtml }));
  });
  it("saves genuine natural email answers once with provenance and leaves interpretation to Blueprint", async () => {
    const f = fixture(), drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
    const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true }, f.ports);
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
  it.each(["completed", "running"])("joins a verified natural reply to the current %s assessment without duplicating or taking over work", async state => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    const queue = await import("../utils/siteAssessmentQueue"), wake = vi.spyOn(queue, "tickSiteAssessments").mockResolvedValue();
    try {
      const f = fixture(), raw = f.db.records.get("inboundRequests/job-1");
      raw.request.buyerType = "site_operator";
      raw.request.consent_attestation = { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T17:00:00Z" };
      const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "job-1", scene_id: "site-job-1",
        capture_id: "walkthrough-job-1", state: "published", completed_at_iso: "2026-10-08T17:00:00Z",
        video: { object_name: "scenes/site-job-1/captures/walkthrough-job-1/raw/walkthrough.mp4", generation: "31", size_bytes: 7, crc32c: "AAAAAA==" },
        manifest: { object_name: "scenes/site-job-1/captures/walkthrough-job-1/raw/manifest.json", generation: "32", size_bytes: 500,
          crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
      const sourceKey = browserPendingDecisionKey(pending);
      raw.capture_privacy_source_bound_decision = { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened", producer_source: { kind: "browser_pending", key: sourceKey } };
      const context = advisoryContextDigest(raw, f.db.records.get("siteTaskBriefs/job-1")), jobId = advisoryJobId("job-1", sourceKey, context);
      raw.site_advisory = { job_id: jobId, source_key: sourceKey, context_digest: context, state };
      f.db.records.set(`siteAssessmentJobs/${jobId}`, { schema_version: "site_assessment_job.v1", request_id: "job-1", capture_id: pending.capture_id,
        source_key: sourceKey, context_digest: context, scene_id: pending.scene_id, state, run_id: "prior-assessment", claim_id: "original-claim" });
      f.db.records.set("agentRuns/prior-assessment", { status: state, task_kind: "site_assessment" });
      f.db.records.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
      const drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
      const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true }, f.ports);
      const anchor = { gmailMessageId: "out-1", gmailThreadId: "thread-1", rfcMessageId: sent.receipt.rfcMessageId, from: "nijel@tryblueprint.io",
        to: ["site@example.com"], subject: f.output.subject, body: f.output.body, receivedAt: "2026-10-08T17:01:00Z", inReplyTo: null, references: [] };
      f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "thread-1", fetchedAt: "2026-10-08T17:04:00Z", messages: [anchor,
        { ...anchor, gmailMessageId: "in-1", rfcMessageId: "<in-1@example.com>", from: "site@example.com", to: ["nijel@tryblueprint.io"],
          body: "About 30 trays per hour would help; we have not approved a visit.", receivedAt: "2026-10-08T17:02:00Z", inReplyTo: anchor.rfcMessageId, references: [anchor.rfcMessageId] },
        { ...anchor, gmailMessageId: "in-2", rfcMessageId: "<in-2@example.com>", from: "site@example.com", to: ["nijel@tryblueprint.io"],
          body: "The final state is an extended rack.", receivedAt: "2026-10-08T17:03:00Z", inReplyTo: anchor.rfcMessageId, references: [anchor.rfcMessageId] }] });
      const first = await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports);
      expect(first).toMatchObject({ saved: 2, assessmentContinuation: state === "completed" ? "queued" : "waiting_for_assessment" });
      if (state === "running") {
        const waiting = f.db.records.get("inboundRequests/job-1");
        expect(advisoryContextDigest(waiting, f.db.records.get("siteTaskBriefs/job-1"))).toBe(context);
        expect(wake).not.toHaveBeenCalled();
        f.db.records.get(`siteAssessmentJobs/${jobId}`).state = "completed";
        f.db.records.get("agentRuns/prior-assessment").status = "completed";
        expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 0, assessmentContinuation: "queued" });
      }
      const current = f.db.records.get("inboundRequests/job-1");
      expect(current.site_advisory.job_id).not.toBe(jobId);
      expect(current.site_assessment_customer_statements).toHaveLength(2);
      const messages = await loadAssessmentCustomerStatements(f.db, "job-1", current, "site@example.com");
      expect(messages.map(message => JSON.parse(message.text).statement)).toEqual(["About 30 trays per hour would help; we have not approved a visit.", "The final state is an extended rack."]);
      expect(current.siteTaskGates).toEqual({ sameTask: "yes" }); expect(current).not.toHaveProperty("pilot_booking");
      expect(wake).toHaveBeenCalledTimes(1);
      expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 0, assessmentContinuation: "already_current" });
      expect([...f.db.records.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(2);
      expect(f.run).toHaveBeenCalledTimes(1); expect(f.ports.send).toHaveBeenCalledTimes(1);
      // The same immutable reply may reference more than one sent question.
      // Reopening it through the second anchor cannot rewrite active evidence.
      const canonicalBefore = JSON.stringify([...f.db.records].filter(([path]) => path.includes("/customerStatements/")));
      f.db.records.get(`siteAssessmentJobs/${current.site_advisory.job_id}`).state = "running";
      const secondId = "e".repeat(64), secondAnchor = { ...anchor, gmailMessageId: "out-2", rfcMessageId: "<out-2@tryblueprint.io>", receivedAt: "2026-10-08T17:01:30Z" };
      f.db.records.set(`inboundRequests/job-1/communications/${secondId}`, { recipient: "site@example.com", output: f.output,
        sendReceipt: { threadId: "thread-1", messageId: "out-2", rfcMessageId: secondAnchor.rfcMessageId } });
      const firstThread = await f.ports.readThread("thread-1");
      f.ports.readThread = async () => ({ ...firstThread, messages: [anchor, secondAnchor, ...firstThread.messages.slice(1).map(message =>
        ({ ...message, references: [anchor.rfcMessageId, secondAnchor.rfcMessageId] }))] });
      expect(await refreshSiteJobReplies(f.db, "job-1", secondId, "operator-1", f.ports)).toMatchObject({ saved: 0, assessmentContinuation: "already_current" });
      expect(JSON.stringify([...f.db.records].filter(([path]) => path.includes("/customerStatements/")))).toBe(canonicalBefore);
      expect(await loadAssessmentCustomerStatements(f.db, "job-1", f.db.records.get("inboundRequests/job-1"), "site@example.com")).toHaveLength(2);
      expect(f.db.records.get(`inboundRequests/job-1/communications/${secondId}`).answerReceived).toBe(true);
      expect(wake).toHaveBeenCalledTimes(1);
    } finally { wake.mockRestore(); }
  });
  it("does not re-admit old replies after the model's 20-reference window rolls across sent questions", async () => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    const queue = await import("../utils/siteAssessmentQueue"), wake = vi.spyOn(queue, "tickSiteAssessments").mockResolvedValue();
    try {
      const f = fixture(), raw = f.db.records.get("inboundRequests/job-1");
      raw.request.buyerType = "site_operator";
      raw.request.consent_attestation = { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T17:00:00Z" };
      const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "job-1", scene_id: "site-job-1",
        capture_id: "walkthrough-job-1", state: "published", completed_at_iso: "2026-10-08T17:00:00Z",
        video: { object_name: "scenes/site-job-1/captures/walkthrough-job-1/raw/walkthrough.mp4", generation: "31", size_bytes: 7, crc32c: "AAAAAA==" },
        manifest: { object_name: "scenes/site-job-1/captures/walkthrough-job-1/raw/manifest.json", generation: "32", size_bytes: 500,
          crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
      const source = browserPendingDecisionKey(pending);
      raw.capture_privacy_source_bound_decision = { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened", producer_source: { kind: "browser_pending", key: source } };
      const context = advisoryContextDigest(raw, f.db.records.get("siteTaskBriefs/job-1")), initialId = advisoryJobId("job-1", source, context);
      raw.site_advisory = { job_id: initialId, source_key: source, context_digest: context, state: "completed" };
      f.db.records.set(`siteAssessmentJobs/${initialId}`, { schema_version: "site_assessment_job.v1", request_id: "job-1", capture_id: pending.capture_id,
        source_key: source, context_digest: context, scene_id: pending.scene_id, state: "completed", run_id: "prior-assessment", claim_id: "original-claim" });
      f.db.records.set("agentRuns/prior-assessment", { status: "completed", task_kind: "site_assessment" });
      f.db.records.set("captureCoverageReviews/historical/calls/unknown", { state: "unknown", cost_estimate_usd: null });
      f.db.records.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
      const preserved = JSON.stringify([f.db.records.get(`siteAssessmentJobs/${initialId}`), f.db.records.get("agentRuns/prior-assessment"),
        f.db.records.get("captureCoverageReviews/historical/calls/unknown")]);
      const drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", await f.request(), f.ports);
      const sent = await sendReviewedSiteJobCommunication(f.db, "job-1", drafted.id, "operator-1", { expectedContextDigest: drafted.contextDigest, expectedOutputDigest: drafted.outputDigest, reviewedSend: true }, f.ports);
      const anchor = { gmailMessageId: "out-1", gmailThreadId: "thread-1", rfcMessageId: sent.receipt.rfcMessageId, from: "nijel@tryblueprint.io",
        to: ["site@example.com"], subject: f.output.subject, body: f.output.body, receivedAt: "2026-10-08T17:01:00Z", inReplyTo: null, references: [] };
      const secondId = "e".repeat(64), secondAnchor = { ...anchor, gmailMessageId: "out-2", rfcMessageId: "<out-2@tryblueprint.io>", receivedAt: "2026-10-08T17:01:30Z" };
      f.db.records.set(`inboundRequests/job-1/communications/${secondId}`, { recipient: "site@example.com", output: f.output,
        sendReceipt: { threadId: "thread-1", messageId: "out-2", rfcMessageId: secondAnchor.rfcMessageId } });
      const replies = [anchor, secondAnchor].flatMap((question, group) => Array.from({ length: 11 }, (_, i) => ({ ...question,
        gmailMessageId: `reply-${group}-${i}`, rfcMessageId: `<reply-${group}-${i}@example.com>`, from: "site@example.com", to: ["nijel@tryblueprint.io"],
        body: `Site answer ${group}-${i}; evaluation criteria remain unverified.`, receivedAt: `2026-10-08T17:0${group + 2}:${String(i).padStart(2, "0")}Z`,
        inReplyTo: question.rfcMessageId, references: [question.rfcMessageId] })));
      f.ports.readThread = async () => ({ mailbox: "nijel@tryblueprint.io", threadId: "thread-1", fetchedAt: "2026-10-08T17:04:00Z", messages: [anchor, secondAnchor, ...replies] });
      const complete = () => {
        const current = f.db.records.get("inboundRequests/job-1"), job = f.db.records.get(`siteAssessmentJobs/${current.site_advisory.job_id}`);
        job.state = "completed"; current.site_advisory.state = "completed";
        f.db.records.set(`agentRuns/${job.run_id}`, { status: "completed", task_kind: "site_assessment" });
      };
      expect(await refreshSiteJobReplies(f.db, "job-1", drafted.id, "operator-1", f.ports)).toMatchObject({ saved: 11, assessmentContinuation: "queued" });
      complete();
      expect(await refreshSiteJobReplies(f.db, "job-1", secondId, "operator-1", f.ports)).toMatchObject({ saved: 11, assessmentContinuation: "queued" });
      complete();
      const current = f.db.records.get("inboundRequests/job-1"), currentBefore = JSON.stringify(current);
      const canonicalBefore = JSON.stringify([...f.db.records].filter(([path]) => path.includes("/customerStatements/")));
      expect(current.site_assessment_customer_statements).toHaveLength(20);
      expect([...f.db.records].filter(([path, row]) => path.includes("/customerStatements/") && row.assessmentAdmission)).toHaveLength(22);
      expect(await loadAssessmentCustomerStatements(f.db, "job-1", current, "site@example.com")).toHaveLength(20);
      for (const id of [drafted.id, secondId, drafted.id, secondId]) {
        expect(await refreshSiteJobReplies(f.db, "job-1", id, "operator-1", f.ports)).toMatchObject({ saved: 0, assessmentContinuation: "already_current" });
        expect(JSON.stringify(f.db.records.get("inboundRequests/job-1"))).toBe(currentBefore);
      }
      expect(JSON.stringify([...f.db.records].filter(([path]) => path.includes("/customerStatements/")))).toBe(canonicalBefore);
      expect(JSON.stringify([f.db.records.get(`siteAssessmentJobs/${initialId}`), f.db.records.get("agentRuns/prior-assessment"),
        f.db.records.get("captureCoverageReviews/historical/calls/unknown")])).toBe(preserved);
      expect([...f.db.records.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(3);
      expect(wake).toHaveBeenCalledTimes(2);
      expect(f.run).toHaveBeenCalledTimes(1); expect(f.ports.send).toHaveBeenCalledTimes(1);
    } finally { wake.mockRestore(); }
  });
  it("retries a known pre-provider failure on the same row and reads a retained session without another create", async () => {
    const f = fixture(), request = await f.request();
    f.run.mockRejectedValueOnce(new Error("communications_inference_disabled"));
    await expect(draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports)).rejects.toThrow("communications_inference_disabled");
    const drafted = await draftSiteJobCommunication(f.db, "job-1", "operator-1", request, f.ports);
    expect(f.run).toHaveBeenCalledTimes(2);
    const ref = `inboundRequests/job-1/communications/${drafted.id}`, row = f.db.records.get(ref);
    f.db.records.set(ref, { ...row, state: "draft_requires_recovery", output: null });
    const read = vi.spyOn(f.ports.api, "reconcileSaved").mockResolvedValue({ output: f.agentOutput, checkpoint: row.checkpoint, usage: null });
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
