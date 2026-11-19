/**
 * Money (package E, E7): each introduction is a recorded billable event. Nothing is charged, no price is set or shown,
 * and nothing here calls Stripe or touches a balance, credit or spend policy. The Terms' sentence that Blueprint
 * "charges no fee … takes no percentage" stays as it is.
 *
 * `billableEvents/{id}` = `{ kind: "introduction", requestId, companyId, atIso, priceUsd: null, status: "recorded_no_price" }`,
 * written in the introduction's own transaction. The id is fixed per job and company and the event is created, never
 * set: `requestIntroduction` reads it first and refuses a pair already on record, so an event is recorded once and
 * never rewritten, even if its introduction record were gone. The party is the company (`companyId`); a site is never
 * the party to an event. An introduction cancelled at dispatch marks its event `status: "void"` (kept, never counted).
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export const BILLABLE_EVENTS_COLLECTION = "billableEvents";

export interface BillableEvent {
  kind: "introduction";
  requestId: string;
  companyId: string;
  atIso: string;
  priceUsd: null;
  /** "void": the introduction was cancelled at dispatch (G3). The event is kept and never counted. */
  status: "recorded_no_price" | "void";
  voidedAtIso?: string;
  voidReason?: string;
}

export const billableEventId = (requestId: string, companyId: string) => `introduction-${requestId}-${companyId}`;

/** The one event slot for a job and a company, for a transaction to read before it writes. */
export function billableEventRef(requestId: string, companyId: string): FirebaseFirestore.DocumentReference {
  if (!db) throw new Error("billable_events_store_unavailable");
  return db.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(requestId, companyId));
}

export function buildIntroductionBillableEvent(requestId: string, companyId: string, atIso: string): BillableEvent & { status: "recorded_no_price" } {
  return { kind: "introduction", requestId, companyId, atIso, priceUsd: null, status: "recorded_no_price" };
}

/**
 * Create the event inside the caller's transaction (after all its reads, one of which is `billableEventRef`). A create:
 * an event already on record makes the transaction fail rather than be overwritten.
 */
export function writeIntroductionBillableEvent(tx: FirebaseFirestore.Transaction, event: BillableEvent): void {
  tx.create(billableEventRef(event.requestId, event.companyId), event);
}

/** A job's billable events, for the admin console. */
export async function listJobBillableEvents(requestId: string): Promise<Array<BillableEvent & { id: string }>> {
  if (!db) return [];
  const rows = await db.collection(BILLABLE_EVENTS_COLLECTION).where("requestId", "==", requestId).get();
  return rows.docs.map(doc => ({ id: doc.id, ...(doc.data() as BillableEvent) }))
    .sort((a, b) => String(a.atIso).localeCompare(String(b.atIso)));
}
