// @vitest-environment node
import { describe, expect, it } from "vitest";
import { humanReplyAdmissionError, humanDecisionBinding } from "../utils/human-reply-admission";
import type { HumanBlockerThreadRecord } from "../utils/human-reply-store";
const now = Date.parse("2026-10-05T12:00:00Z");
const thread = { blocker_id: "one", approved_identity: "owner@example.com", status: "awaiting_reply",
  decision_issued_at: "2026-10-05T10:00:00Z", decision_expires_at: "2026-10-06T10:00:00Z",
  correlation: { gmail_message_id: "outgoing" }, resume_action: { kind: "manual_followup", metadata: { site: "a" } },
} as HumanBlockerThreadRecord;
const message = { sender: "Owner <owner@example.com>", external_message_id: "reply", received_at: "2026-10-05T11:00:00Z" };
describe("blocker-specific decision admission", () => {
  it("accepts the intended principal", () => expect(humanReplyAdmissionError(thread, message, now)).toBeNull());
  it.each([null, "attacker@example.com", 'owner@example.com, attacker@example.com'])('refuses %s', sender =>
    expect(humanReplyAdmissionError(thread, { ...message, sender }, now)).toBe("wrong_principal"));
  it("rejects outgoing packets", () => expect(humanReplyAdmissionError(thread, { ...message, external_message_id: "outgoing" }, now)).toBe("outgoing_message"));
  it("rejects old replies and expired or unbound legacy requests", () => {
    expect(humanReplyAdmissionError(thread, { ...message, received_at: "2026-10-04T11:00:00Z" }, now)).toBe("stale_revision");
    expect(humanReplyAdmissionError(thread, message, now + 7 * 86400_000)).toBe("expired_decision");
    expect(humanReplyAdmissionError({ ...thread, decision_expires_at: undefined }, message, now)).toBe("expired_decision");
  });
  it("binds changes in scope and action", () => {
    expect(humanDecisionBinding(thread)).not.toBe(humanDecisionBinding({ ...thread, action_digest: "changed" }));
    expect(humanDecisionBinding(thread)).not.toBe(humanDecisionBinding({ ...thread, repo_context: { project: "other" } as never }));
  });
});
