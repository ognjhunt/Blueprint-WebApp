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
 *
 * An introduction between Blueprint's internal test company and an internal test job (owner, 2026-11-25,
 * `internalTestCompany.ts`) is a test event: written the same way, so the flow is exercised, with
 * `status: "test_no_charge"` and `testEvent: true` (kept if the event is later marked void). It is never billable: no
 * count and no CSV row (`ownerTotals.ts`) includes it.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export const BILLABLE_EVENTS_COLLECTION = "billableEvents";

/** The status of a test introduction's event: recorded, never billable. */
export const TEST_NO_CHARGE_STATUS = "test_no_charge" as const;

export interface BillableEvent {
  kind: "introduction";
  requestId: string;
  companyId: string;
  atIso: string;
  priceUsd: null;
  /**
   * "void": the introduction was cancelled at dispatch (G3). The event is kept and never counted. "test_no_charge": a
   * test introduction (the internal test company on an internal test job), never billable.
   */
  status: "recorded_no_price" | "void" | typeof TEST_NO_CHARGE_STATUS;
  /** Only on a test introduction's event, and kept when it is marked void: never billable, never in the CSV. */
  testEvent?: true;
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

export function buildIntroductionBillableEvent(requestId: string, companyId: string, atIso: string, attempt = 0,
  options: { test?: boolean } = {}): BillableEvent {
  return { kind: "introduction", requestId, companyId, atIso, priceUsd: null,
    ...(options.test ? { status: TEST_NO_CHARGE_STATUS, testEvent: true as const } : { status: "recorded_no_price" as const }),
    ...(attempt > 0 ? { attempt } : {}) };
}

/** A test introduction's event (`TEST_NO_CHARGE_STATUS`, or `testEvent` on one marked void since): never billable. */
export function isTestBillableEvent(event: { status?: unknown; testEvent?: unknown }): boolean {
  return event.status === TEST_NO_CHARGE_STATUS || event.testEvent === true;
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
 * One job's events for the owner's marketplace numbers (`marketplaceNumbers.ts`), which pages it to the end: the
 * company, status, made time and test marker only, in document-id order (an equality filter on one field, so the
 * automatic single-field index serves it). Read only.
 */
export function jobBillableEventStatesQuery(store: FirebaseFirestore.Firestore, requestId: string): FirebaseFirestore.Query {
  return store.collection(BILLABLE_EVENTS_COLLECTION).where("requestId", "==", requestId)
    .select("companyId", "status", "madeAtIso", "testEvent").orderBy("__name__");
}

/**
 * Owner, 2026-11-23: an event counts as billable only once its introduction is made (`madeAtIso` set, when the company's
 * email was sent). One recorded but not made (its company email not sent yet, or its outcome unknown) is counted apart so
 * staff can see it; a void one is never counted. Nothing here writes to an event.
 */
export function isMadeBillableEvent(event: { status?: unknown; madeAtIso?: unknown; testEvent?: unknown }): boolean {
  return event.status === "recorded_no_price" && event.testEvent !== true && typeof event.madeAtIso === "string"
    && event.madeAtIso.length > 0;
}
export function isUnmadeBillableEvent(event: { status?: unknown; madeAtIso?: unknown; testEvent?: unknown }): boolean {
  return event.status === "recorded_no_price" && event.testEvent !== true && !isMadeBillableEvent(event);
}

/**
 * The events for the owner's totals (`ownerTotals.ts`), in one read: standing events made (billable) and recorded but
 * not made, and the test introductions made (`testMade`), which the totals take out of the introductions made. Read only.
 */
export async function tallyBillableEvents(store: FirebaseFirestore.Firestore | null = db):
  Promise<{ made: number; notMade: number; testMade: number }> {
  if (!store) throw new Error("billable_events_store_unavailable");
  const rows = (await store.collection(BILLABLE_EVENTS_COLLECTION).select("status", "madeAtIso", "testEvent").get()).docs
    .map(doc => doc.data());
  return { made: rows.filter(isMadeBillableEvent).length, notMade: rows.filter(isUnmadeBillableEvent).length,
    testMade: rows.filter(row => isTestBillableEvent(row) && typeof row.madeAtIso === "string" && row.madeAtIso.length > 0).length };
}

/** The standing events, made (billable) and recorded but not made. Read only. */
export async function tallyStandingBillableEvents(store: FirebaseFirestore.Firestore | null = db):
  Promise<{ made: number; notMade: number }> {
  const { made, notMade } = await tallyBillableEvents(store);
  return { made, notMade };
}

/** How many events count as billable: standing (never void) and made. */
export async function countStandingBillableEvents(store: FirebaseFirestore.Firestore | null = db): Promise<number> {
  return (await tallyStandingBillableEvents(store)).made;
}

/** Every event's ids, times and status, for the admin CSV (`ownerTotals.ts`), but a test introduction's. Read only. */
export async function listAllBillableEvents(store: FirebaseFirestore.Firestore | null = db): Promise<Array<Record<string, any>>> {
  if (!store) throw new Error("billable_events_store_unavailable");
  const snapshot = await store.collection(BILLABLE_EVENTS_COLLECTION)
    .select("requestId", "companyId", "atIso", "madeAtIso", "status", "testEvent").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>)).filter(row => !isTestBillableEvent(row))
    .map(({ testEvent: _test, ...row }) => row);
}
