import type { Firestore, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxInput } from "./captureOutbox";

/**
 * One atomic create: a saved site intake must retain its private-link email
 * intent, and a brief the site confirmed by submitting it (2026-11-07) exists
 * exactly when the job does, so no reader sees one without the other.
 */
export async function createInboundRequestWithReceipt(
  store: Firestore,
  requestRef: DocumentReference,
  record: DocumentData,
  receipt: OutboxInput | null,
  brief: { ref: DocumentReference; data: DocumentData } | null = null,
): Promise<void> {
  const batch = store.batch();
  batch.create(requestRef, record);
  if (receipt) {
    batch.create(store.collection(CAPTURE_OUTBOX_COLLECTION).doc(receipt.idempotencyKey), buildOutboxEntry(receipt));
  }
  // Written only if the request create above commits: a concurrent submission
  // of the same id fails as a whole and replaces nothing.
  if (brief) batch.set(brief.ref, brief.data);
  // Both absence preconditions apply to the same commit. Never use set/merge:
  // concurrent submissions must not replace a request owner or a prior intent.
  await batch.commit();
}
