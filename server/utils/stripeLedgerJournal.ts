/**
 * Append-only Stripe financial journal (SCALE2-01).
 *
 * One immutable document per financial state transition (checkout completed,
 * refund, dispute opened/resolved, payout approved, disbursement
 * initiated/settled/failed), written in the SAME Firestore transaction as the
 * corresponding `buyerOrders` / `creatorPayouts` /
 * `creatorPayoutDisbursements` write. Reconciliation sums this journal
 * instead of scanning mutable ledger projections.
 *
 * Invariants:
 *  - Entries are never updated or deleted (no TTL: this is a permanent
 *    money-plane record, like the payout ledger collections).
 *  - Entry ids are deterministic (`{entry_type}:{discriminator}`), so a
 *    webhook retry or double-processed queue job re-derives the same id and
 *    the in-transaction existence check makes the write a no-op instead of a
 *    duplicate.
 *  - Journal writes are additive: they never replace or weaken the underlying
 *    ledger writes (including the WEB-01 double-pay transaction guard).
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export const STRIPE_LEDGER_JOURNAL_COLLECTION = "stripeLedgerJournal";
export const STRIPE_LEDGER_JOURNAL_SCHEMA = "blueprint/stripe-ledger-journal/v1";

export type StripeLedgerEntryType =
  | "checkout_completed"
  | "order_refunded"
  | "dispute_opened"
  | "dispute_resolved"
  | "payout_approved"
  | "disbursement_initiated"
  | "disbursement_settled"
  | "disbursement_failed";

/** Money direction relative to the platform. */
export type StripeLedgerDirection =
  | "buyer_revenue_in"
  | "creator_payout_out"
  | "neutral";

export type StripeLedgerJournalEntryInput = {
  entryType: StripeLedgerEntryType;
  /** Deterministic idempotency discriminator (event id, disbursement id…). */
  discriminator: string;
  amountCents: number | null;
  currency: string | null;
  direction: StripeLedgerDirection;
  orderId?: string | null;
  creatorId?: string | null;
  disbursementId?: string | null;
  payoutEntryIds?: string[];
  stripeEventId?: string | null;
  stripeEventType?: string | null;
  occurredAt?: string | null;
  details?: Record<string, unknown> | null;
};

export type StripeLedgerJournalEntry = {
  id: string;
  schema: typeof STRIPE_LEDGER_JOURNAL_SCHEMA;
  entry_type: StripeLedgerEntryType;
  amount_cents: number | null;
  currency: string | null;
  direction: StripeLedgerDirection;
  order_id: string | null;
  creator_id: string | null;
  disbursement_id: string | null;
  payout_entry_ids: string[];
  stripe_event_id: string | null;
  stripe_event_type: string | null;
  occurred_at: string;
  recorded_at: string;
  details: Record<string, unknown> | null;
};

export function stripeLedgerJournalEntryId(
  entryType: StripeLedgerEntryType,
  discriminator: string,
): string {
  // Firestore doc ids cannot contain "/" — Stripe ids never do, but fail
  // closed on anything unexpected rather than silently splitting the path.
  const safeDiscriminator = discriminator.replace(/\//g, "_");
  return `${entryType}:${safeDiscriminator}`;
}

export function buildStripeLedgerJournalEntry(
  input: StripeLedgerJournalEntryInput,
): StripeLedgerJournalEntry {
  const recordedAt = new Date().toISOString();
  return {
    id: stripeLedgerJournalEntryId(input.entryType, input.discriminator),
    schema: STRIPE_LEDGER_JOURNAL_SCHEMA,
    entry_type: input.entryType,
    amount_cents:
      typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
        ? Math.floor(input.amountCents)
        : null,
    currency: input.currency ? input.currency.toLowerCase() : null,
    direction: input.direction,
    order_id: input.orderId || null,
    creator_id: input.creatorId || null,
    disbursement_id: input.disbursementId || null,
    payout_entry_ids: input.payoutEntryIds || [],
    stripe_event_id: input.stripeEventId || null,
    stripe_event_type: input.stripeEventType || null,
    occurred_at: input.occurredAt || recordedAt,
    recorded_at: recordedAt,
    details: input.details || null,
  };
}

type FirestoreLike = NonNullable<typeof db>;

export function stripeLedgerJournalEntryRef(
  firestore: FirestoreLike,
  input: Pick<StripeLedgerJournalEntryInput, "entryType" | "discriminator">,
) {
  return firestore
    .collection(STRIPE_LEDGER_JOURNAL_COLLECTION)
    .doc(stripeLedgerJournalEntryId(input.entryType, input.discriminator));
}

/**
 * Transactional two-phase helper honoring Firestore's reads-before-writes
 * rule: call `read()` alongside the transaction's other reads, then
 * `append()` alongside its writes. `append()` is a no-op when the entry
 * already exists (idempotent replay), preserving append-only semantics.
 */
export function stripeLedgerJournalTxWriter(
  firestore: FirestoreLike,
  tx: FirebaseFirestore.Transaction,
  input: StripeLedgerJournalEntryInput,
) {
  const ref = stripeLedgerJournalEntryRef(firestore, input);
  let exists: boolean | null = null;
  return {
    read: async () => {
      const snapshot = await tx.get(ref);
      exists = snapshot.exists;
      return exists;
    },
    append: (overrides?: Partial<StripeLedgerJournalEntryInput>) => {
      if (exists === null) {
        throw new Error(
          "stripeLedgerJournalTxWriter.append() called before read(); Firestore requires reads before writes",
        );
      }
      if (exists) {
        return false;
      }
      // Overrides let a transaction fill amounts/entry ids computed after its
      // reads (e.g. disbursement selection); identity fields stay fixed.
      tx.set(
        ref,
        buildStripeLedgerJournalEntry({
          ...input,
          ...overrides,
          entryType: input.entryType,
          discriminator: input.discriminator,
        }),
      );
      return true;
    },
  };
}

/**
 * Standalone append for call sites that are not already inside a transaction:
 * runs its own get-then-create transaction so the entry is written exactly
 * once.
 */
export async function appendStripeLedgerJournalEntry(
  input: StripeLedgerJournalEntryInput,
): Promise<boolean> {
  if (!db) {
    return false;
  }
  const firestore = db;
  return firestore.runTransaction(async (tx) => {
    const writer = stripeLedgerJournalTxWriter(firestore, tx, input);
    await writer.read();
    return writer.append();
  });
}
