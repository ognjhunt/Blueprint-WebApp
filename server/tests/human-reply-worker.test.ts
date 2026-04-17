// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const listOpenHumanBlockerThreads = vi.hoisted(() => vi.fn());
const getHumanReplyEvent = vi.hoisted(() => vi.fn());
const recordHumanReplyEvent = vi.hoisted(() => vi.fn());
const applyHumanReplyThreadUpdate = vi.hoisted(() => vi.fn());
const noteHumanReplyThreadBlocker = vi.hoisted(() => vi.fn());
const recordExternalGapReport = vi.hoisted(() => vi.fn());
const resolveHumanBlockerAwaitingReply = vi.hoisted(() => vi.fn());
const approveAction = vi.hoisted(() => vi.fn());
const resolvePaperclipCompanyId = vi.hoisted(() => vi.fn());
const resolvePaperclipAgentId = vi.hoisted(() => vi.fn());
const getPaperclipIssue = vi.hoisted(() => vi.fn());
const updatePaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const resetPaperclipAgentSession = vi.hoisted(() => vi.fn());
const wakePaperclipAgent = vi.hoisted(() => vi.fn());
const runCityLaunchExecutionHarness = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-store", () => ({
  listOpenHumanBlockerThreads,
  getHumanReplyEvent,
  recordHumanReplyEvent,
  applyHumanReplyThreadUpdate,
  noteHumanReplyThreadBlocker,
}));

vi.mock("../utils/gap-closure", () => ({
  recordExternalGapReport,
}));

vi.mock("../utils/human-blocker-dispatch", () => ({
  resolveHumanBlockerAwaitingReply,
}));

vi.mock("../agents/action-executor", () => ({
  approveAction,
}));

vi.mock("../utils/paperclip", () => ({
  resolvePaperclipCompanyId,
  resolvePaperclipAgentId,
  getPaperclipIssue,
  updatePaperclipIssue,
  createPaperclipIssueComment,
  resetPaperclipAgentSession,
  wakePaperclipAgent,
}));

vi.mock("../utils/cityLaunchExecutionHarness", () => ({
  runCityLaunchExecutionHarness,
}));

afterEach(() => {
  listOpenHumanBlockerThreads.mockReset();
  getHumanReplyEvent.mockReset();
  recordHumanReplyEvent.mockReset();
  applyHumanReplyThreadUpdate.mockReset();
  noteHumanReplyThreadBlocker.mockReset();
  recordExternalGapReport.mockReset();
  resolveHumanBlockerAwaitingReply.mockReset();
  approveAction.mockReset();
  resolvePaperclipCompanyId.mockReset();
  resolvePaperclipAgentId.mockReset();
  getPaperclipIssue.mockReset();
  updatePaperclipIssue.mockReset();
  createPaperclipIssueComment.mockReset();
  resetPaperclipAgentSession.mockReset();
  wakePaperclipAgent.mockReset();
  runCityLaunchExecutionHarness.mockReset();
  vi.resetModules();
});

describe("human reply worker", () => {
  it("approves queued action ledgers from approval replies", async () => {
    resolveHumanBlockerAwaitingReply.mockResolvedValue(true);
    listOpenHumanBlockerThreads.mockResolvedValue([
      {
        blocker_id: "blocker-action",
        title: "Queued action",
        blocker_kind: "ops_commercial",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "ops-lead",
        escalation_owner: null,
        approved_identity: "ohstnhunt@gmail.com",
        record_of_truth: {
          report_paths: [],
          paperclip_issue_id: null,
          ops_work_item_id: "ledger-123",
        },
        correlation: {
          blocker_id: "blocker-action",
          outbound_subject: "[Blueprint Blocker] [Blueprint Blocker ID: blocker-action] Queued action",
        },
        resume_action: {
          kind: "manual_followup",
          description: "Resume queued action",
          metadata: {},
        },
      },
    ]);
    getHumanReplyEvent.mockResolvedValue(null);
    recordHumanReplyEvent.mockResolvedValue({
      id: "email:msg-1",
    });
    recordExternalGapReport.mockResolvedValue({ stable_id: "human_reply:blocker-action" });
    approveAction.mockResolvedValue({ state: "sent", ledgerDocId: "ledger-123", tier: 3 });

    const { ingestHumanReplyPayload } = await import("../utils/human-reply-worker");
    const result = await ingestHumanReplyPayload({
      channel: "email",
      external_message_id: "msg-1",
      subject: "[Blueprint Blocker] [Blueprint Blocker ID: blocker-action] Queued action",
      body: "Approved. Go ahead.",
    });

    expect(approveAction).toHaveBeenCalledWith("ledger-123", "ohstnhunt@gmail.com");
    expect(resolveHumanBlockerAwaitingReply).toHaveBeenCalledWith("blocker-action");
    expect(result).toMatchObject({
      processed: true,
      blocker_id: "blocker-action",
      resolution: "resolved_input",
    });
  });

  it("wakes the execution owner on linked Paperclip issues after a resolved reply", async () => {
    resolveHumanBlockerAwaitingReply.mockResolvedValue(true);
    listOpenHumanBlockerThreads.mockResolvedValue([
      {
        blocker_id: "blocker-issue",
        title: "Production blocker",
        blocker_kind: "technical",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "webapp-codex",
        escalation_owner: "blueprint-cto",
        approved_identity: "ohstnhunt@gmail.com",
        record_of_truth: {
          report_paths: [],
          paperclip_issue_id: "issue-123",
          ops_work_item_id: null,
        },
        correlation: {
          blocker_id: "blocker-issue",
          outbound_subject: "[Blueprint Blocker] [Blueprint Blocker ID: blocker-issue] Production blocker",
        },
        resume_action: {
          kind: "manual_followup",
          description: "Rerun the blocked task",
          metadata: {},
        },
      },
    ]);
    getHumanReplyEvent.mockResolvedValue(null);
    recordHumanReplyEvent.mockResolvedValue({
      id: "email:msg-2",
    });
    recordExternalGapReport.mockResolvedValue({ stable_id: "human_reply:blocker-issue" });
    resolvePaperclipCompanyId.mockResolvedValue("company-1");
    resolvePaperclipAgentId.mockResolvedValue("agent-123");
    getPaperclipIssue.mockResolvedValue({
      id: "issue-123",
      assigneeAgentId: "agent-old",
    });
    updatePaperclipIssue.mockResolvedValue({});
    createPaperclipIssueComment.mockResolvedValue({});
    resetPaperclipAgentSession.mockResolvedValue({});
    wakePaperclipAgent.mockResolvedValue({ runId: "run-123" });

    const { ingestHumanReplyPayload } = await import("../utils/human-reply-worker");
    const result = await ingestHumanReplyPayload({
      channel: "email",
      external_message_id: "msg-2",
      subject: "[Blueprint Blocker] [Blueprint Blocker ID: blocker-issue] Production blocker",
      body: "I added the key and redeployed.",
      received_at: "2026-04-13T14:00:00.000Z",
    });

    expect(updatePaperclipIssue).toHaveBeenCalledWith("issue-123", {
      assigneeAgentId: "agent-123",
    });
    expect(createPaperclipIssueComment).toHaveBeenCalledWith(
      "issue-123",
      expect.stringContaining("Auto-resume: waking webapp-codex."),
    );
    expect(resetPaperclipAgentSession).toHaveBeenCalledWith("agent-123", "issue-123", "company-1");
    expect(wakePaperclipAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-123",
        companyId: "company-1",
        reason: "human_reply_resolved",
        idempotencyKey: "human-reply:blocker-issue:email:msg-2",
      }),
    );
    expect(resolveHumanBlockerAwaitingReply).toHaveBeenCalledWith("blocker-issue");
    expect(noteHumanReplyThreadBlocker).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      processed: true,
      blocker_id: "blocker-issue",
      resolution: "resolved_input",
    });
  });

  it("auto-activates city launches from approval replies without a manual rerun", async () => {
    resolveHumanBlockerAwaitingReply.mockResolvedValue(true);
    listOpenHumanBlockerThreads.mockResolvedValue([
      {
        blocker_id: "city-launch-approval-chicago-il-123",
        title: "Chicago, IL City Launch Approval",
        blocker_kind: "ops_commercial",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "city-launch-agent",
        escalation_owner: null,
        approved_identity: "ohstnhunt@gmail.com",
        record_of_truth: {
          report_paths: [],
          paperclip_issue_id: null,
          ops_work_item_id: null,
        },
        correlation: {
          blocker_id: "city-launch-approval-chicago-il-123",
          outbound_subject:
            "[Blueprint Blocker] [Blueprint Blocker ID: city-launch-approval-chicago-il-123] Chicago, IL City Launch Approval",
        },
        resume_action: {
          kind: "city_launch_activate",
          description: "Activate Chicago after approval.",
          metadata: {
            city: "Chicago, IL",
            budgetTier: "low_budget",
            budgetMaxUsd: 2500,
            operatorAutoApproveUsd: 500,
          },
        },
      },
    ]);
    getHumanReplyEvent.mockResolvedValue(null);
    recordHumanReplyEvent.mockResolvedValue({
      id: "email:msg-3",
    });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_reply:city-launch-approval-chicago-il-123",
    });
    runCityLaunchExecutionHarness.mockResolvedValue({
      city: "Chicago, IL",
      paperclip: {
        rootIssueId: "root-1",
        dispatched: [],
      },
    });

    const { ingestHumanReplyPayload } = await import("../utils/human-reply-worker");
    const result = await ingestHumanReplyPayload({
      channel: "email",
      external_message_id: "msg-3",
      subject:
        "[Blueprint Blocker] [Blueprint Blocker ID: city-launch-approval-chicago-il-123] Chicago, IL City Launch Approval",
      body: "APPROVE ALL",
      received_at: "2026-04-17T16:30:00.000Z",
    });

    expect(runCityLaunchExecutionHarness).toHaveBeenCalledWith({
      city: "Chicago, IL",
      founderApproved: true,
      budgetTier: "low_budget",
      budgetMaxUsd: 2500,
      operatorAutoApproveUsd: 500,
    });
    expect(approveAction).not.toHaveBeenCalled();
    expect(wakePaperclipAgent).not.toHaveBeenCalled();
    expect(resolveHumanBlockerAwaitingReply).toHaveBeenCalledWith(
      "city-launch-approval-chicago-il-123",
    );
    expect(result).toMatchObject({
      processed: true,
      blocker_id: "city-launch-approval-chicago-il-123",
      resolution: "resolved_input",
    });
  });
});
