import { logger } from "../logger";
import {
  HELP_WITH_LABELS,
  REQUESTED_LANE_LABELS,
} from "../../client/src/lib/requestTaxonomy";
import type {
  BudgetBucket,
  HelpWithOption,
  ProofPathPreference,
  RequestPriority,
  RequestedLane,
  BuyerType,
} from "../types/inbound-request";

interface SlackNotifyOptions {
  requestId: string;
  siteSubmissionId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  roleTitle: string;
  buyerType: BuyerType;
  siteName: string;
  siteLocation: string;
  taskStatement: string;
  targetSiteType?: string | null;
  proofPathPreference?: ProofPathPreference | null;
  existingStackReviewWorkflow?: string | null;
  humanGateTopics?: string | null;
  budgetBucket: BudgetBucket;
  requestedLanes: RequestedLane[];
  helpWith: HelpWithOption[];
  details?: string | null;
  priority: RequestPriority;
  sourcePageUrl: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
    action_id?: string;
  }>;
}

const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  site_operator: "Site Operator",
  robot_team: "Robot Team",
};

const PRIORITY_EMOJI: Record<RequestPriority, string> = {
  high: ":fire:",
  normal: ":large_blue_circle:",
  low: ":white_circle:",
};

const PROOF_PATH_PREFERENCE_LABELS: Record<ProofPathPreference, string> = {
  exact_site_required: "Exact-site proof required",
  adjacent_site_acceptable: "Adjacent-site proof is acceptable",
  need_guidance: "Need guidance on the proof path",
};

/**
 * Send a Slack notification for a new inbound request
 */
export async function notifySlackInboundRequest(
  options: SlackNotifyOptions
): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl = process.env.SLACK_INBOUND_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn(
      "SLACK_INBOUND_WEBHOOK_URL not configured; skipping Slack notification"
    );
    return { sent: false };
  }

  const {
    requestId,
    siteSubmissionId,
    firstName,
    lastName,
    email,
    company,
    roleTitle,
    buyerType,
    siteName,
    siteLocation,
    taskStatement,
    targetSiteType,
    proofPathPreference,
    existingStackReviewWorkflow,
    humanGateTopics,
    budgetBucket,
    requestedLanes,
    helpWith,
    details,
    priority,
    sourcePageUrl,
  } = options;

  const helpWithLabels = helpWith
    .map((h) => HELP_WITH_LABELS[h] || h)
    .join(", ");
  const requestedLaneLabels = requestedLanes
    .map((lane) => REQUESTED_LANE_LABELS[lane] || lane)
    .join(", ");

  const priorityEmoji = PRIORITY_EMOJI[priority];
  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${requestId}`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${priorityEmoji} New Site Submission from ${company}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Name:*\n${firstName} ${lastName}`,
        },
        {
          type: "mrkdwn",
          text: `*Company:*\n${company}`,
        },
        {
          type: "mrkdwn",
          text: `*Email:*\n<mailto:${email}|${email}>`,
        },
        {
          type: "mrkdwn",
          text: `*Role:*\n${roleTitle || "Not specified"}`,
        },
        {
          type: "mrkdwn",
          text: `*Buyer Type:*\n${BUYER_TYPE_LABELS[buyerType]}`,
        },
        {
          type: "mrkdwn",
          text: `*Budget:*\n${budgetBucket}`,
        },
        {
          type: "mrkdwn",
          text: `*Priority:*\n${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Requested lanes:*\n${requestedLaneLabels}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Site:*\n${siteName}\n*Location:*\n${siteLocation}\n*Task:*\n${taskStatement}`,
      },
    },
  ];

  if (helpWithLabels) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Legacy taxonomy mirror:*\n${helpWithLabels}`,
      },
    });
  }

  // Add details section if provided
  if (details && details.trim()) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Additional Details:*\n${details.slice(0, 500)}${details.length > 500 ? "..." : ""}`,
      },
    });
  }

  // Add source page
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Source:* ${sourcePageUrl}`,
    },
  });

  if (targetSiteType || proofPathPreference || existingStackReviewWorkflow || humanGateTopics) {
    const proofLines = [
      targetSiteType ? `*Target site type:*\n${targetSiteType}` : null,
      proofPathPreference
        ? `*Proof path:*\n${PROOF_PATH_PREFERENCE_LABELS[proofPathPreference]}`
        : null,
      existingStackReviewWorkflow
        ? `*Existing stack / review workflow:*\n${existingStackReviewWorkflow.slice(0, 400)}`
        : null,
      humanGateTopics
        ? `*Human-gated topics:*\n${humanGateTopics.slice(0, 400)}`
        : null,
    ].filter(Boolean);

    if (proofLines.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: proofLines.join("\n\n"),
        },
      });
    }
  }

  // Add action buttons
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in Admin",
          emoji: true,
        },
        url: adminUrl,
        action_id: "view_admin",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Send Email",
          emoji: true,
        },
        url: `mailto:${email}?subject=Re: Your Blueprint Request`,
        action_id: "send_email",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Schedule Call",
          emoji: true,
        },
        url: "https://calendly.com/blueprintar/30min",
        action_id: "schedule_call",
      },
    ],
  });

  // Add context with request ID
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `_Submission ID: ${siteSubmissionId} · Request ID: ${requestId}_`,
    },
  });

  const payload = {
    blocks,
    text: `New site submission from ${firstName} ${lastName} at ${company}`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText, requestId },
        "Failed to send Slack notification"
      );
      return { sent: false, error: errorText };
    }

    logger.info({ requestId }, "Slack notification sent successfully");
    return { sent: true };
  } catch (error) {
    logger.error({ error, requestId }, "Error sending Slack notification");
    return { sent: false, error };
  }
}

/**
 * Send a simple Slack message to a webhook
 */
export async function sendSlackMessage(
  message: string,
  webhookUrl?: string
): Promise<{ sent: boolean; error?: unknown }> {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;

  if (!url) {
    logger.warn("Slack webhook URL not configured; skipping message");
    return { sent: false };
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
