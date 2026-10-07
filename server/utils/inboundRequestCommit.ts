import type { Firestore, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxInput } from "./captureOutbox";

/** One atomic create: a saved site intake must retain its private-link email intent. */
export async function createInboundRequestWithReceipt(
  store: Firestore,
  requestRef: DocumentReference,
  record: DocumentData,
  receipt: OutboxInput | null,
): Promise<void> {
  const batch = store.batch();
  batch.create(requestRef, record);
  if (receipt) {
    batch.create(store.collection(CAPTURE_OUTBOX_COLLECTION).doc(receipt.idempotencyKey), buildOutboxEntry(receipt));
  }
  // Both absence preconditions apply to the same commit. Never use set/merge:
  // concurrent submissions must not replace a request owner or a prior intent.
  await batch.commit();
}
