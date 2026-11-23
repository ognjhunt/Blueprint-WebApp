import { createHash } from "node:crypto";
import { logger } from "../logger";
// New-intake notices are link-only and live in ./intakeOpsNotice.ts. The old
// block-kit notifier that copied name, email, company, site and task text
// into Slack was removed: contact details stay behind admin auth.

/**
 * Send a simple Slack message to a webhook
 */
export async function sendSlackMessage(
  message: string,
  webhookUrl?: string
): Promise<{ sent: boolean; error?: unknown }> {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;

  if (!url) {
    // In production this means an ops alert reached nobody.
    logger[process.env.NODE_ENV === "production" ? "error" : "warn"](
      { event: "slack_webhook_unconfigured" },
      "Slack webhook URL not configured; skipping message",
    );
    return { sent: false, error: "slack_webhook_unconfigured" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "Failed to send Slack message"
      );
      return { sent: false, error: errorText };
    }

    return { sent: true };
  } catch (error) {
    logger.error({ error }, "Error sending Slack message");
    return { sent: false, error };
  }
}

/**
 * Tell the inbound channel a capture is stuck on privacy and needs a person.
 *
 * The escalation flag on the request is the record; this is the bell. The flag
 * alone had zero consumers, which meant footage could sit in the bucket — no
 * marker, no extraction, invisible outside server logs — while the code
 * promised that "a person" would look at it. Same webhook the lead pipeline
 * uses, because that is the channel ops actually reads.
 */
export async function notifySlackCapturePrivacyEscalation(options: {
  requestId: string;
  reason: string;
  attempts?: number;
}): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl =
    process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn(
      { requestId: options.requestId },
      "No Slack webhook configured; privacy escalation has no bell"
    );
    return { sent: false };
  }

  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/jobs?job=${encodeURIComponent(options.requestId)}`;
  const attemptsPart =
    options.attempts !== undefined ? ` after ${options.attempts} attempts` : "";
  const text =
    `:triangular_flag_on_post: *Capture held for privacy review needs a person*` +
    `${attemptsPart} — request \`${options.requestId}\`\n${options.reason}\nOpen: ${adminUrl}`;

  return sendSlackMessage(text, webhookUrl);
}

/**
 * The bell for a new company application, and one link to its card on the approvals page. With the automatic check's
 * result (`companyCheck.ts`): "approved automatically", or "needs you" with the reasons in words. No applicant name or
 * email goes to Slack; the page is behind the admin role and approving there is one press.
 */
export async function notifySlackRobotTeamAccessApplication(options: {
  email: string;
  fit?: unknown;
  autoApproved?: boolean;
  check?: { outcome: "approved" | "needs_owner"; reasons: string[] };
}): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl =
    process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("No Slack webhook configured; a robot-team application has no bell");
    return { sent: false };
  }
  // The same id as accessRecordId(): the application's record id, not the email.
  const id = createHash("sha256").update(options.email.trim().toLowerCase()).digest("hex");
  const pageUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/robot-team-access?application=${id}`;
  const { companyCheckReasonWords } = await import("../../client/src/lib/companyCheck");
  const why = options.check?.reasons.length ? ` ${options.check.reasons.map(companyCheckReasonWords).join(" ")}` : "";
  const text = options.check?.outcome === "approved"
    ? `:white_check_mark: *A deployment company was approved automatically* (work email at its website's domain, and the website shows it deploys robots). See it: ${pageUrl}`
    : options.check
      ? `:robot_face: *A deployment company applied and needs you.*${why} Approve or not yet: ${pageUrl}`
      : `:robot_face: *A deployment company applied.* Approve or not yet: ${pageUrl}`;
  return sendSlackMessage(text, webhookUrl);
}

export async function sendSlackDirectMessage(
  message: string,
  options?: {
    userId?: string | null;
    targetName?: string | null;
    botToken?: string | null;
  },
): Promise<{
  sent: boolean;
  channel?: string | null;
  ts?: string | null;
  targetName: string;
  error?: unknown;
}> {
  const targetName = options?.targetName?.trim() || "Nijel Hunt";
  const botToken = options?.botToken?.trim() || process.env.SLACK_BOT_TOKEN?.trim() || "";
  const userId =
    options?.userId?.trim()
    || process.env.BLUEPRINT_HUMAN_BLOCKER_SLACK_USER_ID?.trim()
    || process.env.BLUEPRINT_FOUNDER_SLACK_USER_ID?.trim()
    || "";

  if (!botToken || !userId) {
    logger.warn(
      { targetName, hasBotToken: Boolean(botToken), hasUserId: Boolean(userId) },
      "Slack bot token or founder user id not configured; skipping direct message",
    );
    return {
      sent: false,
      targetName,
      error:
        "Slack DM requires SLACK_BOT_TOKEN and BLUEPRINT_HUMAN_BLOCKER_SLACK_USER_ID or BLUEPRINT_FOUNDER_SLACK_USER_ID.",
    };
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: userId,
        text: message,
      }),
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || payload?.ok !== true) {
      const error = payload?.error || response.statusText;
      logger.error(
        { status: response.status, error, targetName },
        "Failed to send Slack direct message",
      );
      return { sent: false, targetName, error };
    }

    return {
      sent: true,
      targetName,
      channel: typeof payload.channel === "string" ? payload.channel : null,
      ts: typeof payload.ts === "string" ? payload.ts : null,
    };
  } catch (error) {
    logger.error({ error, targetName }, "Error sending Slack direct message");
    return { sent: false, targetName, error };
  }
}
