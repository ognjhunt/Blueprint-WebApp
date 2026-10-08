import { createHash } from "node:crypto";

export const QUEUE_CASE_VERSION = "blueprint-reliability-queue.v2";
export type QueueCase = {
  id: string;
  family: string;
  parameters: Record<string, string | number>;
  expected: string;
  hash: string;
  labelVersion: string;
  layer: string;
};
const cases: QueueCase[] = [];
function add(family: string, parameters: QueueCase["parameters"], expected: string) {
  const canonical = JSON.stringify({ family, parameters, expected, version: QUEUE_CASE_VERSION });
  const hash = createHash("sha256").update(canonical).digest("hex");
  cases.push({ id: `RQ-${family}-${hash.slice(0, 12)}`, family, parameters, expected, hash,
    labelVersion: QUEUE_CASE_VERSION, layer: "actual-business-handlers/in-memory-serialized-firestore/fake-email-and-description-provider" });
}

for (const mutation of ["to", "body", "subject", "replyTo", "requestId", "kind", "idempotencyKey", "deliveryToken", "cancelled", "sent"]) {
  for (const provider of ["accepted", "rejected", "unknown"]) add("ordering", { mutation, provider },
    "Preserve successor message or terminal state; retain original-effect receipt; never attach stale acceptance or redispatch uncertainty");
}
for (const storageError of ["unavailable", "permission_denied", "duplicate"]) add("storage_dependencies", { boundary: "enqueue", storageError },
  "Unacknowledged unavailable/forbidden storage creates no intent; duplicate preserves original durable intent without another effect");
for (const boundary of ["cursor_read", "cursor_write", "pending_query", "claim_read", "claim_write", "authority_read", "dispatch_write", "receipt_write", "ack_write"]) {
  for (const attempts of [0, 4, 5]) add("storage_dependencies", { boundary, attempts },
    "Storage failure cannot publish sent or replay a potentially accepted effect; pre-dispatch recovery is allowed only after lease expiry");
}
for (const outcome of ["accepted", "not_sent", "unknown", "throw", "legacy_provider_failure", "unconfigured", "accepted_missing_id", "accepted_empty_id", "accepted_numeric_id", "malformed_null"]) {
  for (const attempts of [0, 4, 5]) add("provider_failures", { outcome, attempts },
    "Only a typed acceptance with provider message identity completes; uncertainty stops replay; known nonacceptance consumes bounded attempts");
}
for (const boundary of ["pending", "lease_active", "lease_expired", "unavailable", "throw", "stale_token", "cached_brief", "late_brief", "starvation", "claim_write_failure"]) {
  const faultMustRun = ["unavailable", "throw", "stale_token", "cached_brief", "late_brief", "claim_write_failure"].includes(boundary);
  for (const attempts of faultMustRun ? [0, 1, 2] : [0, 2, 3]) add("worker_lifecycle", { boundary, attempts },
    attempts === 3 ? "Exhausted ready work stops without provider dispatch; an active lease remains protected; rotating scan must still reach later exhausted work"
      : "Durable producer intent survives worker reentry; bounded claims preserve attempts; stale workers cannot finish successors; blocked rows cannot starve ready work");
}
for (const scenario of ["duplicate", "concurrent_duplicate", "changed_amount", "changed_source", "unknown", "estimated", "supersede_unknown", "supersede_estimate", "missing_predecessor", "settled_immutable", "invalid_currency", "invalid_digest", "negative_amount", "unknown_with_amount", "conflicting_allocation"]) {
  for (const allocation of ["shared_preparation", "incremental_policy"]) add("notifications_accounting", { scenario, allocation },
    "One immutable receipt per logical allocation; unknown/estimated stay outside settled totals; duplicate events never double-charge; conflicts rejected");
}
export const queueCases = cases;
