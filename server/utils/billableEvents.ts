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
 * One cancelled because Blueprint's own email to the company failed may be asked for again: each attempt after the first
 * has its own event (`attempt`, and an id ending `-a{attempt}`), so the void one is never rewritten.
 * `madeAtIso` is written when the company's email is sent: the moment the introduction was actually made. Only an event
 * with it counts as billable (owner, 2026-11-23); one without it is shown to staff apart, never counted.
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
  /** The attempt for this pair, from 1, after an earlier one was cancelled by a failed email; absent on the first. */
  attempt?: number;
  /** When the company's introduction email was sent, so the company holds the site's details. */
  madeAtIso?: string;
}

export const billableEventId = (requestId: string, companyId: string, attempt = 0) =>
  `introduction-${requestId}-${companyId}${attempt > 0 ? `-a${attempt}` : ""}`;

/** The one event slot for a job, a company and an attempt, for a transaction to read before it writes. */
export function billableEventRef(requestId: string, companyId: string, attempt = 0): FirebaseFirestore.DocumentReference {
  if (!db) throw new Error("billable_events_store_unavailable");
  return db.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(requestId, companyId, attempt));
}

export function buildIntroductionBillableEvent(requestId: string, companyId: string, atIso: string, attempt = 0):
  BillableEvent & { status: "recorded_no_price" } {
  return { kind: "introduction", requestId, companyId, atIso, priceUsd: null, status: "recorded_no_price",
    ...(attempt > 0 ? { attempt } : {}) };
}

/**
 * Create the event inside the caller's transaction (after all its reads, one of which is `billableEventRef`). A create:
 * an event already on record makes the transaction fail rather than be overwritten.
 */
export function writeIntroductionBillableEvent(tx: FirebaseFirestore.Transaction, event: BillableEvent): void {
  tx.create(billableEventRef(event.requestId, event.companyId, event.attempt ?? 0), event);
}

/** A job's billable events, for the admin console. */
export async function listJobBillableEvents(requestId: string): Promise<Array<BillableEvent & { id: string }>> {
  if (!db) return [];
  const rows = await db.collection(BILLABLE_EVENTS_COLLECTION).where("requestId", "==", requestId).get();
  return rows.docs.map(doc => ({ id: doc.id, ...(doc.data() as BillableEvent) }))
    .sort((a, b) => String(a.atIso).localeCompare(String(b.atIso)));
}

/**
 * Owner, 2026-11-23: an event counts as billable only once its introduction is made (`madeAtIso` set, when the company's
 * email was sent). One recorded but not made (its company email not sent yet, or its outcome unknown) is counted apart so
 * staff can see it; a void one is never counted. Nothing here writes to an event.
 */
export function isMadeBillableEvent(event: { status?: unknown; madeAtIso?: unknown }): boolean {
  return event.status === "recorded_no_price" && typeof event.madeAtIso === "string" && event.madeAtIso.length > 0;
}
export function isUnmadeBillableEvent(event: { status?: unknown; madeAtIso?: unknown }): boolean {
  return event.status === "recorded_no_price" && !isMadeBillableEvent(event);
}

/** The standing events, made (billable) and recorded but not made, for the owner's totals (`ownerTotals.ts`). Read only. */
export async function tallyStandingBillableEvents(store: FirebaseFirestore.Firestore | null = db):
  Promise<{ made: number; notMade: number }> {
  if (!store) throw new Error("billable_events_store_unavailable");
  const rows = (await store.collection(BILLABLE_EVENTS_COLLECTION).select("status", "madeAtIso").get()).docs.map(doc => doc.data());
  return { made: rows.filter(isMadeBillableEvent).length, notMade: rows.filter(isUnmadeBillableEvent).length };
}

/** How many events count as billable: standing (never void) and made. */
export async function countStandingBillableEvents(store: FirebaseFirestore.Firestore | null = db): Promise<number> {
  return (await tallyStandingBillableEvents(store)).made;
}

/** Every event's ids, times and status, for the admin CSV (`ownerTotals.ts`). Read only. */
export async function listAllBillableEvents(store: FirebaseFirestore.Firestore | null = db): Promise<Array<Record<string, any>>> {
  if (!store) throw new Error("billable_events_store_unavailable");
  const snapshot = await store.collection(BILLABLE_EVENTS_COLLECTION).select("requestId", "companyId", "atIso", "madeAtIso", "status").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
