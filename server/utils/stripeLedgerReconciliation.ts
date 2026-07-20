/**
 * Stripe ledger reconciliation (SCALE2-01).
 *
 * Sums the append-only stripeLedgerJournal for a period and cross-checks
 * creator payout totals against creatorEarningsAggregates (round 1). Neither
 * source is trusted blindly: drift between them is *flagged*, never
 * auto-corrected — a mismatch means either a journal gap (transition written
 * before the journal existed / outside a journaled path) or an aggregate bug,
 * and both need a human eye.
 *
 * Exposed as a pure report builder + a CLI (scripts/stripe-ledger-reconcile.ts)
 * so ops can run it on demand; it deliberately has no write path.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { CreatorEarningsAggregateRecord } from "./accounting";
import {
  STRIPE_LEDGER_JOURNAL_COLLECTION,
  type StripeLedgerJournalEntry,
} from "./stripeLedgerJournal";

const CREATOR_EARNINGS_AGGREGATE_COLLECTION = "creatorEarningsAggregates";

export type StripeLedgerPeriodTotals = {
  buyer_revenue_cents: number;
  refunded_cents: number;
  payouts_approved_cents: number;
  disbursements_initiated_cents: number;
  disbursements_settled_cents: number;
  disbursements_failed_cents: number;
  disputes_opened: number;
  disputes_resolved: number;
  entry_count: number;
};

export type CreatorSettlementDrift = {
  creator_id: string;
  journal_settled_cents: number;
  aggregate_paid_cents: number;
  drift_cents: number;
};

export type StripeLedgerReconciliationReport = {
  schema: "blueprint/stripe-ledger-reconciliation/v1";
  period: { from_iso: string; to_iso: string };
  totals: StripeLedgerPeriodTotals;
  creator_drift: CreatorSettlementDrift[];
  drift_creator_count: number;
  checked_creator_count: number;
  claim_boundary: string;
  generated_at: string;
};

function emptyTotals(): StripeLedgerPeriodTotals {
  return {
    buyer_revenue_cents: 0,
    refunded_cents: 0,
    payouts_approved_cents: 0,
    disbursements_initiated_cents: 0,
    disbursements_settled_cents: 0,
    disbursements_failed_cents: 0,
    disputes_opened: 0,
    disputes_resolved: 0,
    entry_count: 0,
  };
}

function applyEntryToTotals(totals: StripeLedgerPeriodTotals, entry: StripeLedgerJournalEntry) {
  const amount = typeof entry.amount_cents === "number" ? entry.amount_cents : 0;
  totals.entry_count += 1;
  switch (entry.entry_type) {
    case "checkout_completed":
      totals.buyer_revenue_cents += amount;
      break;
    case "order_refunded":
      totals.refunded_cents += amount;
      break;
    case "payout_approved":
      totals.payouts_approved_cents += amount;
      break;
    case "disbursement_initiated":
      totals.disbursements_initiated_cents += amount;
      break;
    case "disbursement_settled":
      totals.disbursements_settled_cents += amount;
      break;
    case "disbursement_failed":
      totals.disbursements_failed_cents += amount;
      break;
    case "dispute_opened":
      totals.disputes_opened += 1;
      break;
    case "dispute_resolved":
      totals.disputes_resolved += 1;
      break;
    default:
      break;
  }
}

/**
 * Cross-check: lifetime settled cents per creator computed from the journal
 * vs the paid bucket of the transactionally-maintained aggregate. Only
 * creators that appear in the period's journal are checked (bounded work).
 */
export async function buildStripeLedgerReconciliationReport(params: {
  fromIso: string;
  toIso: string;
}): Promise<StripeLedgerReconciliationReport> {
  if (!db) {
    throw new Error("Database not available for reconciliation.");
  }
  const firestore = db;

  const periodSnapshot = await firestore
    .collection(STRIPE_LEDGER_JOURNAL_COLLECTION)
    .where("recorded_at", ">=", params.fromIso)
    .where("recorded_at", "<=", params.toIso)
    .get();

  const totals = emptyTotals();
  const creatorsInPeriod = new Set<string>();
  for (const doc of periodSnapshot.docs) {
    const entry = doc.data() as StripeLedgerJournalEntry;
    applyEntryToTotals(totals, entry);
    if (entry.creator_id) {
      creatorsInPeriod.add(entry.creator_id);
    }
  }

  const creatorDrift: CreatorSettlementDrift[] = [];
  for (const creatorId of creatorsInPeriod) {
    // Lifetime journal truth for this creator (bounded per-creator query).
    const settledSnapshot = await firestore
      .collection(STRIPE_LEDGER_JOURNAL_COLLECTION)
      .where("creator_id", "==", creatorId)
      .where("entry_type", "==", "disbursement_settled")
      .get();
    const journalSettledCents = settledSnapshot.docs.reduce((sum, doc) => {
      const entry = doc.data() as StripeLedgerJournalEntry;
      return sum + (typeof entry.amount_cents === "number" ? entry.amount_cents : 0);
    }, 0);

    const aggregateSnapshot = await firestore
      .collection(CREATOR_EARNINGS_AGGREGATE_COLLECTION)
      .doc(creatorId)
      .get();
    const aggregate = aggregateSnapshot.exists
      ? (aggregateSnapshot.data() as CreatorEarningsAggregateRecord)
      : null;
    const aggregatePaidCents =
      aggregate?.status_totals?.paid?.approved_amount_cents ?? 0;

    if (journalSettledCents !== aggregatePaidCents) {
      creatorDrift.push({
        creator_id: creatorId,
        journal_settled_cents: journalSettledCents,
        aggregate_paid_cents: aggregatePaidCents,
        drift_cents: journalSettledCents - aggregatePaidCents,
      });
    }
  }

  return {
    schema: "blueprint/stripe-ledger-reconciliation/v1",
    period: { from_iso: params.fromIso, to_iso: params.toIso },
    totals,
    creator_drift: creatorDrift.sort(
      (a, b) => Math.abs(b.drift_cents) - Math.abs(a.drift_cents),
    ),
    drift_creator_count: creatorDrift.length,
    checked_creator_count: creatorsInPeriod.size,
    claim_boundary:
      "Drift is flagged, not auto-corrected. The journal only covers transitions since it shipped (scaling round 2); creators with pre-journal paid history will show negative drift until a one-time backfill entry is recorded — investigate before trusting either side.",
    generated_at: new Date().toISOString(),
  };
}
