// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

/**
 * SCALE2-01 append-only journal: every financial state transition writes one
 * immutable stripeLedgerJournal document atomically with the corresponding
 * ledger write; replays never duplicate entries; the reconciliation report
 * detects journal/aggregate drift instead of trusting either source.
 */

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});

const docs = sharedFakeFirestoreState.docs;

function journalKeys(): string[] {
  return Array.from(docs.keys())
    .filter((key) => key.startsWith("stripeLedgerJournal/"))
    .sort();
}

/** A capturer payout sent before payouts were retired (2026-11-11), still in transit. */
function seedInTransitPayout(options: { withAggregate?: boolean } = {}) {
  docs.set("creatorPayouts/cap-1", {
    id: "cap-1",
    capture_id: "cap-1",
    creator_id: "creator-123",
    status: "in_transit",
    approved_amount_cents: 4500,
    disbursement_id: "disb-1",
  });
  docs.set("creatorPayoutDisbursements/disb-1", {
    id: "disb-1",
    creator_id: "creator-123",
    stripe_connect_account_id: "acct_creator_123",
    payout_entry_ids: ["cap-1"],
    requested_amount_cents: 4500,
    disbursed_amount_cents: 4500,
    status: "in_transit",
    stripe_payout_id: "po_test_123",
  });
  docs.set("stripePayouts/po_test_123", { disbursement_id: "disb-1" });
  if (options.withAggregate) {
    docs.set("creatorEarningsAggregates/creator-123", {
      creator_id: "creator-123",
      schema: "blueprint/creator-earnings-aggregate/v1",
      status_totals: { in_transit: { count: 1, approved_amount_cents: 4500 } },
      entry_count: 1,
    });
  }
}

beforeEach(() => {
  docs.clear();
});

describe("stripe ledger journal", () => {
  it("journals a payout settlement once, atomically with the payout writes", async () => {
    seedInTransitPayout();
    const { applyCreatorPayoutWebhook } = await import("../utils/accounting");
    await applyCreatorPayoutWebhook({
      stripePayoutId: "po_test_123",
      eventId: "evt_payout_paid_1",
      eventType: "payout.paid",
      status: "paid",
    });

    const settledKey = "stripeLedgerJournal/disbursement_settled:evt_payout_paid_1";
    expect(docs.get(settledKey)).toMatchObject({
      entry_type: "disbursement_settled",
      amount_cents: 4500,
      creator_id: "creator-123",
      disbursement_id: "disb-1",
      stripe_event_id: "evt_payout_paid_1",
    });
    expect(docs.get("creatorPayouts/cap-1")).toMatchObject({ status: "paid" });

    // Replayed webhook (same event id): ledger writes are idempotent merges
    // and the journal must not grow or mutate.
    const journalBefore = journalKeys();
    const settledBefore = JSON.stringify(docs.get(settledKey));
    await applyCreatorPayoutWebhook({
      stripePayoutId: "po_test_123",
      eventId: "evt_payout_paid_1",
      eventType: "payout.paid",
      status: "paid",
    });
    expect(journalKeys()).toEqual(journalBefore);
    expect(JSON.stringify(docs.get(settledKey))).toBe(settledBefore);
  });

  it("journals per-event refund deltas from Stripe's cumulative amount_refunded", async () => {
    const { markBuyerOrderPaymentFailure } = await import("../utils/accounting");
    docs.set("buyerOrders/order-1", {
      id: "order-1",
      currency: "usd",
      pricing: { total_amount_cents: 25_000 },
      status: "paid",
    });

    // First partial refund: cumulative 10,000 -> delta 10,000.
    await markBuyerOrderPaymentFailure({
      orderId: "order-1",
      eventId: "evt_refund_1",
      eventType: "charge.refunded",
      reason: "partial refund",
      refunded: true,
      refundedAmountCents: 10_000,
      refundCurrency: "usd",
    });
    expect(docs.get("stripeLedgerJournal/order_refunded:evt_refund_1")).toMatchObject({
      entry_type: "order_refunded",
      amount_cents: 10_000,
    });
    expect(docs.get("buyerOrders/order-1")).toMatchObject({ refunded_amount_cents: 10_000 });

    // Second partial refund: cumulative 15,000 -> delta 5,000, not the full
    // order total and not the cumulative again.
    await markBuyerOrderPaymentFailure({
      orderId: "order-1",
      eventId: "evt_refund_2",
      eventType: "charge.refunded",
      reason: "second partial refund",
      refunded: true,
      refundedAmountCents: 15_000,
      refundCurrency: "usd",
    });
    expect(docs.get("stripeLedgerJournal/order_refunded:evt_refund_2")).toMatchObject({
      amount_cents: 5_000,
    });
    expect(docs.get("buyerOrders/order-1")).toMatchObject({ refunded_amount_cents: 15_000 });

    // Refund event without an amount (defensive): full-order fallback.
    docs.set("buyerOrders/order-2", {
      id: "order-2",
      currency: "usd",
      pricing: { total_amount_cents: 8_000 },
      status: "paid",
    });
    await markBuyerOrderPaymentFailure({
      orderId: "order-2",
      eventId: "evt_refund_3",
      eventType: "charge.refunded",
      reason: "full refund",
      refunded: true,
    });
    expect(docs.get("stripeLedgerJournal/order_refunded:evt_refund_3")).toMatchObject({
      amount_cents: 8_000,
    });
  });

  it("detects journal/aggregate drift in the reconciliation report", async () => {
    // Settlement of a stored in-transit payout also maintains the
    // creatorEarningsAggregates doc transactionally.
    seedInTransitPayout({ withAggregate: true });
    const { applyCreatorPayoutWebhook } = await import("../utils/accounting");
    await applyCreatorPayoutWebhook({
      stripePayoutId: "po_test_123",
      eventId: "evt_payout_paid_1",
      eventType: "payout.paid",
      status: "paid",
    });

    const { buildStripeLedgerReconciliationReport } = await import(
      "../utils/stripeLedgerReconciliation"
    );
    const from = "1970-01-01T00:00:00.000Z";
    const to = "2999-01-01T00:00:00.000Z";

    // Consistent state: journal settled total matches the aggregate paid
    // bucket -> no drift.
    const clean = await buildStripeLedgerReconciliationReport({ fromIso: from, toIso: to });
    expect(clean.totals.disbursements_settled_cents).toBe(4500);
    expect(clean.drift_creator_count).toBe(0);
    expect(clean.checked_creator_count).toBe(1);

    // Corrupt the aggregate (simulating a missed transactional update):
    // reconciliation must flag it, not silently trust either source.
    const aggregate = docs.get("creatorEarningsAggregates/creator-123")!;
    const statusTotals = aggregate.status_totals as Record<
      string,
      { count: number; approved_amount_cents: number }
    >;
    statusTotals.paid = { count: 1, approved_amount_cents: 999 };
    docs.set("creatorEarningsAggregates/creator-123", aggregate);

    const drifted = await buildStripeLedgerReconciliationReport({ fromIso: from, toIso: to });
    expect(drifted.drift_creator_count).toBe(1);
    expect(drifted.creator_drift[0]).toMatchObject({
      creator_id: "creator-123",
      journal_settled_cents: 4500,
      aggregate_paid_cents: 999,
      drift_cents: 4500 - 999,
    });
  });
});
