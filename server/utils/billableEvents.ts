/**
 * Money (package E, E7): each introduction is a recorded billable event. Nothing is charged, no price is set or shown,
 * and nothing here calls Stripe or touches a balance, credit or spend policy. The Terms' sentence that Blueprint
 * "charges no fee … takes no percentage" stays as it is.
 *
 * `billableEvents/{id}` = `{ kind: "introduction", requestId, companyId, atIso, priceUsd: null, status: "recorded_no_price" }`,
 * written in the introduction's own transaction. The id is fixed per job and company, so an event is recorded once.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export const BILLABLE_EVENTS_COLLECTION = "billableEvents";

export interface BillableEvent {
  kind: "introduction";
  requestId: string;
  companyId: string;
  atIso: string;
  priceUsd: null;
  status: "recorded_no_price";
}

export const billableEventId = (requestId: string, companyId: string) => `introduction-${requestId}-${companyId}`;

export function buildIntroductionBillableEvent(requestId: string, companyId: string, atIso: string): BillableEvent {
  return { kind: "introduction", requestId, companyId, atIso, priceUsd: null, status: "recorded_no_price" };
}

/** Write the event inside the caller's transaction (after all its reads). */
export function writeIntroductionBillableEvent(tx: FirebaseFirestore.Transaction, event: BillableEvent): void {
  if (!db) throw new Error("billable_events_store_unavailable");
  tx.set(db.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(event.requestId, event.companyId)), event);
}

/** A job's billable events, for the admin console. */
export async function listJobBillableEvents(requestId: string): Promise<Array<BillableEvent & { id: string }>> {
  if (!db) return [];
  const rows = await db.collection(BILLABLE_EVENTS_COLLECTION).where("requestId", "==", requestId).get();
  return rows.docs.map(doc => ({ id: doc.id, ...(doc.data() as BillableEvent) }))
    .sort((a, b) => String(a.atIso).localeCompare(String(b.atIso)));
}
