// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ActionPayload,
  DraftOutput,
  LaneSafetyPolicy,
} from "../agents/action-policies";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
const mockSendSlackMessage = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
const dispatchActionApprovalHumanBlocker = vi.hoisted(() => vi.fn());
const safelyDispatchHumanBlocker = vi.hoisted(() =>
  vi.fn(async (_label: string, dispatcher: () => Promise<unknown>) => dispatcher()),
);

// Firestore mock infrastructure
const mockDocSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDocUpdate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDocGet = vi.hoisted(() => vi.fn());
const mockSubcollectionAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "override-1" }));
const mockQueryGet = vi.hoisted(() => vi.fn());

let docIdCounter = vi.hoisted(() => ({ value: 0 }));

const fakeDb = vi.hoisted(() => {
  const makeQuery = () => ({
    where: vi.fn(() => makeQuery()),
    limit: vi.fn(() => makeQuery()),
    get: mockQueryGet,
  });

  return {
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => {
        const docId = id ?? `auto-doc-${++docIdCounter.value}`;
        return {
          id: docId,
          set: mockDocSet,
          update: mockDocUpdate,
          get: mockDocGet,
          collection: vi.fn(() => ({
            add: mockSubcollectionAdd,
          })),
        };
      }),
      where: vi.fn(() => makeQuery()),
    })),
  };
});

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => "timestamp" },
    },
  },
  dbAdmin: fakeDb,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage: mockSendSlackMessage,
}));

vi.mock("../utils/human-blocker-autonomy", () => ({
  dispatchActionApprovalHumanBlocker,
  safelyDispatchHumanBlocker,
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  executeAction,
  approveAction,
  rejectAction,
  retryFailedAction,
  type ExecuteActionParams,
} from "../agents/action-executor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Policy that auto-approves everything (tier 1). */
const ALWAYS_AUTO_POLICY: LaneSafetyPolicy = {
  lane: "test_lane",
  autoApproveCriteria: () => true,
  alwaysHumanReview: () => false,
  maxDailyAutoSends: 1000,
  contentChecks: false,
};

/** Policy that returns tier 2 (auto with notification). */
const TIER2_POLICY: LaneSafetyPolicy = {
  lane: "test_lane",
  autoApproveCriteria: () => false,
  alwaysHumanReview: () => false,
  maxDailyAutoSends: 1000,
  contentChecks: false,
};

/** Policy that always requires human review (tier 3). */
const ALWAYS_HUMAN_POLICY: LaneSafetyPolicy = {
  lane: "test_lane",
  autoApproveCriteria: () => false,
  alwaysHumanReview: () => true,
  maxDailyAutoSends: 100,
  contentChecks: false,
};

/** Policy with content checks enabled. */
const CONTENT_CHECK_POLICY: LaneSafetyPolicy = {
  lane: "test_lane",
  autoApproveCriteria: () => true,
  alwaysHumanReview: () => false,
  maxDailyAutoSends: 1000,
  contentChecks: true,
};

/** Policy with low daily cap. */
const LOW_CAP_POLICY: LaneSafetyPolicy = {
  lane: "capped_lane",
  autoApproveCriteria: () => true,
  alwaysHumanReview: () => false,
  maxDailyAutoSends: 5,
  contentChecks: false,
};

const validEmailPayload: ActionPayload = {
  type: "send_email",
  to: "buyer@warehouse-robotics.co",
  subject: "Welcome to Blueprint",
  body: "Thank you for signing up for Blueprint. We are excited to have you on board and look forward to working with you.",
};

const baseDraft: DraftOutput = {
  recommendation: "invite_now",
  confidence: 0.95,
};

function makeParams(overrides?: Partial<ExecuteActionParams>): ExecuteActionParams {
  return {
    sourceCollection: "waitlistSubmissions",
    sourceDocId: "sub-123",
    actionType: "send_email",
    actionPayload: validEmailPayload,
    safetyPolicy: ALWAYS_AUTO_POLICY,
    draftOutput: baseDraft,
    idempotencyKey: `idem-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
  docIdCounter.value = 0;
});

// ---------------------------------------------------------------------------
// executeAction
// ---------------------------------------------------------------------------

describe("executeAction", () => {
  it("returns sent immediately for an already-sent idempotent ledger doc", async () => {
    // Simulate finding an existing ledger doc with status=sent
    mockQueryGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-ledger-1",
          data: () => ({
            status: "sent",
            action_tier: 1,
          }),
        },
      ],
    });

    const result = await executeAction(makeParams());

    expect(result.state).toBe("sent");
    expect(result.ledgerDocId).toBe("existing-ledger-1");
    expect(result.autoApproveReason).toBe("already_sent");
    // Should NOT call sendEmail again
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not treat an already-sent idempotency match as sent when the current email payload is invalid", async () => {
    mockQueryGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-ledger-1",
          data: () => ({
            status: "sent",
            action_tier: 1,
          }),
        },
      ],
    });

    const result = await executeAction(
      makeParams({
        safetyPolicy: CONTENT_CHECK_POLICY,
        actionPayload: {
          ...validEmailPayload,
          to: "person@example.com",
        },
      }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(result.error).toMatch(/reserved|placeholder|Invalid recipient/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns failed for an existing ledger doc with 3 failed attempts", async () => {
    mockQueryGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-ledger-2",
          data: () => ({
            status: "failed",
            action_tier: 2,
            execution_attempts: 3,
          }),
        },
      ],
    });

    const result = await executeAction(makeParams());

    expect(result.state).toBe("failed");
    expect(result.error).toBe("max_retries_exceeded");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates pending_approval for tier 3 draft and does not execute", async () => {
    // No existing ledger
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const result = await executeAction(
      makeParams({ safetyPolicy: ALWAYS_HUMAN_POLICY }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(mockDocSet).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(dispatchActionApprovalHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "test_lane",
        sourceCollection: "waitlistSubmissions",
        sourceDocId: "sub-123",
        actionType: "send_email",
        approvalReason: "requires_human_review",
      }),
    );
  });

  it("mirrors pending review state for direct intake follow-ups onto the source intake document", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const result = await executeAction(
      makeParams({
        sourceCollection: "contactRequests",
        sourceDocId: "contact-123",
        safetyPolicy: ALWAYS_HUMAN_POLICY,
      }),
    );

    expect(result.state).toBe("pending_approval");
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        intake_follow_up: expect.objectContaining({
          last_status: "pending_approval",
          last_ledger_doc_id: result.ledgerDocId,
          last_approval_reason: "requires_human_review",
          last_subject: "Welcome to Blueprint",
          last_recipient: "buyer@warehouse-robotics.co",
          last_error: null,
        }),
      }),
      { merge: true },
    );
  });

  it("auto-approves and executes tier 1 draft", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 0 }); // daily count check

    const result = await executeAction(makeParams());

    expect(result.state).toBe("sent");
    expect(result.tier).toBe(1);
    expect(result.autoApproveReason).toBe("policy_auto_approved");
    expect(mockDocSet).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@warehouse-robotics.co",
        subject: "Welcome to Blueprint",
      }),
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        sent_at: expect.any(Date),
        last_execution_at: expect.any(Date),
      }),
    );
    // Tier 1 should NOT send a Slack notification
    expect(mockSendSlackMessage).not.toHaveBeenCalled();
  });

  it("mirrors sent state for direct intake follow-ups onto the source intake document", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 0 }); // daily count check

    const result = await executeAction(
      makeParams({
        sourceCollection: "inboundRequests",
        sourceDocId: "request-123",
        safetyPolicy: ALWAYS_AUTO_POLICY,
      }),
    );

    expect(result.state).toBe("sent");
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        intake_follow_up: expect.objectContaining({
          last_status: "sent",
          last_ledger_doc_id: result.ledgerDocId,
          last_action_type: "send_email",
          last_subject: "Welcome to Blueprint",
          last_recipient: "buyer@warehouse-robotics.co",
          last_error: null,
          last_sent_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      }),
      { merge: true },
    );
  });

  it("auto-executes tier 2 draft with Slack notification", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 0 }); // daily count check

    const result = await executeAction(
      makeParams({ safetyPolicy: TIER2_POLICY }),
    );

    expect(result.state).toBe("sent");
    expect(result.tier).toBe(2);
    expect(result.autoApproveReason).toBe("policy_auto_with_notification");
    expect(mockSendEmail).toHaveBeenCalled();
    // Tier 2 should send operator notification
    expect(mockSendSlackMessage).toHaveBeenCalledWith(
      expect.stringContaining("Auto-executed"),
    );
  });

  it("routes to pending_approval when email content validation fails", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const badPayload: ActionPayload = {
      type: "send_email",
      to: "buyer@warehouse-robotics.co",
      subject: "Welcome",
      body: "Short", // too short
    };

    const result = await executeAction(
      makeParams({
        safetyPolicy: CONTENT_CHECK_POLICY,
        actionPayload: badPayload,
      }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(result.error).toMatch(/Body too short/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("routes campaign sends to pending_approval when recipient evidence is required but missing", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const payload: ActionPayload = {
      type: "send_campaign_emails",
      recipients: ["buyer@robotteam.co"],
      subject: "Exact-site hosted review",
      body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
      recipientEvidenceRequired: true,
    };

    const result = await executeAction(
      makeParams({
        actionType: "send_campaign_emails",
        actionPayload: payload,
        safetyPolicy: CONTENT_CHECK_POLICY,
      }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(result.error).toContain("Recipient evidence required");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("allows campaign content validation when required recipient evidence is present", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ size: 0 });

    const payload: ActionPayload = {
      type: "send_campaign_emails",
      recipients: ["buyer@robotteam.co"],
      subject: "Exact-site hosted review",
      body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
      recipientEvidenceRequired: true,
      recipientEvidence: [
        {
          email: "buyer@robotteam.co",
          evidenceSource: "unit-test-fixture:recipient-evidence",
        },
      ],
    };

    const result = await executeAction(
      makeParams({
        actionType: "send_campaign_emails",
        actionPayload: payload,
        safetyPolicy: CONTENT_CHECK_POLICY,
      }),
    );

    expect(result.state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "buyer@robotteam.co" }),
    );
  });

  it("routes campaign sends to pending_approval when recipients use reserved test domains", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const payload: ActionPayload = {
      type: "send_campaign_emails",
      recipients: ["buyer@robotteam.invalid"],
      subject: "Exact-site hosted review",
      body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
      recipientEvidenceRequired: true,
      recipientEvidence: [
        {
          email: "buyer@robotteam.invalid",
          evidenceSource: "unit-test-fixture:recipient-evidence",
        },
      ],
    };

    const result = await executeAction(
      makeParams({
        actionType: "send_campaign_emails",
        actionPayload: payload,
        safetyPolicy: CONTENT_CHECK_POLICY,
      }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(result.error).toMatch(/placeholder|reserved|Invalid campaign recipient/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("routes to pending_approval when daily cap is exceeded", async () => {
    // No existing ledger
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 5 }); // daily count check — at cap

    const result = await executeAction(
      makeParams({ safetyPolicy: LOW_CAP_POLICY }),
    );

    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("writes failed to ledger and increments attempts on execution failure", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 0 }); // daily count check
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP timeout"));

    const result = await executeAction(makeParams());

    expect(result.state).toBe("failed");
    expect(result.error).toBe("SMTP timeout");
    // Should have called update with "failed" status
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        last_execution_error: "SMTP timeout",
        execution_attempts: 1,
      }),
    );
  });

  it("marks email action failed when the transport returns sent false", async () => {
    mockQueryGet
      .mockResolvedValueOnce({ empty: true, docs: [] }) // idempotency check
      .mockResolvedValueOnce({ size: 0 }); // daily count check
    mockSendEmail.mockResolvedValueOnce({ sent: false, error: "Email transport not configured" });

    const result = await executeAction(
      makeParams({
        sourceCollection: "inboundRequests",
        sourceDocId: "request-transport-missing",
      }),
    );

    expect(result.state).toBe("failed");
    expect(result.error).toMatch(/Email transport not configured/i);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        last_execution_error: expect.stringMatching(/Email transport not configured/i),
        execution_attempts: 1,
      }),
    );
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        intake_follow_up: expect.objectContaining({
          last_status: "failed",
          last_error: expect.stringMatching(/Email transport not configured/i),
          last_subject: "Welcome to Blueprint",
          last_recipient: "buyer@warehouse-robotics.co",
        }),
      }),
      { merge: true },
    );
  });
});

// ---------------------------------------------------------------------------
// approveAction
// ---------------------------------------------------------------------------

describe("approveAction", () => {
  it("transitions pending_approval to sent on success", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "pending_approval",
        action_type: "send_email",
        action_payload: validEmailPayload,
        action_tier: 3,
        execution_attempts: 0,
      }),
    });

    const result = await approveAction("ledger-99", "ops@blueprint.io");

    expect(result.state).toBe("sent");
    expect(result.tier).toBe(3);

    // Should have updated status through operator_approved → executing → sent
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "operator_approved" }),
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );

    // Should have logged override
    expect(mockSubcollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        operator_email: "ops@blueprint.io",
        decision: "approved",
      }),
    );

    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("throws if ledger doc does not exist", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });

    await expect(
      approveAction("nonexistent", "ops@blueprint.io"),
    ).rejects.toThrow(/not found/i);
  });

  it("throws if ledger doc is not in pending_approval state", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "sent" }),
    });

    await expect(
      approveAction("ledger-99", "ops@blueprint.io"),
    ).rejects.toThrow(/Cannot approve/i);
  });

  it("keeps approval pending and does not send when required campaign recipient evidence is missing", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "pending_approval",
        action_type: "send_campaign_emails",
        action_payload: {
          type: "send_campaign_emails",
          recipients: ["buyer@robotteam.co"],
          subject: "Exact-site hosted review",
          body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
          recipientEvidenceRequired: true,
        },
        action_tier: 3,
        execution_attempts: 0,
      }),
    });

    const result = await approveAction("ledger-99", "ops@blueprint.io");

    expect(result.state).toBe("pending_approval");
    expect(result.error).toContain("Recipient evidence required");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "operator_approved" }),
    );
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
  });

  it("keeps approval pending and does not execute direct emails with reserved recipients", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "pending_approval",
        action_type: "send_email",
        action_payload: {
          type: "send_email",
          to: "person@example.com",
          subject: "Welcome to Blueprint",
          body: "Thank you for signing up for Blueprint. We are excited to have you on board and look forward to working with you.",
        },
        action_tier: 3,
        execution_attempts: 0,
      }),
    });

    const result = await approveAction("ledger-99", "ops@blueprint.io");

    expect(result.state).toBe("pending_approval");
    expect(result.error).toMatch(/reserved|placeholder|Invalid recipient/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "operator_approved" }),
    );
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
  });

  it("keeps approval pending and does not execute campaign emails with reserved recipients", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "pending_approval",
        action_type: "send_campaign_emails",
        action_payload: {
          type: "send_campaign_emails",
          recipients: ["buyer@robotteam.invalid"],
          subject: "Exact-site hosted review",
          body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
          recipientEvidenceRequired: true,
          recipientEvidence: [
            {
              email: "buyer@robotteam.invalid",
              evidenceSource: "unit-test-fixture:recipient-evidence",
            },
          ],
        },
        action_tier: 3,
        execution_attempts: 0,
      }),
    });

    const result = await approveAction("ledger-99", "ops@blueprint.io");

    expect(result.state).toBe("pending_approval");
    expect(result.error).toMatch(/reserved|placeholder|Invalid campaign recipient/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "operator_approved" }),
    );
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
  });
});

// ---------------------------------------------------------------------------
// rejectAction
// ---------------------------------------------------------------------------

describe("rejectAction", () => {
  it("transitions pending_approval to rejected with reason", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "pending_approval",
        action_tier: 3,
      }),
    });

    const result = await rejectAction(
      "ledger-100",
      "ops@blueprint.io",
      "Content not appropriate",
    );

    expect(result.state).toBe("rejected");
    expect(result.tier).toBe(3);

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        rejected_by: "ops@blueprint.io",
        rejected_reason: "Content not appropriate",
      }),
    );

    expect(mockSubcollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        operator_email: "ops@blueprint.io",
        decision: "rejected",
        reason: "Content not appropriate",
      }),
    );
  });

  it("throws if ledger doc is not in pending_approval state", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "sent" }),
    });

    await expect(
      rejectAction("ledger-100", "ops@blueprint.io", "reason"),
    ).rejects.toThrow(/Cannot reject/i);
  });
});

// ---------------------------------------------------------------------------
// retryFailedAction
// ---------------------------------------------------------------------------

describe("retryFailedAction", () => {
  it("retries and succeeds", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "failed",
        action_type: "send_email",
        action_payload: validEmailPayload,
        action_tier: 1,
        execution_attempts: 1,
      }),
    });

    const result = await retryFailedAction("ledger-200");

    expect(result.state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("keeps retry pending and does not execute direct emails with reserved recipients", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "failed",
        action_type: "send_email",
        action_payload: {
          type: "send_email",
          to: "person@example.com",
          subject: "Welcome to Blueprint",
          body: "Thank you for signing up for Blueprint. We are excited to have you on board and look forward to working with you.",
        },
        action_tier: 1,
        execution_attempts: 1,
      }),
    });

    const result = await retryFailedAction("ledger-200");

    expect(result.state).toBe("pending_approval");
    expect(result.error).toMatch(/reserved|placeholder|Invalid recipient/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
  });

  it("keeps retry pending and does not execute campaign emails without required recipient evidence", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "failed",
        action_type: "send_campaign_emails",
        action_payload: {
          type: "send_campaign_emails",
          recipients: ["buyer@robotteam.co"],
          subject: "Exact-site hosted review",
          body: "Blueprint has a capture-backed hosted-review draft ready for a real deployment-site workflow question.",
          recipientEvidenceRequired: true,
        },
        action_tier: 1,
        execution_attempts: 1,
      }),
    });

    const result = await retryFailedAction("ledger-200");

    expect(result.state).toBe("pending_approval");
    expect(result.error).toContain("Recipient evidence required");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "executing" }),
    );
  });

  it("throws if already at max retries", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "failed",
        action_tier: 1,
        execution_attempts: 3,
      }),
    });

    await expect(retryFailedAction("ledger-200")).rejects.toThrow(
      /Max retries exceeded/i,
    );
  });

  it("throws if action is not in failed state", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "sent",
        action_tier: 1,
        execution_attempts: 1,
      }),
    });

    await expect(retryFailedAction("ledger-200")).rejects.toThrow(
      /Cannot retry/i,
    );
  });

  it("throws if ledger doc does not exist", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });

    await expect(retryFailedAction("nonexistent")).rejects.toThrow(
      /not found/i,
    );
  });
});
