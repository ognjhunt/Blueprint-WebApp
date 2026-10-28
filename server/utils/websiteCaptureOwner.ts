/**
 * Source ownership is assigned by the server when a job is created. A signed
 * owner/film link scopes access to that job; this subject is not a credential.
 * Claiming the job later adds account access without rewriting capture history.
 * Old records retain their original account-based identity.
 */
import { createHash } from "node:crypto";

type OwnerRecord = { capture_owner_uid?: unknown; capture_owner_bound_at_iso?: unknown;
  account_owner_uid?: unknown; claimed_at_iso?: unknown };

export function newWebsiteCaptureOwnerBinding(requestId: string, accountUid: unknown, boundAtIso: string) {
  const owner = typeof accountUid === "string" && accountUid
    ? accountUid : `site-job-${createHash("sha256").update(requestId).digest("hex").slice(0, 40)}`;
  return { capture_owner_uid: owner, capture_owner_bound_at_iso: boundAtIso };
}

export function websiteCaptureOwnerUid(record: OwnerRecord | null | undefined): unknown {
  return record && Object.prototype.hasOwnProperty.call(record, "capture_owner_uid")
    ? record.capture_owner_uid : record?.account_owner_uid;
}

export function websiteCaptureOwnerClaimedAt(record: OwnerRecord): unknown {
  return Object.prototype.hasOwnProperty.call(record, "capture_owner_uid")
    ? record.capture_owner_bound_at_iso : record.claimed_at_iso;
}

export function websiteCaptureOwnerBasis(record: OwnerRecord) {
  return Object.prototype.hasOwnProperty.call(record, "capture_owner_uid")
    ? "inboundRequests.capture_owner_uid" : "inboundRequests.account_owner_uid";
}
