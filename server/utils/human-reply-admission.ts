import { createHash } from "node:crypto";
import type { HumanBlockerThreadRecord } from "./human-reply-store";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function humanDecisionDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value ?? null))).digest("hex");
}
export function humanDecisionBinding(thread: HumanBlockerThreadRecord): string {
  return humanDecisionDigest({ blocker: thread.blocker_id, principal: thread.approved_identity,
    title: thread.title, summary: thread.summary, issued: thread.decision_issued_at,
    execution_owner: thread.execution_owner, routing_owner: thread.routing_owner,
    action: thread.resume_action, record: thread.record_of_truth, scope: thread.repo_context,
    decision: thread.decision_context, dispatch: thread.last_dispatch_id,
    expires: thread.decision_expires_at, action_digest: thread.action_digest });
}
export function replyPrincipal(sender: string | null): string {
  const value = String(sender || "").trim();
  const match = /^(?:[^<>\r\n]*<)?([^<>\s,;]+@[^<>\s,;]+)>?$/.exec(value);
  return match ? match[1].toLowerCase() : value;
}
export function humanReplyAdmissionError(thread: HumanBlockerThreadRecord, params: {
  sender: string | null; received_at: string; external_message_id: string; channel?: string;
}, now = Date.now()): string | null {
  if (!thread.approved_identity || replyPrincipal(params.sender) !== replyPrincipal(thread.approved_identity)) return "wrong_principal";
  if (params.channel && thread.channel && params.channel !== thread.channel) return "wrong_channel";
  if ([thread.correlation.gmail_message_id, thread.correlation.external_message_id].includes(params.external_message_id)) return "outgoing_message";
  if (["awaiting_review", "resolved"].includes(thread.status) || thread.review_status === "rejected") return "decision_not_open";
  const received = Date.parse(params.received_at);
  const expires = Date.parse(thread.decision_expires_at || "");
  if (!Number.isFinite(expires) || !Number.isFinite(received) || now > expires || received > now + 60_000) return "expired_decision";
  if (thread.decision_issued_at && received < Date.parse(thread.decision_issued_at)) return "stale_revision";
  return null;
}
