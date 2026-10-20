import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { AccountDeletionRequest, AccountDeletionQueueItem } from "../../client/src/types/accountDeletion";

export const ACCOUNT_DELETION_COLLECTION = "accountDeletionRequests";
export const RECENT_SIGN_IN_SECONDS = 5 * 60;
const REQUEST_MESSAGE = "Your request is recorded for privacy review. Your account remains active until we process it. We will confirm the outcome, including any records that must be retained. This receipt does not confirm deletion.";

export class AccountDeletionError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export function accountDeletionId(uid: string) {
  return `deletion_${createHash("sha256").update(uid).digest("hex")}`;
}

function database() {
  if (!db) throw new AccountDeletionError("Privacy requests are temporarily unavailable. Please try again or email privacy@tryblueprint.io.", 503, "privacy_requests_unavailable");
  return db;
}

export function requireRecentAccountSignIn(user: Pick<DecodedIdToken, "uid" | "auth_time">, now = Date.now()) {
  const elapsed = Math.floor(now / 1000) - user.auth_time;
  if (!user.uid || !Number.isFinite(user.auth_time) || elapsed < -60 || elapsed > RECENT_SIGN_IN_SECONDS) {
    throw new AccountDeletionError("Sign in again to confirm this request, then return to account privacy settings.", 403, "recent_sign_in_required");
  }
}

type StoredRequest = AccountDeletionQueueItem & { schemaVersion: "account_deletion_request.v1" };

function receipt(record: StoredRequest): AccountDeletionRequest {
  return { id: record.id, status: record.status, requestedAtIso: record.requestedAtIso,
    updatedAtIso: record.updatedAtIso, message: REQUEST_MESSAGE };
}

export async function getAccountDeletionRequest(uid: string) {
  const snapshot = await database().collection(ACCOUNT_DELETION_COLLECTION).doc(accountDeletionId(uid)).get();
  return snapshot.exists ? receipt(snapshot.data() as StoredRequest) : null;
}

/** The account's stable ID and transaction make double-clicks, retries and tabs idempotent. */
export async function requestAccountDeletion(user: DecodedIdToken) {
  requireRecentAccountSignIn(user);
  const databaseRef = database();
  const id = accountDeletionId(user.uid);
  const ref = databaseRef.collection(ACCOUNT_DELETION_COLLECTION).doc(id);
  return databaseRef.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) return { request: receipt(snapshot.data() as StoredRequest), created: false };
    const now = new Date().toISOString();
    const record: StoredRequest = {
      schemaVersion: "account_deletion_request.v1", id, accountUid: user.uid,
      accountEmail: typeof user.email === "string" ? user.email : null,
      status: "requested", requestedAtIso: now, updatedAtIso: now,
      reviewerUid: null, message: REQUEST_MESSAGE,
    };
    transaction.create(ref, record);
    return { request: receipt(record), created: true };
  });
}

export async function listAccountDeletionRequests(cursor?: string) {
  let query = database().collection(ACCOUNT_DELETION_COLLECTION).orderBy("__name__").limit(51);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  const page = snapshot.docs.slice(0, 50);
  return { requests: page.map(doc => {
    const record = doc.data() as StoredRequest;
    return { ...receipt(record), accountUid: record.accountUid, accountEmail: record.accountEmail,
      reviewerUid: record.reviewerUid } satisfies AccountDeletionQueueItem;
  }), nextCursor: snapshot.docs.length > 50 ? page[page.length - 1].id : null };
}

/** Claims review only: completion requires executing the privacy-request runbook. */
export async function beginAccountDeletionReview(id: string, reviewerUid: string) {
  const databaseRef = database();
  const ref = databaseRef.collection(ACCOUNT_DELETION_COLLECTION).doc(id);
  return databaseRef.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AccountDeletionError("This privacy request was not found.", 404, "privacy_request_not_found");
    const record = snapshot.data() as StoredRequest;
    if (record.status === "in_review") return receipt(record);
    const next = { ...record, status: "in_review" as const, reviewerUid, updatedAtIso: new Date().toISOString() };
    transaction.set(ref, next);
    return receipt(next);
  });
}
