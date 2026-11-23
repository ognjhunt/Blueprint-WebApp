import { Request, Response } from "express";
import { Resend } from "resend";
import { getConfiguredEnvValue } from "../config/env";
import { logger } from "../logger";
import { recordEmailSuppression } from "../utils/email-suppression";

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

/**
 * Only suppressions are kept: an unsubscribe, a complaint, a provider suppression or a permanent bounce stops later
 * email to that address. Nothing else of the event (recipient, subject, payload) is stored. A replayed delivery
 * records the same suppression again, which is an upsert.
 */
async function ingestResendWebhook(payload: unknown) {
  const events = Array.isArray(payload) ? payload : [payload];
  let count = 0;

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
    const bounce = event.bounce && typeof event.bounce === "object"
      ? event.bounce as Record<string, unknown>
      : {};
    const shouldSuppress = eventType === "unsubscribed"
      || eventType === "complained"
      || eventType === "suppressed"
      || (eventType === "bounced" && normalizeString(bounce.type).toLowerCase() === "permanent");
    if (recipient && shouldSuppress) {
      const suppression = await recordEmailSuppression({
        email: recipient,
        scope: ["lifecycle", "growth_campaign"],
        reason: eventType === "complained" ? "complaint" : eventType,
        source: "resend:webhook",
        campaignId: localCampaignId,
      });
      // Not saved: answer 500 so Resend delivers the event again.
      if (!suppression.persisted) throw new Error("Email suppression not saved");
    }
    count += 1;
  }

  return { count };
}

/**
 * Resend delivery events, mounted at POST /api/growth/webhooks/resend (the URL
 * registered with Resend). It outlived the growth studio it was written for
 * because it carries one live duty: unsubscribes, complaints and permanent
 * bounces become email suppressions. It stores nothing else of an event.
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
    await ingestResendWebhook(event);
    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest Resend webhook");
    return res.status(500).json({ error: "Failed to ingest Resend webhook" });
  }
}
