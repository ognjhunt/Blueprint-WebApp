/**
 * Stripe event processing, decoupled from HTTP receipt (SCALE2-01).
 *
 * The webhook route (server/routes/stripe-webhooks.ts) verifies the
 * signature, dedupes via stripeWebhookEvents, enqueues, and returns 200; the
 * queue processor (server/utils/stripeWebhookQueue.ts) calls
 * processStripeWebhookEvent from the worker service. The handlers below are
 * the round-1 logic moved verbatim from the route file — processing semantics
 * (idempotent merges, dispute holds, payout settlement, ops failure signals)
 * are unchanged.
 */
import type Stripe from "stripe";

import {
  applyCreatorPayoutWebhook,
  fetchBuyerOrder,
  findBuyerOrderByCheckoutSessionId,
  findBuyerOrderByPaymentIntentId,
  markBuyerOrderPaidFromCheckout,
  markBuyerOrderDisputedFromCharge,
  markBuyerOrderPaymentFailure,
} from "./accounting";
import { createOnboardingSequence } from "./buyer-onboarding";
import { initRenewalTracking } from "./growth-ops";
import { recordBetaOpsFailureSignal } from "./ops-alerts";

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const checkoutSessionId = session.id;
  const order =
    (await findBuyerOrderByCheckoutSessionId(checkoutSessionId)) ||
    (session.client_reference_id
      ? await fetchBuyerOrder(session.client_reference_id)
      : null);
  if (!order) {
    return null;
  }

  if (session.payment_status === "paid") {
    const paidOrder = await markBuyerOrderPaidFromCheckout({
      orderId: order.id,
      checkoutSessionId,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      customerId: typeof session.customer === "string" ? session.customer : null,
      livemode: session.livemode,
      eventId: event.id,
      eventType: event.type,
    });

    if (paidOrder?.id && paidOrder.buyer_email) {
      void createOnboardingSequence({
        orderId: paidOrder.id,
        buyerEmail: paidOrder.buyer_email,
        skuName: paidOrder.item.title || paidOrder.item.sku,
        licenseTier: paidOrder.item.license_tier || "standard",
      });

      if (paidOrder.entitlement_id && paidOrder.paid_at) {
        void initRenewalTracking({
          entitlementId: paidOrder.entitlement_id,
          orderId: paidOrder.id,
          buyerEmail: paidOrder.buyer_email,
          skuName: paidOrder.item.title || paidOrder.item.sku,
          licenseTier: paidOrder.item.license_tier || "standard",
          grantedAt: paidOrder.paid_at,
        });
      }
    }

    return paidOrder;
  }

  return null;
}

async function handleCheckoutSessionAsyncFailure(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const order = await findBuyerOrderByCheckoutSessionId(session.id);
  if (!order) {
    return null;
  }

  await markBuyerOrderPaymentFailure({
    orderId: order.id,
    eventId: event.id,
    eventType: event.type,
    reason: "Stripe reported an asynchronous payment failure.",
  });
  return order.id;
}

async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const order = await findBuyerOrderByCheckoutSessionId(session.id);
  if (!order) {
    return null;
  }

  await markBuyerOrderPaymentFailure({
    orderId: order.id,
    eventId: event.id,
    eventType: event.type,
    reason: "Checkout session expired before payment completed.",
    expired: true,
  });
  return order.id;
}

async function handleChargeRefunded(charge: Stripe.Charge, event: Stripe.Event) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  const order = paymentIntentId
    ? await findBuyerOrderByPaymentIntentId(paymentIntentId)
    : null;
  if (!order) {
    return null;
  }

  await markBuyerOrderPaymentFailure({
    orderId: order.id,
    eventId: event.id,
    eventType: event.type,
    reason: "Stripe reported a refund for the marketplace order.",
    refunded: true,
    refundedAmountCents:
      typeof charge.amount_refunded === "number" ? charge.amount_refunded : null,
    refundCurrency: charge.currency || null,
  });
  return order.id;
}

async function handleChargeDispute(dispute: Stripe.Dispute, event: Stripe.Event) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id || null;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id || null;
  const result = await markBuyerOrderDisputedFromCharge({
    paymentIntentId,
    chargeId,
    disputeId: dispute.id,
    disputeStatus: dispute.status || null,
    disputeReason: dispute.reason || null,
    amountCents: typeof dispute.amount === "number" ? dispute.amount : null,
    currency: dispute.currency || null,
    evidenceDueBy:
      typeof dispute.evidence_details?.due_by === "number"
        ? dispute.evidence_details.due_by
        : null,
    eventId: event.id,
    eventType: event.type,
  });
  await recordBetaOpsFailureSignal({
    kind: "payment_dispute",
    scopeId: result.orderId || dispute.id,
    severity: "critical",
    summary: `Stripe reported ${event.type} for buyer payment ${paymentIntentId || "unknown"}.`,
    details: {
      order_id: result.orderId,
      dispute_id: dispute.id,
      dispute_status: dispute.status || null,
      dispute_reason: dispute.reason || null,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      held_payout_ids: result.heldPayoutIds,
      unresolved_payout_ids: result.unresolvedPayoutIds,
    },
  });
  return result.orderId;
}

async function handlePayoutEvent(
  payout: Stripe.Payout,
  event: Stripe.Event,
): Promise<string | null> {
  if (event.type === "payout.paid") {
    return applyCreatorPayoutWebhook({
      stripePayoutId: payout.id,
      eventId: event.id,
      eventType: event.type,
      status: "paid",
    });
  }

  if (event.type === "payout.failed") {
    const disbursementId = await applyCreatorPayoutWebhook({
      stripePayoutId: payout.id,
      eventId: event.id,
      eventType: event.type,
      status: "failed",
      failureReason: payout.failure_message || "Stripe payout failed.",
    });
    await recordBetaOpsFailureSignal({
      kind: "payout_exception",
      scopeId: disbursementId || payout.id,
      severity: "critical",
      summary: `Stripe payout failed for ${payout.id}.`,
      details: {
        stripe_payout_id: payout.id,
        disbursement_id: disbursementId,
        failure_message: payout.failure_message || null,
      },
    });
    return disbursementId;
  }

  if (event.type === "payout.canceled") {
    const disbursementId = await applyCreatorPayoutWebhook({
      stripePayoutId: payout.id,
      eventId: event.id,
      eventType: event.type,
      status: "canceled",
      failureReason: "Stripe payout was canceled.",
    });
    await recordBetaOpsFailureSignal({
      kind: "payout_exception",
      scopeId: disbursementId || payout.id,
      severity: "critical",
      summary: `Stripe payout was canceled for ${payout.id}.`,
      details: {
        stripe_payout_id: payout.id,
        disbursement_id: disbursementId,
      },
    });
    return disbursementId;
  }

  return null;
}

export type StripeWebhookProcessingResult = {
  orderId: string | null;
  disbursementId: string | null;
};

export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookProcessingResult> {
  let orderId: string | null = null;
  let disbursementId: string | null = null;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const order = await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        event,
      );
      orderId = order?.id || null;
      break;
    }
    case "checkout.session.async_payment_failed": {
      orderId = await handleCheckoutSessionAsyncFailure(
        event.data.object as Stripe.Checkout.Session,
        event,
      );
      break;
    }
    case "checkout.session.expired": {
      orderId = await handleCheckoutSessionExpired(
        event.data.object as Stripe.Checkout.Session,
        event,
      );
      break;
    }
    case "charge.refunded": {
      orderId = await handleChargeRefunded(
        event.data.object as Stripe.Charge,
        event,
      );
      break;
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      orderId = await handleChargeDispute(
        event.data.object as Stripe.Dispute,
        event,
      );
      break;
    }
    case "payout.paid":
    case "payout.failed":
    case "payout.canceled": {
      disbursementId = await handlePayoutEvent(
        event.data.object as Stripe.Payout,
        event,
      );
      break;
    }
    default:
      break;
  }

  return { orderId, disbursementId };
}
