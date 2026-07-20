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

const PIPELINE_RECOMMENDATION = {
  status: "baseline",
  base_payout_cents: 4500,
  recommended_payout_cents: 4500,
  payout_funding_policy: {
    mode: "buyer_revenue_linked",
    buyer_order_id: "order-paid-1",
    realized_buyer_revenue_cents: 10000,
  },
  reasons: [],
};

async function approvePayoutFixture() {
  const { upsertCreatorPayoutFromPipeline } = await import("../utils/accounting");
  docs.set("capture_submissions/cap-1", {
    creator_id: "creator-123",
    status: "submitted",
    payout_cents: 0,
  });
  return upsertCreatorPayoutFromPipeline({
    captureId: "cap-1",
    sceneId: "scene-1",
    captureJobId: "job-1",
    buyerRequestId: "req-1",
    siteSubmissionId: "site-1",
    qualificationState: "qualified_ready",
    opportunityState: "handoff_ready",
    recommendation: PIPELINE_RECOMMENDATION,
    recommendationUri: "gs://bucket/payout.json",
    stripeConnectAccountId: "acct_creator_123",
  });
}

beforeEach(() => {
  docs.clear();
});

describe("stripe ledger journal", () => {
  it("journals payout approval exactly once across pipeline re-upserts", async () => {
    const payout = await approvePayoutFixture();
    expect(payout?.status).toBe("approved");

    expect(journalKeys()).toEqual(["stripeLedgerJournal/payout_approved:cap-1"]);
    expect(docs.get("stripeLedgerJournal/payout_approved:cap-1")).toMatchObject({
      entry_type: "payout_approved",
      amount_cents: 4500,
      creator_id: "creator-123",
      direction: "creator_payout_out",
    });

    // Re-qualification churn re-upserts the payout; the deterministic entry
    // id + in-transaction existence check keep the journal append-only.
    const before = JSON.stringify(docs.get("stripeLedgerJournal/payout_approved:cap-1"));
    const { upsertCreatorPayoutFromPipeline } = await import("../utils/accounting");
    await upsertCreatorPayoutFromPipeline({
      captureId: "cap-1",
      sceneId: "scene-1",
      captureJobId: "job-1",
      buyerRequestId: "req-1",
      siteSubmissionId: "site-1",
      qualificationState: "qualified_ready",
      opportunityState: "handoff_ready",
      recommendation: PIPELINE_RECOMMENDATION,
      recommendationUri: "gs://bucket/payout.json",
      stripeConnectAccountId: "acct_creator_123",
    });
    expect(journalKeys()).toEqual(["stripeLedgerJournal/payout_approved:cap-1"]);
    expect(JSON.stringify(docs.get("stripeLedgerJournal/payout_approved:cap-1"))).toBe(
      before,
    );
  });

  it("journals disbursement initiation and settlement atomically with the payout writes", async () => {
    await approvePayoutFixture();
    const {
      applyCreatorPayoutWebhook,
      beginCreatorPayoutDisbursement,
      finalizeCreatorPayoutDisbursement,
    } = await import("../utils/accounting");

    const disbursement = await beginCreatorPayoutDisbursement({
      creatorId: "creator-123",
      stripeConnectAccountId: "acct_creator_123",
    });
    expect(disbursement).not.toBeNull();
    const disbursementId = disbursement!.disbursement.id;

    const initiationKey = `stripeLedgerJournal/disbursement_initiated:${disbursementId}`;
    expect(docs.get(initiationKey)).toMatchObject({
      entry_type: "disbursement_initiated",
      amount_cents: 4500,
      creator_id: "creator-123",
      disbursement_id: disbursementId,
      payout_entry_ids: ["cap-1"],
    });

    await finalizeCreatorPayoutDisbursement({
      disbursementId,
      stripePayoutId: "po_test_123",
    });
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
      disbursement_id: disbursementId,
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
    // Full lifecycle: approve -> disburse -> settle, which also maintains the
    // creatorEarningsAggregates doc transactionally. Materialize the
    // aggregate first so the incremental maintenance path is active.
    const { readCreatorEarningsAggregate } = await import("../utils/accounting");
    await approvePayoutFixture();
    await readCreatorEarningsAggregate("creator-123");
    const {
      applyCreatorPayoutWebhook,
      beginCreatorPayoutDisbursement,
      finalizeCreatorPayoutDisbursement,
    } = await import("../utils/accounting");
    const disbursement = await beginCreatorPayoutDisbursement({
      creatorId: "creator-123",
      stripeConnectAccountId: "acct_creator_123",
    });
    await finalizeCreatorPayoutDisbursement({
      disbursementId: disbursement!.disbursement.id,
      stripePayoutId: "po_test_123",
    });
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
    expect(clean.totals.payouts_approved_cents).toBe(4500);
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
