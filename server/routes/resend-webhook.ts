import { Request, Response } from "express";
import { Resend } from "resend";
import { getConfiguredEnvValue } from "../config/env";
import { logger } from "../logger";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { recordEmailSuppression } from "../utils/email-suppression";
import { reconcileVerifiedNotificationEmail } from "../utils/transactional-notifications";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCampaignEventType(value: unknown) {
  const raw = normalizeString(value).toLowerCase().replace(/^email\./, "").replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";

  if (["sent", "send", "accepted", "queued", "processed"].includes(raw)) return "sent";
  if (["delivered", "delivery"].includes(raw)) return "delivered";
  if (["open", "opened"].includes(raw)) return "opened";
  if (["click", "clicked"].includes(raw)) return "clicked";
  if (["reply", "replied"].includes(raw)) return "replied";
  if (["bounce", "bounced", "hard_bounce", "soft_bounce"].includes(raw)) return "bounced";
  if (["complaint", "spam_report", "spam_complaint"].includes(raw)) return "complained";
  if (["unsubscribe", "unsubscribed"].includes(raw)) return "unsubscribed";
  return raw;
}

async function ingestResendWebhook(payload: unknown, webhookId: string) {
  if (!db) {
    throw new Error("Database not available");
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const results: Array<Record<string, unknown>> = [];

  for (const item of events) {
    const envelope = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const event = envelope.data && typeof envelope.data === "object"
      ? envelope.data as Record<string, unknown>
      : {};
    const tags = event.tags && typeof event.tags === "object"
      ? event.tags as Record<string, unknown>
      : {};
    const localCampaignId =
      normalizeString(tags.bp_campaign_id) ||
      normalizeString(tags.campaign_id) ||
      null;
    const eventType = normalizeCampaignEventType(envelope.type);
    const recipient = Array.isArray(event.to) ? normalizeString(event.to[0]) : "";
    const receivedAtIso = normalizeString(envelope.created_at) || new Date().toISOString();
    const eventRef = db.collection("growth_campaign_events").doc(webhookId);
    if ((await eventRef.get()).exists) continue;

    await eventRef.create({
      campaign_id: localCampaignId || "unknown",
      local_campaign_id: localCampaignId,
      resend_email_id: normalizeString(event.email_id),
      event_type: eventType,
      recipient,
      payload: envelope,
      received_at_iso: receivedAtIso,
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      source: "resend",
    });

    if (localCampaignId) {
      await db.collection("growthCampaigns").doc(localCampaignId).set(
        {
          event_counts: {
            [eventType]: admin.firestore.FieldValue.increment(1),
          },
          response_tracking: {
            last_event_type: eventType,
            last_event_at: receivedAtIso,
            last_recipient: recipient,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const bounce = event.bounce && typeof event.bounce === "object"
      ? event.bounce as Record<string, unknown>
      : {};
    const shouldSuppress = eventType === "unsubscribed"
      || eventType === "complained"
      || eventType === "suppressed"
      || (eventType === "bounced" && normalizeString(bounce.type).toLowerCase() === "permanent");
    if (recipient && shouldSuppress) {
      await recordEmailSuppression({
        email: recipient,
        scope: ["lifecycle", "growth_campaign"],
        reason: eventType === "complained" ? "complaint" : eventType,
        source: "resend:webhook",
        campaignId: localCampaignId,
      });
    }

    results.push({
      localCampaignId,
      eventType,
      recipient,
    });
  }

  return {
    count: results.length,
    results,
  };
}

/**
 * Resend delivery events, mounted at POST /api/growth/webhooks/resend (the URL
 * registered with Resend). It outlived the growth studio it was written for
 * because it carries two live duties: unsubscribes, complaints and permanent
 * bounces become email suppressions, and delivery receipts settle the status
 * of transactional notifications.
 */
export async function resendWebhookHandler(req: Request & { rawBody?: string }, res: Response) {
  const configuredSecret = getConfiguredEnvValue("RESEND_WEBHOOK_SECRET");
  if (!configuredSecret) {
    return res.status(503).json({ error: "Webhook secret not configured" });
  }
  if (!req.rawBody) {
    return res.status(400).json({ error: "Raw webhook body unavailable" });
  }
  const webhookId = req.header("svix-id");
  if (!webhookId) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let event;
  try {
    const resend = new Resend(getConfiguredEnvValue("RESEND_API_KEY") || "re_webhook_verification");
    event = resend.webhooks.verify({
      payload: req.rawBody,
      headers: {
        id: webhookId,
        timestamp: req.header("svix-timestamp") || "",
        signature: req.header("svix-signature") || "",
      },
      webhookSecret: configuredSecret,
    });
  } catch {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  try {
    await ingestResendWebhook(event, webhookId);
    await reconcileVerifiedNotificationEmail(event, webhookId);
    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest Resend webhook");
    return res.status(500).json({ error: "Failed to ingest Resend webhook" });
  }
}
