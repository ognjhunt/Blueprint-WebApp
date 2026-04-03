import type { Request, Response } from "express";
import type Stripe from "stripe";

import {
  applyCreatorPayoutWebhook,
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
  fetchBuyerOrder,
  findBuyerOrderByCheckoutSessionId,
  findBuyerOrderByPaymentIntentId,
  markBuyerOrderPaidFromCheckout,
  markBuyerOrderPaymentFailure,
} from "../utils/accounting";
import { createOnboardingSequence } from "../utils/buyer-onboarding";
import { initRenewalTracking } from "../utils/growth-ops";
import { stripeClient } from "../constants/stripe";

const stripeWebhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

function requireStripeWebhookContext(req: Request, res: Response) {
  if (!stripeClient) {
    res.status(503).json({ error: "Stripe is disabled." });
    return null;
  }

  if (!stripeWebhookSecret) {
    res.status(503).json({ error: "Stripe webhook secret is not configured." });
    return null;
  }

  const signature = String(req.header("Stripe-Signature") || "").trim();
  if (!signature) {
    res.status(400).json({ error: "Missing Stripe-Signature header." });
    return null;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: "Stripe webhook payload must be raw bytes." });
    return null;
  }

  return {
    stripe: stripeClient,
    signature,
  };
}

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
  });
  return order.id;
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
    return applyCreatorPayoutWebhook({
      stripePayoutId: payout.id,
      eventId: event.id,
      eventType: event.type,
      status: "failed",
      failureReason: payout.failure_message || "Stripe payout failed.",
    });
  }

  if (event.type === "payout.canceled") {
    return applyCreatorPayoutWebhook({
      stripePayoutId: payout.id,
      eventId: event.id,
      eventType: event.type,
      status: "canceled",
      failureReason: "Stripe payout was canceled.",
    });
  }

  return null;
}

/**
 * Relay ops-relevant Stripe events to the Paperclip automation plugin.
 * Fire-and-forget: failures here must not block the primary webhook handler.
 */
const PAPERCLIP_OPS_STRIPE_RELAY_URL = (
  process.env.PAPERCLIP_OPS_STRIPE_WEBHOOK_URL || ""
).trim();

const OPS_RELEVANT_EVENTS = new Set([
  "payout.failed",
  "payout.canceled",
  "charge.dispute.created",
  "charge.refunded",
  "account.updated",
]);

async function relayToPaperclipOps(event: Stripe.Event) {
  if (!PAPERCLIP_OPS_STRIPE_RELAY_URL || !OPS_RELEVANT_EVENTS.has(event.type)) {
    return;
  }
  try {
    await fetch(PAPERCLIP_OPS_STRIPE_RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: event.type,
        id: event.id,
        data: { object: event.data.object },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort relay — don't break the primary handler
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const context = requireStripeWebhookContext(req, res);
  if (!context) {
    return;
  }

  let event: Stripe.Event;
  try {
    event = context.stripe.webhooks.constructEvent(
      req.body,
      context.signature,
      stripeWebhookSecret,
    );
  } catch (error) {
    return res.status(400).json({
      error: (error as Error).message || "Stripe signature verification failed.",
    });
  }

  const eventState = await beginStripeWebhookEvent(event.id, {
    event_type: event.type,
    livemode: event.livemode,
    account: event.account || null,
  });
  if (eventState === "duplicate") {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Fire-and-forget relay to Paperclip ops
  relayToPaperclipOps(event);

  try {
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

    await completeStripeWebhookEvent({
      eventId: event.id,
      orderId,
      disbursementId,
      eventType: event.type,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    await failStripeWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      reason: (error as Error).message || "Webhook processing failed.",
    });
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
