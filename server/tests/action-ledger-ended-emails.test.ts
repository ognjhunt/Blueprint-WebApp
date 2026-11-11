// @vitest-environment node
/**
 * The four-conditions screening emails ended (owner decision 2026-11-11).
 * Rows written to the approval queue before then (`inbound_not_yet_email`,
 * `inbound_lets_talk_email`, `inbound_qualified_email`) must not send on any
 * path that executes a ledger row: they close with a typed reason instead.
 * The kept "we can't simulate this kind of job yet" email still sends.
 */
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const sendEmail = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null, authAdmin: null,
}));
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/human-blocker-autonomy", () => ({ dispatchActionApprovalHumanBlocker: vi.fn(), safelyDispatchHumanBlocker: vi.fn() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { approveAction, executeAction, retryFailedAction } from "../agents/action-executor";
import { INBOUND_POLICY } from "../agents/action-policies";

const ENDED = ["inbound_not_yet_email", "inbound_lets_talk_email", "inbound_qualified_email"] as const;

function seed(ledgerId: string, actionKey: string | null, overrides: Record<string, unknown> = {}, subject = "Your job cleared our screen") {
  state.docs.set(`action_ledger/${ledgerId}`, {
    idempotency_key: `idem-${ledgerId}`, lane: "inbound", action_type: "send_email", action_tier: 3,
    source_collection: "inboundRequests", source_doc_id: "req-1",
    action_payload: { type: "send_email", to: "dana@riversidedc-ops.com", subject, body: "Hi Dana,\n\nA fixed reply about your job, as it was written before the change.\n\nBlueprint" },
    draft_output: { recommendation: "qualified_ready", confidence: 0.9 }, status: "pending_approval",
    approved_by: null, approved_at: null, rejected_by: null, rejected_reason: null,
    execution_attempts: 0, sent_at: null, created_at: new Date(), updated_at: new Date(), ...overrides,
  });
  const request = (state.docs.get("inboundRequests/req-1") ?? { contact: { email: "dana@riversidedc-ops.com" }, ops_automation: { phase2_actions: [] } }) as any;
  if (actionKey) request.ops_automation.phase2_actions.push({ action_key: actionKey, action_type: "send_email",
    action_state: "pending_approval", action_tier: 3, idempotency_key: `idem-${ledgerId}`, ledger_doc_id: ledgerId });
  state.docs.set("inboundRequests/req-1", request);
}

beforeEach(() => { state.docs.clear(); sendEmail.mockClear(); });

it.each(ENDED)("approving a queued %s sends nothing and closes the row with the owner's reason", async key => {
  seed("row-1", key);
  const result = await approveAction("row-1", "ops@tryblueprint.io");
  expect(sendEmail).not.toHaveBeenCalled();
  expect(result).toMatchObject({ state: "rejected", ledgerDocId: "row-1", error: "email_ended_by_owner_decision_2026_11_11" });
  expect(state.docs.get("action_ledger/row-1")).toMatchObject({ status: "rejected", sent_at: null,
    rejected_reason: "email_ended_by_owner_decision_2026_11_11",
    ended_email: { schema_version: "action_ledger_ended_email.v1", action_key: key, ended_on: "2026-11-11", reason: "owner_decision" } });
});

it.each(ENDED)("retrying a failed %s sends nothing and closes the row", async key => {
  seed("row-2", key, { status: "failed", execution_attempts: 1, approved_by: "ops@tryblueprint.io" });
  const result = await retryFailedAction("row-2");
  expect(sendEmail).not.toHaveBeenCalled();
  expect(result).toMatchObject({ state: "rejected", error: "email_ended_by_owner_decision_2026_11_11" });
  expect(state.docs.get("action_ledger/row-2")).toMatchObject({ status: "rejected", ended_email: { action_key: key } });
});

it("closes an inbound screening email whose source record was lost, by its lane and shape", async () => {
  seed("row-3", null);
  expect(await approveAction("row-3", "ops@tryblueprint.io")).toMatchObject({ state: "rejected" });
  expect(sendEmail).not.toHaveBeenCalled();
  expect(state.docs.get("action_ledger/row-3")).toMatchObject({ ended_email: { action_key: "inbound_screening_email" } });
});

it("still sends the kept can't-simulate-yet email if it ever travels through this ledger", async () => {
  seed("row-4", null, {}, "Your job: we are preparing its evaluation");
  const result = await approveAction("row-4", "ops@tryblueprint.io");
  expect(result.error ?? null).toBeNull(); expect(result.state).toBe("sent");
  expect(sendEmail).toHaveBeenCalledTimes(1);
});

it("closes a retained ended row a producer offers again, without sending", async () => {
  seed("row-5", "inbound_qualified_email", { status: "failed", execution_attempts: 1 });
  const row = state.docs.get("action_ledger/row-5") as any;
  const result = await executeAction({ sourceCollection: "inboundRequests", sourceDocId: "req-1", actionType: "send_email",
    actionPayload: row.action_payload, safetyPolicy: { ...INBOUND_POLICY, autoApproveCriteria: () => true, alwaysHumanReview: () => false },
    draftOutput: row.draft_output, idempotencyKey: "idem-row-5" });
  expect(result).toMatchObject({ state: "rejected", ledgerDocId: "row-5", error: "email_ended_by_owner_decision_2026_11_11" });
  expect(sendEmail).not.toHaveBeenCalled();
});
