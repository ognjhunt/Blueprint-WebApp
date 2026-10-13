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

  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${options.requestId}`;
  const attemptsPart =
    options.attempts !== undefined ? ` after ${options.attempts} attempts` : "";
  const text =
    `:triangular_flag_on_post: *Capture held for privacy review needs a person*` +
    `${attemptsPart} — request \`${options.requestId}\`\n${options.reason}\nOpen: ${adminUrl}`;

  return sendSlackMessage(text, webhookUrl);
}

/**
 * Tell ops a confirmed site needs a screening call before its scene is built.
 *
 * Blueprint funds a scene only for a `qualified` site, so a
 * `needs_conversation` site waits on this call. The request's `ops.next_step`
 * is the record; this is the bell, on the channel ops already reads.
 */
export async function notifySlackScreeningCallNeeded(options: {
  requestId: string;
  openQuestions: readonly string[];
}): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl =
    process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn({ requestId: options.requestId }, "No Slack webhook configured; screening call has no bell");
    return { sent: false };
  }
  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${options.requestId}`;
  const agenda = options.openQuestions.length
    ? options.openQuestions.map((question) => `• ${question}`).join("\n")
    : "• Unanswered gates on the brief";
  const text =
    `:telephone_receiver: *Site needs a screening call before its scene is built* — request \`${options.requestId}\`\n`
    + `${agenda}\nRecord the outcome: ${adminUrl}`;
  return sendSlackMessage(text, webhookUrl);
}

/**
 * A walkthrough arrived and no automated footage review will read it.
 *
 * With BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED off, a person reviews coverage,
 * and the site is told so; this is how that person hears there is one to do.
 */
export async function notifySlackFootageNeedsReview(options: {
  requestId: string;
}): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl =
    process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn({ requestId: options.requestId }, "No Slack webhook configured; footage review has no bell");
    return { sent: false };
  }
  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${options.requestId}`;
  const text =
    `:film_frames: *Site walkthrough received — review coverage by hand* — request \`${options.requestId}\`\n`
    + `Automated footage review is off, so the site has been told a person will review it. ${adminUrl}`;
  return sendSlackMessage(text, webhookUrl);
}

export async function notifySlackRobotTeamAccessApplication(options: {
  name: string;
  company: string;
  email: string;
  robot: string;
  workWanted: string;
  testSite?: string | null;
  fit?: { checks: Array<{ label: string; passed: boolean; detail: string }> } | null;
  autoApproved?: boolean;
}): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl =
    process.env.SLACK_INBOUND_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("No Slack webhook configured; a robot-team application has no bell");
    return { sent: false };
  }
  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/robot-team-access`;
  const fit = options.fit?.checks.map((check) => `${check.passed ? ":white_check_mark:" : ":x:"} ${check.label}: ${check.detail}`) ?? [];
  const text = [
    `:robot_face: *Robot-team early-access application${options.autoApproved ? " (auto-approved: clear fit)" : ""}* — ${options.name}, ${options.company} (${options.email})`,
    `Robot: ${options.robot}`,
    `Wants to test on: ${options.workWanted}`,
    ...(options.testSite ? [`Site lead — would test at: ${options.testSite}`] : []),
    ...fit,
    `${options.autoApproved ? "Book the call" : "Review"}: ${adminUrl}`,
  ].join("\n");
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
