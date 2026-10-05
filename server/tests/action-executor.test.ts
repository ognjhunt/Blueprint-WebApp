// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const transactionState = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const transactionSnapshots = vi.hoisted(() => new Map<string, any>());
const releaseSnapshots = vi.hoisted(() => new Map<string, any>());

const fakeDb = vi.hoisted(() => {
  // Each query passes its where-filters to mockQueryGet, so a test can answer by filter.
  const makeQuery = (filters: unknown[][] = []): any => ({
    where: vi.fn((...filter: unknown[]) => makeQuery([...filters, filter])),
    limit: vi.fn(() => makeQuery(filters)),
    get: () => mockQueryGet(filters),
  });

  return {
    runTransaction: async (callback: (tx: any) => Promise<unknown>) => {
      const writes: Array<() => Promise<unknown>> = [];
      const result = await callback({ get: async (ref: any) => {
        const prior = transactionSnapshots.get(ref.id);
        if (releaseSnapshots.has(ref.id) && (ref.id === "prospect-1"
          || transactionState.get(ref.id)?.status === "operator_approved" || prior?.data()?.status === "failed")) {
          const source = releaseSnapshots.get(ref.id); releaseSnapshots.delete(ref.id);
          return source;
        }
        const snap = prior || await ref.get();
        return { ...snap, data: () => ({ ...snap.data(), ...transactionState.get(ref.id) }) };
      }, update: (ref: any, value: any) => { writes.push(async () => {
        transactionState.set(ref.id, { ...transactionState.get(ref.id), ...value });
        await ref.update(value);
      }); } });
      for (const write of writes) await write();
      return result;
    },
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => {
        const docId = id ?? `auto-doc-${++docIdCounter.value}`;
        return {
          id: docId,
          set: mockDocSet,
          update: mockDocUpdate,
          get: async () => {
            const snapshot = await mockDocGet();
            if (snapshot) transactionSnapshots.set(docId, snapshot);
            return snapshot;
          },
          collection: vi.fn(() => ({
            add: mockSubcollectionAdd,
          })),
        };
      }),
      where: vi.fn((...filter: unknown[]) => makeQuery([filter])),
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
import { OUTBOUND_PROSPECT_POLICY } from "../agents/action-policies";
import { reviewOutreachDraft } from "../agents/outreach-review";
import { outreachDraft, passingOutreachChecks } from "./fixtures/outreach-review";

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
  transactionState.clear();
  transactionSnapshots.clear();
  releaseSnapshots.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  docIdCounter.value = 0;
});

// ---------------------------------------------------------------------------
// executeAction
// ---------------------------------------------------------------------------

describe("prospect outreach quality enforcement", () => {
  const payload: ActionPayload = {
    type: "send_email", to: outreachDraft.to, subject: outreachDraft.subject, body: outreachDraft.body,
    outreachContract: outreachDraft.contract, outreachContext: outreachDraft.context,
  };
  const review = { digest: reviewOutreachDraft(outreachDraft).digest, checks: passingOutreachChecks };
  const ledger = {
    status: "pending_approval", lane: "outbound_prospect", source_collection: "outboundProspects", source_doc_id: "prospect-1",
    action_type: "send_email", action_payload: payload, action_tier: 3, execution_attempts: 0,
  };
  // The canonical record the release point reads: chosen by hand, with no research admission.
  const handChosen = { facilityName: "Synthetic hand-chosen facility", contactEmail: outreachDraft.to, stage: "contacted" };
  const prospectDoc = (data: Record<string, unknown> = handChosen) => ({ exists: true, data: () => data });
  const failedLedger = { ...ledger, status: "failed", approved_by: "admin@blueprint.test", outreach_reviewed_by: "admin@blueprint.test",
    outreach_semantic_review: review };
  const approvedLedger = { ...ledger, status: "operator_approved", approved_by: "admin@blueprint.test" };
  // The release claim reads the ledger and the prospect again, inside its transaction.
  const claimReads = (claimLedger: Record<string, unknown>, prospect = prospectDoc()) => {
    releaseSnapshots.set("outreach-1", { exists: true, data: () => claimLedger });
    releaseSnapshots.set("prospect-1", prospect);
  };
  // The recipient check: no other prospect record carries the address.
  const noOtherRecords = () => mockQueryGet.mockResolvedValueOnce({ size: 0, docs: [] });
  // Other prospect records, found by address the way the recipient lookups ask for them:
  // `where("contactEmail", "in", addresses)`. Without a call, no other record exists.
  const otherRecords = (records: Record<string, unknown>[]) => mockQueryGet.mockImplementation(async (filters: unknown[][] = []) => {
    const addresses = (filters.find(([field, op]) => field === "contactEmail" && op === "in")?.[2] ?? []) as unknown[];
    const docs = records.filter(record => addresses.includes(record.contactEmail)).map(record => ({ data: () => record }));
    return { size: docs.length, empty: !docs.length, docs };
  });
  beforeEach(() => { otherRecords([]); });
  afterEach(() => { mockQueryGet.mockReset(); });
  const hypothesisAt = (contactEmail: string) => ({ ...handChosen, contactEmail, researchPublicationId: "BP-000043",
    qualificationTier: "outreach_ready" });

  it("rejects prospect-scoped campaign recipients at queue, approval, and retry", async () => {
    const campaignPayload = { ...payload, recipients: ["unreviewed@other-facility.co"] };
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });
    const queued = await executeAction(makeParams({
      sourceCollection: "outboundProspects", actionType: "send_campaign_emails",
      actionPayload: campaignPayload, safetyPolicy: ALWAYS_AUTO_POLICY,
    }));
    expect(queued.state).toBe("pending_approval");
    expect(queued.error).toBe("prospect_outreach_requires_single_email");
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...ledger, action_type: "send_campaign_emails", action_payload: campaignPayload }) });
    const approved = await approveAction("outreach-1", "admin@blueprint.test", review);
    expect(approved.state).toBe("pending_approval");
    expect(approved.error).toBe("prospect_outreach_requires_single_email");
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({
      ...ledger, status: "failed", action_type: "send_campaign_emails", action_payload: campaignPayload,
      approved_by: "admin@blueprint.test", outreach_reviewed_by: "admin@blueprint.test", outreach_semantic_review: review,
    }) });
    const retry = await retryFailedAction("outreach-1");
    expect(retry.state).toBe("pending_approval");
    expect(retry.error).toBe("prospect_outreach_requires_single_email");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("rejects other action types under prospect scope", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...ledger, action_type: "send_slack", action_payload: { message: "Outreach" } }) });
    const result = await approveAction("outreach-1", "admin@blueprint.test", review);
    expect(result.error).toBe("prospect_outreach_requires_single_email");
    expect(mockSendSlackMessage).not.toHaveBeenCalled();
  });

  it("keeps structurally valid prospect outreach pending even if a caller supplies an auto policy", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });
    const result = await executeAction(makeParams({
      sourceCollection: "outboundProspects", actionPayload: payload,
      safetyPolicy: ALWAYS_AUTO_POLICY,
    }));
    expect(result.state).toBe("pending_approval");
    expect(result.tier).toBe(3);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("checks direct executor callers before queueing, even with contentChecks disabled", async () => {
    mockQueryGet.mockResolvedValueOnce({ empty: true, docs: [] });
    const result = await executeAction(makeParams({
      sourceCollection: "outboundProspects", actionPayload: { ...payload, outreachContract: undefined },
      safetyPolicy: ALWAYS_AUTO_POLICY,
    }));
    expect(result.state).toBe("pending_approval");
    expect(result.error).toContain("outreach_contract_missing_or_invalid");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each(["source", "lane"])("fails closed for legacy approvals identified by %s", async (identity) => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({
      ...ledger, lane: identity === "lane" ? "outbound_prospect" : undefined,
      source_collection: identity === "source" ? "outboundProspects" : undefined,
      action_payload: validEmailPayload,
    }) });
    const result = await approveAction("outreach-1", "admin@blueprint.test", review);
    expect(result.state).toBe("pending_approval");
    expect(result.error).toContain("outreach_contract_missing_or_invalid");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "outreach_semantic_review_required"],
    [{ ...review, digest: "0".repeat(64) }, "outreach_review_does_not_match_draft"],
    [{ ...review, checks: { ...passingOutreachChecks, evidence: "block" } }, "outreach_semantic_review_not_passed"],
  ])("does not release a draft with a missing, stale, or rejected review", async (attestation, expected) => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger });
    const result = await approveAction("outreach-1", "admin@blueprint.test", attestation);
    expect(result.state).toBe("pending_approval");
    expect(result.error).toBe(expected);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "operator_approved" }));
  });

  it("allows existing manual approval only with all required checks bound to the draft", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospectDoc());
    noOtherRecords(); claimReads(approvedLedger);
    const result = await approveAction("outreach-1", "admin@blueprint.test", review);
    expect(result.state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: outreachDraft.to, text: outreachDraft.body }));
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "operator_approved", outreach_semantic_review: review, outreach_reviewed_by: "admin@blueprint.test",
    }));
    expect(OUTBOUND_PROSPECT_POLICY.autoApproveCriteria({})).toBe(false);
    expect(OUTBOUND_PROSPECT_POLICY.alwaysHumanReview({})).toBe(true);
  });

  it.each(["missing", "changed", "unattributed"])("blocks retry when the stored review is %s", async (scenario) => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({
      ...ledger, status: "failed", approved_by: "admin@blueprint.test",
      outreach_reviewed_by: scenario === "unattributed" ? null : "admin@blueprint.test",
      outreach_semantic_review: scenario === "missing" ? undefined : review,
      action_payload: scenario === "changed" ? { ...payload, body: payload.body + " Regards." } : payload,
    }) });
    const result = await retryFailedAction("outreach-1");
    expect(result.state).toBe("pending_approval");
    expect(result.error).toMatch(/outreach_(?:semantic_review_required|review_does_not_match_draft)/);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("retains approval on retry for an unchanged failed send", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => failedLedger }).mockResolvedValueOnce(prospectDoc());
    noOtherRecords(); claimReads(failedLedger);
    const result = await retryFailedAction("outreach-1");
    expect(result.state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it.each<[string, Record<string, unknown>, "true" | "false", string]>([
    ["a verified research prospect while the send flag is off",
      { researchPublicationId: "BP-000042", entityAdmission: "research_provisional" }, "false", "communications_sending_disabled"],
    ["an outreach-ready hypothesis with the send flag on",
      { researchPublicationId: "BP-000043", entityAdmission: "research_provisional", qualificationTier: "outreach_ready" }, "true",
      "outreach_ready_hypothesis_draft_only"],
    ["a site-screen admission with the send flag on", { screenAdmissionId: "d".repeat(64) }, "true", "outreach_ready_hypothesis_draft_only"],
    ["an unknown research admission with the send flag on",
      { researchPublicationId: "BP-000044", entityAdmission: "research_unrecognised" }, "true", "outreach_ready_hypothesis_draft_only"],
  ])("does not release the legacy mailer for %s, at approval or retry", async (_name, research, flag, expected) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", flag);
    const prospect = prospectDoc({ ...handChosen, ...research });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospect);
    expect(await approveAction("outreach-1", "admin@blueprint.test", review)).toMatchObject({ state: "pending_approval", error: expected });
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({ approval_reason: `content_validation_failed: ${expected}` }));
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => failedLedger }).mockResolvedValueOnce(prospect);
    expect(await retryFailedAction("outreach-1")).toMatchObject({ state: "pending_approval", error: expected });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "operator_approved" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "executing" }));
  });

  it("keeps a verified research prospect on the legacy mailer only while the send flag is on", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    const verified = prospectDoc({ ...handChosen, researchPublicationId: "BP-000042", entityAdmission: "research_provisional" });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(verified);
    noOtherRecords(); claimReads(approvedLedger, verified);
    expect((await approveAction("outreach-1", "admin@blueprint.test", review)).state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it.each<[string, () => Promise<unknown>, Record<string, unknown>]>([
    ["approval", () => approveAction("outreach-1", "admin@blueprint.test", review), approvedLedger],
    ["retry", () => retryFailedAction("outreach-1"), failedLedger],
  ])("re-reads the prospect inside the %s release claim, so a marker written after the release check refuses", async (_name, release, claimLedger) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => claimLedger === approvedLedger ? ledger : failedLedger })
      .mockResolvedValueOnce(prospectDoc());
    noOtherRecords();
    // Research intake marks the record a hypothesis between the release check and the claim.
    claimReads(claimLedger, prospectDoc({ ...handChosen, researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" }));
    expect(await release()).toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_approval",
      approval_reason: "content_validation_failed: outreach_ready_hypothesis_draft_only" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "executing" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it.each<[string, Record<string, unknown>]>([
    ["already executing", { ...approvedLedger, status: "executing" }],
    ["approved by someone else", { ...approvedLedger, approved_by: "other@blueprint.test" }],
    ["carrying another payload", { ...approvedLedger, action_payload: { ...payload, body: `${payload.body} Regards.` } }],
  ])("leaves a ledger %s to the release that owns it, and sends nothing", async (_name, claimLedger) => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospectDoc());
    noOtherRecords(); claimReads(claimLedger);
    await expect(approveAction("outreach-1", "admin@blueprint.test", review)).rejects.toThrow("legacy_release_state_or_payload_changed");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "executing" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("refuses an address that another prospect record holds as a hypothesis, before approval and before any flag", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false");
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospectDoc());
    mockQueryGet.mockResolvedValueOnce({ size: 2, docs: [{ data: () => handChosen },
      { data: () => ({ ...handChosen, researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" }) }] });
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "operator_approved" }));
  });

  it("fails closed on unreadable recipient records only for a research-backed release", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    const verified = prospectDoc({ ...handChosen, researchPublicationId: "BP-000042", entityAdmission: "research_provisional" });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(verified);
    mockQueryGet.mockRejectedValueOnce(new Error("firestore unavailable"));
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "recipient_research_origin_unavailable" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    // A hand-chosen prospect keeps the gates it already had.
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospectDoc());
    mockQueryGet.mockRejectedValueOnce(new Error("firestore unavailable"));
    claimReads(approvedLedger);
    expect((await approveAction("outreach-1", "admin@blueprint.test", review)).state).toBe("sent");
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("checks the address the message goes to at the release check, even when the prospect record carries another", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger })
      .mockResolvedValueOnce(prospectDoc({ ...handChosen, contactEmail: "renamed@facility.example" }));
    otherRecords([hypothesisAt(outreachDraft.to)]);
    const claims = vi.spyOn(fakeDb, "runTransaction");
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
    // Refused at the release check itself: never approved, never claimed.
    expect(claims).not.toHaveBeenCalled();
    claims.mockRestore();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "operator_approved" }));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each<[string, "approval" | "retry", string]>([
    ["the address the message goes to", "approval", outreachDraft.to],
    ["the address the prospect record now carries", "approval", "renamed@facility.example"],
    ["the address the message goes to, on retry", "retry", outreachDraft.to],
  ])("re-queries %s inside the release claim, so a hypothesis record written after the release check refuses", async (_name, path, held) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    const claimLedger = path === "approval" ? approvedLedger : failedLedger;
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => path === "approval" ? ledger : failedLedger }).mockResolvedValueOnce(prospectDoc());
    // Research writes the hypothesis record after the release check; the job's own record
    // stays hand-chosen but now carries another address.
    noOtherRecords(); otherRecords([hypothesisAt(held)]);
    claimReads(claimLedger, prospectDoc({ ...handChosen, contactEmail: "renamed@facility.example" }));
    const result = path === "approval" ? await approveAction("outreach-1", "admin@blueprint.test", review) : await retryFailedAction("outreach-1");
    expect(result).toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_approval",
      approval_reason: "content_validation_failed: outreach_ready_hypothesis_draft_only" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "executing" }));
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    ["refuses a research-backed release", { researchPublicationId: "BP-000042", entityAdmission: "research_provisional" },
      { state: "pending_approval", error: "recipient_research_origin_unavailable" }],
    ["sends a hand-chosen release", {}, { state: "sent" }],
  ])("%s when more records carry the address than the claim can read", async (_name, research, expected) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    const prospect = prospectDoc({ ...handChosen, ...research });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospect);
    noOtherRecords(); claimReads(approvedLedger, prospect);
    mockQueryGet.mockResolvedValueOnce({ size: 101, empty: false, docs: Array.from({ length: 101 }, () => ({ data: () => handChosen })) });
    expect(await approveAction("outreach-1", "admin@blueprint.test", review)).toMatchObject(expected);
    expect(mockSendEmail).toHaveBeenCalledTimes(expected.state === "sent" ? 1 : 0);
  });

  it("sends nothing when the recipient lookup inside the release claim fails", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce(prospectDoc());
    noOtherRecords(); claimReads(approvedLedger);
    mockQueryGet.mockRejectedValueOnce(new Error("firestore unavailable"));
    expect(await approveAction("outreach-1", "admin@blueprint.test", review)).toMatchObject({ state: "failed" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "executing" }));
  });

  it("refuses a legacy release whose ledger names another collection, without reading any prospect", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...ledger, source_collection: "inboundRequests" }) });
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "prospect_research_origin_unavailable" });
    expect(mockDocGet).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each<[string, () => void]>([
    ["missing", () => mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockResolvedValueOnce({ exists: false, data: () => undefined })],
    ["unreadable", () => mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ledger }).mockRejectedValueOnce(new Error("firestore unavailable"))],
    ["unaddressed", () => mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...ledger, source_doc_id: " " }) })],
  ])("fails closed when the canonical prospect record is %s", async (_name, arrange) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    arrange();
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "prospect_research_origin_unavailable" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("refuses a hypothesis communications payload before content review", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    // Deliberately incomplete: the refusal reads the raw brief and needs nothing else.
    const hypothesis = { ...payload, emailTransport: "founder_gmail", communications: { brief: { qualification: { tier: "outreach_ready" } } } };
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ ...ledger, action_payload: hypothesis }) });
    expect(await approveAction("outreach-1", "admin@blueprint.test", review))
      .toMatchObject({ state: "pending_approval", error: "outreach_ready_hypothesis_draft_only" });
    expect(mockDocGet).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "operator_approved" }));
  });
});

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
  it("retains a successful send when its audit log write fails", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: "pending_approval",
      action_type: "send_email", action_payload: validEmailPayload, action_tier: 3 }) });
    mockSubcollectionAdd.mockRejectedValueOnce(new Error("audit log unavailable"));
    expect(await approveAction("ledger-observed", "ops@blueprint.io")).toMatchObject({ state: "sent" });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("keeps a lost send acknowledgement unknown instead of retryable", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: "pending_approval",
      action_type: "send_email", action_payload: validEmailPayload, action_tier: 3 }) });
    mockSendEmail.mockRejectedValueOnce(new Error("connection lost after send"));
    expect(await approveAction("ledger-unknown", "ops@blueprint.io"))
      .toMatchObject({ state: "executing", error: "action_outcome_unknown" });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockDocUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

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
