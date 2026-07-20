/**
 * Stripe webhook receipt (SCALE2-01).
 *
 * The synchronous job of this handler is deliberately tiny: verify the
 * signature, dedupe via stripeWebhookEvents (both unchanged, load-bearing
 * round-1 correctness guarantees), persist the event to the durable
 * stripeWebhookQueue, and return 200. Processing runs on the worker service
 * (server/utils/stripeWebhookQueue.ts -> stripeEventProcessor.ts), so payout
 * batches and dispute waves never compete with live buyer/creator HTTP
 * traffic for web event-loop time.
 *
 * BLUEPRINT_STRIPE_WEBHOOK_INLINE=1 restores the round-1 synchronous path
 * (verify -> dedupe -> process in-request) for single-service deploys.
 */
import type { Request, Response } from "express";
import type Stripe from "stripe";

import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "../utils/accounting";
import { processStripeWebhookEvent } from "../utils/stripeEventProcessor";
import {
  enqueueStripeWebhookEvent,
  stripeWebhookInlineMode,
} from "../utils/stripeWebhookQueue";
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
  "charge.dispute.closed",
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

  if (!stripeWebhookInlineMode()) {
    // Durable receipt: enqueue and acknowledge. The queue doc id is the
    // Stripe event id, so a "retry" delivery whose queue doc already exists
    // is acknowledged without a second enqueue.
    try {
      await enqueueStripeWebhookEvent(event);
      return res.status(200).json({ received: true, queued: true });
    } catch (error) {
      // If the event can't be persisted we must NOT ack: report failure so
      // Stripe redelivers, and roll the dedupe record back to retryable.
      await failStripeWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        reason: `Webhook enqueue failed: ${(error as Error).message}`,
      });
      return res.status(500).json({ error: "Webhook enqueue failed." });
    }
  }

  try {
    const { orderId, disbursementId } = await processStripeWebhookEvent(event);
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
