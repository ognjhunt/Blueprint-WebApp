import { Request, Response } from "express";
import { Resend } from "resend";
import { getConfiguredEnvValue } from "../config/env";
import { logger } from "../logger";
import { ingestResendWebhook } from "../utils/growth-ops";
import { reconcileVerifiedNotificationEmail } from "../utils/transactional-notifications";

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
